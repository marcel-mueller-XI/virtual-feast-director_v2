# Virtual Feast Director v2 - Specification

## 1. Project Overview

### 1.1 Purpose
Virtual Feast Director v2 is a NodeCG bundle designed for live events to display event scheduling information on projection screens or LED walls. It shows the **current public event** with detailed information and the **next three public events** (title only) in a clean, professional interface.

### 1.2 Key Differences from Version 1
Unlike the original Virtual Feast Director, version 2 is:
- **Not a custom view for Ontime** - It's a standalone NodeCG bundle
- **Based on NodeCG framework** - Leverages NodeCG's infrastructure for graphics, dashboard panels, and state management
- **Designed for Ontime v4+** - Uses Ontime v4's WebSocket API and data structures
- **More flexible deployment** - Can be used with any streaming software (OBS, vMix, XSplit, CasparCG)
- **Enhanced control** - Provides dashboard controls for operators

### 1.3 Target Audience
- Live event producers
- Festival directors
- Church productions
- Streaming productions

## 2. Core Functionality

### 2.1 Display Features
The graphics always render with a transparent background (hardcoded) and display only text:

#### Current Event
- Event title (big)

#### Upcoming Events
- Event title (smaller)

**Note**: The setting `count_visible_events` determines the total number of events displayed, including the current event. For example, if `count_visible_events = 4`, the display shows 1 current event + 3 upcoming events.

### 2.2 Data Filtering
- Only display **public events** (filterable by custom fields),
- Option to choose if event is public or private from dashboard.
- Skip events marked as "skip" in Ontime

### 2.3 Styling & Customization
- Always transparent background (hardcoded, not user-configurable)
- Customizable text color via NodeCG dashboard
- Option for left or right alignment
- Configurable fonts
- Separate font sizes for current and upcoming events
- **No word wrap** — text is always single-line
- **Max text width (px)**: if rendered text exceeds this width it is truncated with `…`; measures actual rendered width, not character count
- Responsive layout
- Smooth transitions between events

## 3. Technical Architecture

### 3.1 Technology Stack
- **Framework**: NodeCG (latest stable version)
- **Frontend**: HTML5, CSS3, TypeScript
- **Communication**: 
  - WebSocket connection to Ontime for real-time runtime data (timer, current event)
  - HTTP API calls to Ontime for fetching complete event data including custom fields (needed for public/private filtering)
- **Rendering**: Web browser (OBS Browser Source, vMix, etc.)

### 3.2 NodeCG Bundle Structure
```
virtual-feast-director_v2/
├── package.json              # NodeCG bundle manifest
├── dashboard/                # Dashboard panels for operator control
│   ├── index.html           # Main control panel
│   ├── style.css            # Dashboard styling
│   └── panel.ts             # Dashboard logic
├── graphics/                 # Graphics displays
│   ├── director.html        # Main director view
│   ├── director.css         # Graphics styling
│   └── director.ts          # Graphics logic
├── extension/                # Server-side extension
│   └── index.ts             # Ontime WebSocket connection handler
├── schemas/                  # Replicant schemas
│   ├── ontime-config.json   # Ontime connection settings
│   ├── display-settings.json # Display customization
│   └── runtime-data.json    # Ontime runtime data
└── README.md
```

### 3.3 NodeCG Components

#### Replicants (State Management)
- `ontimeConfig`: Ontime server connection details (IP, port)
- `ontimeConnected`: Connection status
- `runtimeData`: Current Ontime runtime data
- `currentEvent`: Currently playing/loaded event
- `upcomingEvents`: Next X public events
- `displaySettings`: Customization options (colors, fonts, layout)

#### Dashboard Panels
- **Connection Panel**: Configure Ontime server connection
- **Appearance Panel**: Customize appearance, define how many events are shown `count_visible_events`
- **Data Panel**: List of all events (not only public events), option to set events public/private, hide/show grafic, 

#### Graphics
- **Director View**: Main display for screens/projectors

#### Extension (Server-side)
- Manages WebSocket connection to Ontime
- Handles data filtering and processing
- Updates replicants with event data
- Monitors connection health

## 4. Ontime v4 Integration

### 4.1 WebSocket and HTTP Connection
- **WebSocket**: Connect to Ontime WebSocket API at `ws://<ontime-ip>:<ontime-port>/ws`
  - Listen for runtime data broadcasts (current event, timer state, playback)
  - Handle connection failures gracefully
  - Auto-reconnection logic
- **HTTP**: Use Ontime HTTP API at `http://<ontime-ip>:<ontime-port>/api`
  - Fetch complete rundown data including all custom fields
  - Required because WebSocket doesn't provide full custom field data for upcoming events
  - Used for initial data load and when event list needs refresh

### 4.2 Data Sources

