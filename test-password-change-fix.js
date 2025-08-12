#!/usr/bin/env node

/**
 * 测试密码修改功能修复效果
 * 验证token认证问题是否已解决
 */

const API_BASE_URL = 'http://localhost:3001';

// 测试数据
const testTokens = {
  admin: 'admin_token',
  supabase: 'dummy_supabase_jwt_token', // 模拟Supabase JWT token
  invalid: 'invalid_token'
};

async function testPasswordChangeAPI(testName, token, testData) {
  console.log(`\n🧪 测试: ${testName}`);
  console.log(`📝 Token: ${token.substring(0, 20)}...`);
  console.log(`📝 数据: ${JSON.stringify(testData)}`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();

    console.log(`📊 状态: ${response.status}`);
    console.log(`📊 响应: ${JSON.stringify(result, null, 2)}`);

    if (response.ok) {
      console.log(`✅ ${testName} - 成功`);
    } else {
      console.log(`❌ ${testName} - 失败: ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ ${testName} - 网络错误:`, error.message);
  }
}

async function runTests() {
  console.log('🔧 密码修改功能修复验证测试');
  console.log('=====================================');

  // 测试1: 管理员用户密码修改
  await testPasswordChangeAPI(
    '管理员密码修改',
    testTokens.admin,
    {
      currentPassword: 'vhvspvtcphijptvx', // 正确的管理员密码
      newPassword: 'newpassword123'
    }
  );

  // 测试2: 管理员用户错误当前密码
  await testPasswordChangeAPI(
    '管理员错误密码',
    testTokens.admin,
    {
      currentPassword: 'wrongpassword',
      newPassword: 'newpassword123'
    }
  );

  // 测试3: 无效token
  await testPasswordChangeAPI(
    '无效token测试',
    testTokens.invalid,
    {
      currentPassword: 'anypassword',
      newPassword: 'newpassword123'
    }
  );

  // 测试4: 缺少认证头
  console.log(`\n🧪 测试: 缺少认证头`);
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currentPassword: 'anypassword',
        newPassword: 'newpassword123'
      })
    });

    const result = await response.json();
    console.log(`📊 状态: ${response.status}`);
    console.log(`📊 响应: ${JSON.stringify(result, null, 2)}`);

    if (response.status === 401 && result.error === '未授权访问') {
      console.log(`✅ 缺少认证头 - 正确拒绝`);
    } else {
      console.log(`❌ 缺少认证头 - 预期401错误`);
    }
  } catch (error) {
    console.log(`❌ 缺少认证头测试 - 网络错误:`, error.message);
  }

  // 测试5: 参数验证
  await testPasswordChangeAPI(
    '缺少新密码参数',
    testTokens.admin,
    {
      currentPassword: 'vhvspvtcphijptvx'
      // 缺少 newPassword
    }
  );

  await testPasswordChangeAPI(
    '新密码太短',
    testTokens.admin,
    {
      currentPassword: 'vhvspvtcphijptvx',
      newPassword: '123' // 少于6位
    }
  );

  console.log('\n🏁 测试完成');
  console.log('=====================================');
}

// 检查服务器是否运行
async function checkServer() {
  try {
    // 尝试连接API端点
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (response.ok) {
      console.log('✅ 服务器已运行');
      return true;
    }
  } catch (error) {
    try {
      // 尝试简单连接
      const response = await fetch(API_BASE_URL);
      console.log('✅ 服务器已运行 (状态码:', response.status, ')');
      return true;
    } catch (error2) {
      console.log('❌ 服务器未运行，请先启动服务器: npm run dev');
      return false;
    }
  }
}

// 主程序
async function main() {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runTests();
  }
}

main().catch(console.error);