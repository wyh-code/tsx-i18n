/**
 * 主替换功能
 */
const ts = require('typescript');

const { } = require('./constants');
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
  HANDLER_REPLACE_TEXT_I18N,
  REPLACE_PRE_KEY,
  CONST_TO_FUNCTION,
  NODE_TYPE_TEMPLATE,
} = require('./constants');

class TextI18n extends BaseClass {
  constructor(config) {
    super(config);
    // 收集类型，默认收集中文
    this.collectType = 'text';

    // 收集到的内容
    this.collectMap = {};

    // 找到可以复用的key
    this.findKeys = {};

    // 翻译信息记录
    this.transResult = {};
    // 翻译错误记录
    this.translateError = {}
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

  // 校验翻译错误
  checkTranslate = (filename, codeText) => {
    const result = this.translateError[filename] && this.translateError[filename][codeText];
    if (result) {
      this.filenameMap[filename].handler = this.filenameMap[filename].handler || {}
      this.filenameMap[filename].handler[codeText] = {
        tip: result.message || '翻译出错',
        ...this.translateError[filename][codeText]
      }
    }
    return result;
  }

  // 校验冒号结尾
  checkColon = (filename, codeText) => {
    if (/(:|：)$/.test(codeText)) {
      this.filenameMap[filename].handler = this.filenameMap[filename].handler || {}
      this.filenameMap[filename].handler[codeText] = '需检查替换后是否冒号缺失'
    }
  }

  // 节点处理
  compileHandler = (filename, type, node, nodeType) => {
    const handelr = this[CONST_TO_FUNCTION[nodeType]] || (node => node);
    const codeInfo = this.getCodeInfo(node, nodeType);
    // 收集
    if (type === COLLECT) {
      this.collect(filename, node, nodeType, codeInfo);
      // 收集文案不需要进行下一步处理
      return node;
    }

    // 文案替换前置校验
    if (type === HANDLER_REPLACE_TEXT_I18N) {
      // 如果当前文案翻译时出错，直接返回手动处理
      if (this.checkTranslate(filename, codeInfo.codeText)) return node;
      // 如果以冒号结尾，需检查替换后是否冒号缺失
      this.checkColon(filename, codeInfo.codeText)
    }

    // 标记需要替换的文件
    this.filenameMap[filename].isReplace = true;

    return handelr(filename, node, codeInfo.codeText);
  }

  // i18n
  i18nHandler = (filename, type, node, codeInfo) => {

  }
  // console
  consoleHandler = (filename, type, node, codeInfo) => {

  }
  // string: 变量声明、对象属性、中文参数 
  stringHandler = (filename, node, codeText) => {
    let newNode = ts.factory.createIdentifier(`i18n('${findKey(codeText, this.wordMap).key}')`);
    // 组件属性 
    if (ts.isJsxAttribute(node.parent)) {
      newNode = ts.factory.createIdentifier(`{i18n('${findKey(codeText, this.wordMap).key}')}`);
    }
    return newNode;
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

  writeNewCode = () => {
    // console.log(Object.keys(this.filenameMap), '--Object.keys(this.filenameMap)--')
    Object.keys(this.filenameMap).forEach(async filename => {
      await this.overwrite(filename)
    })
  }

  // 默认处理流程：中文转i18n函数
  textToI18n = async () => {
    // 收集中文
    log.red('开始收集文案')
    this.compile(COLLECT);

    // 翻译中文
    await this.createWordMap();

    // 替换文案
    log.red('开始依次替换文案')
    this.printCode = true;
    this.compile(HANDLER_REPLACE_TEXT_I18N)

    // 格式化输出
    log.red('格式化输出新代码')
    this.writeNewCode();
  }

  getResolveKey = (transResult, result) => {
    const { area, moduleName, point } = this.config;
    const dst = transResult.map(it => it.dst).join(' ')
    const src = transResult.map(it => it.src).join(' ')
    // 去除翻译后的特殊符号 ${}[]、\/。，,.？"#$¥%*【】?！@#¥%&*（）——+=-_!$[];><《》、
    const str = dst.replace(/\$|\{|\}|\\|\/|\.|,|\?|:|`|\(|\)|'|"|;|-|&|_|\*|（｜）|。|，|？|：|！|@|#|¥|%|（|）|——|\!|\[|\]|\+|=|、|<|>|《|》|【|】/g, ' ');
    const arr = str.split(' ').filter(it => it);
    // 默认取前5个单词
    let wordKey = getWordKey(arr);
    let resolveKey = [area, moduleName, point, wordKey].filter(it => it).join('.')

    // 获取 key 值后，对照基础字典与新字典，记录校验错误信息
    let checkErrorInfo;
    /**
     * 对比已有字典
     * 如在旧字典中查到相同取值key，则须记录手动处理
     */
    if (this.baseWordMap[resolveKey]) {
      // 在已有字典中找到相同取值key，若新文案还有多余单词，则继续拼接新单词
      if (arr.length > 5) {
        wordKey = getWordKey(arr, 6);
        resolveKey = [area, moduleName, point, wordKey].filter(it => it).join('.');
      } else {
        // 新文案没有多余单词，需记录，人工核对
        checkErrorInfo = {
          message: `在基础字典中查到相同的取值key：${resolveKey}`,
          texts: {
            prev: this.baseWordMap[resolveKey], // 基础字典的文案
            curr: src // 当前翻译的文案
          }
        }
      }
    }

    /**
     * 新翻译的文案处理
     * 校验 key 是否重复，若有重复则说明两条文案虽不同，但翻译后前5个单词相同
     */
    if (this.transResult[resolveKey]) {
      // 获取已有的翻译结果
      const target = this.transResult[resolveKey].target;
      let unlike;
      // 在新翻译的单词中查找老翻译没有的单词
      unlike = arr.filter(item => !target.includes(item))[0];
      if (unlike) {
        // 若找到，则追加不同单词作为key
        wordKey = `${wordKey}${firstToUpperCase(unlike)}`;
        resolveKey = [area, moduleName, point, wordKey].filter(it => it).join('.')
      } else {
        // 若没有在新单词中找到不同，则在老单词中寻找不同
        unlike = target.filter(item => !arr.includes(item))[0];
        if (unlike) {
          // 修改旧文案的记录信息
          const prevKey = `${resolveKey}${firstToUpperCase(unlike)}`;
          this.transResult[prevKey] = this.transResult[resolveKey];
          result[prevKey] = result[resolveKey];
        } else {
          // 若新旧翻译均未找到不同，则两条不同的文案有相同的英文翻译
          checkErrorInfo = {
            message: `两条不同的文案有相同的英文翻译，得到相同的取值key：${resolveKey}`,
            texts: {
              prev: this.transResult[resolveKey], // 之前翻译的信息
              curr: src // 当前翻译文案
            }
          }
        }
      }
    }
    return { wordKey, resolveKey, target: arr, checkErrorInfo };
  }

  translate = (words) => {
    return new Promise(resolve => {
      let result = {};
      const translateFetch = this.config.fetchTranslate || fetchTranslate;

      const fn = (index) => {
        const word = words[index];
        if (!word) {
          resolve(result)
        } else {
          const codeText = word.codeInfo.codeText;
          translateFetch(codeText).then(res => {
            const transResult = res.data.trans_result;
            // 如果未翻译成功，记录手动处理
            if (!transResult) {
              this.translateErrorLog(word, { message: res.data })
              log.red(`共需翻译${words.length}条文案, 第${index + 1}条翻译出错：${codeText} - ${res.data?.error_msg} `)
            } else {
              // 获取key
              const { wordKey, resolveKey, target, checkErrorInfo } = this.getResolveKey(transResult, result);
              // 特殊情况翻译后包含中文、getResolveKey 返回有错误信息，需记录，手动处理 
              const t = target.join('');
              if (/.*[\u4e00-\u9fa5]+.*/.test(t) || checkErrorInfo) {
                // 记录错误出错文案信息
                checkErrorInfo.texts.curr = {
                  target,
                  source: codeText,
                  word,
                }
                this.translateErrorLog(word, { message: '翻译后包含中文，需手动处理 ', resolveKey, ...checkErrorInfo })
              } else {
                // 记录翻译信息
                this.transResult[resolveKey] = {
                  target,
                  source: codeText,
                  word,
                };
                result[resolveKey] = codeText;
              }
              console.log(`共需翻译${words.length}条文案, 第${index + 1}条翻译完毕：${codeText} - ${wordKey} `)
            }
          })

          setTimeout(() => {
            fn(index + 1)
          }, 1000)
        }
      }
      fn(0)
    })
  }

  translateErrorLog = (word, info) => {
    this.translateError[word.filename] = {
      ...this.translateError[word.filename],
      [word.codeInfo.codeText]: {
        word,
        info
      }
    };
  }

  createWordMap = async () => {
    const wordList = Object.keys(this.collectMap).map(filename => {
      return this.collectMap[filename][this.collectType].reduce((a, b) => [...a, b], [])
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

    // 翻译文案
    if (words.length) {
      const newMap = await this.translate(words);

      // 更新字典
      this.wordMap = { ...this.baseWordMap, ...newMap };
      this.newMap = newMap;
    }
  }
}

module.exports = TextI18n
