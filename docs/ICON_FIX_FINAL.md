# 图标显示修复 - 最终版本

## 问题
开发环境中窗口标题已显示"老板稳了！天天旺"，但窗口图标仍显示默认的 Electron 图标。

## 根本原因
1. 未在 BrowserWindow 创建时设置 icon 参数
2. Windows 平台应优先使用 ICO 格式而不是 PNG 格式
3. 图标路径需要使用绝对路径

## 解决方案

### 1. 更新 MainWindow.js

添加了 nativeImage 导入和图标加载逻辑：

```javascript
const { BrowserWindow, screen, nativeImage } = require('electron');

// 在创建窗口时
// Get icon path - use ICO on Windows for better compatibility
let iconPath;
if (this.options.icon) {
  iconPath = this.options.icon;
} else {
  // Use platform-specific icon
  if (process.platform === 'win32') {
    iconPath = path.join(process.cwd(), 'resources', 'icon.ico');
  } else {
    iconPath = path.join(process.cwd(), 'resources', 'icon.png');
  }
}

console.log('[MainWindow] Loading icon from:', iconPath);
const icon = nativeImage.createFromPath(iconPath);

this.window = new BrowserWindow({
  icon: icon,
  // ... 其他配置
});
```

### 2. 更新 bootstrap.js

传入平台特定的图标路径：

```javascript
// Use platform-specific icon
const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
const iconPath = path.join(process.cwd(), 'resources', iconFile);

this.mainWindow = new MainWindow({
  title: '老板稳了！天天旺',
  icon: iconPath
});
```

### 3. 图标文件

确保以下文件存在：

- ✅ `resources/icon.png` (1651.3 KB) - Linux/Mac 使用
- ✅ `resources/icon.ico` (350.3 KB) - Windows 使用
- ✅ `resources/app-icon.png` (1651.3 KB) - 源文件
- ✅ `resources/icons/256x256.png` (91.1 KB) - 多尺寸图标

## 验证

运行验证脚本：

```bash
node scripts/check-icon-files.js
```

应该看到所有图标文件都存在。

## 重启开发环境

**必须完全重启才能看到图标更改！**

```bash
# 1. 停止当前运行的开发服务器
# 按 Ctrl+C 或关闭终端

# 2. 重新启动
npm run dev
```

## 预期效果

重启后，你应该看到：

### Windows
- ✅ 窗口左上角显示金元宝图标
- ✅ 任务栏显示金元宝图标和"老板稳了！天天旺"
- ✅ Alt+Tab 切换时显示正确的图标
- ✅ 窗口标题显示"老板稳了！天天旺"

### 控制台输出
```
[Bootstrap] Icon path: E:\WhatsApps\WhatsApp 11.19\resources\icon.ico
[MainWindow] Loading icon from: E:\WhatsApps\WhatsApp 11.19\resources\icon.ico
[MainWindow] ✓ Icon loaded successfully (256x256)
```

## 技术说明

### 为什么 Windows 使用 ICO？

1. **多分辨率支持**: ICO 文件包含多个尺寸（16x16, 32x32, 48x48, 64x64, 128x128, 256x256），Windows 会根据显示场景自动选择合适的尺寸
2. **系统兼容性**: Windows 原生支持 ICO 格式，显示效果更好
3. **任务栏优化**: ICO 格式在任务栏和标题栏显示更清晰

### PNG vs ICO

- **PNG**: 单一分辨率，适合 Linux/Mac
- **ICO**: 多分辨率，适合 Windows
- 我们的代码会根据平台自动选择

### 路径解析

使用 `process.cwd()` 而不是 `__dirname` 的原因：
- `process.cwd()`: 返回应用的根目录
- `__dirname`: 返回当前文件所在目录
- 在开发环境中，`process.cwd()` 指向项目根目录，更可靠

## 故障排除

### 如果图标仍未显示

1. **检查控制台输出**
   ```
   [MainWindow] Loading icon from: ...
   [MainWindow] ✓ Icon loaded successfully (256x256)
   ```

2. **验证图标文件**
   ```bash
   node scripts/check-icon-files.js
   ```

3. **清理缓存**
   - 关闭所有 Electron 进程
   - 删除 `node_modules/.cache` (如果存在)
   - 重新运行 `npm run dev`

4. **Windows 图标缓存**
   - Windows 可能缓存了旧图标
   - 重启 Windows Explorer: 
     ```
     taskkill /f /im explorer.exe
     start explorer.exe
     ```

5. **检查文件权限**
   - 确保图标文件可读
   - 确保没有被其他程序占用

## 打包后的效果

打包后的应用会自动使用正确的图标：

- Windows: 使用 `resources/icon.ico`
- macOS: 使用 `resources/icon.icns`
- Linux: 使用 `resources/icons/` 目录

配置在 `package.json` 的 `build` 部分：

```json
{
  "build": {
    "win": {
      "icon": "resources/icon.ico"
    },
    "mac": {
      "icon": "resources/icon.icns"
    },
    "linux": {
      "icon": "resources/icons"
    }
  }
}
```

## 总结

所有代码更改已完成：
- ✅ MainWindow.js 添加图标加载逻辑
- ✅ bootstrap.js 传入正确的图标路径
- ✅ 使用平台特定的图标格式（Windows 用 ICO）
- ✅ 添加调试日志便于排查问题
- ✅ 所有图标文件已就位

**现在只需要重启开发环境即可看到新图标！**
