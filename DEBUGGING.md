# Debugging Ontime Connection

## Step-by-Step Debugging Guide

### 1. Restart NodeCG

Stop NodeCG if running (Ctrl+C) and restart:

```powershell
npx nodecg start
```

### 2. Check NodeCG Dashboard

Open the dashboard: `http://localhost:9090`

Look for the **Connection panel** and check:
- Current IP and port settings
- Connection status (should show connected/disconnected)
- Any error messages displayed

### 3. Check Extension Logs

In the terminal where NodeCG is running, look for messages like:

**Good signs:**
```
✓ Connected to Ontime at ws://localhost:4001/ws
Sent poll request to Ontime
Received message from Ontime
```

**Bad signs:**
```
WebSocket error: connect ECONNREFUSED
WebSocket closed. Code: 1006
Failed to create WebSocket
```

### 4. Test Ontime Directly

#### Test if Ontime is running:

```powershell
# Test HTTP endpoint
curl http://localhost:4001/api/version
```

Expected response: JSON with Ontime version

#### Or use browser:
Open `http://localhost:4001` - you should see the Ontime interface

### 5. Use the Test Button

In the Connection panel dashboard:
1. Enter Ontime IP and port
2. Click **"Test Connection"**
3. Check the debug info area for results

The test will tell you:
- ✓ If Ontime HTTP is accessible
- ✗ Specific connection errors

### 6. Common Issues & Solutions

#### Error: `ECONNREFUSED`
**Problem:** Ontime is not running or wrong port

**Solutions:**
- Start Ontime
- Check Ontime is on port 4001 (default)
- In Ontime, check Settings → Server to verify port

#### Error: `ETIMEDOUT`
**Problem:** Network/firewall issue

**Solutions:**
- Check Windows Firewall
- Add exception for port 4001
- Try `127.0.0.1` instead of `localhost`

#### Error: `WebSocket closed. Code: 1006`
**Problem:** Connection established but immediately closed

**Solutions:**
- Check Ontime version (must be v4+)
- Check Ontime logs for errors
- Restart Ontime

#### No error, but says "Disconnected"
**Problem:** Wrong IP or port

**Solutions:**
```powershell
# Find what's listening on port 4001
netstat -ano | findstr :4001
```

### 7. Check Ontime Version

This bundle requires **Ontime v4 or higher**.

Check your version:
- Open Ontime
- Look in bottom-left corner or About menu
- Should show "v4.x.x"

### 8. Advanced Debugging

#### Enable NodeCG Debug Logs

Edit `cfg/nodecg.json` (create if not exists):

```json
{
  "logging": {
    "console": {
      "level": "trace"
    }
  }
}
```

Restart NodeCG to see more detailed logs.

#### Check Network with PowerShell

```powershell
# Test if port is open
Test-NetConnection -ComputerName localhost -Port 4001

# Check what's using the port
Get-NetTCPConnection -LocalPort 4001
```

#### Manual WebSocket Test

Use a WebSocket testing tool:
- **Simple WebSocket Client** (Chrome extension)
- **Postman** (has WebSocket support)

Connect to: `ws://localhost:4001/ws`

After connection, send:
```json
{"tag":"poll"}
```

You should receive Ontime's state data.

### 9. Debug Info Interpretation

In the Connection panel's debug area, you'll see:

```
IP: localhost
Port: 4001
WebSocket: ws://localhost:4001/ws
HTTP: http://localhost:4001
Status: Connected/Disconnected
Error: [any error message]
```

**What to check:**
- Is the WebSocket URL correct?
- Can you open the HTTP URL in a browser?
- Does the error message give a clue?

### 10. Still Not Working?

#### Checklist:
- [ ] Ontime is running and accessible at `http://localhost:4001`
- [ ] Ontime version is v4+
- [ ] NodeCG is running (`npx nodecg start`)
- [ ] No firewall blocking port 4001
- [ ] Extension built successfully (`npm run build`)
- [ ] Browser shows NodeCG dashboard at `http://localhost:9090`
- [ ] No other application using port 4001

#### Get Help:

1. **Check extension logs** in NodeCG terminal
2. **Check browser console** (F12) in dashboard
3. **Check Ontime logs** in Ontime application
4. **Report issue** with:
   - NodeCG version
   - Ontime version  
   - Error messages from logs
   - Output of `Test Connection` button

## Quick Test Commands

```powershell
# Test if Ontime HTTP is accessible
Invoke-WebRequest -Uri "http://localhost:4001/api/version"

# Test if port is listening
Test-NetConnection -ComputerName localhost -Port 4001 -InformationLevel Detailed

# Check NodeCG is running
Get-Process | Where-Object {$_.ProcessName -eq "node"}

# View NodeCG logs in real-time (if running in background)
Get-Content logs\nodecg.log -Tail 50 -Wait
```

## Understanding Connection Flow

1. **Dashboard** → Sets `ontimeConfig` replicant (IP, port)
2. **Extension** → Detects config change
3. **Extension** → Creates WebSocket to `ws://ip:port/ws`
4. **Ontime** → Accepts connection (or rejects)
5. **Extension** → Sends `{"tag":"poll"}` request
6. **Ontime** → Responds with full state
7. **Extension** → Updates replicants with event data
8. **Dashboard/Graphics** → Subscribe to replicants, display updates

Any failure in steps 3-6 will show in the Connection panel and logs.
