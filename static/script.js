// --- tsParticles Initialization ---
tsParticles.load("tsparticles", {
    background: { color: { value: 'transparent' } },
    fpsLimit: 60,
    interactivity: {
        events: { onHover: { enable: true, mode: "repulse" }, resize: true },
        modes: { repulse: { distance: 100, duration: 0.4 } }
    },
    particles: {
        color: { value: "#ffffff" },
        links: { color: "#ffffff", distance: 150, enable: true, opacity: 0.1, width: 1 },
        move: { direction: "none", enable: true, outModes: { default: "bounce" }, random: false, speed: 1, straight: false },
        number: { density: { enable: true, area: 800 }, value: 80 },
        opacity: { value: 0.2 },
        shape: { type: "circle" },
        size: { value: { min: 1, max: 3 } }
    },
    detectRetina: true,
});

// --- Xterm.js Terminal Initialization ---
const term = new Terminal({
    fontFamily: "Consolas, 'Courier New', monospace",
    cursorBlink: true,
    theme: {
        background: 'transparent',
        foreground: '#FFFFFF',
        cursor: '#FFFFFF',
        selectionBackground: 'rgba(0, 210, 255, 0.3)',
        black: '#0a0c1c',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#00D2FF', // Accent Color 2
        white: '#FFFFFF',
        brightBlack: '#545454',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#e5c07b',
        brightBlue: '#61afef',
        brightMagenta: '#A044FF', // Accent Color 1
        brightCyan: '#00D2FF',
        brightWhite: '#FFFFFF'
    },
    allowTransparency: true,
    applicationCursorKeys: false
});
const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);

// Mount terminal and fit to screen
term.open(document.getElementById('terminal'));
window.addEventListener('resize', () => fitAddon.fit());

// Notify backend on terminal resize
term.onResize(({ cols, rows }) => {
    if (ws.readyState === WebSocket.OPEN && state === 'connected') {
        ws.send(JSON.stringify({ type: 'resize', cols: cols, rows: rows }));
    }
});

// --- WebSocket Connection ---
const protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
const ws = new WebSocket(`${protocol}${location.host}/ws`);

// --- DOM Elements ---
const loginModal = document.getElementById('login-modal');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const loginErrorMsg = document.getElementById('login-error-msg');

const uploadBtn = document.getElementById('upload-btn');
const downloadBtn = document.getElementById('download-btn');
const fileInput = document.getElementById('file-input');

