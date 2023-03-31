/**
 * 主替换功能
 */
const fs = require('fs');
const ts = require('typescript');
const prettier = require('prettier');
const { 
  NODE_TYPE_CON_I18N, 
  NODE_TYPE_STRING,
  NODE_TYPE_TEMPLATE, 
  NODE_TYPE_JSXTEXT 
} = require('./constants');
const {
  log,
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
    this.textMap = {};
    this.newMap = {};
    // 翻译结果
    this.transResult = {}
    // 翻译错误
    this.translateError = {}
    // 复用的key
    this.findKeys = {}
    // 代码中已有的key
    this.prevKeys = {}
    // 代码中已有 i18n 函数引用的key与当前字典中 key 的差异
    this.diffKeys = {}
    // 收集key时的错误
    this.prevKeysError = {}

    // 替换已有key为新字典key
    this.replaceKeyMap = {} // 已替换的key
    this.replaceNotFindKeyMap = {} // 在替换范围，但新字典未找到的key
    this.notReplaceKeyMap = {} // 不在替换范围内的key

    // 日志收集
    this.log = {}
  }

  // 校验冒号结尾
  checkColon = (filename, newCode) => {
    if (/(:|：)$/.test(newCode)) {
      this.filenameMap[filename].handler = this.filenameMap[filename].handler || {}
      this.filenameMap[filename].handler[newCode] = '需检查替换后是否冒号缺失'
    }
  }

  // 校验翻译错误
  checkTranslate = (filename, newCode) => {
    const result = this.translateError[filename] && this.translateError[filename][newCode];
    if (result) {
      this.filenameMap[filename].handler = this.filenameMap[filename].handler || {}
      this.filenameMap[filename].handler[newCode] = {
        tip: result.message || '翻译出错',
        ...this.translateError[filename][newCode]
      }
    }
    return result;
  }

  getPrevKeys = (node) => {
    const keyStr = node.getText().trim();
    let prevKey;
    if (/^(i18n\()/.test(keyStr)) {
      prevKey = node.arguments[0].getText()

      if (prevKey) {
        prevKey = prevKey.replace(/'|"|`/g, '')
      } else {
        this.prevKeysError[keyStr] = keyStr
      }
    }

    if (prevKey) {
      this.prevKeys[prevKey] = keyStr;

      // 记录已用key与现有字典的差异
      if (this.config.diffKeys) {
        if (!this.baseWordMap[prevKey]) {
          this.diffKeys[prevKey] = keyStr;
        }
      }
    }
    return { keyStr, prevKey }
  }

  // replaceTransformer = (type, filename) => (context) => {
  //   const visitor = (node) => {
  //     // 排除已经替换的i18n 和 console
  //     if (ts.isCallExpression(node) && /^(i18n\(|console)/.test(node.getText())) {
  //       // 记录已经存在无需替换的key
  //       const info = this.getPrevKeys(node);
  //       if (this.config.replaceKey) {
  //         const newNode = this.replaceKey(node, info, filename);
  //         return newNode;
  //       }
  //       return node;
  //     }

  //     /**
  //       * 以下情况阻断下边逻辑执行
  //       * this.config.replaceKey -替换已有key为新字典的key
  //       * this.config.getPrevKeys - 只收集已在文案中的 key 
  //       * this.config.diffKeys - 对比当前已使用的 key 和当前字典的差异
  //     */
  //     if (!this.config.replaceKey && !this.config.getPrevKeys && !this.config.diffKey) {

  //       // 模版字符串
  //       if (ts.isTemplateLiteral(node) && /.*[\u4e00-\u9fa5]+.*/.test(node.getText())) {
  //         // 包含三目判断、引号时 需记录，手动处理
  //         if (/.*\?[^\.].*:.*/.test(node.getText()) || /'|"/.test(node.getText())) {
  //           this.filenameMap[filename].handler = this.filenameMap[filename].handler || {};
  //           this.filenameMap[filename].handler[node.getText()] = '包含三目判断、引号时需手动处理'
  //           return node;
  //         }
  //         // 标记需要替换的文件
  //         this.filenameMap[filename].isReplace = true;
  //         // 收集文案
  //         const { newCode, data } = replaceTemplate(node.getText().trim());
  //         if (type === COLLECT) {
  //           return this.collectText(filename, node, newCode, 'template')
  //         }
  //         // 如果当前文案翻译时出错，直接返回手动处理
  //         if (this.checkTranslate(filename, newCode)) return node;
  //         // 如果以冒号结尾，需检查替换后是否冒号缺失
  //         this.checkColon(filename, newCode);

  //         return ts.factory.createIdentifier(`i18n('${this.findKey(newCode).key}',{${data.join(',')}})`);
  //       }
  //       // 字符串
  //       if (ts.isStringLiteral(node) && node.text && /.*[\u4e00-\u9fa5]+.*/.test(node.text)) {
  //         // 标记需要替换的文件
  //         this.filenameMap[filename].isReplace = true;
  //         // 清理文案前后引号及空格
  //         const newCode = clearText(node.getText());
  //         // 收集文案
  //         if (type === COLLECT) {
  //           return this.collectText(filename, node, newCode, 'string')
  //         }
  //         // 如果当前文案翻译时出错，直接返回手动处理
  //         if (this.checkTranslate(filename, newCode)) return node;
  //         // 如果以冒号结尾，需检查替换后是否冒号缺失
  //         this.checkColon(filename, newCode)
  //         // 变量声明 - 对象属性 - 中文参数 

  //         let newNode = ts.factory.createIdentifier(`i18n('${this.findKey(newCode).key}')`);
  //         // 组件属性 
  //         if (ts.isJsxAttribute(node.parent)) {
  //           newNode = ts.factory.createIdentifier(`{i18n('${this.findKey(newCode).key}')}`);
  //         }
  //         return newNode;
  //       }

  //       // JSXText
  //       if (ts.isJsxText(node) && node.text && /.*[\u4e00-\u9fa5]+.*/.test(node.text)) {
  //         // 标记需要替换的文件
  //         this.filenameMap[filename].isReplace = true;
  //         // 收集文案
  //         const newCode = node.getText().trim();
  //         if (type === COLLECT) {
  //           return this.collectText(filename, node, newCode, 'jsxText')
  //         }
  //         // 如果当前文案翻译时出错，直接返回手动处理
  //         if (this.checkTranslate(filename, newCode)) return node;
  //         // 如果以冒号结尾，需检查替换后是否冒号缺失
  //         this.checkColon(filename, newCode)
  //         return ts.factory.createIdentifier(`{i18n('${this.findKey(node.text.trim()).key}')}`);
  //       }
  //     };

  //     return ts.visitEachChild(node, visitor, context);
  //   }
  //   return function (node) {
  //     return ts.visitNode(node, visitor);
  //   };
  // }

  replaceKey = (node, { prevKey, keyStr }, filename) => {
    let newNode = node;
    if (prevKey) {
      const text = (this.config.replaceWordMap || {})[prevKey];
      if (text) {
        const newKeyInfo = this.findKey(text, this.baseWordMap);

        if (newKeyInfo) {
          newNode = ts.factory.createIdentifier(keyStr.replace(prevKey, newKeyInfo.key));
          // 标记需要替换的文件
          this.filenameMap[filename].isReplace = true;

          // 记录替换的key
          this.replaceKeyMap[filename] = this.replaceKeyMap[filename] || {};
          this.replaceKeyMap[filename][newKeyInfo.key] = {
            prevKey,
            code: keyStr.replace(prevKey, newKeyInfo.key),
            oldCode: keyStr,
            text
          }
        } else {
          // 在替换范围，但是新字典没有这条文案
          this.replaceNotFindKeyMap[filename] = this.replaceNotFindKeyMap[filename] || {};
          this.replaceNotFindKeyMap[filename][prevKey] = {
            oldCode: keyStr,
            text
          }
        }
      } else {
        // 已使用的key不在替换范围之内
        this.notReplaceKeyMap[filename] = this.notReplaceKeyMap[filename] || {};
        this.notReplaceKeyMap[filename][prevKey] = {
          prevKey,
          oldCode: keyStr,
        }
      }
    }

    return newNode;
  }

  // 收集待翻译文案
  collectText = (filename, node, newCode, type) => {
    this.textMap[newCode] = this.textMap[newCode] || [];
    const source = node.getText().trim()
    this.textMap[newCode].push({
      filename,
      type,
      source,
      newCode
    })
    return node;
  }

  createWordMap = async () => {
    this.wordMap = { ...this.baseWordMap };
    // 获取需要翻译的字段
    const words = [];
    Object.keys(this.textMap).forEach(text => {
      const info = this.findKey(text);
      if (info) {
        this.findKeys[info.key] = info.currText === info.prevText ? info.currText : { prevText: info.prevText, currText: info.currText };
      } else {
        words.push(this.textMap[text])
      }
    })
    // 翻译文案
    if (words.length) {
      const newMap = await this.translate(words);
      // 更新字典
      this.wordMap = { ...this.wordMap, ...newMap };
      this.newMap = newMap;
    }
  }

  getResolveKey = (transResult, result) => {
    const { area, moduleName, point } = this.config;
    const dst = transResult.map(it => it.dst).join(' ')
    // 去除翻译后的特殊符号 ${}[]、\/。，,.？"#$¥%*【】?！@#¥%&*（）——+=-_!$[];><《》、
    const str = dst.replace(/\$|\{|\}|\\|\/|\.|,|\?|:|`|\(|\)|'|"|;|-|&|_|\*|（｜）|。|，|？|：|！|@|#|¥|%|（|）|——|\!|\[|\]|\+|=|、|<|>|《|》|【|】/g, ' ');
    const arr = str.split(' ').filter(it => it);
    // 默认取前5个单词
    let wordKey = getWordKey(arr);
    let resolveKey = [area, moduleName, point, wordKey].filter(it => it).join('.')
    let checkErrorInfo; // 若没有找到不同，须记录提示信息

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
          message: `在旧字典中查到相同的取值key：${resolveKey}`,
          texts: {
            prev: this.baseWordMap[resolveKey], // 之前翻译的信息
            curr: undefined // 当前翻译文案
          }
        }
      }
    }

    /**
     * 新翻译的文案处理
     */
    // 校验 key 是否重复，若有重复则说明两条文案虽不同，但翻译后前5个单词相同
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
        // 若新旧翻译均未找到不同，则两条不同的文案有相同的英文翻译
        if (!unlike) {
          checkErrorInfo = {
            message: `两条不同的文案有相同的英文翻译，得到相同的取值key：${resolveKey}`,
            texts: {
              prev: this.transResult[resolveKey], // 之前翻译的信息
              curr: undefined // 当前翻译文案
            }
          }
        } else {
          // 修改旧文案的记录信息
          const prevKey = `${resolveKey}${firstToUpperCase(unlike)}`;
          this.transResult[prevKey] = this.transResult[resolveKey];
          result[prevKey] = result[resolveKey];
        }
      }
    }
    return { wordKey, resolveKey, target: arr, checkErrorInfo };
  }

  translateErrorLog = (words, info) => {
    words.forEach(item => {
      this.translateError[item.filename] = {
        [item.newCode]: {
          words,
          ...info
        },
        ...this.translateError[item.filename] // 合并之前的错误项
      }
    })
  }

  translate = async (words) => {
    return new Promise(resolve => {
      let result = {};
      const fn = (index) => {
        const word = words[index] && words[index][0] && words[index][0].newCode;
        if (!word) {
          resolve(result)
        } else {
          fetchTranslate(word).then(res => {
            console.log(res.data, '==res===', word)
            const transResult = res.data.trans_result;
            // 如果未翻译成功，记录手动处理
            if (!transResult) {
              this.translateErrorLog(words[index], { message: res.data })
            } else {
              // 获取key
              const { wordKey, resolveKey, target, checkErrorInfo } = this.getResolveKey(transResult, result);
              // 特殊情况翻译后包含中文、getResolveKey 返回有错误信息，需记录，手动处理 
              const t = target.join('');
              if (/.*[\u4e00-\u9fa5]+.*/.test(t) || checkErrorInfo) {
                // 记录错误出错文案信息
                checkErrorInfo.texts.curr = {
                  target,
                  source: word,
                  info: words[index],
                }
                this.translateErrorLog(words[index], { message: '翻译后包含中文，需手动处理 ', resolveKey, ...checkErrorInfo })
              } else {
                // 记录翻译信息
                this.transResult[resolveKey] = {
                  target,
                  source: word,
                  info: words[index],
                };
                result[resolveKey] = word;
              }
              console.log(`共${words.length}, 第${index + 1}完毕： `, wordKey, word)
            }
            setTimeout(() => {
              fn(index + 1)
            }, 1000)
          })
        }
      }
      fn(0)
    })
  }

  // 节点处理
  compileHandler = (node, ndeType, type, filename) => {
    console.log(ndeType, type, filename, '==compileHandler-type==')

    return node;
  }

  compile = (type) => {
    Object.keys(this.filenameMap).forEach(filename => {
      this.baseCompile(filename, (node, ndeType) => this.compileHandler(node, ndeType, type, filename));
    })
  }

  writeNewCode = () => {
    Object.keys(this.filenameMap).forEach(async filename => {
      await this.overwrite(filename)
    })
  }

  writeLog = () => {
    const importFile = []; // 查询到的引用文件
    const replaceFile = []; // 替换文案的文件
    const noReplace = []; // 不用替换的文件
    const writeError = []; // 复写格式化出错
    // 替换已有key为新字典的key
    const replaceKeyMap = [];
    const replaceNotFindKeyMap = [];
    const notReplaceKeyMap = [];

    const wordList = Object.keys(this.textMap); // 处理文案集合
    const newWordMap = this.newMap; // 新建文案集合
    const handler = {}; // 需手动处理的文件
    let handlerLen = 0; // 需手动处理的个数

    Object.keys(this.filenameMap).forEach(filename => {
      importFile.push(filename)
      if (this.filenameMap[filename].isReplace) {
        replaceFile.push(filename);

        replaceKeyMap.push(...Object.keys((this.replaceKeyMap[filename] || {})))
      } else {
        noReplace.push(filename)
      }

      if (this.replaceNotFindKeyMap[filename]) {
        replaceNotFindKeyMap.push(...Object.keys(this.replaceNotFindKeyMap[filename]))
      }
      if (this.notReplaceKeyMap[filename]) {
        notReplaceKeyMap.push(...Object.keys(this.notReplaceKeyMap[filename]))
      }

      if (this.filenameMap[filename].isWriteError) {
        writeError.push(filename)
      }
      if (this.filenameMap[filename].handler) {
        handler[filename] = this.filenameMap[filename].handler;
        handlerLen += Object.keys(handler[filename]).length;
      }
    })

    this.log = {
      importFile,
      replaceFile,
      noReplace,
      excludeMap: this.excludeMap,
      wordList,
      findKeys: this.findKeys,
      prevKeys: this.prevKeys,
      diffKeys: this.diffKeys,
      prevKeysError: this.prevKeysError,
      newWordMap,
      writeError,
      replaceKeyMap: this.replaceKeyMap, // 已替换的key
      replaceNotFindKeyMap: this.replaceNotFindKeyMap, // 在替换范围，但新字典未找到的key
      notReplaceKeyMap: this.notReplaceKeyMap, // 不在替换范围内的key
      handler,
      giveUp: this.giveUpMap,
    }

    if (this.config.transResult) {
      this.log = {
        ...this.log,
        transResult: this.transResult,
        translateError: this.translateError
      }
    }

    const giveUpLen = Object.keys(this.giveUpMap).length;
    log.red('============================================================')
    log.red('============================================================')
    log.red('============================================================')
    log.red('------------------------------------------------------------')
    log.green(`importFile: 共查找依赖文件 ${importFile.length + giveUpLen} 个`)
    log.green(`replaceFile: 替换文案的文件 ${replaceFile.length} 个`)
    log.green(`noReplace: 无需替换文案的文件 ${noReplace.length} 个`)
    log.green(`giveUp: 放弃编译文件 ${giveUpLen} 个`)
    log.green(`writeError: 格式化覆盖出错文件 ${writeError.length} 个`)
    log.red('------------------------------------------------------------')
    log.green(`prevKeys: 代码中已有key ${Object.keys(this.prevKeys).length} 个`)
    log.green(`prevKeysError: 搜集 prevKeys 时的未知错误 ${Object.keys(this.prevKeysError).length} 个`)
    log.green(`diffKeys: 代码中已有i18n函数引用的key与当前字典中key的差异 ${Object.keys(this.diffKeys).length} 个`)
    log.green(`wordList: 扫描到文案 ${wordList.length} 个`)
    log.green(`findKeys: 复用文案 ${Object.keys(this.findKeys).length} 个`)
    log.green(`newWordMap: 新建文案 ${Object.keys(newWordMap).length} 个`)
    log.green(`replaceKeyMap: 已替换的key ${replaceKeyMap.length} 个`)
    log.green(`replaceNotFindKeyMap: 在替换范围，但新字典未找到的key ${replaceNotFindKeyMap.length} 个`)
    log.green(`notReplaceKeyMap: 不在替换范围内的key ${notReplaceKeyMap.length} 个`)
    log.red('------------------------------------------------------------')
    log.green(`handler: 需手动复核 ${Object.keys(handler).length} 个文件，共 ${handlerLen} 处`)
    log.red('------------------------------------------------------------')
    log.green('具体信息请在配置文件中添加 getLog 属性（function）获取')
    log.red('------------------------------------------------------------')
    log.red('============================================================')
    log.red('============================================================')
    log.red('============================================================')
    this.config.getLog && this.config.getLog(this.log);
  }
  
  start = async () => {
    //  建立依赖图谱，获取现有字典
    log.red('初始化...')
    await this.init();
    console.log(this.PADDING);
    // 初始化失败，阻断程序执行
    if (this.PADDING) return;

    console.log(this.config.type, '==this.config.replaceKey==', HANDLER_REPLACE)
    const type = this.config.type;

    switch (type) {
      case HANDLER_REPLACE: // 替换已有key为新字典的key
        this.compile(REPLACE_PRE_KEY);
        break;
      default:
        this.compile()
    }

    // // 替换已有key为新字典的key
    // if (this.config.replaceKey) {
    //   this.compile(REPLACE_PRE_KEY);

    //   // 格式化输出
    //   log.green('格式化输出新代码')
    //   this.writeNewCode();
    // } else {
    //   // 收集文案
    //   log.green('开始收集需要替换的文案')
    //   this.compile(COLLECT);
    // }

    // /**
    //  * this.config.replaceKey -替换已有key为新字典的key
    //  * this.config.getPrevKeys - 只收集已在文案中的 key 
    //  * this.config.diffKeys - 对比当前已使用的 key 和当前字典的差异
    //  */
    // if (!this.config.getPrevKeys && !this.config.diffKeys && !this.config.replaceKey) {
    //   // 建立新字典
    //   log.red('开始创建新字典')
    //   await this.createWordMap();
    //   // 替换文案
    //   log.green('开始依次替换文案')
    //   this.compile(HANDLER_REPLACE)
    //   // 格式化输出
    //   log.green('格式化输出新代码')
    //   this.writeNewCode();
    // }
    // // 信息打印
    // this.writeLog();
  }
}

module.exports = TsxI18n
