import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportToWord } from '../../utils/exportUtils';
import './TranscriptionResult.css';

interface TranscriptionResultProps {
  transcription: string;
  onClear: () => void;
}

const TranscriptionResult: React.FC<TranscriptionResultProps> = ({ 
  transcription, 
  onClear 
}) => {
  const { t } = useTranslation();
  const [showNotification, setShowNotification] = useState(false);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(transcription);
      showSuccessNotification();
    } catch (error) {
      console.error('Failed to copy text:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = transcription;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showSuccessNotification();
    }
  };

  const handleExportToWord = () => {
    exportToWord(transcription, 'transcription');
    showSuccessNotification();
  };

  const showSuccessNotification = () => {
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };

  return (
    <>
      <div className="transcription-result card">
        <div className="result-header">
          <h2>{t('audioToText.taskCompleted')}</h2>
          <div className="result-actions">
            <button
              onClick={handleCopyText}
              className="button button-outline"
            >
              {t('common.copy')}
            </button>
            <button
              onClick={handleExportToWord}
              className="button button-outline"
            >
              {t('common.export')}
            </button>
            <button
              onClick={onClear}
              className="button button-secondary"
            >
              {t('common.clear')}
            </button>
          </div>
        </div>
        
        <div className="transcription-content">
          <textarea
            value={transcription}
            readOnly
            className="transcription-textarea"
            rows={10}
          />
        </div>
      </div>

      {showNotification && (
        <div className="notification success">
          {t('audioToText.taskCompleted')}
        </div>
      )}
    </>
  );
};

export default TranscriptionResult;