const fileExplorerModal = document.getElementById('file-explorer-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const fileList = document.getElementById('file-list');
const currentPathSpan = document.getElementById('current-path');
const modalFooter = document.querySelector('.modal-footer');
const filenameInput = document.getElementById('modal-filename-input');
const confirmBtn = document.getElementById('modal-confirm-btn');

// --- State Management ---
let state = 'authenticating'; // 'authenticating', 'connected'
let isPasswordInput = false;
let username = '';
let password = '';
let modalMode = 'download'; // 'download' or 'upload'
let fileToUpload = null;
let initialRemotePath = ''; // 사용자 초기 경로 저장
let currentRemotePath = '';

// --- Welcome Message ---
const welcomeTips =
`\x1b[1;36mWelcome to Narnia Web Terminal!\x1b[0m\r\n\r\n` +
`\x1b[1m시작 팁:\x1b[0m\r\n` +
`1. 다음 명령어로 서버를 탐색하세요:\r\n` +
`   - \x1b[32mls\x1b[0m: 파일 및 디렉토리 목록 보기\r\n` +
`   - \x1b[32mmkdir [디렉토리]\x1b[0m: 디렉토리 생성\r\n` +
`   - \x1b[32mcd [디렉토리]\x1b[0m: 디렉토리로 이동\r\n` +
`   - \x1b[32mcd ..\x1b[0m: 상위 디렉토리로 이동\r\n` +
`   - \x1b[32mpwd\x1b[0m: 현재 디렉토리 경로 보기\r\n` +
`   - \x1b[31mCtrl+C\x1b[0m: 현재 실행중인 명령어 중단\r\n` +
`2. 작업을 원하는 위치로 이동 후 '\x1b[1;36mnarnia\x1b[0m'를 입력하면 AI가 실행됩니다.\r\n` +
`3. 터미널 내에서 \x1b[33mCtrl+Shift+C\x1b[0m (복사) 와 \x1b[33mCtrl+Shift+V\x1b[0m (붙여넣기) 를 사용하세요.\r\n` +
`4. '\x1b[35mUpload\x1b[0m' 와 '\x1b[35mDownload\x1b[0m' 버튼으로 파일을 전송할 수 있습니다.`;

// --- WebSocket Handlers ---
ws.onopen = () => {
    console.log('WebSocket connection established.');
    fitAddon.fit();
    usernameInput.focus();
};

ws.onmessage = (event) => {
    console.log('Received WebSocket message:', event.data);
    try {
        const message_data = JSON.parse(event.data);
        switch (message_data.type) {
            case 'auth_success':
                state = 'connected';
                loginModal.classList.add('modal-hidden');
                uploadBtn.disabled = false;
                downloadBtn.disabled = false;
                initialRemotePath = message_data.initial_path; // 초기 경로 저장
                currentRemotePath = message_data.initial_path;
                term.writeln(welcomeTips);
                term.write(message_data.message);
                ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
                break;
            case 'download_response':
                if (message_data.error) {
                    term.writeln(`\r\n\x1b[31m[Download failed: ${message_data.error}]\x1b[0m`);
                } else {
                    triggerDownload(message_data.filename, message_data.data);
                    term.writeln(`\r\n\x1b[32m[File "${message_data.filename}" downloaded successfully.]\x1b[0m`);
                }
                break;
            case 'list_files_response':
                if (message_data.error) {
                    fileList.innerHTML = `<li>Error: ${message_data.error}</li>`;
                } else {
                    currentRemotePath = message_data.path;
                    renderFileList(message_data.path, message_data.files);
                }
                break;
        }
    } catch (e) {
        const textData = event.data;
        if (state === 'authenticating') {
            if (textData.includes('Password:')) {
                ws.send(JSON.stringify({ type: 'auth', password: password }));
            } else if (textData.includes('Authentication failed')) {
                loginErrorMsg.textContent = 'Authentication failed. Please try again.';
                passwordInput.value = '';
                passwordInput.focus();
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login';
            } else {
                term.write(textData);
            }
        } else {
            if (textData.toLowerCase().includes('password:') || textData.toLowerCase().includes('비밀번호:')) {
                isPasswordInput = true;
            }
            term.write(textData);
        }
    }
};

ws.onclose = () => {
    uploadBtn.disabled = true;
    downloadBtn.disabled = true;
    closeFileExplorer();
    if (state !== 'connected') {
        loginModal.classList.remove('modal-hidden');
        loginErrorMsg.textContent = 'Connection failed. Please check the server and refresh.';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    } else {
        term.writeln('\r\n\r\n\x1b[31m[Connection closed]\x1b[0m');
    }
};

ws.onerror = (error) => {
    console.error('WebSocket Error:', error);
    if (state !== 'connected') {
        loginErrorMsg.textContent = 'A connection error occurred. Please refresh.';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    } else {
        term.writeln('\r\n\r\n\x1b[31m[An error occurred with the connection]\x1b[0m');
    }
};

// --- Terminal Data Handler ---
term.onData(data => {
    if (state === 'connected') {
        // Reset password flag on Enter key
        if (data === '\r') {
            isPasswordInput = false;
        }
        // For numbers, echo locally ONLY if not in a password prompt
        if (!isPasswordInput && (data >= '0' && data <= '9')) {
            term.write(data);
        }
        ws.send(data);
    }
});

// --- Login Logic ---
function handleLogin() {
    username = usernameInput.value;
    password = passwordInput.value;
    if (!username || !password) {
        loginErrorMsg.textContent = 'Username and password cannot be empty.';
        return;
    }
    loginErrorMsg.textContent = '';
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'auth', username: username }));
    } else {
        loginErrorMsg.textContent = 'Not connected to server. Please wait.';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
}

loginBtn.addEventListener('click', handleLogin);
passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
usernameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') passwordInput.focus(); });

