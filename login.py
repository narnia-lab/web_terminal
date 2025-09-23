import subprocess
import os

# --- 접속할 서버 정보 (고정) ---
FIXED_HOST = "narnia-lab.duckdns.org"
FIXED_PORT = 1225

def main():
    """
    사용자에게 아이디를 입력받아 SSH 접속을 실행하는 메인 함수.
    """
    try:
        # 1. 게임처럼 화면을 꾸미기 위해 기존 터미널 내용을 지웁니다.
        os.system('cls' if os.name == 'nt' else 'clear')

        # 2. 접속할 서버 정보를 보여줍니다.
        print("=" * 40)
        print(f"Connecting to: {FIXED_HOST}")
        print("=" * 40)
        print()

        # 3. 사용자 이름(로그인 계정)을 입력받습니다.
        username = input("Enter your username: ")

        if not username:
            print("Username cannot be empty.")
            return

        # 4. Windows에 내장된 ssh.exe를 실행합니다.
        #    - 사용자 이름, 호스트, 포트 정보를 전달합니다.
        #    - 비밀번호는 ssh.exe가 직접 안전하게 물어보도록 합니다.
        print(f"\nAttempting to connect as {username}...")
        subprocess.run([
            "ssh",
            f"{username}@{FIXED_HOST}",
            "-p",
            str(FIXED_PORT)
        ])

    except KeyboardInterrupt:
        print("\n\nConnection cancelled by user. Goodbye!")
    except Exception as e:
        print(f"\nAn error occurred: {e}")

if __name__ == "__main__":
    main()
