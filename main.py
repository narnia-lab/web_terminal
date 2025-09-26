import base64
import io
import json
import asyncio
import os
import sys
import paramiko
import stat
import socket
import uvicorn
import webbrowser
import threading
import requests
import subprocess
from tkinter import messagebox, Tk

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# --- Application Version and Update Config ---
CURRENT_VERSION = "1.1.2"  # This should be updated for each new release
GITHUB_REPO = "narnia-lab/web_terminal" # IMPORTANT: Replace with your GitHub repo, e.g., "user/my-app"


def check_for_updates():
    """Checks GitHub for the latest release and prompts the user to update if available."""
    if GITHUB_REPO == "owner/repository":
        print("Warning: GITHUB_REPO is not configured. Skipping update check.")
        return

    try:
        api_url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
        response = requests.get(api_url, timeout=5)
        response.raise_for_status()
        latest_release = response.json()
        latest_version = latest_release["tag_name"].lstrip('v')

        if latest_version > CURRENT_VERSION:
            root = Tk()
            root.withdraw()  # Hide the main window
            message = (
                f"A new version ({latest_version}) is available.\n"
                f"You are currently running version {CURRENT_VERSION}.\n\n"
                "Would you like to update now?"
            )
            if messagebox.askyesno("Update Available", message):
                asset = next((a for a in latest_release["assets"] if a["name"].endswith(".exe")), None)
                if not asset:
                    messagebox.showerror("Update Error", "Could not find the executable in the latest release.")
                    return

                download_url = asset["browser_download_url"]
                new_exe_path = os.path.join(os.path.dirname(sys.executable), "narnia_web_terminal_new.exe")
                
                # Download the new version
                print(f"Downloading {download_url}...")
                with requests.get(download_url, stream=True) as r:
                    r.raise_for_status()
                    with open(new_exe_path, 'wb') as f:
                        for chunk in r.iter_content(chunk_size=8192):
                            f.write(chunk)
                print("Download complete.")

                # Launch the updater script and exit
                updater_path = os.path.join(os.path.dirname(sys.executable), "updater.bat")
                subprocess.Popen([updater_path, sys.executable, new_exe_path])
                sys.exit(0)
            root.destroy()

    except Exception as e:
        print(f"Failed to check for updates: {e}")



# PyInstaller에 의해 생성된 임시 경로 확인
if getattr(sys, 'frozen', False):
    base_dir = sys._MEIPASS
else:
    base_dir = os.path.dirname(os.path.abspath(__file__))

static_path = os.path.join(base_dir, "static")

# --- 접속할 서버 정보 (고정) ---
FIXED_HOST = "narnia-lab.duckdns.org"
FIXED_PORT = 1225

app = FastAPI()

# 'static' 디렉토리를 정적 파일 경로로 마운트
app.mount("/static", StaticFiles(directory=static_path), name="static")


@app.get("/api/version")
async def get_version():
    """Returns the current application version."""
    return {"version": CURRENT_VERSION}


@app.get("/")
async def read_root():
    """루트 URL 접속 시 index.html 파일을 반환합니다."""
    return FileResponse(os.path.join(static_path, 'index.html'))


