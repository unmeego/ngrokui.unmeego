const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getAuthtoken: () => ipcRenderer.invoke('get-authtoken'),
  saveAuthtoken: (token) => ipcRenderer.invoke('save-authtoken', token),
  getSavedTunnels: () => ipcRenderer.invoke('get-saved-tunnels'),
  saveTunnels: (tunnels) => ipcRenderer.invoke('save-tunnels', tunnels),
  deleteTunnel: (id) => ipcRenderer.invoke('delete-tunnel', id),
  
  // Ngrok management
  checkNgrok: () => ipcRenderer.invoke('check-ngrok'),
  installNgrok: () => ipcRenderer.invoke('install-ngrok'),
  
  // Tunnel management
  startTunnel: (config) => ipcRenderer.invoke('start-tunnel', config),
  stopTunnel: (id) => ipcRenderer.invoke('stop-tunnel', id),
  getTunnelStatus: (id) => ipcRenderer.invoke('get-tunnel-status', id),
  
  // Events
  onTunnelLog: (callback) => ipcRenderer.on('tunnel-log', callback),
  onTunnelUrl: (callback) => ipcRenderer.on('tunnel-url', callback),
  onTunnelStopped: (callback) => ipcRenderer.on('tunnel-stopped', callback),
  onNgrokLog: (callback) => ipcRenderer.on('ngrok-log', callback),
  onNgrokStopped: (callback) => ipcRenderer.on('ngrok-stopped', callback),
  
  // Utils
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text)
});