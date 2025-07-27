import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 导入测试帮助器（开发环境）
import './utils/testHelper'

// 添加全局错误处理
window.addEventListener('error', (event) => {
  console.error('🚨 全局错误:', event.error);
  console.error('错误详情:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 未处理的Promise拒绝:', event.reason);
});

console.log('🚀 开始渲染React应用...');

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  
  console.log('✅ React应用渲染完成');
} catch (error) {
  console.error('❌ React应用渲染失败:', error);
  // 显示错误信息在页面上
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red; border: 2px solid red; margin: 20px;">
        <h2>渲染错误</h2>
        <p>React应用渲染失败: ${error instanceof Error ? error.message : String(error)}</p>
        <button onclick="window.location.reload()">刷新页面</button>
      </div>
    `;
  }
}
