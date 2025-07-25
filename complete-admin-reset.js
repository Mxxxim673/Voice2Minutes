// 完整的管理员账户重置脚本
// 在浏览器控制台中运行此脚本以获得完全可用的管理员账户

console.log('🔄 开始完整重置管理员账户...');

// 1. 完全清除所有数据
localStorage.clear();

// 2. 设置全新的管理员用户数据
const freshAdminUser = {
  id: 'admin',
  email: 'max.z.software@gmail.com',
  isEmailVerified: true,
  userType: 'trial', // 试用状态
  quotaMinutes: 10, // 10分钟初始配额
  usedMinutes: 0, // 使用量从0开始
  trialMinutes: 10,
  createdAt: new Date().toISOString()
};

// 3. 设置必要的localStorage数据
localStorage.setItem('adminUserData', JSON.stringify(freshAdminUser));
localStorage.setItem('userData', JSON.stringify(freshAdminUser));
localStorage.setItem('authToken', 'admin_token');

// 4. 验证数据设置
const savedUserData = JSON.parse(localStorage.getItem('userData'));
const savedAdminData = JSON.parse(localStorage.getItem('adminUserData'));

console.log('✅ 管理员账户重置完成！');
console.log('📊 初始状态:', {
  email: savedUserData.email,
  userType: savedUserData.userType,
  totalMinutes: savedUserData.quotaMinutes,
  usedMinutes: savedUserData.usedMinutes,
  remainingMinutes: savedUserData.quotaMinutes - savedUserData.usedMinutes
});

console.log('🎯 管理员功能现在应该完全可用:');
console.log('  ✅ 音频转文字功能');
console.log('  ✅ 实时录音功能');
console.log('  ✅ 付费计划购买');
console.log('  ✅ 使用量统计');

console.log('🔄 正在刷新页面...');

// 5. 刷新页面
setTimeout(() => {
  window.location.reload();
}, 1000);