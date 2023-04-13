const fs = require('fs');

const TextI18n = require('./TextI18n');
const { log } = require('./utils');

class TsxI18n extends TextI18n  {
  constructor(config){
    super(config);
  }

  log = () => {
    log.red('生成日志信息...');
    fs.writeFileSync('./log.json', JSON.stringify(this), 'utf-8')
  }

  start = async () => {
    //  建立依赖图谱，获取现有字典
    log.red('初始化...')
    await this.init();
    // 初始化失败，阻断程序执行
    if (this.PADDING) return;

    const type = this.config.type;

    switch (type) {
      // case HANDLER_REPLACE: // 替换已有key为新字典的key
      //   this.compile(REPLACE_PRE_KEY);
      //   break;
      default:
        await this.textToI18n()
    }

    // 生成日志信息
    this.log()
  }
}

module.exports = TsxI18n
