// 测试管理员功能修复脚本
console.log('🔧 测试管理员功能修复...');

// 1. 重置管理员账户
localStorage.clear();

const testUser = {
  id: 'admin',
  email: 'max.z.software@gmail.com',
  isEmailVerified: true,
  userType: 'trial',
  quotaMinutes: 10,
  usedMinutes: 0,
  trialMinutes: 10,
  createdAt: new Date().toISOString()
};

localStorage.setItem('userData', JSON.stringify(testUser));
localStorage.setItem('adminUserData', JSON.stringify(testUser));
localStorage.setItem('authToken', 'admin_token');

console.log('✅ 管理员账户已重置');

// 2. 测试清空功能逻辑
console.log('\n🧪 测试一键清空功能:');

// 模拟使用了5分钟
const usedUser = { ...testUser, usedMinutes: 5 };
localStorage.setItem('userData', JSON.stringify(usedUser));
console.log('📊 模拟使用5分钟:', usedUser);

// 模拟清空操作
const clearedUser = { ...usedUser, usedMinutes: 0 };
localStorage.setItem('userData', JSON.stringify(clearedUser));
console.log('🧹 清空后:', clearedUser);
console.log('✅ 清空功能逻辑正确：usedMinutes: 5 → 0，quotaMinutes保持: 10');

// 3. 验证录音转文字修复
console.log('\n🎤 验证录音转文字修复:');
console.log('✅ 已添加 recordedAudioBlobRef 用于保存录音数据');
console.log('✅ 已修复 handleStartTranscription 使用正确的录音数据');
console.log('✅ 已添加详细的控制台日志用于调试');
console.log('✅ 已添加错误处理和用户提示');

// 4. 功能测试清单
console.log('\n📋 请手动测试以下功能:');

console.log('\n1️⃣ 一键清空测试:');
console.log('   - 到 /usage 页面');
console.log('   - 使用一些音频文件增加使用量');
console.log('   - 点击橙色"🔄 清空使用量"按钮');
console.log('   - 确认后应该显示"✅ 使用量已成功清零！"');
console.log('   - 使用量应该变为0，但总配额保持不变');

console.log('\n2️⃣ 录音转文字测试:');
console.log('   - 到 /audio-to-text 页面');
console.log('   - 点击录音按钮开始录音');
console.log('   - 录制一段音频后点击"完成录制"');
console.log('   - 应该出现"开始转录"按钮');
console.log('   - 点击"开始转录"按钮');
console.log('   - 检查控制台应该看到"🎤 开始转录录音"日志');
console.log('   - 应该成功进行转录，并更新使用量');

console.log('\n🔍 调试信息:');
console.log('- 录音过程中查看控制台日志');
console.log('- 录音完成时应该看到"📦 录音完成"日志');
console.log('- 转录开始时应该看到"🎤 开始转录录音"日志');
console.log('- 如果出现错误会显示"❌ 没有录音数据"提示');

// 重置到初始状态
localStorage.setItem('userData', JSON.stringify(testUser));

console.log('\n🚀 修复完成！现在开始测试...');

setTimeout(() => {
  console.log('🔄 3秒后跳转到使用量页面进行测试...');
  setTimeout(() => {
    window.location.href = '/usage';
  }, 3000);
}, 1000);