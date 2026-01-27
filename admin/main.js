const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// 单例实例保护
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('管理后台已在运行中，退出当前实例');
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // 当运行第二个实例时，将焦点设置到主窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    title: '激活码管理后台',
    icon: path.join(__dirname, '../resources/icon.ico'),
    show: false, // 先不显示窗口，等待 ready-to-show 事件
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 窗口准备好后显示，避免闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC处理器
const adminDir = path.join(__dirname);
const codesFile = path.join(adminDir, 'activation-codes.json');
const privateKeyFile = path.join(adminDir, 'privateKey.pem');

// 确保必要的文件存在
function ensureFilesExist() {
  if (!fs.existsSync(privateKeyFile)) {
    throw new Error('私钥文件不存在，请先运行 key-generator.js 生成密钥对');
  }
}

// 生成激活码
ipcMain.handle('generate-codes', async (event, options) => {
  try {
    ensureFilesExist();

    const crypto = require('crypto');
    const privateKey = fs.readFileSync(privateKeyFile, 'utf8');

    const codes = [];
    for (let i = 0; i < options.count; i++) {
      const id = `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // 创建要签名的数据（不包含签名）
      const codeData = {
        id,
        maxDevices: options.maxDevices,
        validDays: options.validDays,
        createdAt: new Date().toISOString(),
        notes: options.notes || ''
      };

      // 使用SHA256算法签名
      const dataString = JSON.stringify(codeData);
      const sign = crypto.createSign('SHA256');
      sign.update(dataString);
      sign.end();
      const signature = sign.sign(privateKey, 'base64');

      // 创建完整的激活码对象
      const fullCode = {
        ...codeData,
        signature
      };

      // Base64编码整个对象
      const base64Code = Buffer.from(JSON.stringify(fullCode)).toString('base64');
      
      codes.push({
        code: base64Code,
        ...codeData,
        createdAt: codeData.createdAt,
        usedDevices: 0
      });
    }

    // 保存到文件
    let existingCodes = [];
    if (fs.existsSync(codesFile)) {
      existingCodes = JSON.parse(fs.readFileSync(codesFile, 'utf8'));
    }
    existingCodes.push(...codes);
    fs.writeFileSync(codesFile, JSON.stringify(existingCodes, null, 2));

    return { success: true, codes };
  } catch (error) {
    console.error('生成激活码失败:', error);
    return { success: false, error: error.message };
  }
});

// 获取激活码列表
ipcMain.handle('get-codes', async () => {
  try {
    if (!fs.existsSync(codesFile)) {
      return { success: true, codes: [] };
    }

    const codes = JSON.parse(fs.readFileSync(codesFile, 'utf8'));
    return { success: true, codes };
  } catch (error) {
    console.error('获取激活码列表失败:', error);
    return { success: false, error: error.message };
  }
});

// 删除激活码
ipcMain.handle('delete-code', async (event, codeId) => {
  try {
    if (!fs.existsSync(codesFile)) {
      return { success: false, error: '激活码文件不存在' };
    }

    let codes = JSON.parse(fs.readFileSync(codesFile, 'utf8'));
    codes = codes.filter(c => c.id !== codeId);
    fs.writeFileSync(codesFile, JSON.stringify(codes, null, 2));

    return { success: true };
  } catch (error) {
    console.error('删除激活码失败:', error);
    return { success: false, error: error.message };
  }
});

// 获取统计信息
ipcMain.handle('get-stats', async () => {
  try {
    if (!fs.existsSync(codesFile)) {
      return { success: true, stats: { totalCodes: 0, totalDevices: 0, usedDevices: 0 } };
    }

    const codes = JSON.parse(fs.readFileSync(codesFile, 'utf8'));
    const totalCodes = codes.length;
    const totalDevices = codes.reduce((sum, c) => sum + c.maxDevices, 0);
    const usedDevices = codes.reduce((sum, c) => sum + (c.usedDevices || 0), 0);

    return { success: true, stats: { totalCodes, totalDevices, usedDevices } };
  } catch (error) {
    console.error('获取统计信息失败:', error);
    return { success: false, error: error.message };
  }
});

// 导出激活码
ipcMain.handle('export-codes', async (event, codeIds) => {
  try {
    if (!fs.existsSync(codesFile)) {
      return { success: false, error: '激活码文件不存在' };
    }

    const codes = JSON.parse(fs.readFileSync(codesFile, 'utf8'));
    const selectedCodes = codes.filter(c => codeIds.includes(c.id));
    
    const exportData = selectedCodes.map(c => ({
      激活码: c.code,
      有效天数: c.validDays,
      最大设备数: c.maxDevices,
      创建时间: c.createdAt,
      备注: c.notes || ''
    }));

    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'activation-codes-export.json',
      filters: [
        { name: 'JSON文件', extensions: ['json'] },
        { name: '文本文件', extensions: ['txt'] }
      ]
    });

    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf8');
      return { success: true, path: filePath };
    }

    return { success: false, error: '用户取消了导出' };
  } catch (error) {
    console.error('导出激活码失败:', error);
    return { success: false, error: error.message };
  }
});