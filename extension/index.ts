// Extension entry point
// Note: Using 'any' type for nodecg parameter due to @nodecg/types resolution issues
// The nodecg object will have all ServerAPI methods at runtime

export = (nodecg: any) => {
  nodecg.log.info('Virtual Feast Director v2 extension loaded');

  // TODO: Initialize Ontime WebSocket connection
  // TODO: Initialize HTTP client for event data
  // TODO: Set up replicants
  // TODO: Implement event filtering logic
};
