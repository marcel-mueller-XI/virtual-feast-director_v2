// Graphics logic
const displaySettings = nodecg.Replicant('displaySettings');
const currentEvent    = nodecg.Replicant('currentEvent');
const upcomingEvents  = nodecg.Replicant('upcomingEvents');
const graphicsVisible = nodecg.Replicant('graphicsVisible');

// ── Appearance ────────────────────────────────────────────────────────────────

function applyAppearance(settings) {
    if (!settings) return;

    // Background is always transparent (hardcoded)
    document.body.style.backgroundColor = 'transparent';

    // Text color
    document.body.style.color = settings.colors?.text ?? '#000000';

    // Alignment
    const alignment = settings.alignment ?? 'left';
    document.getElementById('container').style.textAlign = alignment;
    document.getElementById('container').style.alignItems =
        alignment === 'right' ? 'flex-end' : 'flex-start';

    // Font (shared for all event text)
    const font = settings.font ?? 'Arial, sans-serif';
    document.querySelectorAll('.event.current .title, .event.upcoming').forEach(el => {
        el.style.fontFamily = font;
    });
}

displaySettings.on('change', applyAppearance);

// ── Event rendering ───────────────────────────────────────────────────────────

function renderCurrentEvent(event) {
    const titleEl = document.querySelector('#current-event .title');
    if (!titleEl) return;
    titleEl.textContent = event?.title ?? '';
    document.getElementById('current-event').style.display =
        event ? '' : 'none';
}

function renderUpcomingEvents(events) {
    const container = document.getElementById('upcoming-events');
    container.innerHTML = '';
    if (!events || events.length === 0) return;
    events.forEach(event => {
        const div = document.createElement('div');
        div.className = 'event upcoming';
        div.textContent = event.title ?? '';
        // Apply font immediately from current settings
        div.style.fontFamily = displaySettings.value?.font ?? 'Arial, sans-serif';
        container.appendChild(div);
    });
}

currentEvent.on('change',   renderCurrentEvent);
upcomingEvents.on('change', renderUpcomingEvents);

// ── Visibility ────────────────────────────────────────────────────────────────

graphicsVisible.on('change', (visible) => {
    document.getElementById('container').style.visibility =
        visible === false ? 'hidden' : 'visible';
});

// Initial render once all replicants are ready
NodeCG.waitForReplicants(displaySettings, currentEvent, upcomingEvents, graphicsVisible)
    .then(() => {
        applyAppearance(displaySettings.value);
        renderCurrentEvent(currentEvent.value);
        renderUpcomingEvents(upcomingEvents.value);
        if (graphicsVisible.value === false) {
            document.getElementById('container').style.visibility = 'hidden';
        }
    });

