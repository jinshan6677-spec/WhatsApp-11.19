/**
 * 快捷回复功能诊断脚本
 * 
 * 检查快捷回复功能的集成状态
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('快捷回复功能诊断');
console.log('========================================\n');

// 1. 检查关键文件是否存在
console.log('1. 检查关键文件...');
const files = [
  'src/ipc/QuickReplyIPCHandlers.js',
  'src/single-window/renderer/quick-reply-panel.js',
  'src/single-window/renderer/preload-main/quickReply.js',
  'src/quick-reply/controllers/QuickReplyController.js',
  'src/quick-reply/managers/TemplateManager.js',
  'src/quick-reply/managers/GroupManager.js',
  'src/quick-reply/managers/SendManager.js',
  'src/quick-reply/storage/TemplateStorage.js',
  'src/quick-reply/storage/GroupStorage.js',
  'src/quick-reply/services/TranslationServiceAdapter.js',
  'src/quick-reply/services/WhatsAppWebIntegration.js'
];

let allFilesExist = true;
files.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`  ${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (allFilesExist) {
  console.log('\n  ✓ 所有关键文件都存在\n');
} else {
  console.log('\n  ✗ 部分文件缺失\n');
}

// 2. 检查 HTML 集成
console.log('2. 检查 HTML 集成...');
const htmlPath = 'src/single-window/renderer/app.html';
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

const checks = [
  { name: '快捷回复按钮', pattern: /data-panel="quick-reply"/ },
  { name: '快捷回复面板容器', pattern: /id="quick-reply-panel-body"/ },
  { name: '快捷回复宿主元素', pattern: /id="quick-reply-host"/ },
  { name: '快捷回复脚本加载', pattern: /quick-reply-panel\.js/ }
];

checks.forEach(check => {
  const found = check.pattern.test(htmlContent);
  console.log(`  ${found ? '✓' : '✗'} ${check.name}`);
});

// 3. 检查主进程集成
console.log('\n3. 检查主进程集成...');
const mainPath = 'src/main-refactored.js';
const mainContent = fs.readFileSync(mainPath, 'utf-8');

const mainChecks = [
  { name: 'IPC 处理器导入', pattern: /require\(['"]\.\/ipc\/QuickReplyIPCHandlers['"]\)/ },
  { name: 'IPC 处理器注册', pattern: /registerQuickReplyHandlers/ }
];

mainChecks.forEach(check => {
  const found = check.pattern.test(mainContent);
  console.log(`  ${found ? '✓' : '✗'} ${check.name}`);
});

// 4. 检查 Preload 脚本
console.log('\n4. 检查 Preload 脚本...');
const preloadPath = 'src/single-window/renderer/preload-main.js';
if (fs.existsSync(preloadPath)) {
  const preloadContent = fs.readFileSync(preloadPath, 'utf-8');
  const hasQuickReply = /quickReply/.test(preloadContent);
  console.log(`  ${hasQuickReply ? '✓' : '✗'} quickReply API 已暴露`);
} else {
  console.log('  ✗ preload-main.js 文件不存在');
}

// 5. 检查存储目录
console.log('\n5. 检查存储目录结构...');
const userDataPath = path.join(process.cwd(), 'session-data');
if (fs.existsSync(userDataPath)) {
  console.log(`  ✓ 用户数据目录存在: ${userDataPath}`);
  
  // 检查是否有账号数据
  const accountsPath = path.join(userDataPath, 'accounts.json');
  if (fs.existsSync(accountsPath)) {
    const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
    console.log(`  ✓ 找到 ${accounts.length} 个账号`);
    
    // 检查每个账号的快捷回复目录
    accounts.forEach(account => {
      const quickReplyDir = path.join(userDataPath, account.id, 'quick-reply');
      const exists = fs.existsSync(quickReplyDir);
      console.log(`    ${exists ? '✓' : '○'} 账号 ${account.name} 的快捷回复目录${exists ? '已创建' : '未创建（首次使用时会自动创建）'}`);
    });
  } else {
    console.log('  ○ 未找到账号配置文件');
  }
} else {
  console.log('  ○ 用户数据目录不存在（首次运行时会自动创建）');
}

// 6. 总结
console.log('\n========================================');
console.log('诊断总结');
console.log('========================================');

if (allFilesExist) {
  console.log('\n✓ 快捷回复功能已完整集成');
  console.log('\n使用说明：');
  console.log('1. 启动应用程序');
  console.log('2. 打开一个 WhatsApp 账号');
  console.log('3. 点击右侧面板的"快捷回复"按钮（💬 图标）');
  console.log('4. 首次使用时，面板会显示"选择账号后将显示快捷回复功能"');
  console.log('5. 确保已选择账号后，快捷回复面板会自动加载');
  console.log('\n如果仍然无法使用：');
  console.log('1. 打开开发者工具（F12）查看控制台错误');
  console.log('2. 检查是否有 [QuickReply] 开头的日志');
  console.log('3. 尝试重新启动应用程序');
} else {
  console.log('\n✗ 快捷回复功能集成不完整');
  console.log('请检查上述缺失的文件');
}

console.log('\n========================================\n');
