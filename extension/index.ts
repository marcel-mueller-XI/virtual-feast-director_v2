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
      colors: { background: '#ffffff00', text: '#ffffff' },
      fonts: { title: 'Arial, sans-serif', upcoming: 'Arial, sans-serif' },
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

  const currentEvent = nodecg.Replicant('currentEvent', {
    defaultValue: null
  });

  const upcomingEvents = nodecg.Replicant('upcomingEvents', {
    defaultValue: []
  });

  const allEvents = nodecg.Replicant('allEvents', {
    defaultValue: []
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
      
      // Otherwise, check custom field 'public' (default to true if not set)
      if (event.custom && typeof event.custom.public === 'boolean') {
        return event.custom.public === true;
      }
      
      // Default: show event if no explicit setting
      return true;
    });
  }

  // Update filtered upcoming events
  function updateUpcomingEvents() {
    const filtered = filterEvents(allEvents.value);
    
    // Find current event index
    const currentEventId = currentEvent.value?.id;
    let startIndex = 0;
    
    if (currentEventId) {
      const currentIndex = filtered.findIndex((e: any) => e.id === currentEventId);
      if (currentIndex !== -1) {
        // Start from next event after current
        startIndex = currentIndex + 1;
      }
    }
    
    // Get the number of upcoming events to show (total - 1 for current event)
    const count = (displaySettings.value.countVisibleEvents || 4) - 1;
    
    // Get upcoming events - deep clone to avoid NodeCG "single owner" proxy error
    const upcoming = JSON.parse(JSON.stringify(filtered.slice(startIndex, startIndex + count)));
    
    upcomingEvents.value = upcoming;
    nodecg.log.debug(`Updated upcoming events: ${upcoming.length} events`);
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
    
    // Initialize visibility for new events
    events.forEach((event: any) => {
      if (event.type === 'event' && eventVisibility.value[event.id] === undefined) {
        // Check custom field 'public' or default to true
        const isPublic = event.custom?.public !== false;
        eventVisibility.value[event.id] = isPublic;
      }
    });
    
    updateUpcomingEvents();
  }

  // Connect to Ontime
  function connectToOntime(ip: string, port: number) {
    if (ws) {
      nodecg.log.info('Closing existing WebSocket connection...');
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
        
        // Fetch complete rundown data
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
    switch (message.tag || message.type) {
      case 'ontime':
      case 'poll':
        // Full state update
        nodecg.log.debug('Received full state update');
        if (message.payload) {
          updateFromRuntimeData(message.payload);
        }
        break;

      case 'ontime-eventNow':
        nodecg.log.debug('Current event updated');
        if (message.payload) {
          currentEvent.value = message.payload;
          updateUpcomingEvents();
        }
        break;

      case 'ontime-eventNext':
        nodecg.log.debug('Next event updated');
        // Trigger update of upcoming events
        updateUpcomingEvents();
        break;

      case 'ontime-rundown':
        nodecg.log.debug('Rundown updated');
        // Refresh full event data when rundown changes
        refreshEventData();
        break;

      default:
        // Log unknown message types for debugging
        nodecg.log.debug(`Unhandled message type: ${message.tag || message.type}`);
    }
  }

  function updateFromRuntimeData(data: any) {
    if (data.eventNow) {
      currentEvent.value = data.eventNow;
    }
    updateUpcomingEvents();
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

  // Listen for event visibility changes
  eventVisibility.on('change', () => {
    nodecg.log.debug('Event visibility changed, updating events');
    updateUpcomingEvents();
  });

  // Message handlers for dashboard communication
  nodecg.listenFor('refreshEvents', () => {
    nodecg.log.info('Manual event refresh requested');
    refreshEventData();
  });

  nodecg.listenFor('setEventVisibility', (data: { eventId: string; visible: boolean }) => {
    nodecg.log.info(`Setting event ${data.eventId} visibility to ${data.visible}`);
    eventVisibility.value[data.eventId] = data.visible;
    updateUpcomingEvents();
  });

  nodecg.listenFor('toggleGraphicsVisible', () => {
    graphicsVisible.value = !graphicsVisible.value;
    nodecg.log.info(`Graphics visibility toggled to ${graphicsVisible.value}`);
  });

  // Initial connection
  if (ontimeConfig.value && ontimeConfig.value.ip && ontimeConfig.value.port) {
    connectToOntime(ontimeConfig.value.ip, ontimeConfig.value.port);
  }

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
