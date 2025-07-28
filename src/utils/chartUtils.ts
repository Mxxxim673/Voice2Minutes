interface UsageData {
  date: string;
  duration: number;
  files: string[];
}

/**
 * 计算全局最大使用量，用于统一Y轴范围
 * @param allPeriodsData 包含所有时间段数据的对象
 * @returns 全局最大使用量
 */
export const calculateGlobalMaxUsage = (allPeriodsData: {
  week?: UsageData[];
  month?: UsageData[];
  quarter?: UsageData[];
}): number => {
  const allData = [
    ...(allPeriodsData.week || []),
    ...(allPeriodsData.month || []),
    ...(allPeriodsData.quarter || [])
  ];
  
  if (allData.length === 0) return 10; // 默认最小值
  
  const maxUsage = Math.max(...allData.map(d => d.duration));
  return maxUsage || 10;
};

/**
 * 图表配置常量
 */
export const CHART_CONFIG = {
  // Y轴配置
  useDynamicY: false, // 是否使用动态Y轴（true=根据当前数据，false=使用全局最大值）
  
  // 空状态文本配置
  emptyStateTexts: {
    zh: '暂无数据',
    ja: 'データなし',
    en: 'No Data'
  },
  
  // X轴标签间隔配置
  tickIntervalDays: {
    7: 1,   // 7天显示每天
    30: 2,  // 30天显示每隔2天
    90: 7   // 90天显示每隔7天
  },
  
  // 柱宽配置
  barConfig: {
    minWidth: 0.4,      // 最小柱宽比例
    normalWidth: 0.8,   // 正常柱宽比例
    threshold: 3        // 少于多少根柱时使用最小宽度
  }
};

/**
 * 获取本地化的空状态文本
 * @param language 当前语言
 * @returns 空状态文本
 */
export const getEmptyStateText = (language: string = 'zh'): string => {
  const lang = language.split('-')[0]; // 处理 zh-CN 这样的格式
  return CHART_CONFIG.emptyStateTexts[lang as keyof typeof CHART_CONFIG.emptyStateTexts] 
    || CHART_CONFIG.emptyStateTexts.zh;
};

/**
 * 计算适当的Y轴最大值
 * @param currentMax 当前数据最大值
 * @param globalMax 全局最大值
 * @param useDynamic 是否使用动态计算
 * @returns Y轴最大值
 */
export const calculateYAxisMax = (
  currentMax: number, 
  globalMax: number, 
  useDynamic: boolean = CHART_CONFIG.useDynamicY
): number => {
  const baseMax = useDynamic ? currentMax : globalMax;
  return Math.ceil((baseMax || 1) * 1.1) || 10;
};

/**
 * 获取柱宽配置
 * @param dataLength 数据长度
 * @returns 柱宽配置对象
 */
export const getBarConfiguration = (dataLength: number) => {
  const { barConfig } = CHART_CONFIG;
  const isSmallDataset = dataLength < barConfig.threshold;
  
  return {
    barPercentage: isSmallDataset ? barConfig.minWidth : barConfig.normalWidth,
    categoryPercentage: isSmallDataset ? barConfig.minWidth : barConfig.normalWidth
  };
};