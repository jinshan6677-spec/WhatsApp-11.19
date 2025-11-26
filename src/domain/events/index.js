'use strict';

const ProxyConnectedEvent = require('./ProxyConnectedEvent');
const ProxyDisconnectedEvent = require('./ProxyDisconnectedEvent');
const KillSwitchActivatedEvent = require('./KillSwitchActivatedEvent');
const IPLeakDetectedEvent = require('./IPLeakDetectedEvent');

module.exports = {
  ProxyConnectedEvent,
  ProxyDisconnectedEvent,
  KillSwitchActivatedEvent,
  IPLeakDetectedEvent,
  
  // Re-export enums for convenience
  DisconnectionReason: ProxyDisconnectedEvent.Reason,
  KillSwitchTrigger: KillSwitchActivatedEvent.Trigger,
  LeakType: IPLeakDetectedEvent.LeakType,
  LeakSeverity: IPLeakDetectedEvent.Severity
};
