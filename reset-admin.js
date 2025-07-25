// 重置管理员账户到初始状态的脚本
// 在浏览器控制台中运行这个脚本来重置管理员账户

console.log('🔄 正在将管理员账户重置为初始状态...');

// 创建全新的管理员初始数据
const freshAdminUser = {
  id: 'admin',
  email: 'max.z.software@gmail.com',
  isEmailVerified: true,
  userType: 'trial', // 试用状态
  quotaMinutes: 10, // 10分钟试用配额
  usedMinutes: 0, // 使用量从0开始
  trialMinutes: 10,
  createdAt: new Date().toISOString()
};

// 清除所有相关数据并设置为初始状态
localStorage.removeItem('adminUserData');
localStorage.removeItem('userData'); 
localStorage.removeItem('authToken');
localStorage.removeItem('guestMode');
localStorage.removeItem('guestUsedMinutes');

// 设置全新的管理员数据
localStorage.setItem('adminUserData', JSON.stringify(freshAdminUser));
localStorage.setItem('userData', JSON.stringify(freshAdminUser));
localStorage.setItem('authToken', 'admin_token');

console.log('✅ 管理员账户已重置为初始状态');
console.log('📊 初始配额：10分钟');
console.log('⏱️ 已使用：0分钟');
console.log('🔄 正在刷新页面...');

// 刷新页面
window.location.reload();