// Connection panel logic
const ontimeConfig = nodecg.Replicant('ontimeConfig');
const ontimeConnected = nodecg.Replicant('ontimeConnected');
const connectionError = nodecg.Replicant('connectionError');

const ipInput = document.getElementById('ontime-ip');
const portInput = document.getElementById('ontime-port');
const connectBtn = document.getElementById('connect-btn');
const testBtn = document.getElementById('test-btn');
const statusDiv = document.getElementById('status');
const errorDiv = document.getElementById('error');
const debugInfo = document.getElementById('debug-info');

// Load saved config
ontimeConfig.on('change', (newValue) => {
    if (newValue) {
        ipInput.value = newValue.ip || 'localhost';
        portInput.value = newValue.port || 4001;
        updateDebugInfo();
    }
});

// Update connection status
ontimeConnected.on('change', (connected) => {
    if (connected) {
        statusDiv.textContent = '✓ Connected to Ontime';
        statusDiv.className = 'status connected';
        connectBtn.textContent = 'Reconnect';
    } else {
        statusDiv.textContent = '✗ Disconnected';
        statusDiv.className = 'status disconnected';
        connectBtn.textContent = 'Connect';
    }
    updateDebugInfo();
});

// Show connection errors
connectionError.on('change', (error) => {
    if (error) {
        errorDiv.textContent = `Error: ${error}`;
        errorDiv.style.display = 'block';
    } else {
        errorDiv.style.display = 'none';
    }
    updateDebugInfo();
});

// Connect button
connectBtn.addEventListener('click', () => {
    const ip = ipInput.value.trim() || 'localhost';
    const port = parseInt(portInput.value) || 4001;
    
    ontimeConfig.value = { ip, port };
    errorDiv.style.display = 'none';
    updateDebugInfo();
});

// Test connection button
testBtn.addEventListener('click', async () => {
    const ip = ipInput.value.trim() || 'localhost';
    const port = parseInt(portInput.value) || 4001;
    
    debugInfo.textContent = `Testing connection to ${ip}:${port}...`;
    
    try {
        // Test HTTP endpoint
        const response = await fetch(`http://${ip}:${port}/api/version`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            const version = await response.json();
            debugInfo.textContent = `✓ HTTP OK - Ontime version: ${JSON.stringify(version)}`;
        } else {
            debugInfo.textContent = `✗ HTTP Error: ${response.status} ${response.statusText}`;
        }
    } catch (err) {
        debugInfo.textContent = `✗ Connection test failed: ${err.message}\n\nPossible issues:\n- Ontime not running\n- Wrong IP/port\n- Firewall blocking\n- CORS issue`;
    }
});

function updateDebugInfo() {
    const config = ontimeConfig.value || {};
    const connected = ontimeConnected.value || false;
    const error = connectionError.value;
    
    let info = `IP: ${config.ip || 'not set'}\n`;
    info += `Port: ${config.port || 'not set'}\n`;
    info += `WebSocket: ws://${config.ip}:${config.port}/ws\n`;
    info += `HTTP: http://${config.ip}:${config.port}\n`;
    info += `Status: ${connected ? 'Connected' : 'Disconnected'}\n`;
    if (error) {
        info += `Error: ${error}`;
    }
    
    debugInfo.textContent = info;
}

// Initial update
updateDebugInfo();
