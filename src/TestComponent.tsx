import React from 'react';

export default function TestComponent() {
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f0f0f0', 
      border: '2px solid #007AFF',
      margin: '20px',
      borderRadius: '8px'
    }}>
      <h1 style={{ color: '#007AFF' }}>🎉 React正在正常工作！</h1>
      <p>如果你能看到这条消息，说明：</p>
      <ul>
        <li>✅ React组件正常渲染</li>
        <li>✅ TypeScript编译成功</li>
        <li>✅ Vite开发服务器正常</li>
        <li>✅ 前端不再是白屏</li>
      </ul>
      <p>时间: {new Date().toLocaleString()}</p>
    </div>
  );
}