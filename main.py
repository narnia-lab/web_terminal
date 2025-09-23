import base64
import io
import json
import asyncio
import os
import sys
import paramiko
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# PyInstaller에 의해 생성된 임시 경로 확인
if getattr(sys, 'frozen', False):
    # PyInstaller로 빌드된 경우
    base_dir = sys._MEIPASS
else:
    # 일반 Python 환경에서 실행된 경우
    base_dir = os.path.dirname(os.path.abspath(__file__))

static_path = os.path.join(base_dir, "static")

# --- 접속할 서버 정보 (고정) ---
FIXED_HOST = "narnia-lab.duckdns.org"
FIXED_PORT = 1225

app = FastAPI()

# 'static' 디렉토리를 정적 파일 경로로 마운트
app.mount("/static", StaticFiles(directory=static_path), name="static")


@app.get("/")
async def read_root():
    """루트 URL 접속 시 index.html 파일을 반환합니다."""
    return FileResponse(os.path.join(static_path, 'index.html'))


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """웹소켓 연결을 처리하고 SSH 세션을 중계합니다."""
    await websocket.accept()
    ssh_client = None
    channel = None
    sftp = None

    try:
        # 1. 프론트엔드로부터 사용자 이름 받기
        auth_message = await websocket.receive_text()
        auth_data = json.loads(auth_message)
        if auth_data.get("type") == "auth" and "username" in auth_data:
            username = auth_data["username"]
            await websocket.send_text(f"Connecting as {username}...\r\n")
            await websocket.send_text("Password: ")  # 프론트엔드에 비밀번호 프롬프트 전송
        else:
            await websocket.send_text("\r\nInvalid authentication message.\r\n")
            await websocket.close()
            return

        # 2. 프론트엔드로부터 비밀번호 받기
        password_message = await websocket.receive_text()
        password_data = json.loads(password_message)
        if password_data.get("type") == "auth" and "password" in password_data:
            password = password_data["password"]
        else:
            await websocket.send_text("\r\nInvalid password message.\r\n")
            await websocket.close()
            return

        # 3. Paramiko SSH 클라이언트 설정
        ssh_client = paramiko.SSHClient()
        ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        # 4. SSH 연결 시도 (username과 password 사용)
        await asyncio.to_thread(
            ssh_client.connect,
            hostname=FIXED_HOST,
            port=FIXED_PORT,
            username=username,
            password=password,
        )

        # 5. 대화형 쉘(channel) 및 SFTP 클라이언트 열기
        channel = await asyncio.to_thread(ssh_client.invoke_shell)
        sftp = await asyncio.to_thread(ssh_client.open_sftp)
        await websocket.send_text("Connection successful!\r\n\r\n")

        # SSH 서버 -> 클라이언트 데이터 전송 루프
        async def forward_ssh_to_ws():
            try:
                while not channel.closed:
                    if channel.recv_ready():
                        data = channel.recv(1024)
                        if data:
                            await websocket.send_text(data.decode('utf-8', 'ignore'))
                    await asyncio.sleep(0.01)
            except Exception:
                await websocket.close()

        forward_task = asyncio.create_task(forward_ssh_to_ws())

        # 클라이언트 -> SSH 서버 데이터 전송 루프
        while True:
            message_str = await websocket.receive_text()
            if channel and not channel.closed:
                try:
                    # 메시지를 JSON으로 파싱 시도
                    message_data = json.loads(message_str)

                    if isinstance(message_data, dict):
                        msg_type = message_data.get("type")

                        if msg_type == "resize":
                            cols = message_data.get("cols")
                            rows = message_data.get("rows")
                            if cols and rows:
                                channel.resize_pty(width=cols, height=rows)

                        elif msg_type == "upload":
                            path = message_data.get("path")
                            data_b64 = message_data.get("data")
                            if path and data_b64 and sftp:
                                try:
                                    file_data = base64.b64decode(data_b64)
                                    # sftp.putfo는 동기 함수이므로 to_thread 사용
                                    await asyncio.to_thread(sftp.putfo, fl=io.BytesIO(file_data), remotepath=path)
                                    await websocket.send_text(f"\r\n[File uploaded successfully to {path}]\r\n")
                                    channel.send('\n')
                                except Exception as e:
                                    await websocket.send_text(f"\r\n[File upload failed: {e}]\r\n")

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

                        else:
                            # 'type'이 없거나 알 수 없는 JSON 메시지는 일반 입력으로 처리
                            channel.send(message_str)
                    else:
                        # JSON이 딕셔너리가 아닌 경우 (예: 숫자, 문자열) 일반 입력으로 처리
                        channel.send(message_str)

                except json.JSONDecodeError:
                    # JSON 파싱 실패 시 일반 텍스트 데이터(사용자 입력) 처리
                    channel.send(message_str)

    except WebSocketDisconnect:
        print("Client disconnected")
    except paramiko.AuthenticationException:
        try:
            await websocket.send_text("\r\nAuthentication failed. Please check your username and password.\r\n")
        except WebSocketDisconnect:
            print("Client disconnected before authentication failure could be sent.")
    except Exception as e:
        print(f"An error occurred: {e}")
        try:
            await websocket.send_text(f"\r\nAn error occurred: {e}\r\n")
        except:
            pass  # Websocket might be closed already
    finally:
        if sftp:
            sftp.close()
        if channel:
            channel.close()
        if ssh_client:
            ssh_client.close()
        if 'forward_task' in locals() and not forward_task.done():
            forward_task.cancel()
        print("Connection closed.")


if __name__ == "__main__":
    print("="*50)
    print("웹 터미널 서버가 시작되었습니다.")
    print("아래 주소를 클릭하여 웹 브라우저에서 접속하세요:")
    print("http://127.0.0.1:8001")
    print("="*50)
    uvicorn.run(app, host="127.0.0.1", port=8001)

