
const fs = require('fs');
const TsxI18n = require('./lib');
// const TsxI18n = require('./dist/bundle');

// 配置信息
const config = {
  area: 'area', // 业务场景
  moduleName: 'moduleName', // 业务模块
  point: '', // 功能点
  entry: '/src/code.tsx', // 入口文件，相对项目根路径地址
  transResult: true, // log 中是否包含翻译结果
  importI18n: `import i18n from '@/config/i18n';`, // 
  prettierOption: {}, // 输出文件格式化配置
  // getPrveKeys: true, // 获取代码中已在使用的 key
  // diffKeys: true, // 对比已在使用的 key 与现字典的差异
  // replaceKey: true, // 将代码中已有的key为替换为当前字典的key
  // replaceWordMap, // 需要替换的字典（已在使用的旧字典）
  exclude: (name) => { // 需要排除的文件
    // console.log(name, '==name==')
    return /utils|config/.test(name);
  },
  getWordMap: ()=>({
    'area.moduleName.thisCopyCanBeFound': '旧字典中有的'
  }), // 获取已有的文案字典
  getLog: log => { // 获取替换日志
    fs.writeFileSync('./log.json', JSON.stringify(log), 'utf-8')
  },
}

const configName = process.argv.slice(2)[0];
config.entry = `/src/${configName}.tsx`

const tsxI18n = new TsxI18n(config);

tsxI18n.init()
