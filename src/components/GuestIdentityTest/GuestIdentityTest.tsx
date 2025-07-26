import React, { useState, useEffect } from 'react';
import { guestIdentityService, type GuestValidationResult } from '../../services/guestIdentityService';
import './GuestIdentityTest.css';

const GuestIdentityTest: React.FC = () => {
  const [guestStats, setGuestStats] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<GuestValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const refreshStats = () => {
    const stats = guestIdentityService.getGuestStats();
    setGuestStats(stats);
    addLog('刷新访客统计信息');
  };

  const validateAccess = async () => {
    setIsLoading(true);
    addLog('开始验证访客访问权限...');
    
    try {
      const result = await guestIdentityService.validateGuestAccess();
      setValidationResult(result);
      addLog(`验证完成 - 允许访问: ${result.isAllowed}, 风险等级: ${result.riskLevel}`);
    } catch (error) {
      addLog(`验证失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const simulateUsage = (minutes: number) => {
    guestIdentityService.updateUsage(minutes);
    addLog(`模拟使用 ${minutes} 分钟`);
    refreshStats();
  };

  const clearGuestData = () => {
    guestIdentityService.clearGuestData();
    setGuestStats(null);
    setValidationResult(null);
    addLog('清除所有访客数据');
  };

  const testBackendSync = async () => {
    setIsLoading(true);
    addLog('测试后端同步...');
    
    try {
      const identity = await guestIdentityService.getGuestIdentity();
      await guestIdentityService.reportGuestIdentity(identity);
      addLog('后端同步成功');
    } catch (error) {
      addLog(`后端同步失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testMultipleSessions = () => {
    // 模拟多次会话
    for (let i = 0; i < 5; i++) {
      guestIdentityService.recordSession();
    }
    addLog('模拟 5 次会话记录');
  };

  useEffect(() => {
    refreshStats();
    addLog('访客身份测试工具已加载');
  }, []);

  return (
    <div className="guest-identity-test">
      <h2>🧪 访客身份防滥用测试工具</h2>
      
      <div className="test-sections">
        {/* 当前状态 */}
        <div className="test-section">
          <h3>📊 当前访客状态</h3>
          {guestStats ? (
            <div className="stats-display">
              <p><strong>访客ID:</strong> {guestStats.visitorId.substring(0, 8)}...</p>
              <p><strong>已使用时长:</strong> {guestStats.totalMinutesUsed.toFixed(2)} 分钟</p>
              <p><strong>剩余时长:</strong> {guestStats.remainingMinutes.toFixed(2)} 分钟</p>
              <p><strong>会话次数:</strong> {guestStats.sessionsCount}</p>
              <p><strong>创建时间:</strong> {new Date(guestStats.createdAt).toLocaleString()}</p>
              <p><strong>最后使用:</strong> {new Date(guestStats.lastUsedAt).toLocaleString()}</p>
            </div>
          ) : (
            <p>暂无访客数据</p>
          )}
        </div>

        {/* 验证结果 */}
        <div className="test-section">
          <h3>🔍 访问权限验证</h3>
          {validationResult && (
            <div className={`validation-result ${validationResult.riskLevel}`}>
              <p><strong>允许访问:</strong> {validationResult.isAllowed ? '✅ 是' : '❌ 否'}</p>
              <p><strong>剩余时长:</strong> {validationResult.remainingMinutes.toFixed(2)} 分钟</p>
              <p><strong>风险等级:</strong> 
                <span className={`risk-level ${validationResult.riskLevel}`}>
                  {validationResult.riskLevel === 'low' ? '🟢 低' : 
                   validationResult.riskLevel === 'medium' ? '🟡 中' : '🔴 高'}
                </span>
              </p>
              {validationResult.warnings.length > 0 && (
                <div className="warnings">
                  <p><strong>⚠️ 警告:</strong></p>
                  <ul>
                    {validationResult.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 测试操作 */}
        <div className="test-section">
          <h3>🎮 测试操作</h3>
          <div className="test-buttons">
            <button onClick={refreshStats}>刷新状态</button>
            <button onClick={validateAccess} disabled={isLoading}>
              {isLoading ? '验证中...' : '验证访问权限'}
            </button>
            <button onClick={() => simulateUsage(0.5)}>模拟使用 0.5 分钟</button>
            <button onClick={() => simulateUsage(1)}>模拟使用 1 分钟</button>
            <button onClick={() => simulateUsage(2)}>模拟使用 2 分钟</button>
            <button onClick={testMultipleSessions}>模拟多次会话</button>
            <button onClick={testBackendSync} disabled={isLoading}>
              {isLoading ? '同步中...' : '测试后端同步'}
            </button>
            <button onClick={clearGuestData} className="danger">清除访客数据</button>
          </div>
        </div>

        {/* 测试日志 */}
        <div className="test-section">
          <h3>📝 测试日志</h3>
          <div className="test-logs">
            {testLogs.map((log, index) => (
              <div key={index} className="log-entry">{log}</div>
            ))}
          </div>
          <button onClick={() => setTestLogs([])} className="clear-logs">
            清除日志
          </button>
        </div>

        {/* 边界测试 */}
        <div className="test-section">
          <h3>🚨 边界测试场景</h3>
          <div className="boundary-tests">
            <button onClick={() => {
              // 测试超限使用
              simulateUsage(6);
              setTimeout(validateAccess, 100);
            }}>
              测试超限使用 (6分钟)
            </button>
            
            <button onClick={() => {
              // 测试频繁访问
              for (let i = 0; i < 10; i++) {
                setTimeout(() => guestIdentityService.recordSession(), i * 100);
              }
              setTimeout(() => {
                addLog('模拟 10 次频繁会话');
                validateAccess();
              }, 1100);
            }}>
              测试频繁访问
            </button>

            <button onClick={() => {
              // 测试清除后重新访问
              clearGuestData();
              setTimeout(() => {
                guestIdentityService.recordSession();
                validateAccess();
              }, 100);
            }}>
              测试清除后重新访问
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestIdentityTest;