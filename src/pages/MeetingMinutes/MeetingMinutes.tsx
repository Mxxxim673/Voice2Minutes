import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { exportToWord } from '../../utils/exportUtils';
import './MeetingMinutes.css';

interface CustomTemplate {
  id: string;
  name: string;
  outline: string[];
  createdAt: string;
  itemCount: number;
}

interface MeetingSummary {
  id: string;
  summary: string;
  templateType: 'standard' | 'custom';
  outline: string[];
  createdAt: string;
}

const MeetingMinutes: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { isGuest } = useAuth();
  
  // 状态管理
  const [originalText, setOriginalText] = useState<string>('');
  const [templateType, setTemplateType] = useState<'standard' | 'custom'>('standard');
  const [customOutline, setCustomOutline] = useState<string[]>([]);
  const [tempCustomOutline, setTempCustomOutline] = useState<string[]>([]);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState<string>('');
  const [isEditingTemplate, setIsEditingTemplate] = useState<string | null>(null);
  const [isEditingOutline, setIsEditingOutline] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [summaryGenerated, setSummaryGenerated] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editableSummary, setEditableSummary] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showNoTextModal, setShowNoTextModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  // 获取当前语言的标准提纲
  const getCurrentLanguageOutline = (): string[] => {
    return [
      t('meetingMinutes.standardOutline.meetingTopic'),
      t('meetingMinutes.standardOutline.date'),
      t('meetingMinutes.standardOutline.participants'),
      t('meetingMinutes.standardOutline.agendaItems'),
      t('meetingMinutes.standardOutline.decisionsMade'),
      t('meetingMinutes.standardOutline.todoAndSchedule')
    ];
  };

  // 监听点击事件，处理编辑状态
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // 如果正在编辑且点击的不是编辑区域内的元素
      if (isEditingOutline || isCreatingTemplate || isEditingTemplate) {
        const target = event.target as Element;
        const editorElement = document.querySelector('.template-editor');
        const editButton = document.querySelector('[data-edit-outline]');
        
        if (editorElement && !editorElement.contains(target) && 
            editButton && !editButton.contains(target)) {
          // 取消编辑时恢复到之前保存的状态
          if (isCreatingTemplate || isEditingTemplate) {
            handleCancelTemplate();
          } else {
            setTempCustomOutline([...customOutline]);
            setIsEditingOutline(false);
          }
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditingOutline, isCreatingTemplate, isEditingTemplate, customOutline]);

  // 监听语言变化，更新标准提纲
  useEffect(() => {
    let lastLanguage = localStorage.getItem('i18nextLng') || 'zh';
    
    const handleLanguageChange = () => {
      if (templateType === 'standard') {
        const newOutline = getCurrentLanguageOutline();
        console.log('语言变化，更新提纲:', {
          当前语言: localStorage.getItem('i18nextLng'),
          新提纲: newOutline
        });
        setCustomOutline(newOutline);
        setTempCustomOutline(newOutline);
      }
    };

    // 监听i18next语言变化事件
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'i18nextLng') {
        setTimeout(handleLanguageChange, 100); // 稍微延迟以确保i18next更新完成
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // 更频繁的检查语言变化
    const checkLanguageChange = setInterval(() => {
      const currentLang = localStorage.getItem('i18nextLng') || 'zh';
      if (currentLang !== lastLanguage && templateType === 'standard') {
        console.log('检测到语言变化:', { 上次: lastLanguage, 当前: currentLang });
        lastLanguage = currentLang;
        handleLanguageChange();
      }
    }, 500); // 更频繁的检查

    // 监听i18next的语言变化事件
    const handleI18nLanguageChange = () => {
      if (templateType === 'standard') {
        setTimeout(() => {
          const newOutline = getCurrentLanguageOutline();
          console.log('i18n语言变化事件，更新提纲:', {
            当前语言: i18n.language,
            新提纲: newOutline
          });
          setCustomOutline(newOutline);
          setTempCustomOutline(newOutline);
        }, 100);
      }
    };
    
    i18n.on('languageChanged', handleI18nLanguageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkLanguageChange);
      i18n.off('languageChanged', handleI18nLanguageChange);
    };
  }, [templateType, i18n]);

  // 加载自定义模板
  const loadCustomTemplates = () => {
    try {
      const savedTemplates = localStorage.getItem('customTemplates');
      if (savedTemplates) {
        const templates = JSON.parse(savedTemplates);
        setCustomTemplates(templates);
      }
    } catch (error) {
      console.error('Error loading custom templates:', error);
    }
  };

  // 保存自定义模板
  const saveCustomTemplates = (templates: CustomTemplate[]) => {
    try {
      localStorage.setItem('customTemplates', JSON.stringify(templates));
      setCustomTemplates(templates);
    } catch (error) {
      console.error('Error saving custom templates:', error);
    }
  };

  // 页面加载时获取转录结果
  useEffect(() => {
    const storedTranscription = localStorage.getItem('transcriptionResult');
    if (storedTranscription) {
      setOriginalText(storedTranscription);
      
      // 检查是否已生成过纪要
      const transcriptId = localStorage.getItem('currentTranscriptId');
      const summaryFlag = localStorage.getItem(`summaryGenerated_${transcriptId}`);
      if (summaryFlag === 'true') {
        setSummaryGenerated(true);
        // 尝试加载已保存的纪要
        const savedSummary = localStorage.getItem(`meetingSummary_${transcriptId}`);
        if (savedSummary) {
          try {
            setSummary(JSON.parse(savedSummary));
          } catch (error) {
            console.error('Error parsing saved summary:', error);
          }
        }
      }
    }
    
    // 加载自定义模板
    loadCustomTemplates();
    
    // 延迟初始化提纲，确保i18next已加载
    const initializeOutline = () => {
      // 只有在标准模板模式下才初始化标准提纲
      if (templateType === 'standard') {
        const defaultOutline = getCurrentLanguageOutline();
        console.log('初始化提纲:', {
          当前语言: localStorage.getItem('i18nextLng'),
          提纲: defaultOutline
        });
        setCustomOutline(defaultOutline);
        setTempCustomOutline(defaultOutline);
      }
    };
    
    // 立即初始化一次
    initializeOutline();
    
    // 也在稍后再初始化一次，以防i18next没有加载完成
    const timer = setTimeout(initializeOutline, 500);
    
    return () => clearTimeout(timer);
  }, [templateType]);

  // 检查是否有原文的函数（只在生成纪要时检查）
  const checkOriginalText = (): boolean => {
    if (!originalText.trim()) {
      setShowNoTextModal(true);
      return false;
    }
    return true;
  };

  // 检测原文主要语言
  const detectLanguage = (text: string): string => {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const japaneseChars = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
    const totalChars = text.length;
    
    if (chineseChars / totalChars > 0.3) return 'zh';
    if (japaneseChars / totalChars > 0.1) return 'ja';
    return 'en';
  };

  // 生成会议纪要
  const handleGenerateSummary = async () => {
    if (!checkOriginalText()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const currentOutline = templateType === 'standard' ? getCurrentLanguageOutline() : customOutline;
      const detectedLang = detectLanguage(originalText);
      
      // 使用检测到的原文语言作为输出语言，确保输出与原文语言一致
      const targetLanguage = detectedLang;
      
      const response = await fetch('/api/minutes/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          transcript_id: localStorage.getItem('currentTranscriptId') || Date.now().toString(),
          template_type: templateType,
          outline: currentOutline,
          original_text: originalText,
          detected_language: detectedLang,
          target_language: targetLanguage
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate meeting minutes');
      }

      const result = await response.json();
      const newSummary: MeetingSummary = {
        id: result.summary_id,
        summary: result.summary,
        templateType,
        outline: currentOutline,
        createdAt: new Date().toISOString()
      };

      setSummary(newSummary);
      setSummaryGenerated(true);
      setEditableSummary(result.summary);

      // 保存到本地存储
      const transcriptId = localStorage.getItem('currentTranscriptId') || Date.now().toString();
      localStorage.setItem(`summaryGenerated_${transcriptId}`, 'true');
      localStorage.setItem(`meetingSummary_${transcriptId}`, JSON.stringify(newSummary));

    } catch (error) {
      console.error('Error generating summary:', error);
      setError(t('meetingMinutes.generateError'));
    } finally {
      setIsGenerating(false);
    }
  };

  // 保存自定义提纲(兼容旧版本)
  const handleSaveCustomOutline = () => {
    if (isCreatingTemplate || isEditingTemplate) {
      // 新版本：保存模板
      handleSaveTemplate();
    } else {
      // 旧版本：直接保存提纲
      setCustomOutline(tempCustomOutline);
      const transcriptId = localStorage.getItem('currentTranscriptId') || 'default';
      localStorage.setItem(`customOutline_${transcriptId}`, JSON.stringify(tempCustomOutline));
      setIsEditingOutline(false);
    }
  };

  // 添加提纲项
  const addOutlineItem = () => {
    setTempCustomOutline([...tempCustomOutline, '']);
  };

  // 删除提纲项
  const removeOutlineItem = (index: number) => {
    const newOutline = tempCustomOutline.filter((_, i) => i !== index);
    setTempCustomOutline(newOutline);
  };

  // 更新提纲项
  const updateOutlineItem = (index: number, value: string) => {
    const newOutline = [...tempCustomOutline];
    newOutline[index] = value;
    setTempCustomOutline(newOutline);
  };

  // 复制纪要文本
  const handleCopyText = () => {
    if (summary) {
      navigator.clipboard.writeText(isEditingSummary ? editableSummary : summary.summary);
    }
  };

  // 导出为Word
  const handleExportToWord = () => {
    if (summary) {
      const content = isEditingSummary ? editableSummary : summary.summary;
      exportToWord(content, 'meeting-minutes');
    }
  };

  // 编辑文本
  const handleEditText = () => {
    setIsEditingSummary(true);
    setEditableSummary(summary?.summary || '');
  };

  // 保存编辑的纪要
  const handleSaveEditedSummary = () => {
    if (summary) {
      const updatedSummary = { ...summary, summary: editableSummary };
      setSummary(updatedSummary);
      setIsEditingSummary(false);
      
      // 更新本地存储
      const transcriptId = localStorage.getItem('currentTranscriptId');
      if (transcriptId) {
        localStorage.setItem(`meetingSummary_${transcriptId}`, JSON.stringify(updatedSummary));
      }
    }
  };

  // 模板选择
  const handleTemplateChange = (type: 'standard' | 'custom') => {
    // 如果正在编辑自定义提纲，先取消编辑状态
    if (isEditingOutline || isCreatingTemplate || isEditingTemplate) {
      if (isCreatingTemplate || isEditingTemplate) {
        handleCancelTemplate();
      } else {
        handleCancelEditOutline();
      }
    }
    setTemplateType(type);
    
    // 如果切换到标准模板，立即更新提纲
    if (type === 'standard') {
      const newOutline = getCurrentLanguageOutline();
      console.log('切换到标准模板，更新提纲:', {
        当前语言: localStorage.getItem('i18nextLng'),
        新提纲: newOutline
      });
      setCustomOutline(newOutline);
      setTempCustomOutline(newOutline);
      setSelectedTemplateId(null); // 清空选中的自定义模板
    } else {
      // 切换到自定义模板时，如果没有选中模板，清空outline
      if (!selectedTemplateId) {
        setCustomOutline([]);
        setTempCustomOutline([]);
      }
    }
  };

  // 选择模板
  const handleSelectTemplate = (template: CustomTemplate) => {
    setSelectedTemplateId(template.id);
    setCustomOutline(template.outline);
    setTempCustomOutline(template.outline);
  };

  // 开始创建模板
  const handleCreateTemplate = () => {
    setIsCreatingTemplate(true);
    setTemplateName('');
    // 使用当前语言环境的标准提纲作为初始模板
    const defaultOutline = getCurrentLanguageOutline();
    setTempCustomOutline(defaultOutline);
    setIsEditingOutline(true);
  };

  // 编辑模板
  const handleEditTemplate = (templateId: string) => {
    const template = customTemplates.find(t => t.id === templateId);
    if (template) {
      setIsEditingTemplate(templateId);
      setTemplateName(template.name);
      setTempCustomOutline([...template.outline]);
      setIsEditingOutline(true);
    }
  };

  // 保存模板
  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      alert(t('meetingMinutes.pleaseEnterTemplateName'));
      return;
    }

    const newTemplate: CustomTemplate = {
      id: isEditingTemplate || Date.now().toString(),
      name: templateName.trim(),
      outline: [...tempCustomOutline],
      createdAt: new Date().toISOString(),
      itemCount: tempCustomOutline.length
    };

    let updatedTemplates;
    if (isEditingTemplate) {
      updatedTemplates = customTemplates.map(t => 
        t.id === isEditingTemplate ? newTemplate : t
      );
    } else {
      updatedTemplates = [...customTemplates, newTemplate];
    }

    saveCustomTemplates(updatedTemplates);
    setSelectedTemplateId(newTemplate.id);
    setCustomOutline(newTemplate.outline);
    
    // 重置状态
    setIsCreatingTemplate(false);
    setIsEditingTemplate(null);
    setIsEditingOutline(false);
    setTemplateName('');
  };

  // 取消模板编辑
  const handleCancelTemplate = () => {
    setIsCreatingTemplate(false);
    setIsEditingTemplate(null);
    setIsEditingOutline(false);
    setTemplateName('');
    setTempCustomOutline([...customOutline]);
  };

  // 删除模板
  const handleDeleteTemplate = (templateId: string) => {
    if (confirm(t('meetingMinutes.confirmDeleteTemplate'))) {
      const updatedTemplates = customTemplates.filter(t => t.id !== templateId);
      saveCustomTemplates(updatedTemplates);
      
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
        const defaultOutline = getCurrentLanguageOutline();
        setCustomOutline(defaultOutline);
        setTempCustomOutline(defaultOutline);
      }
    }
  };

  // 编辑提纲(保留兼容)
  const handleEditOutline = () => {
    setTempCustomOutline([...customOutline]);
    setIsEditingOutline(true);
  };

  // 取消编辑提纲
  const handleCancelEditOutline = () => {
    setTempCustomOutline([...customOutline]);
    setIsEditingOutline(false);
  };

  // 关闭提醒弹窗并跳转到音频转文字页面
  const handleGoToAudioToText = () => {
    setShowNoTextModal(false);
    window.location.href = '/audio-to-text';
  };

  // 清空当前记录
  const handleClearCurrentRecord = () => {
    setShowClearConfirmModal(true);
  };

  // 确认清空记录
  const confirmClearRecord = () => {
    try {
      const transcriptId = localStorage.getItem('currentTranscriptId') || 'default';
      
      // 清空本地存储的相关数据
      localStorage.removeItem('transcriptionResult');
      localStorage.removeItem('currentTranscriptId');
      localStorage.removeItem(`summaryGenerated_${transcriptId}`);
      localStorage.removeItem(`meetingSummary_${transcriptId}`);
      localStorage.removeItem(`customOutline_${transcriptId}`);
      
      // 重置所有相关状态
      setOriginalText('');
      setSummary(null);
      setSummaryGenerated(false);
      setIsEditingSummary(false);
      setEditableSummary('');
      setError(null);
      
      // 重置提纲到默认状态
      const defaultOutline = getCurrentLanguageOutline();
      setCustomOutline(defaultOutline);
      setTempCustomOutline(defaultOutline);
      
      console.log('✅ 当前记录已清空');
    } catch (error) {
      console.error('清空记录时发生错误:', error);
      setError(t('meetingMinutes.clearError') || '清空记录失败');
    } finally {
      setShowClearConfirmModal(false);
    }
  };

  // 取消清空操作
  const cancelClearRecord = () => {
    setShowClearConfirmModal(false);
  };

  return (
    <div className="meeting-minutes-page">
      <div className="container">
        {/* 页面头部 */}
        <div className="page-header">
          <h1 className="page-title">{t('meetingMinutes.title')}</h1>
          {originalText && (
            <div className="source-status">
              <div className="status-indicator">
                <span className="status-dot active"></span>
                {t('meetingMinutes.sourceReady')}
              </div>
            </div>
          )}
        </div>

        {/* 主要内容区 */}
        <div className="content-grid">
          {/* 左侧区域 */}
          <div className="left-section">
            {/* 左上角：原文显示区域 */}
            <div className="section-card original-text-section">
              <div className="card-header">
                <h2 className="card-title">{t('meetingMinutes.originalText')}</h2>
                <div className="header-actions">
                  {originalText && (
                    <div className="text-stats">
                      <span className="char-count">
                        {originalText.length} {t('meetingMinutes.characters')}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={handleGenerateSummary}
                    className={`btn btn-primary ${isGenerating ? 'loading' : ''}`}
                    disabled={isGenerating || isEditingOutline}
                  >
                    {isGenerating ? (
                      <>
                        <span className="spinner"></span>
                        {t('meetingMinutes.generating')}
                      </>
                    ) : (
                      <>
                        {t('meetingMinutes.startGeneration')}
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="original-text-content">
                {originalText ? (
                  <div className="text-display">
                    <pre className="original-text">{originalText}</pre>
                  </div>
                ) : (
                  <div className="empty-original-text">
                    <div className="empty-icon">📄</div>
                    <h3>{t('meetingMinutes.noOriginalText')}</h3>
                    <p>{t('meetingMinutes.originalTextHint')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 左下角：模板配置区域 */}
            <div className="section-card template-config-section">
              <div className="card-header">
                <h2 className="card-title">{t('meetingMinutes.templateConfiguration')}</h2>
              </div>
              
              {/* 模板选择 */}
              <div className="template-selector">
                <div className="selector-group">
                  <div 
                    className={`template-card ${templateType === 'standard' ? 'active' : ''}`}
                    onClick={() => handleTemplateChange('standard')}
                  >
                    <div className="template-icon">📋</div>
                    <div className="template-info">
                      <h3>{t('meetingMinutes.standardTemplate')}</h3>
                      <p>{t('meetingMinutes.standardTemplateDesc')}</p>
                    </div>
                  </div>
                  
                  <div 
                    className={`template-card ${templateType === 'custom' ? 'active' : ''}`}
                    onClick={() => handleTemplateChange('custom')}
                  >
                    <div className="template-icon">⚙️</div>
                    <div className="template-info">
                      <h3>{t('meetingMinutes.customTemplate')}</h3>
                      <p>{t('meetingMinutes.customTemplateDesc')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 提纲预览/编辑 */}
              <div className="outline-section">
                
                {templateType === 'standard' ? (
                  <div className="outline-preview">
                    {getCurrentLanguageOutline().map((item, index) => (
                      <div key={index} className="outline-item">
                        <span className="item-number">{index + 1}</span>
                        <span className="item-text">{item}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="custom-outline">
                    {(isCreatingTemplate || isEditingTemplate || isEditingOutline) ? (
                      <div className="template-editor">
                        {(isCreatingTemplate || isEditingTemplate) && (
                          <div className="template-name-section">
                            <label className="template-name-label">{t('meetingMinutes.templateName')}</label>
                            <input
                              type="text"
                              value={templateName}
                              onChange={(e) => setTemplateName(e.target.value)}
                              placeholder={t('meetingMinutes.templateNamePlaceholder')}
                              className="template-name-input"
                            />
                          </div>
                        )}
                        <div className="outline-editor">
                        {tempCustomOutline.map((item, index) => (
                          <div key={index} className="editor-item">
                            <span className="item-number">{index + 1}</span>
                            <input
                              type="text"
                              value={item}
                              onChange={(e) => updateOutlineItem(index, e.target.value)}
                              placeholder={t('meetingMinutes.outlineItemPlaceholder')}
                              className="outline-input"
                            />
                            <button 
                              onClick={() => removeOutlineItem(index)}
                              className="btn btn-remove btn-icon"
                              disabled={tempCustomOutline.length <= 1}
                              title={t('meetingMinutes.deleteItem')}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                            </button>
                          </div>
                        ))}
                        
                        </div>
                        <div className="editor-actions">
                          <button 
                            onClick={addOutlineItem}
                            className="btn btn-outline"
                          >
                            {t('meetingMinutes.addOutlineItem')}
                          </button>
                          <button 
                            onClick={handleSaveCustomOutline}
                            className="btn btn-primary"
                          >
                            {isCreatingTemplate || isEditingTemplate ? t('meetingMinutes.saveTemplate') : t('common.save')}
                          </button>
                          <button 
                            onClick={isCreatingTemplate || isEditingTemplate ? handleCancelTemplate : handleCancelEditOutline}
                            className="btn btn-outline"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="template-list-section">
                        <div className="template-list-header">
                          <button 
                            onClick={handleCreateTemplate}
                            className="btn btn-primary btn-sm"
                          >
                            {t('meetingMinutes.addTemplate')}
                          </button>
                        </div>
                        
                        {customTemplates.length > 0 ? (
                          <div className="template-list">
                            {customTemplates.map((template) => (
                              <div 
                                key={template.id} 
                                className={`template-item ${selectedTemplateId === template.id ? 'selected' : ''}`}
                                onClick={() => handleSelectTemplate(template)}
                              >
                                <div className="template-info">
                                  <div className="template-name">{template.name}</div>
                                  <div className="template-meta">
                                    <span className="item-count">{template.itemCount} {t('meetingMinutes.items')}</span>
                                    <span className="created-date">{new Date(template.createdAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <div className="template-actions">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditTemplate(template.id);
                                    }}
                                    className="btn btn-outline btn-sm"
                                    title={t('meetingMinutes.editTemplate')}
                                  >
                                    <span className="icon">✏️</span>
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTemplate(template.id);
                                    }}
                                    className="btn btn-remove btn-sm"
                                    title={t('meetingMinutes.deleteTemplate')}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3,6 5,6 21,6"></polyline>
                                      <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                                      <line x1="10" y1="11" x2="10" y2="17"></line>
                                      <line x1="14" y1="11" x2="14" y2="17"></line>
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="empty-templates">
                            <div className="empty-icon">📋</div>
                            <p>{t('meetingMinutes.noCustomTemplates')}</p>
                            <p className="empty-hint">{t('meetingMinutes.addTemplateHint')}</p>
                          </div>
                        )}
                        
                        {selectedTemplateId && customOutline.length > 0 && (
                          <div className="selected-template-preview">
                            <h5>{t('meetingMinutes.selectedTemplatePreview')}</h5>
                            <div className="outline-preview">
                              {customOutline.map((item, index) => (
                                <div key={index} className="outline-item">
                                  <span className="item-number">{index + 1}</span>
                                  <span className="item-text">{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：结果展示区 */}
          <div className="result-section">
            <div className="section-card result-card-unified">
              <div className="result-area-unified">
                {isEditingSummary ? (
                  <div className="edit-mode">
                    <textarea
                      value={editableSummary}
                      onChange={(e) => setEditableSummary(e.target.value)}
                      className="summary-editor"
                      placeholder={t('meetingMinutes.editSummaryPlaceholder')}
                    />
                    <div className="edit-actions">
                      <button 
                        onClick={handleSaveEditedSummary}
                        className="btn btn-primary"
                      >
                        {t('common.saveChanges')}
                      </button>
                      <button 
                        onClick={() => {
                          setIsEditingSummary(false);
                          setEditableSummary(summary?.summary || '');
                        }}
                        className="btn btn-outline"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="result-display">
                    {summary ? (
                      <div className="summary-content">
                        <pre className="summary-text">{summary.summary}</pre>
                      </div>
                    ) : (
                      <div className="empty-result-state">
                        <pre className="result-placeholder">{t('meetingMinutes.resultPlaceholder')}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* 操作按钮 */}
              <div className="result-actions">
                {summary && !isEditingSummary && (
                  <button
                    onClick={handleEditText}
                    className="btn btn-outline btn-sm"
                  >
                    {t('meetingMinutes.editText')}
                  </button>
                )}
                <button
                  onClick={handleCopyText}
                  className={`btn btn-outline ${!summary ? 'disabled' : ''}`}
                  disabled={!summary}
                >
                  {t('common.copy')}
                </button>
                <button
                  onClick={handleExportToWord}
                  className={`btn btn-outline ${!summary ? 'disabled' : ''}`}
                  disabled={!summary}
                >
                  {t('common.export')}
                </button>
                <button
                  onClick={handleClearCurrentRecord}
                  className={`btn btn-outline btn-danger ${!originalText && !summary ? 'disabled' : ''}`}
                  disabled={!originalText && !summary}
                >
                  {t('common.clear')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="error-toast">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* 原文缺失提醒弹窗 */}
        {showNoTextModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>{t('meetingMinutes.noTextWarning')}</h3>
              </div>
              <div className="modal-body">
                <p>{t('meetingMinutes.pleaseGoToAudioToText')}</p>
              </div>
              <div className="modal-actions">
                <button 
                  onClick={handleGoToAudioToText}
                  className="btn btn-primary"
                >
                  {t('meetingMinutes.goToAudioToText')}
                </button>
                <button 
                  onClick={() => setShowNoTextModal(false)}
                  className="btn btn-outline"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 清空记录确认弹窗 */}
        {showClearConfirmModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>{t('meetingMinutes.clearConfirmTitle')}</h3>
              </div>
              <div className="modal-body">
                <p>{t('meetingMinutes.clearConfirmMessage')}</p>
                <div className="clear-items-list">
                  <ul>
                    <li>📝 {t('meetingMinutes.originalText')}</li>
                    <li>📋 {t('meetingMinutes.generatedSummary')}</li>
                    <li>💾 {t('meetingMinutes.localStorageData')}</li>
                  </ul>
                </div>
              </div>
              <div className="modal-actions">
                <button 
                  onClick={confirmClearRecord}
                  className="btn btn-primary btn-danger"
                >
                  <span className="icon">🗑️</span>
                  {t('meetingMinutes.confirmClear')}
                </button>
                <button 
                  onClick={cancelClearRecord}
                  className="btn btn-outline"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingMinutes;