/**
 * MainApplicationWindow 测试
 */

const { BrowserWindow } = require('electron');
const MainApplicationWindow = require('../MainApplicationWindow');

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn().mockResolvedValue(undefined),
    once: jest.fn((event, callback) => {
      if (event === 'ready-to-show') {
        setTimeout(callback, 0);
      }
    }),
    on: jest.fn(),
    show: jest.fn(),
    focus: jest.fn(),
    isMinimized: jest.fn().mockReturnValue(false),
    restore: jest.fn(),
    close: jest.fn(),
    webContents: {
      send: jest.fn(),
      openDevTools: jest.fn()
    }
  }))
}));

describe('MainApplicationWindow', () => {
  let mainWindow;

  beforeEach(() => {
    mainWindow = new MainApplicationWindow();
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('应该创建 BrowserWindow', () => {
      mainWindow.initialize();
      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('应该加载 index.html', () => {
      const window = mainWindow.initialize();
      expect(window.loadFile).toHaveBeenCalled();
    });

    it('应该在 ready-to-show 时显示窗口', (done) => {
      const window = mainWindow.initialize();
      setTimeout(() => {
        expect(window.show).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('应该返回窗口对象', () => {
      const window = mainWindow.initialize();
      expect(window).toBeDefined();
      expect(window).toBe(mainWindow.getWindow());
    });

    it('多次调用应该返回同一个窗口', () => {
      const window1 = mainWindow.initialize();
      const window2 = mainWindow.initialize();
      expect(window1).toBe(window2);
    });
  });

  describe('renderAccountList', () => {
    it('应该发送 accounts:render 事件', () => {
      mainWindow.initialize();
      const accounts = [
        { id: '1', name: 'Account 1' },
        { id: '2', name: 'Account 2' }
      ];
      
      mainWindow.renderAccountList(accounts);
      
      expect(mainWindow.window.webContents.send).toHaveBeenCalledWith(
        'accounts:render',
        accounts
      );
    });

    it('窗口不存在时不应该抛出错误', () => {
      expect(() => {
        mainWindow.renderAccountList([]);
      }).not.toThrow();
    });
  });

  describe('updateAccountStatus', () => {
    it('应该发送 account:status-update 事件', () => {
      mainWindow.initialize();
      const accountId = 'test-id';
      const status = { status: 'running', unreadCount: 5 };
      
      mainWindow.updateAccountStatus(accountId, status);
      
      expect(mainWindow.window.webContents.send).toHaveBeenCalledWith(
        'account:status-update',
        { accountId, status }
      );
    });

    it('窗口不存在时不应该抛出错误', () => {
      expect(() => {
        mainWindow.updateAccountStatus('id', {});
      }).not.toThrow();
    });
  });

  describe('showNotification', () => {
    it('应该发送 notification:show 事件', () => {
      mainWindow.initialize();
      const accountId = 'test-id';
      const message = 'Test notification';
      
      mainWindow.showNotification(accountId, message);
      
      expect(mainWindow.window.webContents.send).toHaveBeenCalledWith(
        'notification:show',
        { accountId, message }
      );
    });

    it('窗口不存在时不应该抛出错误', () => {
      expect(() => {
        mainWindow.showNotification('id', 'message');
      }).not.toThrow();
    });
  });

  describe('getWindow', () => {
    it('应该返回窗口对象', () => {
      mainWindow.initialize();
      expect(mainWindow.getWindow()).toBe(mainWindow.window);
    });

    it('未初始化时应该返回 null', () => {
      expect(mainWindow.getWindow()).toBeNull();
    });
  });

  describe('close', () => {
    it('应该关闭窗口', () => {
      mainWindow.initialize();
      mainWindow.close();
      expect(mainWindow.window.close).toHaveBeenCalled();
    });

    it('窗口不存在时不应该抛出错误', () => {
      expect(() => {
        mainWindow.close();
      }).not.toThrow();
    });
  });

  describe('focus', () => {
    it('应该聚焦窗口', () => {
      mainWindow.initialize();
      mainWindow.focus();
      expect(mainWindow.window.focus).toHaveBeenCalled();
    });

    it('窗口最小化时应该先恢复', () => {
      mainWindow.initialize();
      mainWindow.window.isMinimized.mockReturnValue(true);
      
      mainWindow.focus();
      
      expect(mainWindow.window.restore).toHaveBeenCalled();
      expect(mainWindow.window.focus).toHaveBeenCalled();
    });

    it('窗口不存在时不应该抛出错误', () => {
      expect(() => {
        mainWindow.focus();
      }).not.toThrow();
    });
  });
});