@app.get("/logo.png")
async def logo():
    return FileResponse(os.path.join(base_dir, 'logo.png'))


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """웹소켓 연결 및 전체 세션을 처리합니다."""
    await websocket.accept()
    ssh_client = None
    channel = None
    sftp = None
    forward_task = None

    try:
        # --- 인증 루프 ---
        while True:
            try:
                # 1. 클라이언트로부터 사용자 이름 받기
                auth_message = await websocket.receive_text()
                auth_data = json.loads(auth_message)
                if not (auth_data.get("type") == "auth" and "username" in auth_data):
                    continue
                username = auth_data["username"]
                await websocket.send_text("Password: ")

                # 2. 클라이언트로부터 비밀번호 받기
                password_message = await websocket.receive_text()
                password_data = json.loads(password_message)
                if not (password_data.get("type") == "auth" and "password" in password_data):
                    continue
                password = password_data["password"]

                # 3. SSH 연결 시도
                ssh_client = paramiko.SSHClient()
                ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                await asyncio.to_thread(
                    ssh_client.connect,
                    hostname=FIXED_HOST, port=FIXED_PORT,
                    username=username, password=password,
                )
                # 4. 인증 성공 시 루프 탈출
                break

            except paramiko.AuthenticationException:
                await websocket.send_text("Authentication failed. Please try again.\r\n")
                continue # 루프의 처음으로 돌아가 재시도 대기
            except (json.JSONDecodeError, AttributeError):
                # 인증 중 잘못된 형식의 메시지 수신 시, 다음 시도를 위해 계속 진행
                continue

        # --- 인증 성공 후 처리 ---
        channel = await asyncio.to_thread(ssh_client.invoke_shell, term='xterm')
        sftp = await asyncio.to_thread(ssh_client.open_sftp)
        initial_path = await asyncio.to_thread(sftp.normalize, '.')

        # MOTD(오늘의 메시지)를 비활성화하기 위해 .hushlogin 파일을 non-interactive 세션에서 생성
        try:
            # exec_command는 별도의 세션에서 명령을 실행하므로 사용자 터미널에 보이지 않음
            await asyncio.to_thread(ssh_client.exec_command, 'touch ~/.hushlogin')
        except Exception as e:
            # 파일 생성에 실패하더라도 연결은 계속 진행
            print(f"Warning: Could not create .hushlogin file via exec_command: {e}")

        await websocket.send_text(json.dumps({
            "type": "auth_success",
            "message": "\r\n",
            "initial_path": initial_path
        }))

        async def forward_ssh_to_ws():
            try:
                while not channel.closed:
                    if channel.recv_ready():
                        data = channel.recv(1024)
                        if data:
                            await websocket.send_text(data.decode('utf-8', 'ignore'))
                    await asyncio.sleep(0.01)
            except:
                pass

        forward_task = asyncio.create_task(forward_ssh_to_ws())

        # --- 메인 메시지 루프 (클라이언트 -> 서버) ---
        while True:
            message_str = await websocket.receive_text()
            if channel and not channel.closed:
                try:
                    message_data = json.loads(message_str)
                    if isinstance(message_data, dict):
                        msg_type = message_data.get("type")

                        if msg_type == "resize":
                            cols = message_data.get("cols")
                            rows = message_data.get("rows")
                            if cols and rows:
                                channel.resize_pty(width=cols, height=rows)

                        elif msg_type == "list_files":
                            path = message_data.get("path", ".")
                            try:
                                attrs = await asyncio.to_thread(sftp.listdir_attr, path)
                                files = []
                                for attr in sorted(attrs, key=lambda a: a.filename):
                                    if attr.filename.startswith('.'):
                                        continue
                                    is_dir = stat.S_ISDIR(attr.st_mode)
                                    files.append({
                                        "name": attr.filename,
                                        "type": "dir" if is_dir else "file",
                                        "longname": str(attr)
                                    })
                                await websocket.send_text(json.dumps({
                                    "type": "list_files_response",
                                    "path": path,
                                    "files": files
                                }))
                            except Exception as e:
                                await websocket.send_text(json.dumps({
                                    "type": "list_files_response",
                                    "error": str(e)
                                }))

                        elif msg_type == "download":
                            path = message_data.get("path")
                            if path and sftp:
                                try:
                                    filename = os.path.basename(path)
                                    with sftp.open(path, 'rb') as f:
                                        file_data = await asyncio.to_thread(f.read)
                                    data_b64 = base64.b64encode(file_data).decode('utf-8')
                                    await websocket.send_text(json.dumps({
                                        "type": "download_response",
                                        "filename": filename,
                                        "data": data_b64
                                    }))
                                except FileNotFoundError:
                                    await websocket.send_text(json.dumps({
                                        "type": "download_response",
                                        "error": f"File not found: {path}"
                                    }))
                                except Exception as e:
                                    await websocket.send_text(json.dumps({
                                        "type": "download_response",
                                        "error": f"Failed to download file: {e}"
                                    }))
                                channel.send('\n')

                        elif msg_type == "upload":
                            path = message_data.get("path")
                            data_b64 = message_data.get("data")
                            if path and data_b64 and sftp:
                                try:
                                    file_data = base64.b64decode(data_b64)
                                    await asyncio.to_thread(sftp.putfo, fl=io.BytesIO(file_data), remotepath=path)
                                    await websocket.send_text(f"\r\n[File uploaded successfully to {path}]\r\n")
                                    channel.send('\n')
                                except Exception as e:
                                    await websocket.send_text(f"\r\n[File upload failed: {e}]\r\n")
                                    channel.send('\n')
                        else:
                            print(f"Warning: Received unknown JSON message type post-login: {message_str}")
                    else:
                        channel.send(message_str)
                except json.JSONDecodeError:
                    channel.send(message_str)

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"An error occurred: {e}")
        try:
            await websocket.send_text(f"\r\nAn error occurred: {e}\r\n")
        except:
            pass
    finally:
        if forward_task:
            forward_task.cancel()
        if sftp:
            sftp.close()
        if channel:
            channel.close()
        if ssh_client:
            ssh_client.close()
        print("Connection closed.")


def find_free_port(host="127.0.0.1", start_port=8001):
    """Find an available TCP port."""
    for port in range(start_port, 65535):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, port))
                return port
            except OSError:
                continue
    raise IOError("No free ports found")


if __name__ == "__main__":
    # When running as an executable, this check will run first.
    if getattr(sys, 'frozen', False):
        check_for_updates()

    host = "127.0.0.1"
    try:
        port = find_free_port(host)
        url = f"http://{host}:{port}"
        print("="*50)
        print("웹 터미널 서버가 시작되었습니다.")
        print("아래 주소를 클릭하여 웹 브라우저에서 접속하세요:")
        print(url)
        print("="*50)
        threading.Timer(1, lambda: webbrowser.open(url)).start()
        
        # --windowed 모드에서 로깅 오류를 방지하기 위한 설정
        log_config = None
        if getattr(sys, 'frozen', False) and sys.stdout is None:
            log_config = {
                "version": 1,
                "disable_existing_loggers": True,
                "formatters": {
                    "default": {
                        "()": "uvicorn.logging.DefaultFormatter",
                        "fmt": "%(levelprefix)s %(message)s",
                        "use_colors": False,
                    },
                    "access": {
                        "()": "uvicorn.logging.AccessFormatter",
                        "fmt": '%(levelprefix)s %(client_addr)s - "%(request_line)s" %(status_code)s',
                        "use_colors": False,
                    },
                },
                "handlers": {
                    "default": {
                        "formatter": "default",
                        "class": "logging.NullHandler",
                    },
                    "access": {
                        "formatter": "access",
                        "class": "logging.NullHandler",
                    },
                },
                "loggers": {
                    "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
                    "uvicorn.error": {"level": "INFO", "propagate": False},
                    "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": False},
                },
            }

        uvicorn.run(app, host=host, port=port, log_config=log_config)
    except IOError as e:
        print(f"Error: {e}")
