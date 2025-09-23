from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import asyncio
import paramiko
import json

# --- 접속할 서버 정보 (고정) ---
FIXED_HOST = "narnia-lab.duckdns.org"
FIXED_PORT = 1225

app = FastAPI()

# 'static' 디렉토리를 정적 파일 경로로 마운트
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_root():
    """루트 URL 접속 시 index.html 파일을 반환합니다."""
    return FileResponse('static/index.html')

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """웹소켓 연결을 처리하고 SSH 세션을 중계합니다."""
    await websocket.accept()
    ssh_client = None
    channel = None

    try:
        # 1. 프론트엔드로부터 사용자 이름 받기
        auth_message = await websocket.receive_text()
        auth_data = json.loads(auth_message)
        if auth_data.get("type") == "auth" and "username" in auth_data:
            username = auth_data["username"]
            await websocket.send_text(f"Connecting as {username}...\r\n")
            await websocket.send_text("Password: ") # 프론트엔드에 비밀번호 프롬프트 전송
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
            password=password, # 이제 비밀번호를 전달합니다.
            # look_for_keys=False, # 기본값 사용
            # allow_agent=False    # 기본값 사용
        )

        # 5. 대화형 쉘(channel) 열기
        channel = await asyncio.to_thread(ssh_client.invoke_shell)
        await websocket.send_text("Connection successful!\r\n\r\n")

        # 5. SSH 서버 -> 클라이언트 데이터 전송 루프
        async def forward_ssh_to_ws():
            try:
                while not channel.closed:
                    # SSH 채널에서 데이터 수신 대기
                    if channel.recv_ready():
                        data = channel.recv(1024)
                        if data:
                            await websocket.send_text(data.decode('utf-8', 'ignore'))
                    await asyncio.sleep(0.01)
            except Exception:
                await websocket.close()

        forward_task = asyncio.create_task(forward_ssh_to_ws())

        # 6. 클라이언트 -> SSH 서버 데이터 전송 루프
        while True:
            message_str = await websocket.receive_text()
            if channel and not channel.closed:
                try:
                    # 메시지를 JSON으로 파싱 시도
                    message_data = json.loads(message_str)
                    msg_type = message_data.get("type")

                    if msg_type == "resize":
                        # 터미널 크기 조절
                        cols = message_data.get("cols")
                        rows = message_data.get("rows")
                        if cols and rows:
                            channel.resize_pty(width=cols, height=rows)
                except json.JSONDecodeError:
                    # JSON이 아닌 일반 텍스트 데이터(사용자 입력) 처리
                    channel.send(message_str)

    except WebSocketDisconnect:
        print("Client disconnected")
    except paramiko.AuthenticationException:
        await websocket.send_text("\r\nAuthentication failed. Please check your username and password.\r\n")
    except Exception as e:
        print(f"An error occurred: {e}")
        try:
            await websocket.send_text(f"\r\nAn error occurred: {e}\r\n")
        except:
            pass # Websocket might be closed already
    finally:
        if channel:
            channel.close()
        if ssh_client:
            ssh_client.close()
        if not 'forward_task' in locals() or forward_task.done():
            pass
        else:
            forward_task.cancel()
        print("Connection closed.")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
