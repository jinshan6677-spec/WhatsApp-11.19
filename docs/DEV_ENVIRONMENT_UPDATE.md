# 开发环境更新说明

## 应用名称已更新

所有相关文件中的应用名称已经更新为 **"老板稳了！天天旺"**

### 已更新的文件

1. **package.json**
   - `build.productName`: "老板稳了！天天旺"
   - `build.nsis.shortcutName`: "老板稳了！天天旺"

2. **src/app/bootstrap.js**
   ```javascript
   this.mainWindow = new MainWindow({
     title: '老板稳了！天天旺'
   });
   ```

3. **src/single-window/MainWindow.js**
   ```javascript
   constructor(options = {}) {
     this.options = {
       title: options.title || '老板稳了！天天旺',
       // ...
     };
   }
   ```

4. **src/single-window/renderer/app.html**
   ```html
   <title>老板稳了！天天旺</title>
   ```

5. **src/app/constants/app.js**
   ```javascript
   const APP_INFO = {
     NAME: '老板稳了！天天旺',
     DESCRIPTION: '老板稳了！天天旺 - 专业的WhatsApp桌面应用，支持多账号管理、翻译功能等',
     AUTHOR: '老板稳了团队'
   };
   ```

6. **src/managers/TrayManager.js**
   ```javascript
   this.tray.setToolTip('老板稳了！天天旺');
   ```

## 图标更新

### 已添加的图标设置

1. **src/single-window/MainWindow.js**
   ```javascript
   this.window = new BrowserWindow({
     icon: this.options.icon || path.join(__dirname, '../resources/icon.png'),
     // ...
   });
   ```

2. **src/app/bootstrap.js**
   ```javascript
   this.mainWindow = new MainWindow({
     icon: path.join(__dirname, '../resources/icon.png')
   });
   ```

3. **图标文件**
   - `resources/icon.png` - 开发环境使用的 PNG 图标
   - `resources/icon.ico` - Windows 打包使用的 ICO 图标
   - `resources/app-icon.png` - 源图标文件

## 如何查看更改

### 方法1：重启开发环境（推荐）

1. 停止当前运行的开发服务器（Ctrl+C）
2. 重新运行：
   ```bash
   npm run dev
   ```

### 方法2：完全重启

1. 关闭所有 Electron 进程
2. 清理缓存（可选）：
   ```bash
   npm run clean
   ```
3. 重新启动：
   ```bash
   npm run dev
   ```

## 验证更改

启动后，你应该看到：
- ✓ 窗口标题显示为 "老板稳了！天天旺"
- ✓ 窗口图标显示为新的金元宝图标
- ✓ 任务栏显示为 "老板稳了！天天旺" 和新图标
- ✓ 系统托盘提示显示为 "老板稳了！天天旺"

## 打包后的效果

打包后的应用将显示：
- ✓ 安装包文件名：老板稳了！天天旺-1.0.0.exe
- ✓ 桌面快捷方式：老板稳了！天天旺
- ✓ 开始菜单：老板稳了！天天旺
- ✓ 应用窗口标题：老板稳了！天天旺
- ✓ 任务管理器进程名：老板稳了！天天旺.exe

## 注意事项

- 开发环境中的更改需要重启才能生效
- 如果使用了热重载，窗口标题可能不会自动更新
- 建议完全重启 Electron 进程以确保所有更改生效
