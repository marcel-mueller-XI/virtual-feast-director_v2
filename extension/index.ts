// Extension entry point
// Note: Using 'any' type for nodecg parameter due to @nodecg/types resolution issues
// The nodecg object will have all ServerAPI methods at runtime

import WebSocket from 'ws';

export = (nodecg: any) => {
  nodecg.log.info('Virtual Feast Director v2 extension loaded');

  // Create replicants
  const ontimeConfig = nodecg.Replicant('ontimeConfig', {
    defaultValue: { ip: 'localhost', port: 4001 },
    persistent: true
  });

  const displaySettings = nodecg.Replicant('displaySettings', {
    defaultValue: {
      colors: { text: '#000000' },
      font: 'Arial, sans-serif',
      textSize: { current: 48, upcoming: 32 },
      position: { x: 0, y: 0 },
      maxTextWidth: 1800,
      currentBold: true,
      alignment: 'left',
      countVisibleEvents: 4
    },
    persistent: true
  });

  const ontimeConnected = nodecg.Replicant('ontimeConnected', {
    defaultValue: false,
    persistent: false
  });

  const connectionError = nodecg.Replicant('connectionError', {
    defaultValue: null,
    persistent: false
  });

  const ontimeProjectStarted = nodecg.Replicant('ontimeProjectStarted', {
    defaultValue: false,
    persistent: false
  });

  const currentEvent = nodecg.Replicant('currentEvent', {
    defaultValue: null
  });

  const upcomingEvents = nodecg.Replicant('upcomingEvents', {
    defaultValue: []
  });

  const allEvents = nodecg.Replicant('allEvents', {
    defaultValue: []
  });

  // The real current event as reported by Ontime — regardless of public/private.
  // Exposed so the data panel can always show which event is live in Ontime.
  const ontimeCurrentEvent = nodecg.Replicant('ontimeCurrentEvent', {
    defaultValue: null,
    persistent: false
  });

  const eventVisibility = nodecg.Replicant('eventVisibility', {
    defaultValue: {},
    persistent: true
  });

  const graphicsVisible = nodecg.Replicant('graphicsVisible', {
    defaultValue: true,
    persistent: true
  });

  let ws: WebSocket | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;
  let intentionalClose = false;

  // Raw current event ID from Ontime (regardless of public/private status).
  // Used to correctly calculate which events are "upcoming" even when the
  // current event itself is private and therefore not exposed to graphics.
  let liveCurrentEventId: string | null = null;

  // Ensure the 'public' custom field exists in Ontime; create it if not.
  async function ensureCustomFieldPublic(ip: string, port: number): Promise<void> {
    const baseUrl = `http://${ip}:${port}`;
    try {
      const getRes = await fetch(`${baseUrl}/data/custom-fields`);
      if (!getRes.ok) {
        nodecg.log.warn(`Could not fetch custom fields: HTTP ${getRes.status}`);
        return;
      }
      const fields: Record<string, any> = await getRes.json();
      if (Object.values(fields).some((f: any) => f.label === 'public')) {
        nodecg.log.info('Custom field "public" already exists in Ontime — skipping creation');
        return;
      }
      const postRes = await fetch(`${baseUrl}/data/custom-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'public', colour: '#4fd4c2', type: 'text' })
      });
      if (postRes.ok) {
        nodecg.log.info('Created custom field "public" in Ontime');
      } else {
        const body = await postRes.text();
        nodecg.log.warn(`Failed to create custom field "public": HTTP ${postRes.status} — ${body}`);
      }
    } catch (err) {
      nodecg.log.error('Error ensuring custom field "public":', err);
    }
  }

  // Fetch rundown data from Ontime HTTP API
  async function fetchRundownData(ip: string, port: number): Promise<any[]> {
    const url = `http://${ip}:${port}/data/rundowns/current`;
    nodecg.log.info(`Fetching rundown data from ${url}`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      // Response structure: { id, title, order, flatOrder, entries, revision }
      // entries is a dict keyed by ID; flatOrder gives the display order
      const entries: Record<string, any> = data?.entries ?? {};
      const flatOrder: string[] = data?.flatOrder ?? [];

      const events = flatOrder
        .map((id: string) => entries[id])
        .filter(Boolean);

      nodecg.log.info(`✓ Fetched ${events.length} entries from Ontime rundown`);
      return events;
    } catch (err: any) {
      nodecg.log.error(`Failed to fetch rundown data: ${err.message}`);
      return [];
    }
  }

  // Filter events based on visibility settings and skip status
  function filterEvents(events: any[]): any[] {
    return events.filter((event: any) => {
      // Only include type "event" (exclude blocks, delays, etc.)
      if (event.type !== 'event') {
        return false;
      }
      
      // Exclude events marked as skip
      if (event.skip === true) {
        return false;
      }
      
      // Check visibility setting
      const visibility = eventVisibility.value[event.id];
      
      // If visibility is explicitly set, use that
      if (visibility !== undefined) {
        return visibility === true;
      }
      
      // Otherwise, check custom field 'public':
      // any non-empty string = public, absent/empty = private
      if (event.custom && 'public' in event.custom) {
        const val = event.custom.public;
        return typeof val === 'string' ? val.trim().length > 0 : Boolean(val);
      }
      
      // Default: hide event if the custom field is not present at all
      return false;
    });
  }

  // Recompute currentEvent based on liveCurrentEventId and current visibility rules.
  // Must be called whenever visibility settings change, not just on WebSocket updates.
  function updateCurrentEvent() {
    if (ontimeProjectStarted.value === false) {
      currentEvent.value = null;
      return;
    }

    if (!liveCurrentEventId) {
      currentEvent.value = null;
      return;
    }

    const allEventsRaw: any[] = allEvents.value as any[];
    const liveEvent = allEventsRaw.find((e: any) => e.id === liveCurrentEventId) ?? null;

    if (!liveEvent) {
      currentEvent.value = null;
      return;
    }

    const filtered = filterEvents([liveEvent]);
    if (filtered.length > 0) {
      // Live event is public — show it on graphics.
      currentEvent.value = JSON.parse(JSON.stringify(liveEvent));
    } else {
      // Live event is private — show the last public event before it.
      const rawIndex = allEventsRaw.findIndex((e: any) => e.id === liveCurrentEventId);
      if (rawIndex > 0) {
        const eventsBefore = allEventsRaw.slice(0, rawIndex);
        const filteredBefore = filterEvents(eventsBefore);
        currentEvent.value = filteredBefore.length > 0
          ? JSON.parse(JSON.stringify(filteredBefore[filteredBefore.length - 1]))
          : null;
      } else {
        currentEvent.value = null;
      }
    }
  }

  // Update filtered upcoming events
  function updateUpcomingEvents() {
    if (ontimeProjectStarted.value === false) {
      upcomingEvents.value = [];
      return;
    }

    const allEventsRaw: any[] = allEvents.value as any[];
    const count = (displaySettings.value.countVisibleEvents || 4) - 1;

    // Find the raw position of the current event (which may be private)
    // so upcoming events are always those that come *after* the current
    // event in rundown order, regardless of its visibility.
    if (liveCurrentEventId) {
      const rawIndex = allEventsRaw.findIndex((e: any) => e.id === liveCurrentEventId);
      if (rawIndex !== -1) {
        const eventsAfter = allEventsRaw.slice(rawIndex + 1);
        const filtered = filterEvents(eventsAfter);
        const upcoming = JSON.parse(JSON.stringify(filtered.slice(0, count)));
        upcomingEvents.value = upcoming;
        nodecg.log.debug(`Updated upcoming events: ${upcoming.length} events (after raw index ${rawIndex})`);
        return;
      }
    }

    // No current event known — show first N public events
    const filtered = filterEvents(allEventsRaw);
    const upcoming = JSON.parse(JSON.stringify(filtered.slice(0, count)));
    upcomingEvents.value = upcoming;
    nodecg.log.debug(`Updated upcoming events: ${upcoming.length} events (no current event)`);
  }

  // Refresh all event data from Ontime
  async function refreshEventData() {
    const config = ontimeConfig.value;
    if (!config || !config.ip || !config.port) {
      nodecg.log.warn('Cannot refresh events: Ontime config not set');
      return;
    }
    
    const events = await fetchRundownData(config.ip, config.port);
    allEvents.value = events;
    
    // Derive visibility from Ontime custom.public field for every event.
    // This re-syncs on every refresh so stale persisted values cannot linger.
    // Manual dashboard overrides are intentionally overwritten by a refresh.
    events.forEach((event: any) => {
      if (event.type !== 'event') return;
      const pubVal = event.custom?.public;
      const isPublic = typeof pubVal === 'string' ? pubVal.trim().length > 0 : Boolean(pubVal);
      eventVisibility.value[event.id] = isPublic;
    });
    
    updateCurrentEvent();
    updateUpcomingEvents();
  }

  // Connect to Ontime
  function connectToOntime(ip: string, port: number) {
    if (ws) {
      nodecg.log.info('Closing existing WebSocket connection...');
      intentionalClose = true;
      ws.close();
      ws = null;
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    const wsUrl = `ws://${ip}:${port}/ws`;
    nodecg.log.info(`Attempting to connect to Ontime at ${wsUrl}`);

    try {
      ws = new WebSocket(wsUrl, {
        handshakeTimeout: 5000
      });

      ws.on('open', () => {
        nodecg.log.info(`✓ Connected to Ontime at ${wsUrl}`);
        ontimeConnected.value = true;
        connectionError.value = null;
        reconnectAttempts = 0;

        // Request initial state
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ tag: 'poll' }));
          nodecg.log.info('Sent poll request to Ontime');
        }
        
        // Ensure the 'public' custom field exists, then fetch rundown data
        ensureCustomFieldPublic(ip, port);
        refreshEventData();
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          nodecg.log.debug('Received message from Ontime:', message.tag || 'unknown');
          handleOntimeMessage(message);
        } catch (err) {
          nodecg.log.error('Failed to parse Ontime message:', err);
        }
      });

      ws.on('error', (err: Error) => {
        nodecg.log.error(`WebSocket error: ${err.message}`);
        connectionError.value = `WebSocket error: ${err.message}`;
        ontimeConnected.value = false;
      });

      ws.on('close', (code: number, reason: Buffer) => {
        nodecg.log.warn(`WebSocket closed. Code: ${code}, Reason: ${reason.toString()}`);
        ontimeConnected.value = false;
        ws = null;

        if (intentionalClose) {
          intentionalClose = false;
          return;
        }

        // Attempt reconnect
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
          nodecg.log.info(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
          reconnectTimer = setTimeout(() => {
            connectToOntime(ip, port);
          }, delay);
        } else {
          nodecg.log.error('Max reconnection attempts reached. Please check connection manually.');
          connectionError.value = 'Max reconnection attempts reached';
        }
      });

    } catch (err: any) {
      nodecg.log.error(`Failed to create WebSocket: ${err.message}`);
      connectionError.value = `Failed to create WebSocket: ${err.message}`;
      ontimeConnected.value = false;
    }
  }

  function handleOntimeMessage(message: any) {
    switch (message.tag) {
      case 'poll':
        // Response to our initial poll request — full RuntimeStore snapshot
        nodecg.log.debug('Received poll (full state) response');
        if (message.payload) {
          updateFromRuntimeData(message.payload);
        }
        break;

      case 'runtime-data':
        // Partial RuntimeStore broadcast on every state change
        nodecg.log.debug('Received runtime-data update');
        if (message.payload) {
          updateFromRuntimeData(message.payload);
        }
        break;

      case 'refetch':
        // Ontime signals that persistent data (rundown, custom fields, etc.) has changed
        nodecg.log.debug(`Received refetch signal for: ${message.payload?.target ?? 'all'}`);
        refreshEventData();
        break;

      default:
        // Log unknown message types for debugging
        nodecg.log.debug(`Unhandled message type: ${message.tag}`);
    }
  }

  function parseProjectStarted(runtimeData: any): boolean | null {
    if (!runtimeData || typeof runtimeData !== 'object') {
      return null;
    }

    if (typeof runtimeData.started === 'boolean') {
      return runtimeData.started;
    }

    const playback = runtimeData.playback;
    if (typeof playback === 'boolean') {
      return playback;
    }
    if (typeof playback === 'string') {
      const normalized = playback.toLowerCase();
      return !['stop', 'stopped', 'idle', 'paused', 'pause', 'none'].includes(normalized);
    }
    if (playback && typeof playback === 'object') {
      if (typeof playback.started === 'boolean') return playback.started;
      if (typeof playback.isRunning === 'boolean') return playback.isRunning;
      if (typeof playback.isPlaying === 'boolean') return playback.isPlaying;
      if (typeof playback.playing === 'boolean') return playback.playing;
      if (typeof playback.state === 'string') {
        const normalized = playback.state.toLowerCase();
        return !['stop', 'stopped', 'idle', 'paused', 'pause', 'none'].includes(normalized);
      }
    }

    const timer = runtimeData.timer;
    if (timer && typeof timer === 'object') {
      if (typeof timer.isRunning === 'boolean') return timer.isRunning;
      if (typeof timer.running === 'boolean') return timer.running;
      if (typeof timer.started === 'boolean') return timer.started;
      if (typeof timer.startedAt === 'number') return timer.startedAt > 0;
      if (typeof timer.state === 'string') {
        const normalized = timer.state.toLowerCase();
        return !['stop', 'stopped', 'idle', 'paused', 'pause', 'none'].includes(normalized);
      }
    }

    if ('eventNow' in runtimeData) {
      return Boolean(runtimeData.eventNow);
    }

    return null;
  }

  function updateFromRuntimeData(data: any) {
    const started = parseProjectStarted(data);
    if (started !== null) {
      ontimeProjectStarted.value = started;
    }

    if (ontimeProjectStarted.value === false) {
      liveCurrentEventId = null;
      ontimeCurrentEvent.value = null;
      updateCurrentEvent();
      updateUpcomingEvents();
      return;
    }

    // payload is Partial<RuntimeStore>, so only update fields that are present
    if ('eventNow' in data) {
      const event = data.eventNow;
      liveCurrentEventId = event?.id ?? null;

      // Always expose the real Ontime current event so the data panel can
      // show which event is live even when it is private.
      ontimeCurrentEvent.value = event ? JSON.parse(JSON.stringify(event)) : null;

      updateCurrentEvent();
      updateUpcomingEvents();
    }
  }

  // Listen for config changes
  ontimeConfig.on('change', (newValue: any) => {
    if (newValue && newValue.ip && newValue.port) {
      nodecg.log.info(`Ontime config changed: ${newValue.ip}:${newValue.port}`);
      reconnectAttempts = 0; // Reset attempts on manual reconnect
      connectToOntime(newValue.ip, newValue.port);
    }
  });

  // Listen for display settings changes
  displaySettings.on('change', () => {
    nodecg.log.debug('Display settings changed, updating events');
    updateUpcomingEvents();
  });

  // Listen for event visibility changes — must also recompute currentEvent
  // because toggling an event public/private can change what appears as current.
  eventVisibility.on('change', () => {
    nodecg.log.debug('Event visibility changed, updating events');
    updateCurrentEvent();
    updateUpcomingEvents();
  });

  // Write event public/private state back to Ontime via HTTP change API
  async function writeEventVisibilityToOntime(eventId: string, visible: boolean): Promise<void> {
    const config = ontimeConfig.value;
    if (!config || !config.ip || !config.port) {
      nodecg.log.warn('Cannot write event visibility: Ontime config not set');
      return;
    }

    // Any non-empty string = public, empty string = private
    const publicValue = visible ? 'true' : '';
    const url = `http://${config.ip}:${config.port}/api/change/${eventId}?custom:public=${encodeURIComponent(publicValue)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      nodecg.log.info(`✓ Set event ${eventId} custom:public=${publicValue || '(empty)'} in Ontime`);
    } catch (err: any) {
      nodecg.log.error(`Failed to write event visibility to Ontime: ${err.message}`);
    }
  }

  // Message handlers for dashboard communication
  nodecg.listenFor('setEventVisibility', (data: { eventId: string; visible: boolean }) => {
    nodecg.log.info(`Setting event ${data.eventId} visibility to ${data.visible}`);
    // Update local replicant immediately for instant UI feedback
    eventVisibility.value[data.eventId] = data.visible;
    updateUpcomingEvents();
    // Persist the change to Ontime (the refetch WS signal will re-sync allEvents)
    writeEventVisibilityToOntime(data.eventId, data.visible);
  });

  nodecg.listenFor('toggleGraphicsVisible', () => {
    graphicsVisible.value = !graphicsVisible.value;
    nodecg.log.info(`Graphics visibility toggled to ${graphicsVisible.value}`);
  });


  // Cleanup on shutdown
  nodecg.on('exit', () => {
    nodecg.log.info('Extension shutting down...');
    if (ws) {
      ws.close();
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
  });
};
