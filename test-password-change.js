// 密码修改功能测试脚本
const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';

async function testPasswordChange() {
  console.log('🧪 开始测试密码修改功能...');
  
  // 这里需要一个有效的用户token来测试
  // 在实际测试时，你需要替换为真实的token
  const testToken = 'your-test-token-here';
  
  const testData = {
    currentPassword: 'oldpassword123',
    newPassword: 'newpassword123'
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    
    console.log('响应状态:', response.status);
    console.log('响应数据:', result);
    
    if (response.ok && result.success) {
      console.log('✅ 密码修改测试成功');
    } else {
      console.log('❌ 密码修改测试失败:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
if (require.main === module) {
  console.log('⚠️  注意：运行此测试需要：');
  console.log('1. 服务器在 localhost:3001 运行');
  console.log('2. 替换 testToken 为有效的用户token');
  console.log('3. 确保测试用户存在并且当前密码正确');
  console.log('');
  
  // testPasswordChange();
  console.log('请根据实际情况修改代码并取消注释上一行来运行测试');
}

module.exports = { testPasswordChange };