#### Runtime Data (from Ontime WebSocket)
Ontime v4 broadcasts two relevant message types:
- `runtime-data`: Partial `RuntimeStore` object broadcast on every state change (current event, timer, playback). Contains fields such as `eventNow`, `eventNext`, `timer`, etc.
- `refetch`: Signals that persistent REST data has changed and should be re-fetched. Payload is `{ target: string, revision: number }`. Relevant target keys: `rundown` (event list changed), `custom-fields`, etc.
- `poll`: Response to an explicit `{tag:"poll"}` request — contains the full `RuntimeStore` snapshot.

#### Event Data Structure
Events contain:
- `id`: Unique event identifier
- `title`: Event title
- `cue`: Event cue identifier
- `timeStart`: Scheduled start time (milliseconds from midnight)
- `timeEnd`: Scheduled end time (milliseconds from midnight)
- `duration`: Event duration (milliseconds)
- `skip`: Whether event should be skipped
- `colour`: Event color
- `custom`: Object with custom fields
- `timerType`: count-down, count-up, clock, or none

### 4.3 Event Filtering Logic
The extension should filter events based on:
1. **Skip status**: Exclude events with `skip: true`
2. **Custom field filtering**: Check the `custom.public` field — if the field contains **any non-empty text** the event is considered public; if the field is absent, `null`, or an empty string the event is considered private. (Ontime stores custom field values as text, so users simply type any value such as `"true"` or `"yes"` to mark an event public and leave it blank to make it private.)
3. **Event type**: Only include type "event" (exclude blocks, delays, etc.)

### 4.4 Polling & Updates
- Initial connection: Send `{tag: "poll"}` to get full state
- Real-time updates: Listen for granular WebSocket messages
- Update frequency: As broadcast by Ontime (event-driven)

## 5. Features & Requirements

### 5.1 Functional Requirements

#### FR-1: Connection Management
- Configure Ontime server IP and port via dashboard
- Display connection status (connected/disconnected)
- Auto-reconnect on connection loss
- Error handling and user feedback

#### FR-2: Event Display
- Display current event
- Display next `count_visible_events` upcoming public events (title only)
- Update display in real-time as events change
- Smooth transitions between events

#### FR-3: Customization
- Configurable colors (background, text, accents)
- Configurable fonts
- Adjustable text sizes

#### FR-4: Data Filtering
- Filter events by custom field value: `public`
- Configurable filter criteria via dashboard
- Default filter: show only public events

### 5.2 Non-Functional Requirements

#### NFR-1: Performance
- Low latency (<100ms from Ontime update to display update)
- Efficient WebSocket handling
- Minimal CPU/memory usage
- 60 FPS graphics rendering

#### NFR-2: Reliability
- Graceful handling of connection issues
- No crashes or data loss
- Automatic recovery from errors

#### NFR-3: Usability
- Intuitive dashboard controls
- Clear status indicators
- Minimal configuration required
- Comprehensive documentation

#### NFR-4: Compatibility
- NodeCG v2.x compatible
- Ontime v4.0+ compatible
- Modern browser support (Chrome 90+, Firefox 88+)
- Compatible with streaming software (OBS, vMix, CasparCG)

## 6. User Interface Design

### 6.1 Graphics Display Layout

```
Event Title Here

Next Event Title
Another Event Title
Third Event Title
```

### 6.2 Dashboard Panels

#### Connection Panel
- Ontime server IP input
- Ontime server port input
- Connect/Disconnect button
- Connection status indicator
- Test connection button

#### Appearance Panel
- Color pickers (background, text, accents)
- Font selection dropdowns
- Text size option (separate for current and upcomming events)
- Bold toggle for current event
- Max text width input (px) — text exceeding this rendered width is truncated with `…`
- Text position sliders
- left/right alignment
- choose how many events will be shown `count_visible_events`, including the current event

#### Data Panel
- Show all events, not only those to be shown
- Toggle public/private of events — writes the change back to Ontime via `GET /api/change/<eventId>?custom:public=<value>` (non-empty string for public, empty string for private)
- Visual indication which events are shown
- Toggle for hide/show graphics (controls visibility of the entire graphics output)
- Event list updates automatically whenever Ontime signals a rundown change via WebSocket (no manual refresh button)
- Live preview

## 7. Data Flow

### 7.1 Connection Flow
1. User configures Ontime connection in dashboard
2. Extension establishes WebSocket connection
3. Extension sends `poll` request
4. Ontime responds with full runtime state
5. Extension updates `ontimeConnected` replicant to `true`

### 7.2 Update Flow
1. Ontime broadcasts state change via WebSocket
2. Extension receives message
3. Extension filters and processes event data
4. Extension updates relevant replicants
5. Graphics subscribe to replicants and update display

