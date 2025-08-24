class NgrokController {
    constructor() {
        this.tunnels = new Map();
        this.currentLanguageIndex = 0;
        this.welcomeMessages = [
            'Welcome',      // English
            'Bienvenido',   // Spanish
            '환영합니다',      // Korean
            '欢迎',         // Chinese
            'Willkommen',   // German
            'Bienvenue',    // French
            'स्वागत है'      // Hindi
        ];
        this.init();
    }

    init() {
        this.startWelcomeScreen();
        this.setupEventListeners();
        
        // Hide welcome screen after 4 seconds
        setTimeout(() => {
            this.hideWelcomeScreen();
        }, 4000);
    }
    
    startWelcomeScreen() {
        const welcomeMessage = document.getElementById('welcomeMessage');
        
        this.welcomeInterval = setInterval(() => {
            welcomeMessage.style.animation = 'none';
            setTimeout(() => {
                this.currentLanguageIndex = (this.currentLanguageIndex + 1) % this.welcomeMessages.length;
                welcomeMessage.textContent = this.welcomeMessages[this.currentLanguageIndex];
                welcomeMessage.style.animation = 'textFade 0.8s ease-in-out';
            }, 50);
        }, 1000);
    }
    
    hideWelcomeScreen() {
        clearInterval(this.welcomeInterval);
        
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.querySelector('.header').classList.remove('hidden');
        document.getElementById('mainScreen').classList.remove('hidden');
        document.querySelector('.footer').classList.remove('hidden');
        
        // Initialize app after welcome screen
        this.checkNgrokStatus();
        this.loadAuthtoken();
        this.loadSavedTunnels();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('configBtn').addEventListener('click', () => this.showConfig());
        document.getElementById('backBtn').addEventListener('click', () => this.showMain());
        document.getElementById('detailsBackBtn').addEventListener('click', () => this.showMain());
        document.getElementById('requestBackBtn').addEventListener('click', () => {
            if (this.currentTunnelId) {
                this.showTunnelDetails(this.currentTunnelId);
            } else {
                this.showMain();
            }
        });
        
        // Details footer buttons (check if they exist)
        const terminalBtn = document.getElementById('detailsTerminalBtn');
        const requestsBtn = document.getElementById('detailsRequestsBtn');
        const metricsBtn = document.getElementById('detailsMetricsBtn');
        const actionsBtn = document.getElementById('detailsActionsBtn');
        if (terminalBtn) terminalBtn.addEventListener('click', () => this.showTerminalTab());
        if (requestsBtn) requestsBtn.addEventListener('click', () => this.showRequestsTab());
        if (metricsBtn) metricsBtn.addEventListener('click', () => this.showMetricsTab());
        if (actionsBtn) actionsBtn.addEventListener('click', () => this.showActionsTab());

        // Tunnel management
        document.getElementById('addTunnelBtn').addEventListener('click', () => this.showAddTunnelModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.hideAddTunnelModal());
        document.getElementById('tunnelForm').addEventListener('submit', (e) => this.createTunnel(e));

        // Config
        document.getElementById('saveTokenBtn').addEventListener('click', () => this.saveAuthtoken());
        document.getElementById('installBtn').addEventListener('click', () => this.installNgrok());

        // IPC Events
        window.electronAPI.onTunnelLog((event, data) => this.handleTunnelLog(data));
        window.electronAPI.onTunnelUrl((event, data) => this.handleTunnelUrl(data));
        window.electronAPI.onTunnelStopped((event, id) => this.handleTunnelStopped(id));
        window.electronAPI.onNgrokLog((event, data) => this.handleNgrokLog(data));
        window.electronAPI.onNgrokStopped((event) => this.handleNgrokStopped());
    }

    showConfig() {
        document.getElementById('mainScreen').classList.add('hidden');
        document.getElementById('configScreen').classList.remove('hidden');
    }

    showMain() {
        document.getElementById('configScreen').classList.add('hidden');
        document.getElementById('tunnelDetailsScreen').classList.add('hidden');
        document.getElementById('requestDetailsScreen').classList.add('hidden');
        document.getElementById('mainScreen').classList.remove('hidden');
        this.currentTunnelId = null;
    }
    
    showRequestDetails(requestData) {
        document.getElementById('tunnelDetailsScreen').classList.add('hidden');
        document.getElementById('requestDetailsScreen').classList.remove('hidden');
        
        document.getElementById('requestTitle').textContent = `${requestData.method} ${requestData.path}`;
        
        // Request info
        document.getElementById('requestInfo').innerHTML = `
            <h3>Request</h3>
            <div class="info-item">
                <span class="info-label">Method:</span>
                <span class="info-value">${requestData.method}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Path:</span>
                <span class="info-value">${requestData.path}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Remote IP:</span>
                <span class="info-value">${requestData.remoteAddr}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Duration:</span>
                <span class="info-value">${requestData.duration}</span>
            </div>
        `;
        
        // Request headers
        const headers = requestData.request?.headers || {};
        const headersList = Object.entries(headers).map(([key, value]) => 
            `<div class="header-item"><strong>${key}:</strong> ${value}</div>`
        ).join('');
        
        document.getElementById('requestHeaders').innerHTML = `
            <h3>Headers</h3>
            <div class="headers-list">
                ${headersList || '<div class="no-data">No headers available</div>'}
            </div>
        `;
        
        // Response info
        const response = requestData.response;
        document.getElementById('responseInfo').innerHTML = `
            <h3>Response</h3>
            <div class="info-item">
                <span class="info-label">Status:</span>
                <span class="info-value status-${response?.status >= 400 ? 'error' : 'success'}">${response?.status || 'N/A'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Content-Type:</span>
                <span class="info-value">${response?.headers?.['content-type'] || 'N/A'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Content-Length:</span>
                <span class="info-value">${response?.headers?.['content-length'] || 'N/A'}</span>
            </div>
        `;
    }

    showAddTunnelModal() {
        document.getElementById('addTunnelModal').classList.remove('hidden');
    }

    hideAddTunnelModal() {
        document.getElementById('addTunnelModal').classList.add('hidden');
        document.getElementById('tunnelForm').reset();
    }

    async checkNgrokStatus() {
        const status = await window.electronAPI.checkNgrok();
        const statusEl = document.getElementById('ngrokStatus');
        const installBtn = document.getElementById('installBtn');

        if (status.installed) {
            statusEl.innerHTML = `✅ ngrok installed: version ${status.version}`;
            statusEl.className = 'status-info status-success';
            installBtn.classList.add('hidden');
        } else {
            statusEl.innerHTML = '❌ ngrok not detected';
            statusEl.className = 'status-info status-error';
            installBtn.classList.remove('hidden');
        }
    }

    async loadAuthtoken() {
        const token = await window.electronAPI.getAuthtoken();
        if (token) {
            document.getElementById('authtokenInput').value = token;
        }
    }

    async loadSavedTunnels() {
        const savedTunnels = await window.electronAPI.getSavedTunnels();
        if (savedTunnels && savedTunnels.length > 0) {
            savedTunnels.forEach(config => {
                this.addTunnelCard(config);
            });
        }
        this.updateEmptyState();
    }
    
    updateEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const hasTunnels = this.tunnels.size > 0;
        
        if (emptyState) {
            emptyState.style.display = hasTunnels ? 'none' : 'flex';
        }
    }

    async saveTunnels() {
        const tunnelsArray = Array.from(this.tunnels.values()).map(tunnel => ({
            id: tunnel.id,
            name: tunnel.name,
            protocol: tunnel.protocol,
            port: tunnel.port,
            staticDomain: tunnel.staticDomain
        }));
        await window.electronAPI.saveTunnels(tunnelsArray);
    }

    async saveAuthtoken() {
        const token = document.getElementById('authtokenInput').value.trim();
        const statusEl = document.getElementById('tokenStatus');

        if (!token) {
            this.showStatus(statusEl, 'Please enter an authtoken', 'error');
            return;
        }

        const result = await window.electronAPI.saveAuthtoken(token);
        
        if (result.success) {
            this.showStatus(statusEl, 'Token saved successfully', 'success');
        } else {
            this.showStatus(statusEl, `Error: ${result.error}`, 'error');
        }
    }

    async installNgrok() {
        const installBtn = document.getElementById('installBtn');
        const statusEl = document.getElementById('ngrokStatus');

        installBtn.textContent = 'Installing...';
        installBtn.disabled = true;

        const result = await window.electronAPI.installNgrok();

        if (result.success) {
            statusEl.innerHTML = '✅ ngrok installed successfully';
            statusEl.className = 'status-info status-success';
            installBtn.classList.add('hidden');
        } else {
            statusEl.innerHTML = `❌ Installation error: ${result.output}`;
            statusEl.className = 'status-info status-error';
            installBtn.textContent = 'Install ngrok';
            installBtn.disabled = false;
        }
    }

    async createTunnel(event) {
        event.preventDefault();

        const name = document.getElementById('tunnelName').value.trim();
        const protocol = document.getElementById('tunnelProtocol').value;
        const port = document.getElementById('tunnelPort').value;
        const staticDomain = document.getElementById('staticDomain').value.trim();

        if (!name || !port) return;

        const id = Date.now().toString();
        const config = { id, name, protocol, port, staticDomain };

        this.addTunnelCard(config);
        this.hideAddTunnelModal();
        
        // Save tunnels to storage
        await this.saveTunnels();
        
        // Don't start automatically - user must click Start button
    }

    addTunnelCard(config) {
        const { id, name, protocol, port, staticDomain } = config;
        
        const card = document.createElement('div');
        card.className = 'tunnel-card';
        card.dataset.id = id;
        
        card.innerHTML = `
            <div class="tunnel-header">
                <div class="tunnel-info">
                    <h3>${name}</h3>
                    <p>${protocol.toUpperCase()} • Port ${port}${staticDomain ? ` • ${staticDomain}` : ''}</p>
                </div>
                <span class="tunnel-status status-stopped">Stopped</span>
            </div>
            
            <div class="tunnel-actions">
                <button class="start-btn" data-id="${id}">Start</button>
                <button class="stop-btn" data-id="${id}" disabled>Stop</button>
                <button class="delete-btn" data-id="${id}">🗑️</button>
            </div>
            
            <div class="url-section hidden">
                <label>Public URL:</label>
                <div class="url-display">
                    <input type="text" class="url-input" readonly>
                    <button class="url-btn copy-btn" data-id="${id}">Copy</button>
                    <button class="url-btn open-btn" data-id="${id}">Open</button>
                </div>
            </div>
            

        `;

        // Add event listeners
        const startBtn = card.querySelector('.start-btn');
        const stopBtn = card.querySelector('.stop-btn');
        const copyBtn = card.querySelector('.copy-btn');
        const openBtn = card.querySelector('.open-btn');
        const deleteBtn = card.querySelector('.delete-btn');

        startBtn.addEventListener('click', (e) => { e.stopPropagation(); this.startTunnel(id); });
        stopBtn.addEventListener('click', (e) => { e.stopPropagation(); this.stopTunnel(id); });
        copyBtn.addEventListener('click', (e) => { e.stopPropagation(); this.copyUrl(id); });
        openBtn.addEventListener('click', (e) => { e.stopPropagation(); this.openUrl(id); });
        deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); this.deleteTunnel(id); });
        
        // Click en tarjeta para ir a detalles
        card.addEventListener('click', () => this.showTunnelDetails(id));

        document.getElementById('tunnelsList').appendChild(card);
        this.tunnels.set(id, { 
            ...config, 
            running: false, 
            publicUrl: null,
            staticDomain: config.staticDomain || null
        });
        
        // Set initial state - stopped
        this.updateTunnelStatus(id, 'stopped');
        this.updateTunnelButtons(id, true, false);
        this.updateTunnelUrl(id, ''); // Hide copy/open buttons initially
        
        // Hide empty state
        this.updateEmptyState();
    }

    async startTunnel(id) {
        const tunnel = this.tunnels.get(id);
        if (!tunnel) return;

        // Update UI immediately
        this.updateTunnelStatus(id, 'running');
        this.updateTunnelButtons(id, false, true);
        this.addTunnelLog(id, { type: 'info', message: 'Starting tunnel...', timestamp: new Date() });

        const result = await window.electronAPI.startTunnel(tunnel);
        
        if (!result.success) {
            this.updateTunnelStatus(id, 'stopped');
            this.updateTunnelButtons(id, true, false);
            this.addTunnelLog(id, { type: 'error', message: result.error, timestamp: new Date() });
        } else {
            // Set start time for uptime calculation
            const tunnel = this.tunnels.get(id);
            if (tunnel) {
                tunnel.startTime = Date.now();
            }
            this.addTunnelLog(id, { type: 'info', message: 'Tunnel started successfully', timestamp: new Date() });
        }
    }

    async stopTunnel(id) {
        // Update UI immediately
        this.updateTunnelStatus(id, 'stopped');
        this.updateTunnelButtons(id, true, false);
        this.updateTunnelUrl(id, '');
        this.addTunnelLog(id, { type: 'info', message: 'Stopping tunnel...', timestamp: new Date() });
        
        const result = await window.electronAPI.stopTunnel(id);
        
        if (result.success) {
            this.addTunnelLog(id, { type: 'info', message: 'Tunnel stopped successfully', timestamp: new Date() });
        } else {
            this.addTunnelLog(id, { type: 'error', message: `Error: ${result.error}`, timestamp: new Date() });
        }
    }

    updateTunnelStatus(id, status) {
        const card = document.querySelector(`[data-id="${id}"]`);
        if (!card) return;

        const statusEl = card.querySelector('.tunnel-status');
        if (statusEl) {
            statusEl.textContent = status === 'running' ? 'Running' : 'Stopped';
            statusEl.className = `tunnel-status ${status === 'running' ? 'status-running' : 'status-stopped'}`;
        }

        const tunnel = this.tunnels.get(id);
        if (tunnel) {
            tunnel.running = status === 'running';
        }
    }

    updateTunnelButtons(id, startEnabled, stopEnabled) {
        const card = document.querySelector(`[data-id="${id}"]`);
        if (!card) return;

        const startBtn = card.querySelector('.start-btn');
        const stopBtn = card.querySelector('.stop-btn');

        if (startBtn) {
            startBtn.disabled = !startEnabled;
            startBtn.style.display = startEnabled ? 'block' : 'none';
        }
        if (stopBtn) {
            stopBtn.disabled = !stopEnabled;
            stopBtn.style.display = stopEnabled ? 'block' : 'none';
        }
    }

    updateTunnelUrl(id, url) {
        const card = document.querySelector(`[data-id="${id}"]`);
        if (!card) return;

        const urlSection = card.querySelector('.url-section');
        const urlInput = card.querySelector('.url-input');
        
        if (url) {
            // Show URL section and set value
            urlSection.classList.remove('hidden');
            urlInput.value = url;
        } else {
            // Hide entire URL section
            urlSection.classList.add('hidden');
            urlInput.value = '';
        }

        const tunnel = this.tunnels.get(id);
        if (tunnel) {
            tunnel.publicUrl = url;
        }
    }

    addTunnelLog(id, log) {
        const tunnel = this.tunnels.get(id);
        if (!tunnel) return;
        
        // Store log in tunnel
        if (!tunnel.logs) tunnel.logs = [];
        tunnel.logs.push(log);
        

        
        // Update details screen if it's showing this tunnel
        const detailsScreen = document.getElementById('tunnelDetailsScreen');
        if (!detailsScreen.classList.contains('hidden') && this.currentTunnelId === id) {
            this.updateDetailsLogs(id);
            this.updateDetailsButtons(id);
        }
    }

    handleTunnelLog(data) {
        this.addTunnelLog(data.id, data.log);
    }

    handleTunnelUrl(data) {
        this.updateTunnelUrl(data.id, data.url);
    }

    handleTunnelStopped(id) {
        this.updateTunnelStatus(id, 'stopped');
        this.updateTunnelButtons(id, true, false);
        this.updateTunnelUrl(id, '');
    }

    handleNgrokLog(data) {
        // Add global ngrok logs to all active tunnels
        this.tunnels.forEach((tunnel, id) => {
            if (tunnel.running) {
                this.addTunnelLog(id, data);
            }
        });
    }

    handleNgrokStopped() {
        // Mark all tunnels as stopped
        this.tunnels.forEach((tunnel, id) => {
            this.updateTunnelStatus(id, 'stopped');
            this.updateTunnelButtons(id, true, false);
            this.updateTunnelUrl(id, '');
        });
    }

    copyUrl(id) {
        const tunnel = this.tunnels.get(id);
        if (tunnel?.publicUrl) {
            window.electronAPI.copyToClipboard(tunnel.publicUrl);
        }
    }

    openUrl(id) {
        const tunnel = this.tunnels.get(id);
        if (tunnel?.publicUrl) {
            window.electronAPI.openExternal(tunnel.publicUrl);
        }
    }

    openInspector() {
        window.electronAPI.openExternal('http://127.0.0.1:4040');
    }

    showTunnelDetails(id) {
        const tunnel = this.tunnels.get(id);
        if (!tunnel) return;

        this.currentTunnelId = id;
        
        document.getElementById('mainScreen').classList.add('hidden');
        document.getElementById('configScreen').classList.add('hidden');
        document.getElementById('requestDetailsScreen').classList.add('hidden');
        document.getElementById('tunnelDetailsScreen').classList.remove('hidden');
        
        document.getElementById('detailsTitle').textContent = tunnel.name;
        
        // Update tunnel info
        const tunnelInfo = document.getElementById('tunnelInfo');
        tunnelInfo.innerHTML = `
            <div class="info-item">
                <span class="info-label">Protocol:</span>
                <span class="info-value">${tunnel.protocol.toUpperCase()}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Port:</span>
                <span class="info-value">${tunnel.port}</span>
            </div>
            ${tunnel.staticDomain ? `
                <div class="info-item">
                    <span class="info-label">Domain:</span>
                    <span class="info-value">${tunnel.staticDomain}</span>
                </div>
            ` : ''}
            <div class="info-item">
                <span class="info-label">Status:</span>
                <span class="info-value status-${tunnel.running ? 'running' : 'stopped'}">
                    ${tunnel.running ? 'Running' : 'Stopped'}
                </span>
            </div>
            ${tunnel.publicUrl ? `
                <div class="info-item">
                    <span class="info-label">Public URL:</span>
                    <span class="info-value url-value">${tunnel.publicUrl}</span>
                </div>
            ` : ''}
        `;
        
        // Show terminal tab by default
        this.currentTab = 'terminal';
        this.updateDetailsLogs(id);
        this.updateDetailsButtons(id);
    }
    
    updateDetailsLogs(id) {
        const tunnel = this.tunnels.get(id);
        const detailsLogs = document.getElementById('detailsLogs');
        
        detailsLogs.innerHTML = '';
        
        if (tunnel && tunnel.logs && tunnel.logs.length > 0) {
            const filteredLogs = this.currentTab === 'terminal' 
                ? tunnel.logs.filter(log => log.type !== 'request')
                : tunnel.logs.filter(log => log.type === 'request');
            
            if (filteredLogs.length > 0) {
                filteredLogs.forEach(log => {
                    const logEntry = document.createElement('div');
                    logEntry.className = `details-log-entry details-log-${log.type}`;
                    
                    if (log.type === 'request' && log.requestData) {
                        logEntry.className += ' clickable-request';
                        logEntry.addEventListener('click', () => this.showRequestDetails(log.requestData));
                    }
                    
                    logEntry.innerHTML = `
                        <span class="log-time">[${new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span class="log-message">${log.message}</span>
                        ${log.type === 'request' ? '<span class="click-hint">👆 Click for details</span>' : ''}
                    `;
                    detailsLogs.appendChild(logEntry);
                });
            } else {
                const message = this.currentTab === 'terminal' 
                    ? 'No terminal logs available'
                    : 'No requests available';
                detailsLogs.innerHTML = `<div class="no-logs">${message}</div>`;
            }
        } else {
            const message = this.currentTab === 'terminal' 
                ? 'No terminal logs available'
                : 'No requests available';
            detailsLogs.innerHTML = `<div class="no-logs">${message}</div>`;
        }
        
        detailsLogs.scrollTop = detailsLogs.scrollHeight;
    }
    
    updateDetailsButtons(id) {
        // This function is no longer needed since we removed copy/open buttons from footer
        // Actions are now handled in the Actions tab
        return;
    }
    
    showTerminalTab() {
        this.currentTab = 'terminal';
        this.setActiveTab('detailsTerminalBtn');
        document.getElementById('logsTitle').textContent = 'Terminal';
        this.showLogsContent();
        
        if (this.currentTunnelId) {
            this.updateDetailsLogs(this.currentTunnelId);
        }
    }
    
    showRequestsTab() {
        this.currentTab = 'requests';
        this.setActiveTab('detailsRequestsBtn');
        document.getElementById('logsTitle').textContent = 'Requests';
        this.showLogsContent();
        
        if (this.currentTunnelId) {
            this.updateDetailsLogs(this.currentTunnelId);
        }
    }
    
    showMetricsTab() {
        this.currentTab = 'metrics';
        this.setActiveTab('detailsMetricsBtn');
        document.getElementById('logsTitle').textContent = 'Metrics';
        this.showMetricsContent();
        
        if (this.currentTunnelId) {
            this.updateMetrics(this.currentTunnelId);
        }
    }
    
    showActionsTab() {
        this.currentTab = 'actions';
        this.setActiveTab('detailsActionsBtn');
        document.getElementById('logsTitle').textContent = 'Actions';
        this.showActionsContent();
        
        if (this.currentTunnelId) {
            this.updateActions(this.currentTunnelId);
        }
    }
    
    setActiveTab(activeId) {
        ['detailsTerminalBtn', 'detailsRequestsBtn', 'detailsMetricsBtn', 'detailsActionsBtn']
            .forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.classList.remove('active');
            });
        const activeBtn = document.getElementById(activeId);
        if (activeBtn) activeBtn.classList.add('active');
    }
    
    showLogsContent() {
        const logsEl = document.getElementById('detailsLogs');
        const metricsEl = document.getElementById('metricsContent');
        const actionsEl = document.getElementById('actionsContent');
        
        if (logsEl) logsEl.classList.remove('hidden');
        if (metricsEl) metricsEl.classList.add('hidden');
        if (actionsEl) actionsEl.classList.add('hidden');
    }
    
    showMetricsContent() {
        const logsEl = document.getElementById('detailsLogs');
        const metricsEl = document.getElementById('metricsContent');
        const actionsEl = document.getElementById('actionsContent');
        
        if (logsEl) logsEl.classList.add('hidden');
        if (metricsEl) metricsEl.classList.remove('hidden');
        if (actionsEl) actionsEl.classList.add('hidden');
    }
    
    showActionsContent() {
        const logsEl = document.getElementById('detailsLogs');
        const metricsEl = document.getElementById('metricsContent');
        const actionsEl = document.getElementById('actionsContent');
        
        if (logsEl) logsEl.classList.add('hidden');
        if (metricsEl) metricsEl.classList.add('hidden');
        if (actionsEl) actionsEl.classList.remove('hidden');
    }
    
    async updateMetrics(id) {
        const tunnel = this.tunnels.get(id);
        const metricsContent = document.getElementById('metricsContent');
        
        if (!tunnel || !metricsContent) return;
        
        try {
            const response = await fetch('http://127.0.0.1:4040/api/tunnels');
            const data = await response.json();
            const tunnelData = data.tunnels.find(t => t.name === id || t.public_url === tunnel.publicUrl);
            
            if (tunnelData && tunnelData.metrics) {
                const metrics = tunnelData.metrics;
                const httpMetrics = metrics.http || {};
                const connMetrics = metrics.conns || {};
                
                const requestsPerSec = httpMetrics.rate1 ? parseFloat(httpMetrics.rate1).toFixed(2) : '0.00';
                console.log('Raw p50 value:', httpMetrics.p50); // Debug
                const avgResponse = httpMetrics.p50 ? Math.round(httpMetrics.p50 / 1000000) : 0; // Convertir de nanosegundos a ms
                
                metricsContent.innerHTML = `
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <div class="metric-value">${httpMetrics.count || 0}</div>
                            <div class="metric-label">HTTP Requests</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value">${connMetrics.count || 0}</div>
                            <div class="metric-label">Connections</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value">${requestsPerSec}/s</div>
                            <div class="metric-label">Requests/sec</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value">${avgResponse}ms</div>
                            <div class="metric-label">Avg Response</div>
                        </div>
                    </div>
                `;
            } else {
                // Fallback to basic metrics
                const uptime = tunnel.startTime ? Math.floor((Date.now() - tunnel.startTime) / 1000) : 0;
                const totalRequests = tunnel.logs ? tunnel.logs.filter(log => log.type === 'request').length : 0;
                
                metricsContent.innerHTML = `
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <div class="metric-value">${totalRequests}</div>
                            <div class="metric-label">Total Requests</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value">${uptime}s</div>
                            <div class="metric-label">Uptime</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value">0</div>
                            <div class="metric-label">Connections</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value">0.00/s</div>
                            <div class="metric-label">Requests/sec</div>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            // Error getting metrics, show basic info
            const uptime = tunnel.startTime ? Math.floor((Date.now() - tunnel.startTime) / 1000) : 0;
            metricsContent.innerHTML = `
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">N/A</div>
                        <div class="metric-label">Metrics unavailable</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${uptime}s</div>
                        <div class="metric-label">Uptime</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">-</div>
                        <div class="metric-label">Inspector: 4040</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">-</div>
                        <div class="metric-label">Status: ${tunnel.running ? 'Active' : 'Stopped'}</div>
                    </div>
                </div>
            `;
        }
    }
    
    updateActions(id) {
        const tunnel = this.tunnels.get(id);
        const actionsContent = document.getElementById('actionsContent');
        
        if (!tunnel || !actionsContent) return;
        
        actionsContent.innerHTML = `
            <div class="actions-grid">
                <button class="action-btn ${tunnel.running ? 'hidden' : ''}" onclick="ngrokController.startTunnel('${id}')">
                    <span class="action-icon">▶️</span>
                    <span class="action-text">Start Tunnel</span>
                </button>
                <button class="action-btn ${!tunnel.running ? 'hidden' : ''}" onclick="ngrokController.stopTunnel('${id}')">
                    <span class="action-icon">⏹️</span>
                    <span class="action-text">Stop Tunnel</span>
                </button>
                <button class="action-btn ${!tunnel.publicUrl ? 'hidden' : ''}" onclick="ngrokController.copyUrl('${id}')">
                    <span class="action-icon">📋</span>
                    <span class="action-text">Copy URL</span>
                </button>
                <button class="action-btn ${!tunnel.publicUrl ? 'hidden' : ''}" onclick="ngrokController.openUrl('${id}')">
                    <span class="action-icon">🚀</span>
                    <span class="action-text">Open in Browser</span>
                </button>
                <button class="action-btn" onclick="ngrokController.openInspector()">
                    <span class="action-icon">🔍</span>
                    <span class="action-text">ngrok Inspector</span>
                </button>
                <button class="action-btn danger" onclick="ngrokController.deleteTunnel('${id}')">
                    <span class="action-icon">🗑️</span>
                    <span class="action-text">Delete Tunnel</span>
                </button>
            </div>
        `;
    }
    

    
    detailsCopyUrl() {
        if (this.currentTunnelId) {
            this.copyUrl(this.currentTunnelId);
        }
    }
    
    detailsOpenUrl() {
        if (this.currentTunnelId) {
            this.openUrl(this.currentTunnelId);
        }
    }

    async deleteTunnel(id) {
        if (confirm('Are you sure you want to delete this tunnel?')) {
            // Stop tunnel if running
            const tunnel = this.tunnels.get(id);
            if (tunnel && tunnel.running) {
                await this.stopTunnel(id);
            }
            
            // Remove from UI
            const card = document.querySelector(`[data-id="${id}"]`);
            if (card) {
                card.remove();
            }
            
            // Remove from memory
            this.tunnels.delete(id);
            
            // Remove from storage
            await window.electronAPI.deleteTunnel(id);
            
            // Update empty state
            this.updateEmptyState();
        }
    }

    showStatus(element, message, type) {
        element.textContent = message;
        element.className = `status-message status-${type}`;
        setTimeout(() => {
            element.textContent = '';
            element.className = 'status-message';
        }, 3000);
    }
}

// Initialize app
const ngrokController = new NgrokController();