// --- File Explorer Logic ---
function findPwdInTerminal() {
    const promptRegex = /:([^$#\s]+)\s*[$#]\s*$/;
    for (let i = term.buffer.active.cursorY; i >= 0; i--) {
        const line = term.buffer.active.getLine(i).translateToString();
        const match = line.match(promptRegex);
        if (match && match[1]) {
            let path = match[1];
            if (path.startsWith('~')) {
                path = path.replace('~', `/home/${username}`);
            }
            return path;
        }
    }
    return null;
}

function closeFileExplorer() {
    fileExplorerModal.classList.add('modal-hidden');
    fileToUpload = null;
    fileInput.value = '';
}

function openFileExplorer(mode, options = {}) {
    modalMode = mode;
    modalFooter.style.display = (modalMode === 'upload') ? 'flex' : 'none';
    if (modalMode === 'upload') {
        filenameInput.value = options.filename || '';
    }
    fileExplorerModal.classList.remove('modal-hidden');
}

function renderFileList(path, files) {
    currentPathSpan.textContent = path;
    fileList.innerHTML = '';
    if (path !== '/') {
        const parentLi = document.createElement('li');
        parentLi.textContent = '..';
        parentLi.dataset.type = 'dir';
        parentLi.addEventListener('click', () => {
            const parentPath = path.replace(/\/[^\/]+\/?$/, '') || '/';
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
                    term.writeln(`\r\n\x1b[36m[Requesting download for ${fullPath}... ]\x1b[0m`);
                    ws.send(JSON.stringify({ type: 'download', path: fullPath }));
                    closeFileExplorer();
                } else if (modalMode === 'upload') {
                    filenameInput.value = file.name;
                }
            });
        }
        fileList.appendChild(li);
    });
}

function fetchAndRenderFiles(path) {
    if (ws.readyState === WebSocket.OPEN) {
        fileList.innerHTML = '<li>Loading...</li>';
        ws.send(JSON.stringify({ type: 'list_files', path: path }));
    }
}

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

// --- Event Listeners ---
closeModalBtn.addEventListener('click', closeFileExplorer);

confirmBtn.addEventListener('click', () => {
    if (!fileToUpload) {
        term.writeln('\r\n\x1b[31m[Upload error: No file selected.]\x1b[0m');
        return;
    }
    const currentDir = currentPathSpan.textContent;
    const finalName = filenameInput.value;
    if (!finalName) {
        term.writeln('\r\n\x1b[31m[Upload error: Filename cannot be empty.]\x1b[0m');
        return;
    }
    const destinationPath = (currentDir.endsWith('/') ? currentDir : currentDir + '/') + finalName;
    const reader = new FileReader();
    reader.onload = (e) => {
        term.writeln(`\r\n\x1b[36m[Uploading ${fileToUpload.name} to ${destinationPath}... ]\x1b[0m`);
        const base64Data = e.target.result.split(',', 2)[1];
        ws.send(JSON.stringify({ type: 'upload', path: destinationPath, data: base64Data }));
        closeFileExplorer();
        fileToUpload = null;
        fileInput.value = '';
    };
    reader.onerror = () => {
        term.writeln(`\r\n\x1b[31m[Error reading file: ${fileToUpload.name}]\x1b[0m`);
        closeFileExplorer();
        fileToUpload = null;
        fileInput.value = '';
    };
    reader.readAsDataURL(fileToUpload);
});

uploadBtn.addEventListener('click', () => {
    if (state !== 'connected') return;
    fileInput.click();
});

downloadBtn.addEventListener('click', () => {
    if (state !== 'connected') return;
    openFileExplorer('download');
    fetchAndRenderFiles(initialRemotePath || '/');
});

fileInput.addEventListener('change', (event) => {
    fileToUpload = event.target.files[0];
    if (!fileToUpload) return;
    openFileExplorer('upload', { filename: fileToUpload.name });
    fetchAndRenderFiles(initialRemotePath || '/');
});

// --- Custom Keyboard Shortcuts ---
document.getElementById('terminal').addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        const selection = term.getSelection();
        if (selection) {
            navigator.clipboard.writeText(selection).then(() => term.clearSelection());
        }
    }
});
