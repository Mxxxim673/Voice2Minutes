import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import GuestIdentityTest from '../../components/GuestIdentityTest/GuestIdentityTest';
import './AdminPanel.css';

interface TestUser {
  id: string;
  email: string;
  userType: 'guest' | 'trial' | 'paid' | 'subscription' | 'admin';
  quotaMinutes: number;
  usedMinutes: number;
  planType?: string;
  subscriptionType?: 'monthly' | 'yearly' | 'one-time';
}

const AdminPanel: React.FC = () => {
  const { t } = useTranslation();
  const { setUser, setIsGuest } = useAuth() as any; // 扩展类型以允许直接设置
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [selectedUser, setSelectedUser] = useState<TestUser | null>(null);
  const [testFile, setTestFile] = useState<File | null>(null);
  const [simulationMode, setSimulationMode] = useState<'normal' | 'quota-exceeded' | 'slow-network'>('normal');

  // 检查管理员密码
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const adminPassword = 'admin123'; // 简单密码，生产环境应该使用环境变量
    
    if (password === adminPassword) {
      setIsAuthenticated(true);
      setPasswordError('');
      localStorage.setItem('adminAuth', 'true');
    } else {
      setPasswordError('密码错误，请重试');
      setPassword('');
    }
  };

  // 检查本地存储的认证状态
  React.useEffect(() => {
    const adminAuth = localStorage.getItem('adminAuth');
    if (adminAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // 如果未认证，显示登录界面
  if (!isAuthenticated) {
    return (
      <div className="admin-panel">
        <div className="container">
          <div className="admin-login">
            <div className="login-card">
              <h1>🔐 管理员面板</h1>
              <p>请输入管理员密码以访问测试面板</p>
              
              <form onSubmit={handlePasswordSubmit} className="login-form">
                <div className="form-group">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入管理员密码"
                    className="password-input"
                    autoFocus
                  />
                </div>
                
                {passwordError && (
                  <div className="error-message">
                    {passwordError}
                  </div>
                )}
                
                <button type="submit" className="login-button">
                  登录管理面板
                </button>
              </form>
              
              <div className="login-hint">
                <p>💡 提示：默认密码为 <code>admin123</code></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 预定义测试用户（简化为三种类型）
  const testUsers: TestUser[] = [
    {
      id: 'guest',
      email: '',
      userType: 'guest',
      quotaMinutes: 5,
      usedMinutes: 0,
    },
    {
      id: 'trial_new',
      email: 'trial@test.com',
      userType: 'trial',
      quotaMinutes: 10,
      usedMinutes: 2.5,
    },
    {
      id: 'trial_almost_full',
      email: 'trial-full@test.com',
      userType: 'trial',
      quotaMinutes: 10,
      usedMinutes: 9.5,
    },
    {
      id: 'paid_1hour',
      email: 'paid1h@test.com',
      userType: 'paid',
      quotaMinutes: 60, // 1 hour
      usedMinutes: 15,
      planType: '1小时套餐'
    },
    {
      id: 'paid_3hour',
      email: 'paid3h@test.com',
      userType: 'paid',
      quotaMinutes: 180, // 3 hours
      usedMinutes: 60,
      planType: '3小时套餐'
    },
    {
      id: 'paid_5hour',
      email: 'paid5h@test.com',
      userType: 'paid',
      quotaMinutes: 300, // 5 hours
      usedMinutes: 120,
      planType: '5小时套餐'
    },
    {
      id: 'paid_10hour',
      email: 'paid10h@test.com',
      userType: 'paid',
      quotaMinutes: 600, // 10 hours
      usedMinutes: 200,
      planType: '10小时套餐'
    },
    {
      id: 'paid_20hour',
      email: 'paid20h@test.com',
      userType: 'paid',
      quotaMinutes: 1200, // 20 hours
      usedMinutes: 400,
      planType: '20小时套餐'
    },
    {
      id: 'paid_50hour',
      email: 'paid50h@test.com',
      userType: 'paid',
      quotaMinutes: 3000, // 50 hours
      usedMinutes: 1000,
      planType: '50小时套餐'
    },
    {
      id: 'paid_100hour',
      email: 'paid100h@test.com',
      userType: 'paid',
      quotaMinutes: 6000, // 100 hours
      usedMinutes: 2000,
      planType: '100小时套餐'
    }
  ];

  const handleUserSwitch = (testUser: TestUser) => {
    setSelectedUser(testUser);
    
    // 更新AuthContext状态
    if (testUser.userType === 'guest') {
      setIsGuest(true);
      setUser({
        id: 'guest',
        email: '',
        isEmailVerified: false,
        userType: 'guest',
        quotaMinutes: 5,
        usedMinutes: testUser.usedMinutes,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('guestMode', 'true');
      localStorage.setItem('guestUsedMinutes', testUser.usedMinutes.toString());
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
    } else {
      setIsGuest(false);
      const userData = {
        id: testUser.id,
        email: testUser.email,
        isEmailVerified: true,
        userType: testUser.userType,
        quotaMinutes: testUser.quotaMinutes,
        usedMinutes: testUser.usedMinutes,
        planType: testUser.planType,
        subscriptionType: testUser.subscriptionType,
        createdAt: new Date().toISOString()
      };
      
      setUser(userData);
      localStorage.setItem('authToken', `admin_token_${testUser.id}`);
      localStorage.setItem('userData', JSON.stringify(userData));
      localStorage.removeItem('guestMode');
      localStorage.removeItem('guestUsedMinutes');
    }

    console.log(`🎭 已切换到测试用户: ${testUser.userType} - ${testUser.email || 'Guest'}`);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setTestFile(file);
    }
  };

  const handleUsageSimulation = (minutes: number) => {
    if (!selectedUser) return;
    
    const newUsedMinutes = Math.min(
      selectedUser.quotaMinutes,
      selectedUser.usedMinutes + minutes
    );
    
    const updatedUser = { ...selectedUser, usedMinutes: newUsedMinutes };
    setSelectedUser(updatedUser);
    handleUserSwitch(updatedUser);
  };

  const resetUserUsage = () => {
    if (!selectedUser) return;
    
    const resetUser = { ...selectedUser, usedMinutes: 0 };
    setSelectedUser(resetUser);
    handleUserSwitch(resetUser);
  };

  const simulatePurchase = (planType: string, minutes: number) => {
    if (!selectedUser) return;
    
    const updatedUser = {
      ...selectedUser,
      userType: 'paid' as const,
      quotaMinutes: selectedUser.quotaMinutes + minutes,
      planType: planType
    };
    
    setSelectedUser(updatedUser);
    handleUserSwitch(updatedUser);
    console.log(`💳 模拟购买时长: ${planType} - ${minutes}分钟`);
  };

  const simulateSubscription = (type: 'monthly' | 'yearly') => {
    if (!selectedUser) return;
    
    const minutes = type === 'monthly' ? 1800 : 21600; // 30h or 360h
    const updatedUser = {
      ...selectedUser,
      userType: 'subscription' as const,
      quotaMinutes: minutes,
      usedMinutes: 0, // Reset usage for new subscription
      planType: type === 'monthly' ? '月付订阅' : '年付订阅',
      subscriptionType: type
    };
    
    setSelectedUser(updatedUser);
    handleUserSwitch(updatedUser);
    console.log(`📅 模拟订阅: ${type}`);
  };

  const getUserStatusIcon = (userType: string) => {
    switch (userType) {
      case 'guest': return '👤';
      case 'trial': return '🎯';
      case 'paid': return '💎';
      case 'subscription': return '👑';
      default: return '❓';
    }
  };

  // 音频模拟功能函数
  const simulateRecording = (minutes: number) => {
    if (!selectedUser) {
      alert('请先选择一个测试用户');
      return;
    }

    console.log(`🎤 模拟录音开始: ${minutes} 分钟`);
    
    // 检查权限
    if (selectedUser.userType === 'guest' && minutes > 5) {
      alert('⚠️ 游客用户录音时间不能超过5分钟');
      return;
    }

    // 检查配额
    const remainingQuota = selectedUser.quotaMinutes - selectedUser.usedMinutes;
    if (remainingQuota < minutes) {
      alert(`⚠️ 配额不足！剩余 ${remainingQuota.toFixed(1)} 分钟，需要 ${minutes} 分钟`);
      return;
    }

    // 模拟录音过程
    const newUsage = selectedUser.usedMinutes + minutes;
    setSelectedUser({...selectedUser, usedMinutes: newUsage});
    
    // 更新认证上下文中的用户数据
    const updatedUser = {
      ...selectedUser,
      usedMinutes: newUsage,
      isEmailVerified: selectedUser.userType !== 'guest'
    };
    setUser(updatedUser);
    
    alert(`✅ 录音模拟完成！使用了 ${minutes} 分钟，剩余配额: ${(selectedUser.quotaMinutes - newUsage).toFixed(1)} 分钟`);
    console.log(`✅ 录音完成，新的使用量: ${newUsage} 分钟`);
  };

  const simulateFileUpload = (size: 'small' | 'medium' | 'large') => {
    if (!selectedUser) {
      alert('请先选择一个测试用户');
      return;
    }

    const fileSpecs = {
      small: { mb: 2, minutes: 5, name: 'small_audio.mp3' },
      medium: { mb: 10, minutes: 20, name: 'medium_audio.wav' },
      large: { mb: 50, minutes: 60, name: 'large_audio.mp4' }
    };

    const spec = fileSpecs[size];
    console.log(`📁 模拟文件上传: ${spec.name} (${spec.mb}MB, ${spec.minutes}分钟)`);

    // 检查权限
    if (selectedUser.userType === 'guest') {
      alert('⚠️ 游客用户无法上传文件，请使用实时录音功能');
      return;
    }

    // 检查配额
    const remainingQuota = selectedUser.quotaMinutes - selectedUser.usedMinutes;
    if (remainingQuota < spec.minutes) {
      alert(`⚠️ 配额不足！剩余 ${remainingQuota.toFixed(1)} 分钟，需要 ${spec.minutes} 分钟`);
      return;
    }

    // 模拟上传过程
    const newUsage = selectedUser.usedMinutes + spec.minutes;
    setSelectedUser({...selectedUser, usedMinutes: newUsage});
    
    // 更新认证上下文中的用户数据
    const updatedUser = {
      ...selectedUser,
      usedMinutes: newUsage,
      isEmailVerified: true
    };
    setUser(updatedUser);
    
    alert(`✅ 文件上传模拟完成！${spec.name} 处理完毕，使用了 ${spec.minutes} 分钟`);
    console.log(`✅ 文件上传完成: ${spec.name}, 新的使用量: ${newUsage} 分钟`);
  };

  const simulateTranscription = (type: 'success' | 'quota-exceeded' | 'permission-denied' | 'poor-quality') => {
    if (!selectedUser) {
      alert('请先选择一个测试用户');
      return;
    }

    console.log(`🤖 模拟转录结果: ${type}`);

    switch (type) {
      case 'success':
        alert('✅ 转录成功！\n\n模拟转录结果：\n"这是一段模拟的转录文本内容，用于测试转录功能是否正常工作。系统已成功识别并转换了音频内容。"');
        break;
        
      case 'quota-exceeded':
        alert('⚠️ 配额已超限！\n\n您的可用时长已用完，请购买更多时长或升级套餐后继续使用。');
        break;
        
      case 'permission-denied':
        if (selectedUser.userType === 'guest') {
          alert('🚫 权限不足！\n\n游客用户无法使用此功能，请注册账户或登录后再试。');
        } else {
          alert('🚫 权限不足！\n\n您当前的用户类型无法使用此功能。');
        }
        break;
        
      case 'poor-quality':
        alert('⚠️ 音频质量过差！\n\n检测到音频文件质量较差或存在以下问题：\n• 音量过低\n• 背景噪音过多\n• 音频格式不支持\n\n请上传更高质量的音频文件。');
        break;
        
      default:
        alert('❓ 未知的转录结果类型');
    }
  };

  const testFeatureAccess = (feature: 'copy-text' | 'export-word' | 'file-upload' | 'history-access') => {
    if (!selectedUser) {
      alert('请先选择一个测试用户');
      return;
    }

    console.log(`🔐 测试功能权限: ${feature} (用户类型: ${selectedUser.userType})`);

    const featureNames = {
      'copy-text': '复制文本',
      'export-word': '导出Word文档',
      'file-upload': '文件上传',
      'history-access': '历史记录访问'
    };

    const featureName = featureNames[feature];

    // 根据用户类型检查权限
    let hasPermission = false;
    let reason = '';

    switch (selectedUser.userType) {
      case 'guest':
        hasPermission = feature === 'file-upload';
        reason = hasPermission ? 
          '访客用户可以上传文件，但不能复制文本和导出Word' : 
          '访客用户仅支持实时录音和文件上传功能';
        break;
        
      case 'trial':
        hasPermission = true; // 试用用户现在拥有所有功能权限
        reason = '试用用户已解锁全部功能（复制、导出Word、文件上传、使用统计）';
        break;
        
      case 'paid':
        hasPermission = true;
        reason = '付费用户享有完整功能权限';
        break;
        
      default:
        hasPermission = false;
        reason = '未知用户类型';
    }

    if (hasPermission) {
      alert(`✅ 权限检查通过！\n\n功能: ${featureName}\n用户类型: ${selectedUser.userType.toUpperCase()}\n说明: ${reason}`);
    } else {
      alert(`🚫 权限不足！\n\n功能: ${featureName}\n用户类型: ${selectedUser.userType.toUpperCase()}\n原因: ${reason}`);
    }
  };

  return (
    <div className="admin-panel">
      <div className="container">
        <div className="admin-header">
          <h1>🔧 管理员测试面板</h1>
          <p>模拟不同用户身份和场景进行功能测试</p>
        </div>

        <div className="admin-content">
          {/* 用户切换区域 */}
          <div className="admin-section">
            <h2>👥 用户身份切换</h2>
            <div className="user-grid">
              {testUsers.map((user) => (
                <div
                  key={user.id}
                  className={`user-card ${selectedUser?.id === user.id ? 'selected' : ''}`}
                  onClick={() => handleUserSwitch(user)}
                >
                  <div className="user-icon">
                    {getUserStatusIcon(user.userType)}
                  </div>
                  <div className="user-info">
                    <h3>{user.userType.toUpperCase()}</h3>
                    <p>{user.email || '游客模式'}</p>
                    <div className="user-quota">
                      {user.usedMinutes.toFixed(1)}/{user.quotaMinutes} 分钟
                    </div>
                    {user.planType && (
                      <div className="user-plan">{user.planType}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 当前用户状态 */}
          {selectedUser && (
            <div className="admin-section">
              <h2>📊 当前测试用户状态</h2>
              <div className="current-user-status">
                <div className="status-item">
                  <strong>用户类型:</strong> {getUserStatusIcon(selectedUser.userType)} {selectedUser.userType}
                </div>
                <div className="status-item">
                  <strong>邮箱:</strong> {selectedUser.email || '无'}
                </div>
                <div className="status-item">
                  <strong>配额:</strong> {selectedUser.quotaMinutes} 分钟
                </div>
                <div className="status-item">
                  <strong>已用:</strong> {selectedUser.usedMinutes.toFixed(1)} 分钟
                </div>
                <div className="status-item">
                  <strong>剩余:</strong> {(selectedUser.quotaMinutes - selectedUser.usedMinutes).toFixed(1)} 分钟
                </div>
                {selectedUser.planType && (
                  <div className="status-item">
                    <strong>套餐:</strong> {selectedUser.planType}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 使用量模拟 */}
          <div className="admin-section">
            <h2>⏱️ 使用量模拟</h2>
            <div className="simulation-controls">
              <button 
                onClick={() => handleUsageSimulation(1)}
                className="button button-secondary"
                disabled={!selectedUser}
              >
                +1 分钟
              </button>
              <button 
                onClick={() => handleUsageSimulation(5)}
                className="button button-secondary"
                disabled={!selectedUser}
              >
                +5 分钟
              </button>
              <button 
                onClick={() => handleUsageSimulation(30)}
                className="button button-secondary"
                disabled={!selectedUser}
              >
                +30 分钟
              </button>
              <button 
                onClick={resetUserUsage}
                className="button button-warning"
                disabled={!selectedUser}
              >
                重置使用量
              </button>
            </div>
          </div>

          {/* 购买时长模拟 */}
          <div className="admin-section">
            <h2>💳 购买时长/订阅模拟</h2>
            <div className="purchase-controls">
              <h3>购买时长</h3>
              <div className="purchase-buttons">
                <button 
                  onClick={() => simulatePurchase('5小时套餐', 300)}
                  className="button button-primary"
                  disabled={!selectedUser}
                >
                  购买时长5小时 (300分钟)
                </button>
                <button 
                  onClick={() => simulatePurchase('10小时套餐', 600)}
                  className="button button-primary"
                  disabled={!selectedUser}
                >
                  购买时长10小时 (600分钟)
                </button>
                <button 
                  onClick={() => simulatePurchase('30小时套餐', 1800)}
                  className="button button-primary"
                  disabled={!selectedUser}
                >
                  购买时长30小时 (1800分钟)
                </button>
              </div>

              <h3>订阅服务</h3>
              <div className="subscription-buttons">
                <button 
                  onClick={() => simulateSubscription('monthly')}
                  className="button button-success"
                  disabled={!selectedUser}
                >
                  月付订阅 (30小时/月)
                </button>
                <button 
                  onClick={() => simulateSubscription('yearly')}
                  className="button button-success"
                  disabled={!selectedUser}
                >
                  年付订阅 (360小时/年)
                </button>
              </div>
            </div>
          </div>

          {/* 场景模拟 */}
          <div className="admin-section">
            <h2>🎬 场景模拟</h2>
            <div className="scenario-controls">
              <div className="scenario-item">
                <h4>网络模拟</h4>
                <select 
                  value={simulationMode}
                  onChange={(e) => setSimulationMode(e.target.value as any)}
                  className="scenario-select"
                >
                  <option value="normal">正常网络</option>
                  <option value="slow-network">慢速网络</option>
                  <option value="quota-exceeded">配额超限</option>
                </select>
              </div>

              <div className="scenario-item">
                <h4>测试文件上传</h4>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="file-input"
                />
                {testFile && (
                  <div className="file-info">
                    已选择: {testFile.name} ({(testFile.size / 1024 / 1024).toFixed(2)}MB)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 音频转文字模拟 */}
          <div className="admin-section">
            <h2>🎵 音频转文字功能模拟</h2>
            
            <div className="audio-simulation">
              <h3>实时录音模拟</h3>
              <div className="recording-controls">
                <button 
                  className="button-primary"
                  onClick={() => simulateRecording(5)}
                >
                  模拟录音 5 分钟
                </button>
                <button 
                  className="button-primary"
                  onClick={() => simulateRecording(1)}
                >
                  模拟录音 1 分钟
                </button>
                <button 
                  className="button-primary"
                  onClick={() => simulateRecording(0.5)}
                >
                  模拟录音 30 秒
                </button>
              </div>

              <h3>文件上传模拟</h3>
              <div className="upload-controls">
                <button 
                  className="button-success"
                  onClick={() => simulateFileUpload('small')}
                >
                  模拟小文件 (2MB, 5分钟)
                </button>
                <button 
                  className="button-success"
                  onClick={() => simulateFileUpload('medium')}
                >
                  模拟中文件 (10MB, 20分钟)
                </button>
                <button 
                  className="button-success"
                  onClick={() => simulateFileUpload('large')}
                >
                  模拟大文件 (50MB, 60分钟)
                </button>
              </div>

              <h3>转录结果模拟</h3>
              <div className="transcription-controls">
                <button 
                  className="button-secondary"
                  onClick={() => simulateTranscription('success')}
                >
                  成功转录
                </button>
                <button 
                  className="button-secondary"
                  onClick={() => simulateTranscription('quota-exceeded')}
                >
                  配额超限
                </button>
                <button 
                  className="button-secondary"
                  onClick={() => simulateTranscription('permission-denied')}
                >
                  权限不足 (游客)
                </button>
                <button 
                  className="button-secondary"
                  onClick={() => simulateTranscription('poor-quality')}
                >
                  音质过差
                </button>
              </div>

              <h3>功能权限测试</h3>
              <div className="permission-controls">
                <button 
                  className="button-warning"
                  onClick={() => testFeatureAccess('copy-text')}
                >
                  测试复制文本权限
                </button>
                <button 
                  className="button-warning"
                  onClick={() => testFeatureAccess('export-word')}
                >
                  测试导出Word权限
                </button>
                <button 
                  className="button-warning"
                  onClick={() => testFeatureAccess('file-upload')}
                >
                  测试文件上传权限
                </button>
                <button 
                  className="button-warning"
                  onClick={() => testFeatureAccess('history-access')}
                >
                  测试历史记录权限
                </button>
              </div>
            </div>
          </div>

          {/* 快速导航 */}
          <div className="admin-section">
            <h2>🚀 快速导航</h2>
            <div className="quick-nav">
              <a href="/audio-to-text" className="nav-button">
                🎵 音频转文字
              </a>
              <a href="/usage" className="nav-button">
                📊 使用量统计
              </a>
              <a href="/pricing" className="nav-button">
                💰 价格页面
              </a>
            </div>
          </div>

          {/* 访客身份防滥用测试 */}
          <div className="admin-section">
            <h2>🛡️ 访客身份防滥用测试</h2>
            <GuestIdentityTest />
          </div>

          {/* 系统信息 */}
          <div className="admin-section">
            <h2>ℹ️ 系统信息</h2>
            <div className="system-info">
              <div className="info-item">
                <strong>模拟模式:</strong> {simulationMode}
              </div>
              <div className="info-item">
                <strong>本地存储:</strong> 
                <button 
                  onClick={() => {
                    localStorage.clear();
                    window.location.reload();
                  }}
                  className="button button-small button-warning"
                >
                  清除全部数据
                </button>
              </div>
              <div className="info-item">
                <strong>控制台日志:</strong> 请查看浏览器开发者工具
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;