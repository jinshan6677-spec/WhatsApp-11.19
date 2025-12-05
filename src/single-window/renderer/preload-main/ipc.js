const createInvoke = (ipcRenderer, invokeChannels) => async (channel, ...args) => {
  if (invokeChannels.includes(channel)) {
    return await ipcRenderer.invoke(channel, ...args);
  } else {
    console.warn(`[Preload] Attempted to invoke invalid channel: ${channel}`);
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
};

const createSend = (ipcRenderer, sendChannels) => (channel, ...args) => {
  if (sendChannels.includes(channel)) {
    ipcRenderer.send(channel, ...args);
  } else {
    console.warn(`[Preload] Attempted to send to invalid channel: ${channel}`);
  }
};

module.exports = { createInvoke, createSend };