### 7.3 Error Flow
1. Connection lost or error occurs
2. Extension updates `ontimeConnected` to `false`
3. Dashboard displays error notification
4. Extension attempts auto-reconnect (exponential backoff)
5. On reconnect, full poll is performed

## 8. Configuration

### 8.1 Default Settings
```json
{
  "ontimeServer": {
    "ip": "localhost",
    "port": 4001
  },
  "display": {
    "colors": {
      "background": "#ffffff00",
      "text": "#ffffff"
    },
    "fonts": {
      "title": "Arial, sans-serif",
      "body": "Arial, sans-serif"
    },
  },
  "filtering": {
    "customField": "public",
    "customFieldValue": "<any non-empty text>"
  }
}
```

### 8.2 Replicant Schemas

#### ontime-config.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "type": "object",
  "properties": {
    "ip": {
      "type": "string",
      "default": "localhost"
    },
    "port": {
      "type": "number",
      "default": 4001
    }
  }
}
```

#### display-settings.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "type": "object",
  "properties": {
    "colors": {
      "type": "object"
    },
    "fonts": {
      "type": "object"
    },
  }
}
```

## 9. Development Roadmap

### Phase 1: Core Infrastructure
- [ ] Set up NodeCG bundle structure
- [ ] Create initial package.json with dependencies
- [ ] Set up replicant schemas
- [ ] Create basic dashboard panel structure
- [ ] Create basic graphics HTML structure

### Phase 2: Ontime Integration
- [ ] Implement WebSocket connection in extension
- [ ] Implement Ontime message parsing
- [ ] Implement event filtering logic
- [ ] Handle connection errors and reconnection
- [ ] Update replicants with Ontime data

### Phase 3: Graphics Display
- [ ] Implement current event display
- [ ] Implement upcoming events display
- [ ] Implement timer formatting and display
- [ ] Add timer state indicators
- [ ] Implement smooth transitions

### Phase 4: Dashboard Controls
- [ ] Connection configuration panel
- [ ] Display settings panel
- [ ] Live preview functionality

### Phase 5: Customization
- [ ] Color customization
- [ ] Font customization
- [ ] Layout options
- [ ] Theme presets
- [ ] Custom field selection

### Phase 6: Polish & Documentation
- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] Comprehensive README
- [ ] User documentation
- [ ] Installation guide
- [ ] Configuration examples

## 10. Testing Requirements

### 10.1 Unit Tests
- WebSocket message parsing
- Event filtering logic
- Time formatting functions
- Configuration validation

### 10.2 Integration Tests
- Ontime connection establishment
- Data flow from Ontime to graphics
- Replicant updates
- Dashboard-extension communication

### 10.3 Manual Tests
- Visual regression testing
- Browser compatibility
- Streaming software compatibility
- Connection failure scenarios
- Long-running stability

## 11. Deployment

### 11.1 Installation
1. Install NodeCG
2. Clone bundle to `bundles/virtual-feast-director_v2`
3. Run `npm install` in bundle directory
4. Start NodeCG
5. Configure Ontime connection in dashboard
6. Add graphics to streaming software as browser source

### 11.2 Browser Source URL
```
http://localhost:9090/bundles/virtual-feast-director_v2/graphics/director.html
```

### 11.3 System Requirements
- Node.js 18+ (for NodeCG)
- Modern browser (Chrome 90+, Firefox 88+)
- Network access to Ontime server
- Sufficient bandwidth for WebSocket connection

## 12. Future Enhancements

### Potential Future Features
- Multiple graphic layouts (horizontal, vertical, minimal)
- Transition animation options
- Sound notifications for event changes
- Integration with other timing systems
- Multi-language support
- Mobile-responsive dashboard
- Export/import of settings
- Multiple Ontime instances support
- Advanced filtering with multiple conditions
- Custom CSS injection
- Graphic overlays and effects

## 13. License & Attribution

### License
GPL-3.0 (matching original virtual-feast-director)

### Credits
- Based on the original virtual-feast-director
- Built for Ontime by Carlos Valente
- Powered by NodeCG framework

## 14. References

### Documentation
- [Ontime Documentation](https://docs.getontime.no/)
- [Ontime API Documentation](https://docs.getontime.no/api/)
- [Ontime WebSocket API](https://docs.getontime.no/api/protocols/websockets/)
- [Ontime Runtime Data](https://docs.getontime.no/api/data/runtime-data/)
- [NodeCG Documentation](https://www.nodecg.dev/docs/)
- [NodeCG Bundle Guide](https://www.nodecg.dev/docs/creating-bundles/)

### Related Projects
- [Original virtual-feast-director](https://github.com/marcel-mueller-XI/virtual-feast-director)
- [Ontime GitHub](https://github.com/cpvalente/ontime)
- [NodeCG GitHub](https://github.com/nodecg/nodecg)
