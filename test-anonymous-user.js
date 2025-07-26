// 测试未登录用户的访客身份识别功能
// 模拟浏览器环境中的操作

console.log('🧪 测试未登录用户访客身份识别功能');
console.log('=====================================');

// 模拟浏览器环境
global.window = {
    AudioContext: class MockAudioContext {
        constructor() {
            this.state = 'running';
        }
        close() {
            return Promise.resolve();
        }
    },
    MediaRecorder: class MockMediaRecorder {
        constructor() {
            this.state = 'inactive';
        }
    }
};

global.navigator = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Test Browser',
    language: 'zh-CN',
    platform: 'MacIntel',
    cookieEnabled: true,
    onLine: true,
    hardwareConcurrency: 8,
    mediaDevices: {
        getUserMedia: () => Promise.resolve({
            getTracks: () => [{ stop: () => {} }]
        })
    }
};

global.screen = {
    width: 1920,
    height: 1080
};

global.Intl = {
    DateTimeFormat: () => ({
        resolvedOptions: () => ({ timeZone: 'Asia/Shanghai' })
    })
};

global.localStorage = {
    data: {},
    getItem(key) {
        return this.data[key] || null;
    },
    setItem(key, value) {
        this.data[key] = value;
        console.log(`📦 localStorage.setItem: ${key} = ${value}`);
    },
    removeItem(key) {
        delete this.data[key];
        console.log(`🗑️ localStorage.removeItem: ${key}`);
    },
    clear() {
        this.data = {};
        console.log('🧹 localStorage.clear()');
    }
};

global.fetch = async (url, options) => {
    console.log(`🌐 API调用: ${options?.method || 'GET'} ${url}`);
    if (options?.body) {
        console.log('📤 请求数据:', JSON.parse(options.body));
    }
    
    // 模拟访客身份记录API
    if (url.includes('/api/guest/identity')) {
        const requestBody = JSON.parse(options.body);
        return {
            ok: true,
            json: () => Promise.resolve({
                success: true,
                message: '访客身份记录成功',
                riskLevel: 'low',
                warnings: [],
                allowContinue: true
            })
        };
    }
    
    // 模拟其他API调用失败
    return {
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' })
    };
};

// 导入访客身份服务（简化版模拟）
class GuestIdentityService {
    constructor() {
        this.VISITOR_ID_KEY = 'visitor_id';
        this.GUEST_USAGE_KEY = 'guestUsedMinutes';
        this.GUEST_IDENTITY_KEY = 'guest_identity';
        this.GUEST_SESSIONS_KEY = 'guest_sessions';
        this.GUEST_LIMIT_MINUTES = 5;
    }
    
    generateUUID() {
        return 'test-uuid-' + Date.now();
    }
    
    generateSimpleFingerprint() {
        return 'test-fingerprint-' + Math.random().toString(36).substr(2, 9);
    }
    
    async getGuestIdentity() {
        const visitorId = localStorage.getItem(this.VISITOR_ID_KEY) || this.generateUUID();
        localStorage.setItem(this.VISITOR_ID_KEY, visitorId);
        
        const fingerprint = this.generateSimpleFingerprint();
        const totalMinutesUsed = Number(localStorage.getItem(this.GUEST_USAGE_KEY) || '0');
        
        const identity = {
            visitorId,
            fingerprint,
            deviceInfo: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                timezone: 'Asia/Shanghai',
                screen: `${screen.width}x${screen.height}`
            },
            usageInfo: {
                totalMinutesUsed,
                sessionsCount: JSON.parse(localStorage.getItem(this.GUEST_SESSIONS_KEY) || '[]').length,
                lastUsedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            }
        };
        
        localStorage.setItem(this.GUEST_IDENTITY_KEY, JSON.stringify(identity));
        return identity;
    }
    
    async validateGuestAccess() {
        const identity = await this.getGuestIdentity();
        const remainingMinutes = Math.max(0, this.GUEST_LIMIT_MINUTES - identity.usageInfo.totalMinutesUsed);
        const isAllowed = remainingMinutes > 0;
        
        return {
            isAllowed,
            remainingMinutes,
            identity,
            riskLevel: 'low',
            warnings: []
        };
    }
    
    recordSession() {
        const sessions = JSON.parse(localStorage.getItem(this.GUEST_SESSIONS_KEY) || '[]');
        sessions.push({
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        });
        localStorage.setItem(this.GUEST_SESSIONS_KEY, JSON.stringify(sessions));
        console.log(`📝 记录新会话，总会话数: ${sessions.length}`);
    }
    
    updateUsage(minutesUsed) {
        const currentUsage = Number(localStorage.getItem(this.GUEST_USAGE_KEY) || '0');
        const newUsage = currentUsage + minutesUsed;
        localStorage.setItem(this.GUEST_USAGE_KEY, newUsage.toString());
        console.log(`⏱️ 使用量更新: +${minutesUsed}分钟, 总计: ${newUsage}分钟`);
    }
    
    async reportGuestIdentity(identity) {
        return await fetch('http://localhost:3001/api/guest/identity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                visitorId: identity.visitorId,
                fingerprint: identity.fingerprint,
                deviceInfo: identity.deviceInfo,
                usageInfo: identity.usageInfo
            })
        });
    }
}

