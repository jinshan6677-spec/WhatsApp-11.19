const createEventsAPI = (ipcRenderer, eventChannels) => ({
  on: (channel, callback) => {
    if (eventChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    } else {
      console.warn(`[Preload] Attempted to listen to invalid channel: ${channel}`);
    }
  },
  removeListener: (channel, callback) => {
    if (eventChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },
  removeAllListeners: (channel) => {
    if (eventChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  }
});

module.exports = createEventsAPI;
