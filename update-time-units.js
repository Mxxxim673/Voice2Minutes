import fs from 'fs';

// 为所有语言添加时间单位翻译
const timeUnitsTranslations = {
  'en.json': {
    hours: "hours",
    minutes: "minutes", 
    seconds: "seconds",
    hour: "hour",
    minute: "minute",
    second: "second"
  },
  'ja.json': {
    hours: "時間",
    minutes: "分",
    seconds: "秒",
    hour: "時間",
    minute: "分",
    second: "秒"
  },
  'fr.json': {
    hours: "heures",
    minutes: "minutes",
    seconds: "secondes", 
    hour: "heure",
    minute: "minute",
    second: "seconde"
  },
  'es.json': {
    hours: "horas",
    minutes: "minutos",
    seconds: "segundos",
    hour: "hora", 
    minute: "minuto",
    second: "segundo"
  },
  'ar.json': {
    hours: "ساعات",
    minutes: "دقائق",
    seconds: "ثوان",
    hour: "ساعة",
    minute: "دقيقة", 
    second: "ثانية"
  },
  'ru.json': {
    hours: "часов",
    minutes: "минут",
    seconds: "секунд",
    hour: "час",
    minute: "минута",
    second: "секунда"
  }
};

for (const [filename, timeUnits] of Object.entries(timeUnitsTranslations)) {
  const filePath = `./src/i18n/locales/${filename}`;
  
  try {
    // 读取现有文件
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // 添加时间单位翻译
    if (data.common) {
      data.common.timeUnits = timeUnits;
      
      // 写回文件
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✅ 已更新 ${filename} 时间单位翻译`);
    }
  } catch (error) {
    console.error(`❌ 更新 ${filename} 时出错:`, error.message);
  }
}

console.log('时间单位翻译更新完成！');