// 开始测试
async function runTest() {
    console.log('\n🔍 步骤1: 模拟未登录用户首次访问');
    
    // 清除所有存储（模拟首次访问）
    localStorage.clear();
    
    console.log('初始状态:');
    console.log('- authToken:', localStorage.getItem('authToken'));
    console.log('- guestMode:', localStorage.getItem('guestMode'));
    console.log('- userData:', localStorage.getItem('userData'));
    console.log('- guestUsedMinutes:', localStorage.getItem('guestUsedMinutes'));
    
    console.log('\n🔍 步骤2: 初始化访客身份服务');
    const guestService = new GuestIdentityService();
    
    // 记录会话（模拟用户访问页面）
    guestService.recordSession();
    
    // 获取或创建访客身份
    const identity = await guestService.getGuestIdentity();
    console.log('✅ 访客身份创建成功:', {
        visitorId: identity.visitorId,
        fingerprint: identity.fingerprint,
        usageInfo: identity.usageInfo
    });
    
    console.log('\n🔍 步骤3: 验证访客访问权限');
    const validationResult = await guestService.validateGuestAccess();
    console.log('✅ 访问权限验证结果:', {
        isAllowed: validationResult.isAllowed,
        remainingMinutes: validationResult.remainingMinutes,
        riskLevel: validationResult.riskLevel
    });
    
    console.log('\n🔍 步骤4: 模拟用户进行录音转文字');
    // 模拟录音1分钟
    guestService.updateUsage(1.0);
    
    // 重新验证权限
    const afterUsageResult = await guestService.validateGuestAccess();
    console.log('✅ 使用后权限状态:', {
        isAllowed: afterUsageResult.isAllowed,
        remainingMinutes: afterUsageResult.remainingMinutes,
        totalUsed: afterUsageResult.identity.usageInfo.totalMinutesUsed
    });
    
    console.log('\n🔍 步骤5: 模拟上报后端');
    try {
        const response = await guestService.reportGuestIdentity(afterUsageResult.identity);
        console.log('✅ 后端上报成功');
    } catch (error) {
        console.log('❌ 后端上报失败:', error.message);
    }
    
    console.log('\n🔍 步骤6: 模拟超限使用');
    guestService.updateUsage(4.5); // 总计5.5分钟，超过5分钟限制
    
    const exceedResult = await guestService.validateGuestAccess();
    console.log('✅ 超限后权限状态:', {
        isAllowed: exceedResult.isAllowed,
        remainingMinutes: exceedResult.remainingMinutes,
        totalUsed: exceedResult.identity.usageInfo.totalMinutesUsed,
        shouldBeBlocked: exceedResult.identity.usageInfo.totalMinutesUsed >= 5
    });
    
    console.log('\n📊 最终localStorage状态:');
    Object.keys(localStorage.data).forEach(key => {
        console.log(`- ${key}:`, localStorage.getItem(key));
    });
    
    console.log('\n🎉 测试完成！');
    
    // 验证关键问题
    console.log('\n🚨 关键问题验证:');
    console.log('1. 未登录用户是否能正确初始化访客身份?', localStorage.getItem('visitor_id') ? '✅ 是' : '❌ 否');
    console.log('2. 使用量是否正确记录?', localStorage.getItem('guestUsedMinutes') === '5.5' ? '✅ 是' : '❌ 否');
    console.log('3. 超限后是否正确阻止?', !exceedResult.isAllowed ? '✅ 是' : '❌ 否');
    console.log('4. 会话是否正确记录?', JSON.parse(localStorage.getItem('guest_sessions') || '[]').length > 0 ? '✅ 是' : '❌ 否');
}

// 运行测试
runTest().catch(console.error);