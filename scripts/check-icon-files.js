/**
 * 检查图标文件
 */

const fs = require('fs');
const path = require('path');

console.log('\n=== 图标文件检查 ===\n');
console.log('当前工作目录:', process.cwd());
console.log('');

const files = [
  'resources/icon.png',
  'resources/icon.ico',
  'resources/app-icon.png',
  'resources/icons/256x256.png'
];

files.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`✓ ${file}`);
    console.log(`  路径: ${fullPath}`);
    console.log(`  大小: ${sizeKB} KB`);
    console.log('');
  } else {
    console.log(`✗ ${file} (不存在)`);
    console.log(`  预期路径: ${fullPath}`);
    console.log('');
  }
});

console.log('=== 建议 ===\n');
console.log('Windows 开发环境应使用: resources/icon.ico');
console.log('Linux/Mac 开发环境应使用: resources/icon.png');
console.log('\n重启开发环境以应用图标更改：');
console.log('  1. 停止当前的 npm run dev (Ctrl+C)');
console.log('  2. 重新运行: npm run dev');
console.log('');
