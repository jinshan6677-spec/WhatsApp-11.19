const createAccountsAPI = (ipcRenderer) => ({
  getAccount: (accountId) => ipcRenderer.invoke('get-account', accountId),
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  listAccounts: () => ipcRenderer.invoke('account:list'),
  createAccount: (config) => ipcRenderer.invoke('create-account', config),
  updateAccount: (accountId, updates) => ipcRenderer.invoke('update-account', accountId, updates),
  deleteAccount: (accountId, options) => ipcRenderer.invoke('delete-account', accountId, options),
  reorderAccounts: (accountIds) => ipcRenderer.invoke('account:reorder', accountIds),
  openCreateAccountDialog: () => ipcRenderer.send('account:create'),
  openEditAccountDialog: (accountId) => ipcRenderer.send('account:edit', accountId),
  openAccount: (accountId) => ipcRenderer.invoke('open-account', accountId),
  closeAccount: (accountId) => ipcRenderer.invoke('close-account', accountId),
  getAccountStatus: (accountId) => ipcRenderer.invoke('get-account-status', accountId),
  getAllAccountStatuses: () => ipcRenderer.invoke('get-all-account-statuses')
});

module.exports = createAccountsAPI;
