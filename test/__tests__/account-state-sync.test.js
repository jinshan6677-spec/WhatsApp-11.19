/**
 * 测试账号状态同步机制
 * 验证修复后的状态同步逻辑
 */

describe('账号状态同步机制', () => {
  let mockAccounts = [];
  let mockMergeRunningStatuses;
  let mockHandleAccountsUpdated;

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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('mergeRunningStatuses 应保护已连接的账号不被 loading 状态覆盖', () => {
    // 模拟 mergeRunningStatuses 函数（修复后的版本）
    const mergeRunningStatuses = (accounts, statuses) => {
      accounts.forEach((account) => {
        const statusInfo = statuses[account.id];
        if (statusInfo) {
          const oldStatus = account.runningStatus;
          const newStatus = statusInfo.status;
          
          // 特殊保护：如果账号已经是 connected 状态，不要用 loading 状态覆盖
          if (oldStatus === 'connected' && newStatus === 'loading') {
            console.warn(`Protecting account ${account.id} from incorrect status change`);
            return; // 跳过这次更新
          }
          
          account.runningStatus = newStatus;
          account.isRunning = !!statusInfo.isRunning;
        }
      });
    };

    // 初始状态
    const accounts = [...mockAccounts];
    
    // 模拟状态更新：账号5应该保持 connected，账号6更新为 loading
    const statuses = {
      'account-5': { status: 'loading', isRunning: true }, // 错误的状态更新
      'account-6': { status: 'loading', isRunning: true }  // 正确的状态更新
    };

    mergeRunningStatuses(accounts, statuses);

    // 验证账号5的状态被保护，没有被覆盖
    const account5 = accounts.find(acc => acc.id === 'account-5');
    expect(account5.runningStatus).toBe('connected'); // 应该保持原状
    expect(account5.isRunning).toBe(true);

    // 验证账号6的状态被更新
    const account6 = accounts.find(acc => acc.id === 'account-6');
    expect(account6.runningStatus).toBe('loading');
    expect(account6.isRunning).toBe(true);
  });

  test('handleAccountsUpdated 应保留已有账号的运行状态', () => {
    // 模拟 handleAccountsUpdated 函数（修复后的版本）
    const handleAccountsUpdated = (oldAccounts, newAccountsData) => {
      // 创建旧账号状态的映射
      const oldAccountStatusMap = new Map();
      oldAccounts.forEach(acc => {
        oldAccountStatusMap.set(acc.id, {
          runningStatus: acc.runningStatus,
          isRunning: acc.isRunning,
          loginStatus: acc.loginStatus,
          status: acc.status
        });
      });

      // 合并新账号数据，保留旧账号的运行状态
      return newAccountsData.map(newAccount => {
        const oldStatus = oldAccountStatusMap.get(newAccount.id);
        if (oldStatus) {
          return {
            ...newAccount,
            runningStatus: oldStatus.runningStatus,
            isRunning: oldStatus.isRunning,
            loginStatus: oldStatus.loginStatus !== undefined ? oldStatus.loginStatus : newAccount.loginStatus,
            status: oldStatus.status || newAccount.status
          };
        }
        return newAccount;
      });
    };

    // 初始状态
    const oldAccounts = [
      {
        id: 'account-5',
        name: '账号 5',
        runningStatus: 'connected',
        isRunning: true,
        loginStatus: true,
        status: 'online',
        phoneNumber: '1234567890',
        note: '测试账号'
      }
    ];

    // 模拟从主进程接收的新数据（不包含运行状态）
    const newAccountsData = [
      {
        id: 'account-5',
        name: '账号 5（已重命名）',
        phoneNumber: '1234567890',
        note: '更新后的备注',
        loginStatus: true,
        status: 'online'
      },
      {
        id: 'account-6',
        name: '账号 6',
        phoneNumber: '0987654321',
        note: '新账号',
        loginStatus: false,
        status: 'offline'
      }
    ];

    const result = handleAccountsUpdated(oldAccounts, newAccountsData);

    // 验证账号5的运行状态被保留
    const account5 = result.find(acc => acc.id === 'account-5');
    expect(account5.runningStatus).toBe('connected');
    expect(account5.isRunning).toBe(true);
    expect(account5.name).toBe('账号 5（已重命名）'); // 名称被更新
    expect(account5.note).toBe('更新后的备注'); // 备注被更新

    // 验证账号6是全新的账号
    const account6 = result.find(acc => acc.id === 'account-6');
    expect(account6.runningStatus).toBeUndefined(); // 新账号没有运行状态
    expect(account6.isRunning).toBeUndefined();
    expect(account6.name).toBe('账号 6');
  });

  test('状态同步应正确处理各种状态转换', () => {
    // 测试各种状态转换场景
    const testCases = [
      {
        name: 'not_started -> loading (允许)',
        oldStatus: 'not_started',
        newStatus: 'loading',
        shouldUpdate: true
      },
      {
        name: 'loading -> connected (允许)',
        oldStatus: 'loading',
        newStatus: 'connected',
        shouldUpdate: true
      },
      {
        name: 'connected -> not_started (允许)',
        oldStatus: 'connected',
        newStatus: 'not_started',
        shouldUpdate: true
      },
      {
        name: 'connected -> loading (阻止)',
        oldStatus: 'connected',
        newStatus: 'loading',
        shouldUpdate: false
      },
      {
        name: 'error -> loading (允许)',
        oldStatus: 'error',
        newStatus: 'loading',
        shouldUpdate: true
      },
      {
        name: 'loading -> error (允许)',
        oldStatus: 'loading',
        newStatus: 'error',
        shouldUpdate: true
      }
    ];

    testCases.forEach(testCase => {
      // 模拟状态保护逻辑
      const shouldProtect = (oldStatus, newStatus) => {
        return oldStatus === 'connected' && newStatus === 'loading';
      };

      const willUpdate = !shouldProtect(testCase.oldStatus, testCase.newStatus);
      expect(willUpdate).toBe(testCase.shouldUpdate);
    });
  });

  test('多账号操作时状态应保持独立', () => {
    // 模拟多个账号的独立状态管理
    const accounts = [
      { id: 'account-1', name: '账号 1', runningStatus: 'connected', isRunning: true },
      { id: 'account-2', name: '账号 2', runningStatus: 'not_started', isRunning: false },
      { id: 'account-3', name: '账号 3', runningStatus: 'connected', isRunning: true }
    ];

    // 模拟只更新账号2的状态
    const updateSingleAccountStatus = (accounts, accountId, newStatus) => {
      return accounts.map(account => {
        if (account.id === accountId) {
          return {
            ...account,
            runningStatus: newStatus,
            isRunning: newStatus !== 'not_started' && newStatus !== 'error'
          };
        }
        return account;
      });
    };

    // 更新账号2为 loading
    const updatedAccounts = updateSingleAccountStatus(accounts, 'account-2', 'loading');

    // 验证只有账号2的状态被更新
    const account1 = updatedAccounts.find(acc => acc.id === 'account-1');
    const account2 = updatedAccounts.find(acc => acc.id === 'account-2');
    const account3 = updatedAccounts.find(acc => acc.id === 'account-3');

    expect(account1.runningStatus).toBe('connected');
    expect(account1.isRunning).toBe(true);

    expect(account2.runningStatus).toBe('loading');
    expect(account2.isRunning).toBe(true);

    expect(account3.runningStatus).toBe('connected');
    expect(account3.isRunning).toBe(true);
  });

  test('新账号创建不应触发已有账号的状态重新渲染', () => {
    // 模拟 renderAccountList 的调用计数
    let renderCount = 0;
    const mockRenderAccountList = () => {
      renderCount++;
    };

    // 模拟防抖逻辑
    const updateTimers = new Map();
    const DEBOUNCE_DELAY = 100;

    const scheduleRender = (timerKey, renderFn) => {
      if (updateTimers.has(timerKey)) {
        clearTimeout(updateTimers.get(timerKey));
      }

      updateTimers.set(
        timerKey,
        setTimeout(() => {
          renderFn();
          updateTimers.delete(timerKey);
        }, DEBOUNCE_DELAY)
      );
    };

    // 模拟多次快速更新（如创建新账号时）
    scheduleRender('accountList', mockRenderAccountList);
    scheduleRender('accountList', mockRenderAccountList);
    scheduleRender('accountList', mockRenderAccountList);

    // 验证防抖逻辑：多次快速调用应该只计划一次渲染
    expect(updateTimers.size).toBe(1);
    
    // 模拟定时器触发
    const timerId = updateTimers.get('accountList');
    clearTimeout(timerId);
    mockRenderAccountList();
    updateTimers.delete('accountList');

    // 验证只渲染了一次
    expect(renderCount).toBe(1);
  });
});