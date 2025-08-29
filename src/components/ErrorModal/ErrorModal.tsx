import React from 'react';
import { useTranslation } from 'react-i18next';
import './ErrorModal.css';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
}

const ErrorModal: React.FC<ErrorModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  type = 'error' 
}) => {
  const { t } = useTranslation();
  
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '❌';
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'error': return t('common.error');
      case 'warning': return t('common.warning');
      case 'info': return t('common.info');
      default: return t('common.error');
    }
  };

  return (
    <div className="error-modal-overlay" onClick={onClose}>
      <div 
        className={`error-modal-content error-modal-${type}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="error-modal-header">
          <div className="error-modal-icon">{getIcon()}</div>
          <h3 className="error-modal-title">{getTitle()}</h3>
        </div>
        
        <div className="error-modal-body">
          <p className="error-modal-message">{message}</p>
        </div>
        
        <div className="error-modal-footer">
          <button 
            className="error-modal-button"
            onClick={onClose}
          >
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;