import React from 'react';
import { useTranslation } from 'react-i18next';

const MeetingMinutesSimple: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2.5rem', color: '#007bff' }}>
        {t('meetingMinutes.title')}
      </h1>
      <p>这是一个简化的会议纪要页面测试组件</p>
      <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h2>调试信息</h2>
        <p>如果您能看到这个页面，说明：</p>
        <ul style={{ textAlign: 'left', display: 'inline-block' }}>
          <li>✅ React路由配置正确</li>
          <li>✅ 组件导入正确</li>
          <li>✅ 多语言配置工作正常</li>
          <li>✅ 页面可以正常渲染</li>
        </ul>
      </div>
    </div>
  );
};

export default MeetingMinutesSimple;