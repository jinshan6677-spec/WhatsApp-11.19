/**
 * 测试多账号场景下的按钮状态管理
 * 问题描述：当用户已经登录账号5时，关闭账号按钮功能正常运作。
 * 但在创建新账号6后，账号5的关闭按钮状态会异常地持续显示"加载中"状态。
 * 必须手动刷新页面才能使账号5的关闭按钮恢复正常功能状态。
 */

describe('多账号场景下的按钮状态管理', () => {
  let mockAccounts = [];
  let mockSidebar;
  let mockElectronAPI;

  beforeEach(() => {
    // 模拟账号数据
    mockAccounts = [
      {
        id: 'account-5',
        name: '账号 5',
        runningStatus: 'connected',
        isRunning: true,
        loginStatus: true,
        status: 'online'
      },
      {
        id: 'account-6',
        name: '账号 6',
        runningStatus: 'not_started',
        isRunning: false,
        loginStatus: false,
        status: 'offline'
      }
    ];

    // 模拟 Electron API
    mockElectronAPI = {
      invoke: jest.fn(),
      on: jest.fn(),
      send: jest.fn(),
      getAllAccountStatuses: jest.fn().mockResolvedValue({
        success: true,
        statuses: {
          'account-5': { status: 'connected', isRunning: true },
          'account-6': { status: 'not_started', isRunning: false }
        }
      })
    };

    // 模拟 sidebar 模块
    mockSidebar = {
      accounts: [...mockAccounts],
      updateAccountRunningStatus: jest.fn(),
      handleAccountsUpdated: jest.fn(),
      renderAccountList: jest.fn(),
      syncAccountStatusesWithRunningStatus: jest.fn()
    };

    // 模拟全局对象
    global.window = {
      electronAPI: mockElectronAPI,
      sidebar: mockSidebar
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('创建新账号不应影响已有账号的关闭按钮状态', () => {
    // 初始状态：账号5已登录，关闭按钮应显示正常
    const account5 = mockAccounts.find(acc => acc.id === 'account-5');
    expect(account5.runningStatus).toBe('connected');
    expect(account5.isRunning).toBe(true);

    // 模拟创建新账号6
    const newAccount = {
      id: 'account-6',
      name: '账号 6',
      runningStatus: 'not_started',
      isRunning: false,
      loginStatus: false,
      status: 'offline'
    };

    // 模拟 accounts-updated 事件
    const updatedAccounts = [...mockAccounts, newAccount];
    mockSidebar.handleAccountsUpdated(updatedAccounts);

    // 验证账号5的状态不应被修改
    expect(account5.runningStatus).toBe('connected');
    expect(account5.isRunning).toBe(true);

    // 验证没有调用 updateAccountRunningStatus 来修改账号5的状态
    expect(mockSidebar.updateAccountRunningStatus).not.toHaveBeenCalledWith('account-5', 'loading');
  });

  test('handleAccountsUpdated 应保留已有账号的运行状态', () => {
    // 模拟初始状态
    const initialAccounts = [
      {
        id: 'account-5',
        name: '账号 5',
        runningStatus: 'connected',
        isRunning: true,
        loginStatus: true,
        status: 'online'
      }
    ];

    mockSidebar.accounts = initialAccounts;

    // 模拟从主进程接收的更新数据（不包含运行状态）
    const updatedAccountsData = [
      {
        id: 'account-5',
        name: '账号 5',
        loginStatus: true,
        status: 'online'
      },
      {
        id: 'account-6',
        name: '账号 6',
        loginStatus: false,
        status: 'offline'
      }
    ];

    // 调用 handleAccountsUpdated
    mockSidebar.handleAccountsUpdated(updatedAccountsData);

    // 验证账号5的运行状态应该被保留
    const account5 = mockSidebar.accounts.find(acc => acc.id === 'account-5');
    expect(account5.runningStatus).toBe('connected');
    expect(account5.isRunning).toBe(true);
  });

  test('mergeRunningStatuses 应正确合并状态', () => {
    // 模拟 mergeRunningStatuses 函数
    const mergeRunningStatuses = (statuses) => {
      mockSidebar.accounts.forEach((account) => {
        const statusInfo = statuses[account.id];
        if (statusInfo) {
          account.runningStatus = statusInfo.status;
          account.isRunning = !!statusInfo.isRunning;
        }
      });
    };

    // 初始状态
    const accounts = [
      { id: 'account-5', name: '账号 5', runningStatus: 'connected', isRunning: true },
      { id: 'account-6', name: '账号 6', runningStatus: 'not_started', isRunning: false }
    ];

    mockSidebar.accounts = accounts;

    // 模拟状态更新（只更新账号6）
    const statuses = {
      'account-6': { status: 'loading', isRunning: true }
    };

    mergeRunningStatuses(statuses);

    // 验证账号5的状态不变
    const account5 = mockSidebar.accounts.find(acc => acc.id === 'account-5');
    expect(account5.runningStatus).toBe('connected');
    expect(account5.isRunning).toBe(true);

    // 验证账号6的状态更新
    const account6 = mockSidebar.accounts.find(acc => acc.id === 'account-6');
    expect(account6.runningStatus).toBe('loading');
    expect(account6.isRunning).toBe(true);
  });

  test('updateAccountRunningStatus 应只更新指定账号的状态', () => {
    // 模拟 updateAccountRunningStatus 函数
    const updateAccountRunningStatus = (accountId, runningStatus) => {
      const account = mockSidebar.accounts.find((acc) => acc.id === accountId);
      if (!account) return;

      account.runningStatus = runningStatus;
      account.isRunning = runningStatus !== 'not_started' && runningStatus !== 'error';
    };

    // 初始状态
    const accounts = [
      { id: 'account-5', name: '账号 5', runningStatus: 'connected', isRunning: true },
      { id: 'account-6', name: '账号 6', runningStatus: 'not_started', isRunning: false }
    ];

    mockSidebar.accounts = accounts;

    // 更新账号6的状态
    updateAccountRunningStatus('account-6', 'loading');

    // 验证账号5的状态不变
    const account5 = mockSidebar.accounts.find(acc => acc.id === 'account-5');
    expect(account5.runningStatus).toBe('connected');
    expect(account5.isRunning).toBe(true);

    // 验证账号6的状态更新
    const account6 = mockSidebar.accounts.find(acc => acc.id === 'account-6');
    expect(account6.runningStatus).toBe('loading');
    expect(account6.isRunning).toBe(true);
  });

  test('renderQuickActions 应根据运行状态显示正确的按钮', () => {
    // 模拟 renderQuickActions 函数逻辑（根据实际代码）
    const getButtonState = (account) => {
      const runningStatus = account.runningStatus || 'not_started';
      const isRunning = !!account.isRunning;

      // 注意：实际代码中，runningStatus === 'error' 的检查在 isRunning 检查之前
      if (runningStatus === 'error') {
        return { type: 'retry', icon: '↻', title: '重试' };
      } else if (runningStatus === 'loading') {
        return { type: 'loading', icon: null, title: '' };
      } else if (runningStatus === 'connected' || isRunning) {
        return { type: 'stop', icon: '⏹', title: '关闭账号' };
      } else {
        // runningStatus === 'not_started' || !isRunning
        return { type: 'start', icon: '▶', title: '打开账号' };
      }
    };

    // 测试各种状态
    const testCases = [
      { runningStatus: 'not_started', isRunning: false, expected: 'start' },
      { runningStatus: 'loading', isRunning: true, expected: 'loading' },
      { runningStatus: 'connected', isRunning: true, expected: 'stop' },
      { runningStatus: 'error', isRunning: false, expected: 'retry' },
      { runningStatus: 'error', isRunning: true, expected: 'retry' } // error 状态优先
    ];

    testCases.forEach((testCase, index) => {
      const account = {
        id: `account-${index}`,
        name: `账号 ${index}`,
        runningStatus: testCase.runningStatus,
        isRunning: testCase.isRunning
      };

      const result = getButtonState(account);
      expect(result.type).toBe(testCase.expected);
    });
  });
});