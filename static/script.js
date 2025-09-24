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
let username = '';
let password = '';
let modalMode = 'download'; // 'download' or 'upload'
let fileToUpload = null;
let currentRemotePath = ''; // To track the remote path for the file explorer

// --- Welcome Message ---
const welcomeTips = 
`Welcome to Narnia Web Terminal!\r\n\r\n` +
`시작 팁:\r\n` +
`1. 다음 명령어로 서버를 탐색하세요:\r\n` +
`   - ls: 파일 및 디렉토리 목록 보기\r\n` +
`   - cd [디렉토리]: 디렉토리로 이동\r\n` +
`   - cd ..: 상위 디렉토리로 이동\r\n` +
`   - pwd: 현재 디렉토리 경로 보기\r\n` +
`   - Ctrl+C: 현재 실행중인 명령어 중단\r\n` +
`2. 터미널 내에서 Ctrl+Shift+C (복사) 와 Ctrl+Shift+V (붙여넣기) 를 사용하세요.\r\n` +
`3. 'Upload' 와 'Download' 버튼으로 파일을 전송할 수 있습니다.\r\n`;
// --- WebSocket Handlers ---
ws.onopen = () => {
    console.log('WebSocket connection established.');
    fitAddon.fit();
    usernameInput.focus();
};

ws.onmessage = (event) => {
    // --- JSON Message Handling ---
    try {
        const message_data = JSON.parse(event.data);

        if (message_data.type === 'auth_success') {
            state = 'connected';
            loginModal.style.display = 'none'; // Hide login modal
            uploadBtn.disabled = false;
            downloadBtn.disabled = false;
            currentRemotePath = message_data.initial_path; // Store initial path
            term.writeln(welcomeTips.replace(/\n/g, '\r\n'));
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
                currentRemotePath = message_data.path; // Update path on navigation
                renderFileList(message_data.path, message_data.files);
            }
            return;
        }
    } catch (e) {
        // Not a JSON message, treat as plain text.
    }

    // --- Plain Text Message Handling ---
    const textData = event.data;

    if (state === 'authenticating') {
        if (textData.includes('Password:')) {
            // Server is asking for the password, send it.
            ws.send(JSON.stringify({ type: 'auth', password: password }));
        } else if (textData.includes('Authentication failed')) {
            loginErrorMsg.textContent = 'Authentication failed. Please try again.';
            passwordInput.value = '';
            passwordInput.focus();
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        } else {
            // Other messages during auth (like connection info)
            term.write(textData);
        }
    } else {
        // Once connected, all text goes to the terminal.
        term.write(textData);
    }
};

ws.onclose = () => {
    uploadBtn.disabled = true;
    downloadBtn.disabled = true;
    closeFileExplorer();
    if (state !== 'connected') {
        loginModal.style.display = 'flex';
        loginErrorMsg.textContent = 'Connection failed. Please check the server and refresh.';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    } else {
        term.writeln('\r\n\r\n[Connection closed]');
    }
};

ws.onerror = (error) => {
    console.error('WebSocket Error:', error);
    if (state !== 'connected') {
        loginErrorMsg.textContent = 'A connection error occurred. Please refresh.';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    } else {
        term.writeln('\r\n\r\n[An error occurred with the connection]');
    }
};

// --- Terminal Data Handler (User Input) ---
term.onData(data => {
        // Filter out the terminal identification response that causes "1;2c"
        if (data === '\x1b[?1;2c') {
            return;
        }

        // Only forward data to server when fully connected
        if (state === 'connected') {
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

    loginErrorMsg.textContent = ''; // Clear previous errors
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';

    // Start the auth process by sending the username
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'auth', username: username }));
    } else {
        loginErrorMsg.textContent = 'Not connected to server. Please wait.';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
}

loginBtn.addEventListener('click', handleLogin);
passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleLogin();
    }
});
usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        passwordInput.focus();
    }
});


// --- File Explorer Logic ---

function findPwdInTerminal() {
    // This regex is designed to find a path in a typical shell prompt
    // like "user@host:~/some/path$" or "[user@host path]$ ".
    const promptRegex = /:([^$#\s]+)\s*[$#]\s*$/;
    // Search from the cursor upwards to find the last prompt
    for (let i = term.buffer.active.cursorY; i >= 0; i--) {
        const line = term.buffer.active.getLine(i).translateToString();
        const match = line.match(promptRegex);
        if (match && match[1]) {
            let path = match[1];
            // Expand tilde `~` to the home directory
            if (path.startsWith('~')) {
                // Expand tilde `~` to the home directory using the username
                path = path.replace('~', `/home/${username}`);
            }
            return path;
        }
    }
    return null; // Return null if no path is found
}

function closeFileExplorer() {
    fileExplorerModal.classList.add('modal-hidden');
}

function openFileExplorer(mode, options = {}) {
    modalMode = mode;
    if (modalMode === 'upload') {
        modalFooter.style.display = 'flex';
        filenameInput.value = options.filename || '';
    } else {
        modalFooter.style.display = 'none';
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
                    term.writeln(`\r\n[Requesting download for ${fullPath}... ]`);
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

// --- File Transfer Event Listeners ---
closeModalBtn.addEventListener('click', closeFileExplorer);

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
        term.writeln(`\r\n[Uploading ${fileToUpload.name} to ${destinationPath}... ]`);
        const base64Data = e.target.result.split(',', 2)[1];
        ws.send(JSON.stringify({
            type: 'upload',
            path: destinationPath,
            data: base64Data
        }));
        closeFileExplorer();
        fileToUpload = null;
        fileInput.value = '';
    };
    reader.onerror = () => {
        term.writeln(`\r\n[Error reading file: ${fileToUpload.name}]`);
        closeFileExplorer();
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
    const pathFromTerminal = findPwdInTerminal();
    openFileExplorer('download');
    fetchAndRenderFiles(pathFromTerminal || currentRemotePath || '/');
});

fileInput.addEventListener('change', (event) => {
    fileToUpload = event.target.files[0];
    if (!fileToUpload) {
        return;
    }
    const pathFromTerminal = findPwdInTerminal();
    openFileExplorer('upload', { filename: fileToUpload.name });
    fetchAndRenderFiles(pathFromTerminal || currentRemotePath || '/');
});

// --- Custom Keyboard Shortcuts ---
document.getElementById('terminal').addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault(); // Prevent developer tools from opening
        const selection = term.getSelection();
        if (selection) {
            navigator.clipboard.writeText(selection).then(() => {
                term.clearSelection();
                term.focus(); // Refocus the terminal
            });
        }
    }
});