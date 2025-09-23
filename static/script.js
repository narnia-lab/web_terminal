// Xterm.js 터미널 인스턴스 생성 및 FitAddon 적용
const term = new Terminal({
    fontFamily: "Consolas, 'Courier New', monospace",
    cursorBlink: true,
    theme: {
        background: '#000000',
        foreground: '#d1d1d1',
        cursor: '#d1d1d1',
        selection: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#d1d1d1',
        brightBlack: '#545454',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#e5c07b',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff'
    }
});
const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);

// 터미널을 #terminal div에 마운트하고 화면 크기에 맞춤
term.open(document.getElementById('terminal'));
window.addEventListener('resize', () => fitAddon.fit());

// 터미널 크기 변경 시 백엔드에 알림
term.onResize(({ cols, rows }) => {
    if (ws.readyState === WebSocket.OPEN && state === 'connected') {
        ws.send(JSON.stringify({ type: 'resize', cols: cols, rows: rows }));
    }
});

// 웹소켓 연결 설정
const protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
const ws = new WebSocket(`${protocol}${location.host}/ws`);

// 터미널 초기화 및 사용자 이름 입력 프롬프트
term.writeln('Welcome to Narnia Web Terminal!');
term.writeln('================================');
term.write('Enter your username: ');

let username = '';
let password = '';
let inputBuffer = '';
let state = 'username'; // 상태: 'username', 'password', 'connected'

// 웹소켓 연결이 성공했을 때
ws.onopen = () => {
    console.log('WebSocket connection established.');
    fitAddon.fit(); // 연결 후 터미널 크기 맞춤
};

// 웹소켓으로부터 메시지를 받았을 때 (백엔드 -> 프론트엔드)
ws.onmessage = (event) => {
    // 비밀번호 프롬프트가 오면 상태 변경
    if (state !== 'connected' && event.data.includes('Password:')) {
        state = 'password';
    }
    term.write(event.data);
};

// 웹소켓 연결이 닫혔을 때
ws.onclose = () => {
    uploadBtn.disabled = true; // 업로드 버튼 비활성화
    term.writeln('\r\n\r\n[Connection closed]');
};

// 웹소켓 에러 발생 시
ws.onerror = (error) => {
    console.error('WebSocket Error:', error);
    term.writeln('\r\n\r\n[An error occurred with the connection]');
};

// 터미널에서 사용자가 키를 입력했을 때 (프론트엔드 -> 백엔드)
term.onData(data => {
    if (ws.readyState !== WebSocket.OPEN) return;

    switch (state) {
        case 'username':
            // Enter 키 처리
            if (data === '\r') {
                username = inputBuffer;
                if (username) {
                    term.writeln('');
                    // 사용자 이름을 JSON으로 백엔드에 전송
                    ws.send(JSON.stringify({ type: 'auth', username: username }));
                    inputBuffer = '';
                    state = 'password'; // 다음 상태는 비밀번호 입력
                } else {
                    term.writeln('\r\nUsername cannot be empty.');
                    term.write('Enter your username: ');
                    inputBuffer = '';
                }
                return;
            }
            // Backspace 키 처리
            if (data === '\x7f') {
                if (inputBuffer.length > 0) {
                    inputBuffer = inputBuffer.slice(0, -1);
                    term.write('\b \b');
                }
                return;
            }
            // 일반 문자 입력
            inputBuffer += data;
            term.write(data);
            break;

        case 'password':
            // Enter 키 처리
            if (data === '\r') {
                password = inputBuffer;
                term.writeln('');
                // 비밀번호를 JSON으로 백엔드에 전송
                ws.send(JSON.stringify({ type: 'auth', password: password }));
                inputBuffer = '';
                state = 'connected'; // 연결 상태로 변경
                uploadBtn.disabled = false; // 업로드 버튼 활성화

                // 연결 직후, 현재 터미널 크기를 백엔드에 전송
                ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
                return;
            }
            // Backspace 키 처리
            if (data === '\x7f') {
                if (inputBuffer.length > 0) {
                    inputBuffer = inputBuffer.slice(0, -1);
                    // 비밀번호는 화면에 보이지 않으므로 커서만 이동
                }
                return;
            }
            // 일반 문자 입력 (화면에 '*' 표시)
            inputBuffer += data;
            term.write('*');
            break;

        case 'connected':
            // 연결된 후에는 모든 입력을 서버로 전송
            ws.send(data);
            break;
    }
});

// --- 파일 업로드 로직 ---
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');

uploadBtn.addEventListener('click', () => {
    // 연결된 상태에서만 업로드 버튼 활성화
    if (state !== 'connected') {
        term.writeln('\r\n[Please connect to the server before uploading files.]');
        return;
    }
    fileInput.click(); // 숨겨진 파일 입력창 클릭
});

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const destinationPath = prompt(`Enter the destination path for "${file.name}" on the server:`, `/home/${username}/${file.name}`);
    if (!destinationPath) {
        term.writeln('\r\n[Upload cancelled.]');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        term.writeln(`\r\n[Uploading ${file.name} to ${destinationPath}...]`);
        
        // e.target.result는 "data:;base64,xxxxx" 형태이므로, 콤마 뒤의 base64 데이터만 추출
        const base64Data = e.target.result.split(',', 2)[1];

        ws.send(JSON.stringify({
            type: 'upload',
            path: destinationPath,
            data: base64Data
        }));
    };

    reader.onerror = () => {
        term.writeln(`\r\n[Error reading file: ${file.name}]`);
    };

    reader.readAsDataURL(file);

    // 다음에 같은 파일을 다시 선택할 수 있도록 입력값 초기화
    fileInput.value = '';
});
