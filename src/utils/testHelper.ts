// 测试帮助器 - 用于回归测试音频时长计算
import { usageTracker } from '../services/usageTracker';
import { getAudioDuration } from '../services/usageService';

export const testHelper = {
  /**
   * 清除所有使用记录
   */
  clearAll() {
    usageTracker.clearAllUsageRecords();
    console.log('🧪 测试环境已清理');
  },

  /**
   * 获取详细统计
   */
  async getStats() {
    const stats = await usageTracker.getDetailedUsageStats();
    console.log('📊 当前使用量统计:', stats);
    return stats;
  },

  /**
   * 测试音频时长计算
   */
  async testAudioDuration(file: File) {
    console.log('🧪 开始测试音频时长计算:', file.name);
    
    try {
      const durationMinutes = await getAudioDuration(file);
      const durationSeconds = durationMinutes * 60;
      
      console.log('✅ 时长计算测试结果:', {
        文件: file.name,
        文件大小: file.size + ' bytes',
        时长分钟: durationMinutes.toFixed(4),
        时长秒: durationSeconds.toFixed(3),
        预期3秒误差: Math.abs(durationSeconds - 3).toFixed(3) + 's',
        预期10秒误差: Math.abs(durationSeconds - 10).toFixed(3) + 's',
        预期30秒误差: Math.abs(durationSeconds - 30).toFixed(3) + 's'
      });
      
      return {
        durationSeconds,
        durationMinutes,
        file: file.name
      };
    } catch (error) {
      console.error('❌ 时长计算测试失败:', error);
      throw error;
    }
  },

  /**
   * 模拟录音并测试完整流程
   */
  async simulateRecording(durationSeconds: number, fileName: string = 'test-recording.webm') {
    console.log(`🧪 模拟 ${durationSeconds} 秒录音:`, fileName);
    
    // 模拟录音数据 (WebM格式，大约64kbps)
    const bytesPerSecond = (64 * 1024) / 8; // 64kbps
    const fileSize = Math.floor(durationSeconds * bytesPerSecond);
    const mockBlob = new Blob([new ArrayBuffer(fileSize)], { type: 'audio/webm' });
    const mockFile = new File([mockBlob], fileName, { type: 'audio/webm' });
    
    console.log('📦 模拟文件创建:', {
      预期时长: durationSeconds + 's',
      文件大小: fileSize + ' bytes',
      文件类型: 'audio/webm'
    });
    
    // 测试时长计算
    const result = await this.testAudioDuration(mockFile);
    
    // 计算误差
    const error = Math.abs(result.durationSeconds - durationSeconds);
    const errorPercent = (error / durationSeconds) * 100;
    
    console.log('📈 误差分析:', {
      预期时长: durationSeconds + 's',
      实际检测: result.durationSeconds.toFixed(3) + 's',
      绝对误差: error.toFixed(3) + 's',
      相对误差: errorPercent.toFixed(2) + '%',
      误差是否可接受: errorPercent < 5 ? '✅ 是' : '❌ 否'
    });
    
    return {
      expected: durationSeconds,
      actual: result.durationSeconds,
      error,
      errorPercent,
      acceptable: errorPercent < 5
    };
  },

  /**
   * 运行完整的回归测试
   */
  async runRegressionTest() {
    console.log('🧪 开始回归测试: 3/10/30秒音频时长检测');
    
    this.clearAll();
    
    const testCases = [3, 10, 30];
    const results = [];
    
    for (const duration of testCases) {
      console.log(`\n🎯 测试 ${duration} 秒音频...`);
      
      try {
        const result = await this.simulateRecording(duration, `test-${duration}s.webm`);
        results.push({
          duration,
          ...result
        });
      } catch (error) {
        console.error(`❌ ${duration}秒测试失败:`, error);
        results.push({
          duration,
          error: true,
          message: error.message
        });
      }
      
      // 等待一会儿，避免太快
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📊 回归测试总结:');
    console.table(results);
    
    const passedTests = results.filter(r => !r.error && r.acceptable).length;
    console.log(`\n✅ 通过测试: ${passedTests}/${testCases.length}`);
    
    if (passedTests === testCases.length) {
      console.log('🎉 所有测试通过！误差已归零到可接受范围内。');
    } else {
      console.log('❌ 部分测试失败，需要进一步调优。');
    }
    
    return results;
  }
};

// 在开发环境中暴露到全局，方便测试
if (process.env.NODE_ENV === 'development') {
  (window as any).testHelper = testHelper;
  console.log('🧪 测试帮助器已暴露到 window.testHelper');
  console.log('使用方法:');
  console.log('  testHelper.clearAll() - 清除测试数据');
  console.log('  testHelper.getStats() - 查看当前统计');
  console.log('  testHelper.runRegressionTest() - 运行完整回归测试');
}