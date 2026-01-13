/**
 * Check Tunnel Configuration
 * This script checks if tunnel configuration is saved correctly
 */

const Store = require('electron-store');

console.log('=== Tunnel Configuration Check ===\n');

try {
    const store = new Store({
        name: 'environment-configs',
        encryptionKey: 'whatsapp-env-config-key-v1'
    });
    
    // Get all accounts
    const accounts = store.get('accounts', {});
    const accountIds = Object.keys(accounts);
    
    console.log('Found ' + accountIds.length + ' accounts with environment configuration\n');
    
    for (const accountId of accountIds) {
        const config = accounts[accountId];
        console.log('Account: ' + accountId);
        console.log('  Tunnel enabled:', config.tunnel?.enabled);
        console.log('  Tunnel type:', config.tunnel?.type);
        console.log('  Tunnel host:', config.tunnel?.host);
        console.log('  Tunnel port:', config.tunnel?.port);
        console.log('  Proxy enabled:', config.proxy?.enabled);
        console.log('  Proxy host:', config.proxy?.host);
        console.log('  Proxy port:', config.proxy?.port);
        console.log('');
    }
    
    if (accountIds.length === 0) {
        console.log('No accounts found with environment configuration');
        console.log('This means tunnel settings have not been saved yet!');
    }
    
} catch (error) {
    console.error('Error reading configuration:', error);
    process.exit(1);
}

console.log('=== Check Complete ===');