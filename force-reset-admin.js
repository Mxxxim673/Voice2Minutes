// 强制重置管理员 localStorage 数据
console.log('🔄 强制清理所有管理员相关数据...');

// 完全清除所有数据
localStorage.clear();

// 设置全新的管理员初始数据
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

// 设置数据
localStorage.setItem('adminUserData', JSON.stringify(freshAdminUser));
localStorage.setItem('userData', JSON.stringify(freshAdminUser));
localStorage.setItem('authToken', 'admin_token');

console.log('✅ 管理员数据已完全重置');
console.log('📊 配额数据:', freshAdminUser);
console.log('🔄 请刷新页面...');

// 提示用户刷新
alert('管理员数据已重置，请手动刷新页面 (F5)');

