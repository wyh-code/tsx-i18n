'use strict';

var path = require('path');
var fs = require('fs');
var typescript = require('typescript');
var prettier = require('prettier');
var axios = require('axios');
var md5 = require('md5');

class BaseClass {
  constructor(config) {
    this.config = config;

    // 项目根路径
    this.rootPath = process.cwd();

    // 代码格式化
    this.withParserOptions = {
      parser: "typescript",
      ...config.prettierOption
    };

    // 文案映射
    this.wordMap = {};
  }

  // 拼接绝对路径
  splicePath = (name, root) => {
    let pathName = name;

    // 相对路径开头
    if (/^\./.test(name)) {
      const dir = root.split('/').slice(0, -1).join('/');
      pathName = path.join(dir, name);
    }

    // 相对项目根路径
    if (/^\@\//.test(name)) {
      pathName = name.replace(/^\@\//, `${this.rootPath}src/`);
    }

    return pathName;
  }

  // 查询已有key
  findKey = (text) => {
    const wordMap = this.wordMap;
    const current = [text];

    // 如果文案以冒号结尾
    if (/(:|：)$/.test(text)) {
      current.push(text.slice(0, -1));
    }

    let key;
    for (let k in wordMap) {
      if (current.includes(wordMap[k])) {
        key = k;
        break;
      }
    }
    return key;
  }

  /**
   * 收集的文本最外层包含引号、前后空格,需要清理
   */
  clearText = (text) => {
    return text.trim().slice(1, -1).trim();
  }

  // 根据翻译获取字段编码
  getWordKey = (keys) => {
    // 默认获取前5个单词
    return keys.slice(0, 5).map(key => key.toLowerCase()).map((it, index) => {
      if (index) {
        return this.replaceStr(it)
      }
      return it
    }).join('')
  }

  // 获取入口文件绝对路径
  getEntryPath = () => {
    const entry = this.config.entry;
    const filename = path.join(this.rootPath, entry);
    // const filename = path.join(this.rootPath, entry);

    this.filenameMap[filename] = {};
    return filename;
  }

  // 百度翻译
  fetchTranslate(value) {
    /**
     * 百度翻译
     * APP ID：20220517001218904
     * 密钥：GzoTEwvPd9TCb2jXUAFN
     */
    const url = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
    const appid = '20220517001218904';
    const key = 'GzoTEwvPd9TCb2jXUAFN';
    const q = value;
    const salt = +new Date();
    const sign = md5(`${appid}${q}${salt}${key}`);

    const api = `${url}?q=${encodeURI(q)}&from=zh&to=en&appid=${appid}&salt=${salt}&sign=${sign}`;
    return axios.get(api);
  }

  // 首字母大写
  replaceStr(str) {
    // 首字母大写
    str = str.toLowerCase();
    var reg = /\b(\w)|\s(\w)/g; //  \b判断边界\s判断空格
    return str.replace(reg, function (m) {
      return m.toUpperCase()
    });
  }

  // 模版字符串替换
  replaceTemplate = (code) => {
    const data = [];
    let newCode = code.replace(/\${(.*?)}/g, (a, b, c, d) => {
      const key = b.replace(/\./g, '_');

      if (/\(.*\)/.test(b)) {
        // 函数调用 `str ${fn()}`
        data.push(`'${key}': ${b}`);
      } else {
        data.push(`${key}: ${b}`);
      }

      return a.replace(b, `${key}`)
    }).replace(/`/g, ""); // 去除反引号

    return { newCode, data };
  }
}

var BaseClass_1 = BaseClass;

const COLLECT$1 = 'collect'; // 收集
const REPLACE$1 = 'replace'; // 替换

const log$1 = {
  red: (...args) => console.log('\x1B[31m%s\x1B[0m', ...args),
  green: (...args) => console.log('\x1B[32m%s\x1B[0m', ...args),
};

var utils = {
  COLLECT: COLLECT$1,
  REPLACE: REPLACE$1,
  log: log$1
};

const { log, COLLECT, REPLACE } = utils;

class TsxI18n extends BaseClass_1 {
  constructor(config) {
    super(config);

    this.filenameMap = {};
    this.giveUp = {};
    this.excludeMap = {};
    this.textMap = {};
    this.newMap = {};

    // 翻译结果
    this.transResult = {};
    // 翻译错误
    this.translateError = {};
    // 复用的key
    this.findKeys = {};
    // 日志收集
    this.log = {};
  }

  // 记录不需要替换的文件
  checkExclude = (resolvedPath, moduleSpecifier) => {
    let exclude = this.config.exclude(moduleSpecifier);
    if (exclude) {
      this.excludeMap[resolvedPath] = this.excludeMap[resolvedPath] || {};
      this.excludeMap[resolvedPath][moduleSpecifier] = "不需要编译的引用";
    }
    return !exclude
  }

  getPathTransformer = (resolvedPath) => (context) => {
    const visitor = (node) => {
      if (typescript.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier.text;
        // 判断 i18n 是否已经导入
        if (moduleSpecifier === '@/config/i18n') {
          this.filenameMap[resolvedPath].importI18n = true;
        }
        if (
          /^(\.|\@\/)/.test(moduleSpecifier) && // 匹配本地文件引用
          !/\.less|\.css|\.scss|\.sass/.test(moduleSpecifier) && // 排除样式文件
          this.checkExclude(resolvedPath, moduleSpecifier) // 排除不需要替换的文件
        ) {
          let filename = this.splicePath(moduleSpecifier, resolvedPath);
          const filePath = filename;
          if (!/(.tsx)$/.test(filename)) {
            filename = `${filePath}.tsx`;
            // 如果直接添加后缀读取不到，则默认为导入了文件夹
            try {
              fs.readFileSync(filename, 'utf-8');
            } catch (err) {
              // 导入文件夹
              try {
                filename = `${filePath}/index.tsx`;
                fs.readFileSync(filename, 'utf-8');
              } catch (err) {
                // 如果不是.tsx文件和文件夹则放弃替换
                filename = undefined;
              }
            }
          }
          // 记录放弃替换的文件
          if (!filename) {
            this.giveUp[filePath] = {
              [`${filePath}.tsx`]: '未找到',
              [`${filePath}/index.tsx`]: '未找到',
            };
            return;
          }          // 缓存引用文件
          this.filenameMap[filename] = {};
          // 递归获取引用文件的引用
          this.getAllPath(filename);
        }
      }
      return typescript.visitEachChild(node, visitor, context);
    };
    return function (node) {
      return typescript.visitNode(node, visitor);
    };
  }

  getAllPath(filename) {
    const code = fs.readFileSync(filename, 'utf-8');
    const ast = typescript.createSourceFile(
      filename,
      code,
      typescript.ScriptTarget.ES2015,
      true,  /* setParentNodes */
      typescript.ScriptKind.TSX
    );
    typescript.transform(ast, [this.getPathTransformer(filename)]);
  }

  // 校验冒号结尾
  checkColon = (filename, newCode) => {
    if (/(:|：)$/.test(newCode)) {
      this.filenameMap[filename].handler = this.filenameMap[filename].handler || {};
      this.filenameMap[filename].handler[newCode] = '需检查替换后是否冒号缺失';
    }
  }

  // 校验翻译错误
  checkTranslate = (filename, newCode) => {
    const result = this.translateError[filename] && this.translateError[filename][newCode];
    if (result) {
      this.filenameMap[filename].handler = this.filenameMap[filename].handler || {};
      this.filenameMap[filename].handler[newCode] = {
        tip: '翻译出错',
        ...this.translateError[filename][newCode]
      };
    }
    return result;
  }

  replaceTransformer = (type, filename) => (context) => {
    const visitor = (node) => {
      // 排除已经替换的i18n 和 console
      if (typescript.isCallExpression(node) && /^(i18n\(|console)/.test(node.getText())) {
        return node;
      }
      // 模版字符串
      if (typescript.isTemplateLiteral(node) && /.*[\u4e00-\u9fa5]+.*/.test(node.getText())) {
        // 包含三目判断、引号时 需记录，手动处理
        if (/.*\?[^\.].*:.*/.test(node.getText()) || /'|"/.test(node.getText())) {
          this.filenameMap[filename].handler = this.filenameMap[filename].handler || {};
          this.filenameMap[filename].handler[node.getText()] = '包含三目判断、引号时需手动处理';
          return node;
        }
        // 标记需要替换的文件
        this.filenameMap[filename].isReplace = true;
        // 收集文案
        const { newCode, data } = this.replaceTemplate(node.getText().trim());
        if (type === COLLECT) {
          return this.collectText(filename, node, newCode, 'template')
        }
        // 如果当前文案翻译时出错，直接返回手动处理
        if (this.checkTranslate(filename, newCode)) return node;
        // 如果以冒号结尾，需检查替换后是否冒号缺失
        this.checkColon(filename, newCode);
        return typescript.factory.createIdentifier(`i18n('${this.findKey(newCode)}',{${data.join(',')}})`);
      }
      // 字符串
      if (typescript.isStringLiteral(node) && node.text && /.*[\u4e00-\u9fa5]+.*/.test(node.text)) {
        // 标记需要替换的文件
        this.filenameMap[filename].isReplace = true;
        // 清理文案前后引号及空格
        const newCode = this.clearText(node.getText());
        // 收集文案
        if (type === COLLECT) {
          return this.collectText(filename, node, newCode, 'string')
        }
        // 如果当前文案翻译时出错，直接返回手动处理
        if (this.checkTranslate(filename, newCode)) return node;
        // 如果以冒号结尾，需检查替换后是否冒号缺失
        this.checkColon(filename, newCode);
        // 变量声明 - 对象属性 - 中文参数 
        let newNode = typescript.factory.createIdentifier(`i18n('${this.findKey(newCode)}')`);
        // 组件属性 
        if (typescript.isJsxAttribute(node.parent)) {
          newNode = typescript.factory.createIdentifier(`{i18n('${this.findKey(newCode)}')}`);
        }
        return newNode;
      }

      // JSXText
      if (typescript.isJsxText(node) && node.text && /.*[\u4e00-\u9fa5]+.*/.test(node.text)) {
        // 标记需要替换的文件
        this.filenameMap[filename].isReplace = true;
        // 收集文案
        const newCode = node.getText().trim();
        if (type === COLLECT) {
          return this.collectText(filename, node, newCode, 'jsxText')
        }
        // 如果当前文案翻译时出错，直接返回手动处理
        if (this.checkTranslate(filename, newCode)) return node;
        // 如果以冒号结尾，需检查替换后是否冒号缺失
        this.checkColon(filename, newCode);
        return typescript.factory.createIdentifier(`{i18n('${this.findKey(node.text.trim())}')}`);
      }
      return typescript.visitEachChild(node, visitor, context);
    };
    return function (node) {
      return typescript.visitNode(node, visitor);
    };
  }

  // 收集待翻译文案
  collectText = (filename, node, newCode, type) => {
    this.textMap[newCode] = this.textMap[newCode] || [];
    const source = node.getText().trim();
    this.textMap[newCode].push({
      filename,
      type,
      source,
      newCode
    });
    return node;
  }

  createWordMap = async () => {
    // 获取已有文案
    this.oldWordMap = await this.config.getWordMap();
    this.wordMap = { ...this.oldWordMap };
    // 获取需要翻译的字段
    const words = [];
    Object.keys(this.textMap).forEach(text => {
      const key = this.findKey(text);
      if (key) {
        this.findKeys[key] = text;
      } else {
        words.push(this.textMap[text]);
      }
    });
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
    const dst = transResult.map(it => it.dst).join(' ');
    // 去除翻译后的特殊符号 ${}[]、\/。，,.？"#$¥%*【】?！@#¥%&*（）——+=-_!$[];><《》、
    const str = dst.replace(/\$|\{|\}|\\|\/|\.|,|\?|:|`|\(|\)|'|"|;|-|&|_|\*|（｜）|。|，|？|：|！|@|#|¥|%|（|）|——|\!|\[|\]|\+|=|、|<|>|《|》|【|】/g, ' ');
    const arr = str.split(' ').filter(it => it);
    // 默认取前5个单词
    let wordKey = this.getWordKey(arr);
    // 获取前缀
    const pre = [area, moduleName, point].filter(it => it);
    let resolveKey = `${pre.join('.')}.${wordKey}`;
    let checkErrorInfo; // 若没有找到不同，须记录提示信息
    // 校验 key 是否重复，若有重复则说明两条文案虽不同，但翻译后前5个单词相同
    if (this.transResult[resolveKey]) {
      // 获取已有的翻译结果
      const target = this.transResult[resolveKey].target;
      let unlike;
      // 在新翻译的单词中查找老翻译没有的单词
      unlike = arr.filter(item => !target.includes(item))[0];
      if (unlike) {
        // 若找到，则追加不同单词作为key
        wordKey = `${wordKey}${this.replaceStr(unlike)}`;
        resolveKey = `${pre.join('.')}.${wordKey}`;
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
          };
        } else {
          // 修改旧文案的记录信息
          const prevKey = `${resolveKey}${this.replaceStr(unlike)}`;
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
        }
      };
    });
  }

  translate = async (words) => {
    return new Promise(resolve => {
      let result = {};
      const fn = (index) => {
        const word = words[index] && words[index][0] && words[index][0].newCode;
        if (!word) {
          resolve(result);
        } else {
          this.fetchTranslate(word).then(res => {
            console.log(res.data, '==res===', word);
            const transResult = res.data.trans_result;
            // 如果未翻译成功，记录手动处理
            if (!transResult) {
              this.translateErrorLog(words[index], { message: res.data });
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
                };
                this.translateErrorLog(words[index], { message: '翻译后包含中文，需手动处理 ', resolveKey, ...checkErrorInfo });
              } else {
                // 记录翻译信息
                this.transResult[resolveKey] = {
                  target,
                  source: word,
                  info: words[index],
                };
                result[resolveKey] = word;
              }
              console.log(`共${words.length}, 第${index + 1}: `, wordKey, word);
            }
            setTimeout(() => {
              fn(index + 1);
            }, 1000);
          });
        }
      };
      fn(0);
    })
  }

  compile = (type) => {
    Object.keys(this.filenameMap).forEach(filename => {
      log.green(`开始编译： ${filename}`);
      const code = fs.readFileSync(filename, 'utf-8');
      const ast = typescript.createSourceFile(
        filename,
        code,
        typescript.ScriptTarget.ES2015,
        true,  /* setParentNodes */
        typescript.ScriptKind.TSX
      );
      const newAst = typescript.transform(ast, [this.replaceTransformer(type, filename)]);
      // 替换文案
      if (type === REPLACE) {
        const printer = typescript.createPrinter();
        let newCode = printer.printNode(typescript.EmitHint.SourceFile, newAst.transformed[0], ast);
        // 插入i18n引用
        const { isReplace, importI18n } = this.filenameMap[filename];
        if (isReplace && !importI18n) {
          newCode = `${importI18n}${newCode}`;
        }
        this.filenameMap[filename].newCode = newCode;
      }
    });
  }

  writeNewCode = () => {
    Object.keys(this.filenameMap).forEach(async filename => {
      const { newCode, isReplace } = this.filenameMap[filename];
      if (isReplace) {
        try {
          const options = await prettier.resolveConfig(filename);
          const output = prettier.format(newCode, { ...this.withParserOptions, ...options });
          fs.writeFileSync(filename, output, 'utf-8');
        } catch (err) {
          this.filenameMap[filename].isWriteError = true;
          fs.writeFileSync(filename, newCode, 'utf-8');
        }
      }
    });
  }

  writeLog = () => {
    const importFile = []; // 查询到的引用文件
    const replaceFile = []; // 替换文案的文件
    const noReplace = []; // 不用替换的文件
    const writeError = []; // 复写格式化出错
    const wordList = Object.keys(this.textMap); // 处理文案集合
    const findWord = Object.keys(this.findKeys); // 复用文案集合
    const newWordMap = this.newMap; // 新建文案集合
    const handler = {}; // 需手动处理的文件
    let handlerLen = 0; // 需手动处理的个数

    Object.keys(this.filenameMap).forEach(filename => {
      importFile.push(filename);
      if (this.filenameMap[filename].isReplace) {
        replaceFile.push(filename);
      } else {
        noReplace.push(filename);
      }
      if (this.filenameMap[filename].isWriteError) {
        writeError.push(filename);
      }
      if (this.filenameMap[filename].handler) {
        handler[filename] = this.filenameMap[filename].handler;
        handlerLen += Object.keys(handler).length;
      }
    });

    this.log = {
      importFile,
      replaceFile,
      noReplace,
      excludeMap: this.excludeMap,
      wordList,
      findWord,
      newWordMap,
      writeError,
      handler,
      giveUp: this.giveUp,
    };

    if (this.config.transResult) {
      this.log = {
        ...this.log,
        transResult: this.transResult,
        translateError: this.translateError
      };
    }

    const giveUpLen = Object.keys(this.giveUp).length;
    log.red('============================================================');
    log.red('============================================================');
    log.red('============================================================');
    log.red('------------------------------------------------------------');
    log.green(`importFile: 共查找依赖文件 ${importFile.length + giveUpLen} 个`);
    log.green(`replaceFile: 替换文案的文件 ${replaceFile.length} 个`);
    log.green(`noReplace: 无需替换文案的文件 ${noReplace.length} 个`);
    log.green(`giveUp: 放弃编译文件 ${giveUpLen} 个`);
    log.green(`writeError: 格式化覆盖出错文件 ${writeError.length} 个`);
    log.red('------------------------------------------------------------');
    log.green(`wordList: 处理文案 ${wordList.length} 个`);
    log.green(`findWord: 复用文案 ${findWord.length} 个`);
    log.green(`newWordMap: 新建文案 ${Object.keys(newWordMap).length} 个`);
    log.red('------------------------------------------------------------');
    log.green(`handler: 需手动复核 ${Object.keys(handler).length} 个文件，共 ${handlerLen} 处`);
    log.red('------------------------------------------------------------');
    log.green('具体信息请在配置文件中添加 getLog 属性（function）获取');
    log.red('------------------------------------------------------------');
    log.red('============================================================');
    log.red('============================================================');
    log.red('============================================================');
    this.config.getLog && this.config.getLog(this.log);
  }

  init = async () => {
    // 获取入口绝对路径
    const entryFile = this.getEntryPath();
    // 获取所有要替换的路径
    log.red('开始收集需要替换的路径');
    this.getAllPath(entryFile);
    // 收集文案
    log.green('开始收集需要替换的文案');
    this.compile(COLLECT);
    // 建立字典
    log.red('开始创建字典');
    await this.createWordMap();
    // 替换文案
    log.green('开始依次替换文案');
    this.compile(REPLACE);
    // 格式化输出
    log.green('格式化输出新代码');
    this.writeNewCode();
    // 信息打印
    this.writeLog();
  }
}

var lib = TsxI18n;

module.exports = lib;