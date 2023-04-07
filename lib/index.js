/**
 * 主替换功能
 */
const fs = require('fs');
const ts = require('typescript');
const prettier = require('prettier');
const { CONST_TO_FUNCTION, NODE_TYPE_TEMPLATE } = require('./constants');
const {
  log,
  findKey,
  firstToUpperCase,
  getWordKey,
  replaceTemplate,
  fetchTranslate,
  clearText,
  splicePath
} = require('./utils');

const BaseClass = require('./BaseClass');
const {
  COLLECT,
  HANDLER_REPLACE,
  REPLACE_PRE_KEY
} = require('./constants');

class TsxI18n extends BaseClass {
  constructor(config) {
    super(config);
    // 收集类型，默认收集中文
    this.collectType = 'text';

    // 收集到的内容
    this.collectMap = {};
  }

  getCodeInfo = (node, nodeType) => {
    let info = {
      codeText: node.text
    }
    // console.log(info.codeText, '--codeText--', node.getText())
    // if(nodeType === NODE_TYPE_TEMPLATE){
    //   const { newCode, data } = replaceTemplate(info.codeText);
    // }

    return info;
  }

  collect = (filename, node, nodeType, codeInfo) => {
    this.collectMap[filename] = this.collectMap[filename] || {};
    this.collectMap[filename][this.collectType] = this.collectMap[filename][this.collectType] || [];

    this.collectMap[filename][this.collectType].push({
      filename,
      collectType: this.collectType,
      source: node.getText().trim(),
      codeInfo,
      nodeType,
    })
  }

  // 节点处理
  compileHandler = (filename, type, node, nodeType) => {
    const handelr = this[CONST_TO_FUNCTION[nodeType]] || (node => node);
    const codeInfo = this.getCodeInfo(node, nodeType);
    // 收集
    this.collect(filename, node, nodeType, codeInfo);

    // 收集文案不需要进行下一步处理
    if (['text'].includes(this.collectType)) return node;

    return handelr(filename, type, node, codeInfo);
  }

  // i18n
  i18nHandler = (filename, type, node, codeInfo) => {

  }
  // console
  consoleHandler = (filename, type, node, codeInfo) => {

  }
  // string
  stringHandler = (filename, type, node, codeInfo) => {
    // 标记需要替换的文件
    this.filenameMap[filename].isReplace = true;


  }
  // template
  templateHandler = (filename, type, node, codeInfo) => {

  }
  // jsx
  i18nHandler = (filename, type, node, codeInfo) => {

  }

  compile = (type) => {
    Object.keys(this.filenameMap).forEach(filename => {
      this.baseCompile(filename, (node, nodeType) => this.compileHandler(filename, type, node, nodeType));
    })
  }

  // 默认处理流程：中文转i18n函数
  textToI18n = async () => {
    // 收集中文
    this.compile();

    // 翻译中文
    await this.createWordMap();

  }

  translate = (wordList) => {
    return new Promise(resolve => {
      let result = {};
      const translateFetch = this.config.fetchTranslate || fetchTranslate;

      const fn = (index) => {
        const word = wordList[index];
        if(!word){
          resolve(result)
        } else {
          translateFetch(word).then(res => {
            const transResult = res.data.trans_result;

            // 如果未翻译成功，记录手动处理
            if(!transResult){
              this.translateErrorLog(word, { message: res.data })
            }else{
              console.log(res, '==res==')
            }
          })
        }

        setTimeout(() => {
          fn(index + 1)
        }, 1000)
      }

      fn(0)
    })
  }

  translateErrorLog = () => {

  }

  createWordMap = async () => {
    const wordList = Object.keys(this.collectMap).map(filename => {
      return this.collectMap[filename][this.collectType].reduce((a, b) => [...a, b], [])
    // })
    }).reduce((a, b) => [...a, ...b], []).filter(it => it.codeInfo.codeText) // codeText 不一定拿得到（console）

    // 获取需要翻译的字段
    const words = [];
    wordList.forEach(item => {
      const info = findKey(item.codeInfo.codeText, this.baseWordMap);
      if (info) {
        this.findKeys[info.key] = info.currText === info.prevText ? info.currText : { prevText: info.prevText, currText: info.currText };
      } else {
        words.push(item)
      }
    })

    // // 翻译文案
    // if (wordList.length) {
    //   const newMap = await this.translate(wordList);
    //   // 更新字典
    //   this.wordMap = { ...this.wordMap, ...newMap };
    //   this.newMap = newMap;
    // }
    console.log(this.collectMap, '==wordList==', wordList)
  }

  start = async () => {
    //  建立依赖图谱，获取现有字典
    log.red('初始化...')
    await this.init();
    // 初始化失败，阻断程序执行
    if (this.PADDING) return;

    console.log(this.config.type, '==this.config.replaceKey==', HANDLER_REPLACE)
    const type = this.config.type;

    switch (type) {
      case HANDLER_REPLACE: // 替换已有key为新字典的key
        this.compile(REPLACE_PRE_KEY);
        break;
      default:
        await this.textToI18n()
    }
  }
}

module.exports = TsxI18n
