/**
 * ProxyRelayIntegration - Integration layer between ProxySecurityManager and ProxyRelayService
 * 
 * This module provides helper functions to integrate the proxy relay service
 * with the existing proxy security infrastructure.
 */

import { ProxyRelayService } from '../../application/services/ProxyRelayService';

const ProxyConfig = require('../../domain/entities/ProxyConfig');

export interface ChromiumProxyArgs {
  proxyServer: string;
  proxyBypassList?: string;
}

/**
 * Generates Chromium startup arguments for proxy relay
 * 
 * @param localPort - Local relay port
 * @param bypassList - Optional bypass list
 * @returns Chromium arguments
 */
export function generateChromiumProxyArgs(
  localPort: number,
  bypassList?: string
): ChromiumProxyArgs {
  return {
    proxyServer: `socks5://127.0.0.1:${localPort}`,
    proxyBypassList: bypassList || '<local>'
  };
}

/**
 * Converts ChromiumProxyArgs to Chromium command line arguments
 * 
 * @param args - Proxy arguments
 * @returns Array of command line arguments
 */
export function toChromiumArgs(args: ChromiumProxyArgs): string[] {
  const result: string[] = [
    `--proxy-server=${args.proxyServer}`
  ];

  if (args.proxyBypassList) {
    result.push(`--proxy-bypass-list=${args.proxyBypassList}`);
  }

  return result;
}

/**
 * Starts a proxy relay and returns Chromium arguments
 * 
 * @param proxyRelayService - Proxy relay service instance
 * @param accountId - Account identifier
 * @param remoteProxy - Remote proxy configuration
 * @returns Chromium arguments and relay info
 */
export async function startRelayAndGetChromiumArgs(
  proxyRelayService: ProxyRelayService,
  accountId: string,
  remoteProxy: typeof ProxyConfig
): Promise<{
  chromiumArgs: string[];
  relayInfo: any;
}> {
  // Start the relay
  const relayInfo = await proxyRelayService.startRelay(accountId, remoteProxy);

  // Generate Chromium arguments
  const proxyArgs = generateChromiumProxyArgs(
    relayInfo.localPort,
    remoteProxy.bypass
  );

  const chromiumArgs = toChromiumArgs(proxyArgs);

  return {
    chromiumArgs,
    relayInfo
  };
}

/**
 * Stops a proxy relay
 * 
 * @param proxyRelayService - Proxy relay service instance
 * @param accountId - Account identifier
 */
export async function stopRelay(
  proxyRelayService: ProxyRelayService,
  accountId: string
): Promise<void> {
  await proxyRelayService.stopRelay(accountId);
}

/**
 * Gets the relay status for an account
 * 
 * @param proxyRelayService - Proxy relay service instance
 * @param accountId - Account identifier
 * @returns Relay status or null
 */
export async function getRelayStatus(
  proxyRelayService: ProxyRelayService,
  accountId: string
): Promise<any> {
  return await proxyRelayService.getRelayStatus(accountId);
}

/**
 * Integrates proxy relay with KillSwitch
 * 
 * When KillSwitch is activated, the relay should continue running
 * but all network requests should be blocked until the relay is restored.
 * 
 * @param proxyRelayService - Proxy relay service instance
 * @param killSwitch - KillSwitch instance
 * @param accountId - Account identifier
 */
export async function integrateWithKillSwitch(
  proxyRelayService: ProxyRelayService,
  killSwitch: any,
  accountId: string
): Promise<void> {
  // Get relay status
  const relayStatus = await proxyRelayService.getRelayStatus(accountId);

  if (!relayStatus) {
    throw new Error(`No relay found for account ${accountId}`);
  }

  // If relay is not running, activate KillSwitch
  if (relayStatus.status !== 'running') {
    await killSwitch.enable(accountId);
  } else {
    // Relay is running, disable KillSwitch
    await killSwitch.disable(accountId);
  }
}

/**
 * Validates that Chromium proxy arguments are correct
 * 
 * @param args - Chromium arguments array
 * @param expectedPort - Expected local port
 * @returns true if valid
 */
export function validateChromiumProxyArgs(
  args: string[],
  expectedPort: number
): boolean {
  const proxyServerArg = args.find(arg => arg.startsWith('--proxy-server='));
  
  if (!proxyServerArg) {
    return false;
  }

  const expectedArg = `--proxy-server=socks5://127.0.0.1:${expectedPort}`;
  return proxyServerArg === expectedArg;
}
