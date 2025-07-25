// 调试当前管理员功能问题
console.log('🔍 开始调试管理员功能问题...');

// 1. 检查当前用户状态
const currentUserData = localStorage.getItem('userData');
const authToken = localStorage.getItem('authToken');

console.log('📊 当前用户数据:', currentUserData ? JSON.parse(currentUserData) : '无数据');
console.log('🔑 认证令牌:', authToken);

// 2. 测试 updateUserQuota 函数是否存在
if (window.React && window.React.version) {
  console.log('✅ React 环境正常');
} else {
  console.log('❌ React 环境异常');
}

// 3. 检查管理员状态
if (currentUserData) {
  const user = JSON.parse(currentUserData);
  const isAdmin = user.email === 'max.z.software@gmail.com';
  console.log('👤 是否为管理员:', isAdmin);
  console.log('⏱️ 当前配额:', user.quotaMinutes, '分钟');
  console.log('📈 已使用:', user.usedMinutes, '分钟');
  console.log('⚡ 剩余:', (user.quotaMinutes - user.usedMinutes), '分钟');
}

// 4. 模拟清空操作
console.log('\n🧪 测试清空功能...');
if (currentUserData) {
  const user = JSON.parse(currentUserData);
  const clearedUser = { ...user, usedMinutes: 0 };
  
  localStorage.setItem('userData', JSON.stringify(clearedUser));
  localStorage.setItem('adminUserData', JSON.stringify(clearedUser));
  
  console.log('✅ 本地清空完成，新数据:', clearedUser);
  console.log('🔄 请检查页面是否自动更新，如果没有请手动刷新');
} else {
  console.log('❌ 无用户数据，无法清空');
}

// 5. 检查关键函数是否存在
console.log('\n🔧 检查关键函数实现状态:');
console.log('- truncateAudioForLimit: 只标记截断，未实际处理音频 ❌');
console.log('- checkUsageLimit: 需要检查是否正确验证配额 🔍');
console.log('- updateUserQuota: AuthContext 函数，需要通过组件调用 ⚠️');
console.log('- recordUsage: 需要检查是否正确更新使用量 🔍');

console.log('\n📝 修复建议:');
console.log('1. 修复 truncateAudioForLimit 实际截断音频文件');
console.log('2. 修复清空按钮通过正确的 React 状态更新');
console.log('3. 确保配额检查函数正确工作');
console.log('4. 实现真正的录音时长限制');
console.log('5. 添加正确的配额耗尽提示');

// 6. 强制刷新以查看清空效果
setTimeout(() => {
  console.log('🔄 3秒后自动刷新页面查看清空效果...');
  setTimeout(() => {
    window.location.reload();
  }, 3000);
}, 1000);