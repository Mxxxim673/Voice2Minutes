import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error for debugging
    console.error('Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    
    this.setState({ 
      hasError: true, 
      error, 
      errorInfo 
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          border: '2px solid #ff3b30',
          borderRadius: '8px',
          backgroundColor: '#fff5f5',
          color: '#333'
        }}>
          <h2 style={{ color: '#ff3b30', marginBottom: '16px' }}>
            🚨 应用遇到错误
          </h2>
          <p style={{ marginBottom: '16px' }}>
            应用遇到了一个错误，请刷新页面重试。如果问题持续存在，请联系技术支持。
          </p>
          
          <details style={{ marginBottom: '16px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              点击查看技术详情
            </summary>
            <div style={{ 
              marginTop: '8px', 
              padding: '12px', 
              backgroundColor: '#f8f8f8', 
              borderRadius: '4px',
              fontSize: '14px',
              fontFamily: 'monospace'
            }}>
              <strong>错误信息:</strong>
              <pre>{this.state.error?.toString()}</pre>
              
              {this.state.errorInfo && (
                <>
                  <strong>错误堆栈:</strong>
                  <pre>{this.state.errorInfo.componentStack}</pre>
                </>
              )}
            </div>
          </details>
          
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007AFF',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '8px'
            }}
          >
            刷新页面
          </button>
          
          <button 
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '8px 16px',
              backgroundColor: '#8E8E93',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;