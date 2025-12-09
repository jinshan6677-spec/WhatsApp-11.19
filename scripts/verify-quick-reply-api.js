/**
 * Quick Reply API Verification Script
 * 
 * Run this in the browser console (F12) after opening the app
 * to verify the Quick Reply API is properly exposed.
 */

(function verifyQuickReplyAPI() {
  console.log('=== Quick Reply API Verification ===\n');
  
  // Check 1: electronAPI exists
  if (!window.electronAPI) {
    console.error('❌ window.electronAPI is not defined');
    console.log('   The preload script may not have loaded correctly.');
    return;
  }
  console.log('✅ window.electronAPI exists');
  
  // Check 2: quickReply namespace exists
  if (!window.electronAPI.quickReply) {
    console.error('❌ window.electronAPI.quickReply is not defined');
    console.log('   The quickReply API was not properly exposed.');
    console.log('   Available keys:', Object.keys(window.electronAPI));
    return;
  }
  console.log('✅ window.electronAPI.quickReply exists');
  
  // Check 3: All required methods exist
  const requiredMethods = [
    'load',
    'sendTemplate',
    'insertTemplate',
    'searchTemplates',
    'openManagement',
    'onQuickReplyEvent',
    'onAccountSwitch',
    'onAccountSwitchError'
  ];
  
  const missingMethods = [];
  const foundMethods = [];
  
  requiredMethods.forEach(method => {
    if (typeof window.electronAPI.quickReply[method] === 'function') {
      foundMethods.push(method);
    } else {
      missingMethods.push(method);
    }
  });
  
  if (foundMethods.length > 0) {
    console.log(`✅ Found ${foundMethods.length} methods:`, foundMethods.join(', '));
  }
  
  if (missingMethods.length > 0) {
    console.error(`❌ Missing ${missingMethods.length} methods:`, missingMethods.join(', '));
  } else {
    console.log('✅ All required methods are available');
  }
  
  // Summary
  console.log('\n=== Summary ===');
  if (missingMethods.length === 0) {
    console.log('🎉 Quick Reply API is properly configured!');
    console.log('\nTo test loading data, run:');
    console.log('  window.electronAPI.quickReply.load("your-account-id")');
  } else {
    console.log('⚠️ Quick Reply API has issues. Please check the preload script.');
  }
})();
