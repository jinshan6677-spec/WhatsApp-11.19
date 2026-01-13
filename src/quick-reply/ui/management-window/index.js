/**
 * Management Window Module
 * 
 * This module exports the ManagementWindow class and React components
 * for creating independent quick reply management windows.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.6, 4.1-4.10
 */

const ManagementWindow = require('./ManagementWindow');

// Export Node.js module
module.exports = {
  ManagementWindow
};

// Also export React components for use in renderer process
// These are exported separately to avoid issues with require vs import
module.exports.components = {
  ManagementWindowApp: './ManagementWindowApp',
  Toolbar: './Toolbar',
  ImportExportBar: './ImportExportBar',
  ContentCard: './ContentCard',
  SearchBox: './SearchBox'
};
