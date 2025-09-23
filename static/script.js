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
    try {
        const message_data = JSON.parse(event.data);

        if (message_data.type === 'auth_success') {
            state = 'connected';
            uploadBtn.disabled = false;
            downloadBtn.disabled = false;
            term.write(message_data.message);
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
            return;
        } else if (message_data.type === 'download_response') {
            if (message_data.error) {
                term.writeln(`\r\n[Download failed: ${message_data.error}]`);
            } else {
                triggerDownload(message_data.filename, message_data.data);
                term.writeln(`\r\n[File \"${message_data.filename}\" downloaded successfully.]`);
            }
            return;
        } else if (message_data.type === 'list_files_response') {
            if (message_data.error) {
                fileList.innerHTML = `<li>Error: ${message_data.error}</li>`;
            } else {
                renderFileList(message_data.path, message_data.files);
            }
            return;
        }
    } catch (e) {
        // JSON 파싱 실패 시, 아래의 일반 텍스트 처리 로직으로 넘어갑니다.
    }

    // 일반 텍스트 데이터 처리
    if (state !== 'connected' && event.data.includes('Password:')) {
        state = 'password';
    }
    term.write(event.data);
};

// 웹소켓 연결이 닫혔을 때
ws.onclose = () => {
    uploadBtn.disabled = true; // 업로드 버튼 비활성화
    downloadBtn.disabled = true; // 다운로드 버튼 비활성화
    closeModal(); // 모달이 열려있으면 닫기
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
                    // 서버가 "Password:" 프롬프트를 보내주면 onmessage 핸들러가 state를 변경할 것임
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
                // DO NOT change state or enable buttons here. Wait for server confirmation.
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

// --- 파일 탐색기 및 업로드/다운로드 로직 ---
const uploadBtn = document.getElementById('upload-btn');
const downloadBtn = document.getElementById('download-btn');
const fileInput = document.getElementById('file-input');
const modal = document.getElementById('file-explorer-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const fileList = document.getElementById('file-list');
const currentPathSpan = document.getElementById('current-path');
const modalFooter = document.querySelector('.modal-footer');
const filenameInput = document.getElementById('modal-filename-input');
const confirmBtn = document.getElementById('modal-confirm-btn');

let modalMode = 'download'; // 'download' or 'upload'
let fileToUpload = null;

// 터미널 프롬프트에서 현재 경로를 파싱
function findPwdInTerminal() {
    // user@host:~/path$ 또는 root@host:/path# 같은 형식의 프롬프트에서 경로를 찾음
    const promptRegex = /:([^$#\s]+)\s*[$#]\s*$/;

    for (let i = term.buffer.active.cursorY; i >= 0; i--) {
        const line = term.buffer.active.getLine(i).translateToString();
        const match = line.match(promptRegex);
        if (match && match[1]) {
            let path = match[1];
            // '~'를 사용자의 홈 디렉토리로 치환
            if (path.startsWith('~')) {
                path = path.replace('~', `/home/${username}`);
            }
            return path;
        }
    }
    return null; // 경로를 찾지 못한 경우
}

// 모달 닫기
function closeModal() {
    modal.classList.add('modal-hidden');
}

// 모달 열기
function openModal(mode, options = {}) {
    modalMode = mode;
    if (modalMode === 'upload') {
        modalFooter.style.display = 'flex';
        filenameInput.value = options.filename || '';
    } else {
        modalFooter.style.display = 'none';
    }
    modal.classList.remove('modal-hidden');
}

// 파일 목록 렌더링
function renderFileList(path, files) {
    currentPathSpan.textContent = path;
    fileList.innerHTML = ''; // 목록 초기화

    // 상위 디렉토리('..') 추가
    if (path !== '/') {
        const parentLi = document.createElement('li');
        parentLi.textContent = '..';
        parentLi.dataset.type = 'dir';
        parentLi.addEventListener('click', () => {
            const parentPath = path.replace(/\/?[^\/]+\/?$/, '') || '/';
            fetchAndRenderFiles(parentPath);
        });
        fileList.appendChild(parentLi);
    }

    files.forEach(file => {
        const li = document.createElement('li');
        li.textContent = file.name;
        li.dataset.type = file.type;
        
        const fullPath = (path.endsWith('/') ? path : path + '/') + file.name;

        if (file.type === 'dir') {
            li.addEventListener('click', () => fetchAndRenderFiles(fullPath));
        } else {
            li.addEventListener('click', () => {
                if (modalMode === 'download') {
                    term.writeln(`\r\n[Requesting download for ${fullPath}...]`);
                    ws.send(JSON.stringify({ type: 'download', path: fullPath }));
                    closeModal();
                } else if (modalMode === 'upload') {
                    // 업로드 모드에서 파일을 클릭하면 파일명 입력창에 해당 파일명을 채워넣음
                    filenameInput.value = file.name;
                }
            });
        }
        fileList.appendChild(li);
    });
}

// 서버에 파일 목록 요청
function fetchAndRenderFiles(path) {
    if (ws.readyState === WebSocket.OPEN) {
        fileList.innerHTML = '<li>Loading...</li>';
        ws.send(JSON.stringify({ type: 'list_files', path: path }));
    }
}

// Base64 데이터를 Blob으로 변환 후 다운로드 실행
function triggerDownload(filename, base64Data) {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/octet-stream' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

// --- 이벤트 리스너 설정 ---
closeModalBtn.addEventListener('click', closeModal);

// 모달의 Confirm 버튼 클릭 (업로드 실행)
confirmBtn.addEventListener('click', () => {
    if (!fileToUpload) {
        term.writeln('\r\n[Upload error: No file selected.]');
        return;
    }

    const currentDir = currentPathSpan.textContent;
    const finalName = filenameInput.value;
    if (!finalName) {
        term.writeln('\r\n[Upload error: Filename cannot be empty.]');
        return;
    }

    const destinationPath = (currentDir.endsWith('/') ? currentDir : currentDir + '/') + finalName;

    const reader = new FileReader();
    reader.onload = (e) => {
        term.writeln(`\r\n[Uploading ${fileToUpload.name} to ${destinationPath}...]`);
        const base64Data = e.target.result.split(',', 2)[1];
        ws.send(JSON.stringify({
            type: 'upload',
            path: destinationPath,
            data: base64Data
        }));
        // Cleanup after sending
        closeModal();
        fileToUpload = null;
        fileInput.value = '';
    };
    reader.onerror = () => {
        term.writeln(`\r\n[Error reading file: ${fileToUpload.name}]`);
        // Cleanup on error too
        closeModal();
        fileToUpload = null;
        fileInput.value = '';
    };
    
    reader.readAsDataURL(fileToUpload);
});

uploadBtn.addEventListener('click', () => {
    if (state !== 'connected') {
        term.writeln('\r\n[Please connect to the server before uploading files.]');
        return;
    }
    fileInput.click();
});

downloadBtn.addEventListener('click', () => {
    if (state !== 'connected') {
        term.writeln('\r\n[Please connect to the server before downloading files.]');
        return;
    }
    const pwd = findPwdInTerminal();
    openModal('download');
    fetchAndRenderFiles(pwd || `/home/${username}`);
});

fileInput.addEventListener('change', (event) => {
    fileToUpload = event.target.files[0];
    if (!fileToUpload) {
        return;
    }

    const pwd = findPwdInTerminal();
    openModal('upload', { filename: fileToUpload.name });
    fetchAndRenderFiles(pwd || `/home/${username}`);
});
