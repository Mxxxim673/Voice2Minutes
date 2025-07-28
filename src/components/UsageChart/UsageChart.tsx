import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface UsageData {
  date: string;
  duration: number;
  files: string[];
}

interface UsageChartProps {
  data: UsageData[];
  selectedPeriod: number;
  globalMaxUsage?: number;
  useDynamicY?: boolean;
  emptyStateText?: string;
}

const UsageChart: React.FC<UsageChartProps> = ({
  data,
  selectedPeriod,
  globalMaxUsage = 0,
  useDynamicY = false,
  emptyStateText
}) => {
  const { t } = useTranslation();

  // 格式化时长显示
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);
    
    if (hours > 0) {
      return `${hours}${t('usage.hours')}${mins}${t('usage.minutes')}`;
    } else if (mins > 0) {
      return `${mins}${t('usage.minutes')}${secs > 0 ? secs + t('usage.seconds') : ''}`;
    } else {
      return `${secs}${t('usage.seconds')}`;
    }
  };

  // 格式化日期标签
  const formatDateLabel = (dateStr: string, period: number) => {
    const date = new Date(dateStr);
    
    if (period === 7) {
      // 7天显示每天
      return date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric' 
      });
    } else if (period === 30) {
      // 30天每隔2天显示
      return date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric' 
      });
    } else {
      // 90天每隔7天显示
      return date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  // 计算Y轴最大值
  const currentDataMax = Math.max(...data.map(d => d.duration), 1);
  const maxY = useDynamicY 
    ? Math.ceil(currentDataMax * 1.1)
    : Math.ceil((globalMaxUsage || currentDataMax) * 1.1) || 10;

  // 检查是否为空数据
  const isEmpty = data.length === 0 || data.every(d => d.duration === 0);
  
  if (isEmpty) {
    return (
      <div style={{
        height: '250px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        fontSize: 'var(--font-size-callout)'
      }}>
        {emptyStateText || 'データなし'}
      </div>
    );
  }

  // 柱宽配置：数据少时增大柱宽
  const barPercentage = data.length < 3 ? 0.6 : 0.8;
  const categoryPercentage = data.length < 3 ? 0.6 : 0.8;

  // 准备图表数据
  const chartData = {
    labels: data.map(d => formatDateLabel(d.date, selectedPeriod)),
    datasets: [
      {
        data: data.map(d => d.duration),
        backgroundColor: 'rgb(0, 122, 255)', // --primary-blue 统一蓝色
        borderColor: 'var(--primary-blue)',
        borderWidth: 0,
        borderRadius: 3,
        borderSkipped: false,
        barPercentage,
        categoryPercentage,
      },
    ],
  };

  // 图表配置
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (context: any) => {
            const index = context[0].dataIndex;
            const dateStr = data[index]?.date;
            return dateStr ? new Date(dateStr).toLocaleDateString() : '';
          },
          label: (context: any) => {
            const index = context.dataIndex;
            const item = data[index];
            const lines = [
              `${t('usage.duration')}: ${formatDuration(item.duration)}`,
            ];
            
            if (item.files && item.files.length > 0) {
              lines.push(`${t('usage.files')}:`);
              item.files.forEach(file => {
                lines.push(`  ${file}`);
              });
            }
            
            return lines;
          },
          labelColor: () => ({
            borderColor: 'rgb(0, 122, 255)',
            backgroundColor: 'rgb(0, 122, 255)',
          }),
        },
        backgroundColor: 'var(--background-primary)',
        titleColor: 'var(--text-primary)',
        bodyColor: 'var(--text-secondary)',
        borderColor: 'var(--border-color)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: 'var(--text-secondary)',
          font: {
            size: 12,
          },
          maxRotation: 0,
          autoSkip: selectedPeriod > 7,
          maxTicksLimit: selectedPeriod === 90 ? 13 : selectedPeriod === 30 ? 15 : undefined,
        },
      },
      y: {
        beginAtZero: true,
        max: maxY,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          lineWidth: 0.5,
        },
        ticks: {
          color: 'var(--text-secondary)',
          font: {
            size: 12,
          },
          callback: function(value: any) {
            const minutes = Number(value);
            if (minutes === 0) {
              return ''; // 隐藏原点的0标签
            }
            if (minutes >= 60) {
              const hours = Math.floor(minutes / 60);
              const mins = Math.floor(minutes % 60);
              return mins > 0 ? `${hours}時${mins}分` : `${hours}時`;
            } else if (minutes >= 1) {
              return `${Math.floor(minutes)}分`;
            } else if (minutes > 0) {
              return `${Math.floor(minutes * 60)}秒`;
            }
            return '';
          },
          stepSize: Math.max(0.5, Math.floor(maxY / 5)),
        },
        border: {
          display: false,
        },
      },
    },
    layout: {
      padding: {
        top: 10,
        right: 10,
        bottom: 0,
        left: 10,
      },
    },
    elements: {
      bar: {
        borderRadius: {
          topLeft: 2,
          topRight: 2,
          bottomLeft: 0,
          bottomRight: 0,
        },
      },
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart' as const,
    },
  };

  return (
    <div style={{ height: '250px', width: '100%' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default UsageChart;