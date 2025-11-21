/**
 * 测试通过代理访问 WhatsApp 的速度
 */

const { spawn } = require('child_process');

console.log('=== 测试代理访问 WhatsApp ===\n');
console.log('使用 curl 测试代理连接...\n');

// 使用 curl 测试 SOCKS5 代理
const curl = spawn('curl', [
  '-x', 'socks5://txy:YOUR_PASSWORD@72.60.203.176:12111',
  '-I',
  '--connect-timeout', '10',
  '--max-time', '15',
  'https://web.whatsapp.com/'
]);

let output = '';
let startTime = Date.now();

curl.stdout.on('data', (data) => {
  output += data.toString();
});

curl.stderr.on('data', (data) => {
  output += data.toString();
});

curl.on('close', (code) => {
  const responseTime = Date.now() - startTime;
  
  console.log('响应时间:', responseTime, 'ms\n');
  console.log('输出:');
  console.log(output);
  
  if (code === 0) {
    console.log('\n✓ 代理连接成功');
    if (responseTime > 5000) {
      console.log('⚠️  警告: 响应时间过长，可能导致 WhatsApp 加载缓慢');
    }
  } else {
    console.log('\n✗ 代理连接失败');
    console.log('退出码:', code);
  }
  
  console.log('\n建议:');
  console.log('- 如果响应时间 > 5000ms，建议更换更快的代理');
  console.log('- 如果连接失败，请检查代理服务器状态');
  console.log('- 可以尝试禁用代理，使用直连');
});

curl.on('error', (error) => {
  console.error('错误:', error.message);
  console.log('\n注意: 此测试需要系统安装 curl 命令');
  console.log('Windows 10/11 通常已内置 curl');
});
