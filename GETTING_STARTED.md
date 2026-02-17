# Getting Started

## Project Structure Created

The basic NodeCG bundle structure has been set up:

```
virtual-feast-director_v2/
├── package.json           ✓ Created
├── tsconfig.json          ✓ Created
├── .gitignore            ✓ Created
├── README.md             ✓ Updated
├── SETUP.md              ✓ Complete setup guide
│
├── extension/
│   └── index.ts          ✓ Entry point (needs implementation)
│
├── dashboard/
│   └── connection.html   ✓ Basic panel (needs implementation)
│
├── graphics/
│   ├── director.html     ✓ Basic layout (needs implementation)
│   └── director.css      ✓ Basic styles
│
├── schemas/
│   ├── ontime-config.json      ✓ Complete
│   └── display-settings.json   ✓ Complete
│
└── spec/
    └── spec.md           ✓ Full specification
```

## Next Steps

### 1. Install Dependencies

```powershell
npm install
```

This will install:
- NodeCG (as a project dependency)
- TypeScript and build tools
- Type definitions

### 2. Implementation Roadmap

Follow the development roadmap in [spec/spec.md](spec/spec.md#9-development-roadmap):

#### Phase 1: Core Infrastructure ✓ (Done)
- [x] Set up NodeCG bundle structure
- [x] Create package.json with dependencies
- [x] Set up replicant schemas
- [x] Create basic dashboard panel structure
- [x] Create basic graphics HTML structure

#### Phase 2: Ontime Integration (Next)
- [ ] Implement WebSocket connection in extension
- [ ] Implement HTTP client for event data
- [ ] Implement Ontime message parsing
- [ ] Implement event filtering logic
- [ ] Handle connection errors and reconnection
- [ ] Update replicants with Ontime data

#### Phase 3: Graphics Display
- [ ] Implement current event display
- [ ] Implement upcoming events display
- [ ] Implement smooth transitions

#### Phase 4: Dashboard Controls
- [ ] Connection configuration panel
- [ ] Appearance settings panel
- [ ] Status monitoring panel
- [ ] Data panel

#### Phase 5: Customization
- [ ] Color customization
- [ ] Font customization
- [ ] Layout options
- [ ] Custom field selection

#### Phase 6: Polish & Documentation
- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] User documentation

### 3. Start Development

```powershell
# Terminal 1: Start NodeCG (will show errors until extension is implemented)
npx nodecg start

# Terminal 2: Watch TypeScript files
npm run watch
```

### 4. Placeholder Files to Implement

**Extension (`extension/index.ts`):**
- WebSocket client for Ontime
- HTTP client for full event data
- Replicant management
- Event filtering logic

**Dashboard Panels (create these files):**
- `dashboard/connection.html` + `.ts` - Connection config
- `dashboard/appearance.html` + `.ts` - Appearance settings
- `dashboard/status.html` + `.ts` - Status monitoring
- `dashboard/data.html` + `.ts` - Event data management

**Graphics (`graphics/director.ts`):**
- Replicant subscriptions
- DOM updates
- Transition animations

## Key Implementation Details

### Replicants to Create

```typescript
// In extension/index.ts
const ontimeConfig = nodecg.Replicant('ontimeConfig', {
  defaultValue: { ip: 'localhost', port: 4001 }
});

const ontimeConnected = nodecg.Replicant<boolean>('ontimeConnected', {
  defaultValue: false
});

const currentEvent = nodecg.Replicant('currentEvent');
const upcomingEvents = nodecg.Replicant('upcomingEvents', {
  defaultValue: []
});

const displaySettings = nodecg.Replicant('displaySettings');
```

### WebSocket Connection Pattern

```typescript
import WebSocket from 'ws';

let ws: WebSocket | null = null;

ontimeConfig.on('change', (newVal) => {
  connectToOntime(newVal.ip, newVal.port);
});

function connectToOntime(ip: string, port: number) {
  ws = new WebSocket(`ws://${ip}:${port}/ws`);
  
  ws.on('open', () => {
    ontimeConnected.value = true;
    ws?.send(JSON.stringify({ tag: 'poll' }));
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    handleOntimeMessage(message);
  });
  
  ws.on('error', (err) => {
    nodecg.log.error('Ontime connection error:', err);
    ontimeConnected.value = false;
  });
}
```

### HTTP Event Fetching

```typescript
async function fetchEvents(ip: string, port: number) {
  const response = await fetch(`http://${ip}:${port}/api/rundown`);
  const events = await response.json();
  
  // Filter for public events
  const publicEvents = events.filter(e => 
    e.type === 'event' && 
    !e.skip && 
    e.custom?.public === true
  );
  
  return publicEvents;
}
```

## Testing

Once basic implementation is done:

1. **Start Ontime** (v4+) on port 4001
2. **Add custom field** `public` (Boolean) in Ontime
3. **Mark some events as public**
4. **Start NodeCG**: `npx nodecg start`
5. **Open dashboard**: `http://localhost:9090`
6. **Configure connection** in Connection panel
7. **View graphics**: `http://localhost:9090/graphics/director.html`

## Resources

- **Full Spec**: [spec/spec.md](spec/spec.md)
- **Setup Guide**: [SETUP.md](SETUP.md)
- **NodeCG Docs**: https://www.nodecg.dev/docs/
- **Ontime API**: https://docs.getontime.no/api/

## Questions?

Refer to the detailed specification in `spec/spec.md` for:
- Complete technical architecture
- Data flow diagrams
- API integration details
- Configuration examples
