// 全局错误处理工具

export interface ErrorHandlerConfig {
  showConsoleLog: boolean;
  fallbackValue?: any;
  retryCount: number;
  retryDelay: number;
}

const defaultConfig: ErrorHandlerConfig = {
  showConsoleLog: true,
  retryCount: 3,
  retryDelay: 1000
};

// 安全函数调用包装器
export async function safeCall<T>(
  fn: () => Promise<T> | T,
  config: Partial<ErrorHandlerConfig> = {}
): Promise<T | null> {
  const cfg = { ...defaultConfig, ...config };
  
  for (let i = 0; i < cfg.retryCount; i++) {
    try {
      const result = await Promise.resolve(fn());
      return result;
    } catch (error) {
      if (cfg.showConsoleLog) {
        console.warn(`safeCall 尝试 ${i + 1}/${cfg.retryCount} 失败:`, error);
      }
      
      // 最后一次尝试失败
      if (i === cfg.retryCount - 1) {
        if (cfg.showConsoleLog) {
          console.error('safeCall 所有尝试都失败了:', error);
        }
        return cfg.fallbackValue ?? null;
      }
      
      // 等待后重试
      if (cfg.retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, cfg.retryDelay));
      }
    }
  }
  
  return cfg.fallbackValue ?? null;
}

// 服务调用包装器
export class ServiceWrapper<T> {
  private service: T;
  private config: ErrorHandlerConfig;
  
  constructor(service: T, config: Partial<ErrorHandlerConfig> = {}) {
    this.service = service;
    this.config = { ...defaultConfig, ...config };
  }
  
  // 创建安全的方法调用
  createSafeMethod<K extends keyof T>(
    methodName: K,
    fallbackValue: any = null
  ) {
    return async (...args: any[]) => {
      const method = this.service[methodName];
      if (typeof method !== 'function') {
        console.error(`方法 ${String(methodName)} 不存在`);
        return fallbackValue;
      }
      
      return safeCall(
        () => (method as any).apply(this.service, args),
        { ...this.config, fallbackValue }
      );
    };
  }
}

// 常用的错误处理函数
export const errorHandlers = {
  // 处理API调用错误
  apiCall: async <T>(
    apiCall: () => Promise<T>,
    fallback: T
  ): Promise<T> => {
    try {
      return await apiCall();
    } catch (error) {
      console.warn('API调用失败，使用备用值:', error);
      return fallback;
    }
  },
  
  // 处理localStorage访问错误
  localStorage: {
    getItem: (key: string, fallback: string | null = null): string | null => {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.warn(`localStorage.getItem(${key}) 失败:`, error);
        return fallback;
      }
    },
    
    setItem: (key: string, value: string): boolean => {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.warn(`localStorage.setItem(${key}) 失败:`, error);
        return false;
      }
    }
  },
  
  // 处理JSON解析错误
  jsonParse: <T>(str: string, fallback: T): T => {
    try {
      return JSON.parse(str);
    } catch (error) {
      console.warn('JSON解析失败，使用备用值:', error);
      return fallback;
    }
  }
};

// 全局错误监听器
export const setupGlobalErrorHandlers = () => {
  // 捕获未处理的Promise错误
  window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
    event.preventDefault(); // 防止控制台输出错误
  });
  
  // 捕获其他JavaScript错误
  window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
  });
};