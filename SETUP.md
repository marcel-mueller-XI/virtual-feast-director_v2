# Virtual Feast Director v2 - Setup Guide

Quick setup guide for Windows developers.

**Uses new NodeCG installation method** - NodeCG is a project dependency, not a global install.

## Prerequisites

- Node.js 18+ ([nodejs.org](https://nodejs.org/))
- Ontime v4+ running on network


## Install Bundle

```powershell
git clone https://github.com/marcel-mueller-XI/virtual-feast-director_v2.git
cd virtual-feast-director_v2
npm install
npm run build
```

NodeCG is installed as a dependency in `package.json`.

**Using other bundles?** Place them in a `bundles/` directory in the project root.

## Configure Ontime

1. Download Ontime v4+ from [getontime.no](https://getontime.no/)
2. Install and launch (default: `http://localhost:4001`)
3. Add custom field `public` (type: Boolean) in Settings → Custom Fields
4. Mark events as public in the rundown

## Configure Bundle

```powershell
npx nodecg start
```

Dashboard: `http://localhost:9090`

1. **Connection Panel**: Set Ontime IP/port, connect
2. **Appearance Panel**: Configure colors, fonts, alignment, event count
3. **Data Panel**: Toggle event visibility, hide/show graphics

## Add to OBS

Add Browser Source:
```
http://localhost:9090/graphics/director.html
```

With the new NodeCG installation method, the bundle becomes the main project, so graphics are at the root level.

## Development

```powershell
# Terminal 1
npx nodecg start

# Terminal 2
npm run watch
```

## Production

```powershell
npm install -g pm2
pm2 start npx -- nodecg start
pm2 save
pm2 startup
```

## Troubleshooting

**Port conflict:**
```powershell
netstat -ano | findstr :9090
taskkill /PID <pid> /F
```

Or change port in `cfg\nodecg.json`:
```json
{"host": "localhost", "port": 9091}
```

**Bundle not loading:** Rebuild and restart
```powershell
npm run build
npx nodecg start
```

## Network Setup

For remote access, allow firewall rules:
- NodeCG: Port 9090
- Ontime: Port 4001

Access from network: `http://<your-ip>:9090`

## Quick Reference

```powershell
# Start NodeCG
npx nodecg start

# Build bundle
npm run build

# Watch (dev)
npm run watch

# Rebuild from scratch
rm -r node_modules, dist
npm install
npm run build
```

---

See [spec/spec.md](spec/spec.md) for detailed functionality.
