const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Store = require('electron-store');

const store = new Store();
const tunnels = new Map();
let ngrokProcess = null;
let mainWindow;

const configPath = path.join(os.homedir(), 'Library', 'Application Support', 'ngrok', 'ngrok.yml');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    resizable: true,
    minWidth: 350,
    minHeight: 600
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  tunnels.forEach(tunnel => tunnel.process?.kill());
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC Handlers
ipcMain.handle('get-authtoken', () => store.get('authtoken', ''));

ipcMain.handle('get-saved-tunnels', () => store.get('savedTunnels', []));

ipcMain.handle('save-tunnels', (event, tunnelsArray) => {
  store.set('savedTunnels', tunnelsArray);
  return { success: true };
});

ipcMain.handle('save-authtoken', async (event, token) => {
  try {
    const process = spawn('ngrok', ['config', 'add-authtoken', token]);
    await new Promise((resolve, reject) => {
      process.on('close', code => code === 0 ? resolve() : reject());
    });
    store.set('authtoken', token);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-ngrok', async () => {
  try {
    const process = spawn('ngrok', ['version']);
    return await new Promise((resolve) => {
      let output = '';
      process.stdout.on('data', data => output += data.toString());
      process.on('close', code => {
        if (code === 0) {
          const version = output.match(/ngrok version ([\d.]+)/)?.[1] || 'unknown';
          resolve({ installed: true, version });
        } else {
          resolve({ installed: false });
        }
      });
    });
  } catch {
    return { installed: false };
  }
});

ipcMain.handle('install-ngrok', async () => {
  try {
    const process = spawn('brew', ['install', 'ngrok']);
    return await new Promise((resolve) => {
      let output = '';
      process.stdout.on('data', data => output += data.toString());
      process.stderr.on('data', data => output += data.toString());
      process.on('close', code => {
        resolve({ success: code === 0, output });
      });
    });
  } catch (error) {
    return { success: false, output: error.message };
  }
});

ipcMain.handle('start-tunnel', async (event, config) => {
  const { id, protocol, port, name, staticDomain } = config;
  
  try {
    // Add tunnel to config file
    await updateNgrokConfig(id, { name, protocol, port });
    
    const tunnel = {
      id,
      name,
      protocol,
      port,
      staticDomain,
      logs: [],
      publicUrl: null
    };

    tunnels.set(id, tunnel);

    // Start or restart ngrok agent
    await restartNgrokAgent();

    // Get public URL with retry logic
    let retries = 0;
    const maxRetries = 5;
    const checkUrl = async () => {
      try {
        const response = await fetch('http://127.0.0.1:4040/api/tunnels');
        const data = await response.json();
        // Get tunnel config from our map
        const tunnelConfig = tunnels.get(id);
        
        if (tunnelConfig && tunnelConfig.staticDomain) {
          // For static domains, use the configured domain directly
          const publicUrl = `https://${tunnelConfig.staticDomain}`;
          tunnel.publicUrl = publicUrl;
          mainWindow.webContents.send('tunnel-url', { id, url: publicUrl });
          startRequestMonitoring(id, publicUrl);
        } else {
          // For dynamic domains, find by name in API
          const tunnelData = data.tunnels.find(t => t.name === id);
          if (tunnelData) {
            tunnel.publicUrl = tunnelData.public_url;
            mainWindow.webContents.send('tunnel-url', { id, url: tunnelData.public_url });
            startRequestMonitoring(id, tunnelData.public_url);
          } else if (retries < maxRetries) {
            retries++;
            setTimeout(checkUrl, 2000);
          }
        }
      } catch (error) {
        if (retries < maxRetries) {
          retries++;
          setTimeout(checkUrl, 2000);
        } else {
          console.error('Error getting tunnel URL after retries:', error);
          mainWindow.webContents.send('tunnel-log', { 
            id, 
            log: { type: 'error', message: 'Could not get public URL', timestamp: new Date() } 
          });
        }
      }
    };
    setTimeout(checkUrl, 3000);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-tunnel', async (event, id) => {
  try {
    const tunnel = tunnels.get(id);
    if (!tunnel) {
      return { success: false, error: 'Tunnel not found' };
    }
    
    // Clear request monitoring interval
    if (tunnel.requestInterval) {
      clearInterval(tunnel.requestInterval);
    }
    
    // Remove tunnel from config
    await removeFromNgrokConfig(id);
    
    // Remove from tunnels map
    tunnels.delete(id);
    
    // Kill ngrok process and restart with remaining tunnels
    if (ngrokProcess) {
      ngrokProcess.kill();
      ngrokProcess = null;
    }
    
    // Only restart if there are remaining tunnels
    if (tunnels.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for process to die
      await startNgrokAgent();
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-tunnel-status', (event, id) => {
  const tunnel = tunnels.get(id);
  return tunnel ? {
    running: true,
    publicUrl: tunnel.publicUrl,
    logs: tunnel.logs
  } : { running: false };
});

// Utils handlers
ipcMain.handle('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
  return true;
});

ipcMain.handle('delete-tunnel', (event, id) => {
  const savedTunnels = store.get('savedTunnels', []);
  const filteredTunnels = savedTunnels.filter(tunnel => tunnel.id !== id);
  store.set('savedTunnels', filteredTunnels);
  return { success: true };
});

// Helper functions
async function updateNgrokConfig(tunnelId, config) {
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let ngrokConfig = {
    version: '2',
    authtoken: store.get('authtoken', ''),
    tunnels: {}
  };

  if (fs.existsSync(configPath)) {
    try {
      const yaml = require('js-yaml');
      const content = fs.readFileSync(configPath, 'utf8');
      ngrokConfig = yaml.load(content) || ngrokConfig;
    } catch (error) {
      console.error('Error reading config:', error);
    }
  }

  if (!ngrokConfig.tunnels) ngrokConfig.tunnels = {};
  
  const tunnelConfig = {
    proto: config.protocol,
    addr: config.port
  };
  
  if (config.staticDomain && config.staticDomain.trim()) {
    tunnelConfig.url = config.staticDomain.trim();
  }
  
  ngrokConfig.tunnels[tunnelId] = tunnelConfig;

  const yaml = require('js-yaml');
  fs.writeFileSync(configPath, yaml.dump(ngrokConfig));
}

async function removeFromNgrokConfig(tunnelId) {
  if (!fs.existsSync(configPath)) return;

  try {
    const yaml = require('js-yaml');
    const content = fs.readFileSync(configPath, 'utf8');
    const ngrokConfig = yaml.load(content);
    
    if (ngrokConfig?.tunnels?.[tunnelId]) {
      delete ngrokConfig.tunnels[tunnelId];
      fs.writeFileSync(configPath, yaml.dump(ngrokConfig));
    }
  } catch (error) {
    console.error('Error updating config:', error);
  }
}

async function startNgrokAgent() {
  return new Promise((resolve, reject) => {
    const tunnelNames = Array.from(tunnels.keys());
    
    if (tunnelNames.length === 0) {
      resolve();
      return;
    }
    
    // If single tunnel with static domain, use --url parameter
    if (tunnelNames.length === 1) {
      const tunnelId = tunnelNames[0];
      const tunnel = tunnels.get(tunnelId);
      
      if (tunnel && tunnel.staticDomain) {
        const args = [tunnel.protocol, `--url=${tunnel.staticDomain}`, tunnel.port];
        ngrokProcess = spawn('ngrok', args);
      } else {
        const args = ['start', tunnelId];
        ngrokProcess = spawn('ngrok', args);
      }
    } else {
      // Multiple tunnels, use config file
      const args = ['start', '--all'];
      ngrokProcess = spawn('ngrok', args);
    }
    
    ngrokProcess.stdout.on('data', data => {
      const log = data.toString();
      mainWindow.webContents.send('ngrok-log', { type: 'info', message: log, timestamp: new Date() });
    });

    ngrokProcess.stderr.on('data', data => {
      const log = data.toString();
      mainWindow.webContents.send('ngrok-log', { type: 'error', message: log, timestamp: new Date() });
    });

    ngrokProcess.on('close', code => {
      ngrokProcess = null;
      mainWindow.webContents.send('ngrok-stopped');
    });

    setTimeout(resolve, 2000);
  });
}

async function restartNgrokAgent() {
  if (ngrokProcess) {
    ngrokProcess.kill();
    ngrokProcess = null;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  await startNgrokAgent();
}

function startRequestMonitoring(tunnelId, publicUrl) {
  const seenRequests = new Set();
  
  const checkRequests = async () => {
    try {
      const response = await fetch('http://127.0.0.1:4040/api/requests/http');
      const data = await response.json();
      
      if (data.requests && data.requests.length > 0) {
        // Create unique ID from request data
        const newRequests = data.requests.filter(req => {
          const uniqueId = `${req.started_at}-${req.request.method}-${req.request.uri}`;
          return !seenRequests.has(uniqueId);
        });
        
        newRequests.forEach(req => {
          console.log('Request object:', req); // Debug - ver estructura completa
          
          const method = req.request.method;
          const fullUrl = req.request.uri;
          const path = fullUrl.includes('://') ? new URL(fullUrl).pathname : fullUrl;
          const status = req.response ? req.response.status : 'pending';
          
          // Intentar diferentes campos para obtener IP
          const remoteAddr = req.request.remote_addr || 
                           req.request.headers?.['x-forwarded-for'] || 
                           req.request.headers?.['x-real-ip'] ||
                           req.remote_addr ||
                           'local';
                           
          const duration = req.duration ? `${Math.round(req.duration * 1000)}ms` : '-';
          const timestamp = new Date();
          
          const message = `${method} ${path} → ${status} | ${remoteAddr} | ${duration}`;

          
          mainWindow.webContents.send('tunnel-log', {
            id: tunnelId,
            log: { 
              type: 'request', 
              message, 
              timestamp,
              requestData: {
                id: req.id,
                method,
                path,
                status,
                remoteAddr,
                duration,
                request: req.request,
                response: req.response
              }
            }
          });
          // Mark as seen
          const uniqueId = `${req.started_at}-${req.request.method}-${req.request.uri}`;
          seenRequests.add(uniqueId);
        });
        
        // Clean up old IDs (keep last 100)
        if (seenRequests.size > 100) {
          const idsArray = Array.from(seenRequests);
          seenRequests.clear();
          idsArray.slice(-50).forEach(id => seenRequests.add(id));
        }
      }
    } catch (error) {
      // Silently ignore errors
    }
  };
  
  // Check immediately and then every 2 seconds
  checkRequests();
  const interval = setInterval(checkRequests, 2000);
  
  // Store interval to clear it later
  const tunnel = tunnels.get(tunnelId);
  if (tunnel) {
    tunnel.requestInterval = interval;
  }
}