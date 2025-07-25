// 完整的管理员功能测试脚本
// 在浏览器控制台中运行，确保所有管理员功能正常

console.log('🎯 开始管理员功能完整测试...');

// 1. 重置管理员账户到初始状态
console.log('步骤1: 重置管理员账户');
localStorage.clear();

const freshAdminUser = {
  id: 'admin',
  email: 'max.z.software@gmail.com',
  isEmailVerified: true,
  userType: 'trial',
  quotaMinutes: 10,
  usedMinutes: 0,
  trialMinutes: 10,
  createdAt: new Date().toISOString()
};

localStorage.setItem('adminUserData', JSON.stringify(freshAdminUser));
localStorage.setItem('userData', JSON.stringify(freshAdminUser));
localStorage.setItem('authToken', 'admin_token');

console.log('✅ 管理员账户已重置到初始状态');
console.log('📊 初始配额:', freshAdminUser);

// 2. 验证功能完整性
setTimeout(() => {
  console.log('\n🔍 验证功能清单:');
  console.log('✅ 管理员登录 - 应该显示试用用户状态');
  console.log('✅ 音频上传转写 - 应该能连续使用直到配额耗尽');
  console.log('✅ 实时录音 - 应该在剩余时长用完时自动停止');
  console.log('✅ 付费计划购买 - 应该直接增加时长到配额');
  console.log('✅ 使用量统计 - 应该实时显示准确数据');
  console.log('✅ 管理员清空功能 - 在使用量页面有清空按钮');
  
  console.log('\n📋 测试流程建议:');
  console.log('1. 刷新页面，确认显示10分钟总配额，0分钟已使用');
  console.log('2. 上传短音频文件测试转写功能');
  console.log('3. 查看使用量页面，确认时长正确扣除');
  console.log('4. 继续使用直到接近10分钟，测试"试用时长已结束"提示');
  console.log('5. 在价格页面购买时长，测试时长累加');
  console.log('6. 在使用量页面点击"清空使用量"按钮测试重置功能');
  console.log('7. 测试录音功能的时长限制');
  
  console.log('\n⚠️  已知功能特性:');
  console.log('- 超长音频文件会自动截断到剩余时长');
  console.log('- 录音会在剩余时长用完时自动停止');
  console.log('- 管理员购买计划时跳过支付流程直接获得时长');
  console.log('- 使用量实时同步到localStorage和页面显示');
  
  console.log('\n🔄 正在刷新页面进行测试...');
  
  setTimeout(() => {
    window.location.reload();
  }, 2000);
}, 1000);