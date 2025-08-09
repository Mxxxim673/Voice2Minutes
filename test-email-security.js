#!/usr/bin/env node

/**
 * 邮箱验证安全测试脚本
 * 测试修复后的邮箱验证系统是否正确工作
 */

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Supabase 配置
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 管理客户端（service role权限）
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 普通客户端（匿名权限）
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 测试邮箱
const TEST_EMAIL = 'test.email.security@example.com';
const TEST_PASSWORD = 'TestPassword123';

console.log(`
🔐 邮箱验证安全测试开始
==============================
测试邮箱: ${TEST_EMAIL}
`);

// 测试1: 清理现有测试数据
async function cleanupTestData() {
  console.log('🧹 清理现有测试数据...');
  
  try {
    // 获取所有用户列表
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      console.error('获取用户列表失败:', error);
      return false;
    }
    
    // 查找测试邮箱用户
    const testUser = users.users.find(u => u.email === TEST_EMAIL);
    
    if (testUser) {
      // 删除测试用户
      await supabaseAdmin.auth.admin.deleteUser(testUser.id);
      console.log('✅ 已删除现有测试用户');
    } else {
      console.log('✅ 没有找到现有测试用户');
    }
    
    return true;
  } catch (error) {
    console.error('清理测试数据失败:', error);
    return false;
  }
}

// 测试2: 注册新用户
async function testRegistration() {
  console.log('\n📝 测试用户注册...');
  
  try {
    const response = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        language: 'zh'
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ 用户注册成功');
      console.log('📧 等待验证邮件发送...');
      return result.user;
    } else {
      console.error('❌ 用户注册失败:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ 注册请求失败:', error);
    return null;
  }
}

// 测试3: 重复注册已验证用户
async function testDuplicateRegistration() {
  console.log('\n🔁 测试重复注册已验证用户...');
  
  // 首先手动验证用户邮箱
  try {
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const testUser = users.users.find(u => u.email === TEST_EMAIL);
    
    if (testUser) {
      await supabaseAdmin.auth.admin.updateUserById(testUser.id, {
        email_confirm: true
      });
      console.log('✅ 手动验证测试用户邮箱');
    }
    
    // 尝试重新注册
    const response = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        language: 'zh'
      })
    });
    
    const result = await response.json();
    
    if (response.status === 400 && result.code === 'EMAIL_ALREADY_REGISTERED') {
      console.log('✅ 正确阻止了已注册用户重复注册');
      return true;
    } else {
      console.error('❌ 未能阻止重复注册:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ 重复注册测试失败:', error);
    return false;
  }
}

// 测试4: 未验证用户尝试登录
async function testUnverifiedLogin() {
  console.log('\n🚫 测试未验证用户尝试登录...');
  
  // 重新创建未验证用户
  await cleanupTestData();
  await testRegistration();
  
  try {
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      })
    });
    
    const result = await response.json();
    
    if (response.status === 401 && result.code === 'EMAIL_NOT_VERIFIED') {
      console.log('✅ 正确阻止了未验证用户登录');
      return true;
    } else {
      console.error('❌ 未能阻止未验证用户登录:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ 未验证登录测试失败:', error);
    return false;
  }
}

// 测试5: 验证用户成功登录
async function testVerifiedLogin() {
  console.log('\n✅ 测试已验证用户登录...');
  
  try {
    // 手动验证用户邮箱
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const testUser = users.users.find(u => u.email === TEST_EMAIL);
    
    if (testUser) {
      await supabaseAdmin.auth.admin.updateUserById(testUser.id, {
        email_confirm: true
      });
      console.log('✅ 手动验证测试用户邮箱');
    }
    
    // 尝试登录
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.user) {
      console.log('✅ 已验证用户成功登录');
      return true;
    } else {
      console.error('❌ 已验证用户登录失败:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ 验证用户登录测试失败:', error);
    return false;
  }
}

// 测试6: SMTP连接和邮件模板
async function testEmailTemplate() {
  console.log('\n📧 测试邮件模板和SMTP连接...');
  
  try {
    // 测试SMTP连接
    const smtpResponse = await fetch('http://localhost:3001/api/email/test-connection');
    const smtpResult = await smtpResponse.json();
    
    if (smtpResult.success) {
      console.log('✅ SMTP连接测试成功');
    } else {
      console.error('❌ SMTP连接失败:', smtpResult.error);
      return false;
    }
    
    // 测试发送验证邮件
    const emailResponse = await fetch('http://localhost:3001/api/email/send-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: TEST_EMAIL,
        subject: '测试邮件 - 验证码',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4a90e2;">Voice2Minutes - 邮箱验证</h2>
            <p>这是一封测试邮件，验证邮件模板是否正确显示。</p>
            <div style="background: #f1f5f9; border: 2px dashed #4a90e2; padding: 20px; text-align: center;">
              <h1 style="color: #4a90e2; font-size: 36px;">123456</h1>
            </div>
            <p>如果您看到这封邮件正确的HTML格式，说明邮件模板修复成功。</p>
          </div>
        `,
        text: '测试邮件 - 验证码: 123456',
        fromEmail: process.env.SMTP_USER,
        fromName: 'Voice2Minutes Test'
      })
    });
    
    const emailResult = await emailResponse.json();
    
    if (emailResult.success) {
      console.log('✅ 验证邮件发送成功');
      console.log('📧 邮件ID:', emailResult.messageId);
      return true;
    } else {
      console.error('❌ 验证邮件发送失败:', emailResult.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 邮件模板测试失败:', error);
    return false;
  }
}

// 主测试函数
async function runAllTests() {
  const results = {
    cleanup: false,
    registration: false,
    duplicateRegistration: false,
    unverifiedLogin: false,
    verifiedLogin: false,
    emailTemplate: false
  };
  
  console.log('开始运行所有测试...\n');
  
  // 检查服务器是否运行
  try {
    const healthResponse = await fetch('http://localhost:3001/api/health');
    if (!healthResponse.ok) {
      throw new Error('服务器健康检查失败');
    }
    console.log('✅ 服务器运行正常\n');
  } catch (error) {
    console.error('❌ 无法连接到服务器，请确保服务器在端口3001运行');
    console.error('启动命令: npm run server 或 node server.js');
    return;
  }
  
  // 运行测试
  results.cleanup = await cleanupTestData();
  results.registration = await testRegistration();
  results.duplicateRegistration = await testDuplicateRegistration();
  results.unverifiedLogin = await testUnverifiedLogin();
  results.verifiedLogin = await testVerifiedLogin();
  results.emailTemplate = await testEmailTemplate();
  
  // 最终清理
  await cleanupTestData();
  
  // 输出测试结果
  console.log('\n' + '='.repeat(50));
  console.log('📊 邮箱验证安全测试结果');
  console.log('='.repeat(50));
  
  Object.entries(results).forEach(([test, result]) => {
    const status = result ? '✅ 通过' : '❌ 失败';
    const testName = {
      cleanup: '数据清理',
      registration: '用户注册',
      duplicateRegistration: '重复注册阻止',
      unverifiedLogin: '未验证登录阻止',
      verifiedLogin: '已验证用户登录',
      emailTemplate: '邮件模板和SMTP'
    }[test];
    
    console.log(`${status} ${testName}`);
  });
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log('\n' + '='.repeat(50));
  console.log(`总体结果: ${passedTests}/${totalTests} 测试通过`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有测试通过！邮箱验证系统安全性修复成功！');
  } else {
    console.log('⚠️ 部分测试失败，请检查失败的测试项目');
  }
  console.log('='.repeat(50));
}

// 运行测试
runAllTests().catch(console.error);