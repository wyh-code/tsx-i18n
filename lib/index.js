const fs = require('fs');

const TextI18n = require('./TextI18n');
const HandlerKey = require('./HandlerKey');
const {
  HANDLER_PRE_KEY,
  HANDLER_REPLACE_PRE_KEY
} = require('./constants')
const { log } = require('./utils');

class TsxI18n {
  constructor(config) {
    this.config = config;
    this.instance = null;
  }

  log = () => {
    log.red('生成日志信息...');
    fs.writeFileSync('./log.json', JSON.stringify(this.instance), 'utf-8')
  }

  start = async () => {
    let type = this.config.type;
    // 替换已有key为新字典的key
    if([HANDLER_REPLACE_PRE_KEY].includes(type)){
      type = HANDLER_PRE_KEY;
    }
    switch (type) {
      case HANDLER_PRE_KEY: 
        this.instance = new HandlerKey(this.config);
        break;
      default:
        this.instance = new TextI18n(this.config);
    }

    //  建立依赖图谱，获取现有字典
    log.red('初始化...')
    await this.instance.init();
    // 初始化失败，阻断程序执行
    if (this.instance.PADDING) return;
    await this.instance.start()

    // 生成日志信息
    this.log()
  }
}

module.exports = TsxI18n
