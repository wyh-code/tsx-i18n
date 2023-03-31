const path = require('path');

const {
  findKey
} = require('./utils');

class BaseClass {
  constructor(config) {
    this.config = config;
    // 项目根路径
    this.rootPath = process.cwd();
    // 代码格式化
    this.withParserOptions = {
      parser: "typescript",
      ...config.prettierOption
    }
    // 文案映射
    this.wordMap = {}
  }

  findKey = (currText, wordMap = this.wordMap) => {
    return findKey(currText, wordMap)
  }

  // 获取入口文件绝对路径
  getEntryPath = () => {
    const entry = this.config.entry;
    const filename = path.join(this.rootPath, entry);

    this.filenameMap[filename] = {};
    return filename;
  }

}

module.exports = BaseClass;
