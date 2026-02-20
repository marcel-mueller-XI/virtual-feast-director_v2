# Virtual Feast Director v2

NodeCG bundle for displaying Ontime event information on projection screens and LED walls.

## Overview

**This software is mostly written by AI.**  
Virtual Feast Director v2 displays the title of the **current event** and **upcoming events** from [Ontime](https://github.com/cpvalente/ontime) in a clean, customizable interface designed for projection screens and LED walls.
This is intended for use at live events or conferences.

**Key Features:**
- Real-time WebSocket connection to Ontime v4+
- Customizable appearance (colors, fonts, alignment)
- Public/private event filtering
- Transparent background for overlay
- Works with OBS, vMix, XSplit, CasparCG

## Differences from Version 1

Unlike the original Virtual Feast Director:
- **NodeCG bundle** instead of Ontime custom view
- **More flexible** - Works independently of Ontime's view system
- **Enhanced control** - Dashboard panels for configuration

## Quick Start

```powershell
git clone https://github.com/marcel-mueller-XI/virtual-feast-director_v2.git
cd virtual-feast-director_v2
npm install
npm run build
npx nodecg start
```

Dashboard: `http://localhost:9090`  
Graphics: `http://localhost:9090/graphics/director.html`

## Documentation

- **[SETUP.md](SETUP.md)** - Complete installation and configuration guide
- **[spec/spec.md](spec/spec.md)** - Detailed technical specification

## Requirements

- Node.js 18+
- Ontime v4+
- Modern browser (Chrome 90+, Firefox 88+)

## License

GPL-3.0

## Credits

Based on the original [virtual-feast-director](https://github.com/marcel-mueller-XI/virtual-feast-director).  