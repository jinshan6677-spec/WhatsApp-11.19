/**
 * 测试图标加载
 */

const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  console.log('\n=== 图标加载测试 ===\n');
  
  // 测试不同的路径
  const paths = [
    path.join(__dirname, '../resources/icon.png'),
    path.join(process.cwd(), 'resources', 'icon.png'),
    path.resolve('resources/icon.png'),
    'resources/icon.png'
  ];
  
  console.log('当前工作目录:', process.cwd());
  console.log('__dirname:', __dirname);
  console.log('\n测试图标路径:\n');
  
  paths.forEach((iconPath, index) => {
    console.log(`${index + 1}. ${iconPath}`);
    const icon = nativeImage.createFromPath(iconPath);
    
    if (icon.isEmpty()) {
      console.log('   ✗ 图标为空\n');
    } else {
      const size = icon.getSize();
      console.log(`   ✓ 图标加载成功 (${size.width}x${size.height})\n`);
    }
  });
  
  // 创建测试窗口
  console.log('创建测试窗口...\n');
  const iconPath = path.join(process.cwd(), 'resources', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    title: '图标测试 - 老板稳了！天天旺',
    icon: icon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  win.loadURL('data:text/html,<h1>图标测试窗口</h1><p>检查窗口左上角和任务栏的图标</p>');
  
  win.on('closed', () => {
    app.quit();
  });
  
  console.log('✓ 测试窗口已创建');
  console.log('  请检查窗口左上角和任务栏的图标');
  console.log('  关闭窗口以退出测试\n');
});

app.on('window-all-closed', () => {
  app.quit();
});
