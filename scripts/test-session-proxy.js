/**
 * Test Session Proxy Configuration
 * This script tests if Electron sessions are properly configured with proxy
 */

const { BrowserWindow, session } = require('electron');

async function testSessionProxy() {
    console.log('=== Session Proxy Test ===\n');
    
    try {
        // Create a test session
        const testSession = session.fromPartition('test-proxy-session');
        
        // Apply tunnel configuration (same as your app uses)
        console.log('1. Applying tunnel configuration...');
        await testSession.setProxy({
            proxyRules: 'http=127.0.0.1:10808;https=127.0.0.1:10808',
            proxyBypassRules: '<local>'
        });
        console.log('   ✓ Tunnel configuration applied');
        
        // Check proxy info
        console.log('\n2. Checking proxy info...');
        const proxyInfo = await testSession.getProxyInfo();
        console.log('   Proxy info:', JSON.stringify(proxyInfo, null, 2));
        
        // Create a window with this session
        console.log('\n3. Creating test window...');
        const win = new BrowserWindow({
            width: 800,
            height: 600,
            show: false,
            webPreferences: {
                session: testSession,
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        
        // Load a page and execute fetch
        console.log('\n4. Loading test page...');
        await win.loadURL('about:blank');
        
        console.log('\n5. Testing fetch through proxy...');
        const ipResult = await win.webContents.executeJavaScript(`
            (async () => {
                try {
                    const response = await fetch('https://api.ipify.org?format=json');
                    const data = await response.json();
                    return {
                        success: true,
                        ip: data.ip
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            })()
        `);
        
        console.log('   Fetch result:', JSON.stringify(ipResult, null, 2));
        
        if (ipResult.success) {
            console.log('\n✓ SUCCESS: IP through proxy is ' + ipResult.ip);
            console.log('  Expected: 38.175.207.23 (your V2RayN IP)');
            console.log('  Match:', ipResult.ip === '38.175.207.23' ? 'YES' : 'NO');
        } else {
            console.log('\n✗ FAILED: Could not get IP through proxy');
            console.log('  Error:', ipResult.error);
        }
        
        await win.close();
        
        console.log('\n=== Test Complete ===');
        process.exit(0);
        
    } catch (error) {
        console.error('\n✗ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testSessionProxy();