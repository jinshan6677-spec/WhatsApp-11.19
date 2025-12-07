/**
 * 验证图标设置
 */

const fs = require('fs');
const path = require('path');

console.log('=== 图标设置验证 ===\n');

const checks = [
  {
    name: 'resources/icon.png (开发环境)',
    path: path.join(__dirname, '../resources/icon.png'),
    required: true
  },
  {
    name: 'resources/icon.ico (Windows 打包)',
    path: path.join(__dirname, '../resources/icon.ico'),
    required: true
  },
  {
    name: 'resources/app-icon.png (源文件)',
    path: path.join(__dirname, '../resources/app-icon.png'),
    required: true
  },
  {
    name: 'resources/icons/256x256.png',
    path: path.join(__dirname, '../resources/icons/256x256.png'),
    required: false
  }
];

let allPassed = true;

checks.forEach(check => {
  const exists = fs.existsSync(check.path);
  const status = exists ? '✓' : (check.required ? '✗' : '⚠');
  
  if (!exists && check.required) {
    allPassed = false;
  }
  
  console.log(`${status} ${check.name}`);
  
  if (exists) {
    const stats = fs.statSync(check.path);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`  大小: ${sizeKB} KB`);
  } else if (check.required) {
    console.log(`  ⚠ 文件不存在！`);
  }
  console.log('');
});

// 检查代码中的图标设置
console.log('=== 代码配置检查 ===\n');

const mainWindowPath = path.join(__dirname, '../src/single-window/MainWindow.js');
const mainWindowContent = fs.readFileSync(mainWindowPath, 'utf8');

if (mainWindowContent.includes('icon:')) {
  console.log('✓ MainWindow.js 包含图标设置');
} else {
  console.log('✗ MainWindow.js 缺少图标设置');
  allPassed = false;
}

const bootstrapPath = path.join(__dirname, '../src/app/bootstrap.js');
const bootstrapContent = fs.readFileSync(bootstrapPath, 'utf8');

if (bootstrapContent.includes("icon: path.join")) {
  console.log('✓ bootstrap.js 包含图标路径设置');
} else {
  console.log('⚠ bootstrap.js 可能缺少图标路径设置');
}

console.log('\n=== 验证结果 ===\n');

if (allPassed) {
  console.log('✓ 所有必需的图标文件和配置都已就位');
  console.log('\n请重启开发环境以查看更改：');
  console.log('  1. 停止当前的 npm run dev (Ctrl+C)');
  console.log('  2. 重新运行: npm run dev');
} else {
  console.log('✗ 部分检查失败，请修复上述问题');
  process.exit(1);
}
