'use strict';

const ProxyError = require('./ProxyError');

module.exports = {
  ProxyError,
  
  // Re-export error codes for convenience
  ProxyErrorCode: ProxyError.Code
};
