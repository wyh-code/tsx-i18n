/**
 * 通用基础功能
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const {
  log,
  findKey,
  checkType,
  splicePath,
  resolveFilename,
  checkModuleSpecifier
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

    // 标记程序是否继续走下起
    this.PADDING = false;

    // 依赖文件
    this.filenameMap = {};
    // 排除的文件
    this.excludeMap = {};
    // 放弃文件
    this.giveUpMap = {};

    // 基础字典
    this.baseWordMap = {};
    // 文案映射
    this.wordMap = {};
  }

  // 校验、记录需排除的文件
  checkExclude = (resolvedPath, moduleSpecifier) => {
    let exclude = this.config.exclude(moduleSpecifier);
    if (exclude) {
      this.excludeMap[resolvedPath] = this.excludeMap[resolvedPath] || {};
      this.excludeMap[resolvedPath][moduleSpecifier] = "不需要编译的引用";
    }
    return !exclude
  }

  findKey = (currText, wordMap = this.wordMap) => {
    return findKey(currText, wordMap)
  }

  padding = () => this.PADDING = true;

  // 获取入口文件绝对路径
  getEntryPath = () => {
    const entry = this.config.entry;
    const filename = path.join(this.rootPath, entry);

    this.filenameMap[filename] = {};
    return filename;
  }

  // 放弃的文件
  giveUp = (filename, filePath) => {
    if (!filename) {
      this.giveUp[filePath] = {
        [`${filePath}.tsx`]: '未找到',
        [`${filePath}/index.tsx`]: '未找到',
      };
      return;
    };
  }

  getPathTransformer = (resolvedPath) => (context) => {
    const visitor = (node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier.text;
        // 判断 i18n 是否已经导入
        if (moduleSpecifier === '@/config/i18n') {
          this.filenameMap[resolvedPath].importI18n = true;
        }
        // 排除不需要替换的文件
        if (checkModuleSpecifier(moduleSpecifier) && this.checkExclude(resolvedPath, moduleSpecifier)) {
          let filename = splicePath(moduleSpecifier, resolvedPath, this.rootPath);
          const filePath = filename;
          filename = resolveFilename(filename);

          // 记录放弃替换的文件
          this.giveUp(filename, filePath);

          // 若引用文件未被缓存，则缓存引用文件
          if (filename && !this.filenameMap[filename]) {
            this.filenameMap[filename] = {};
            // 递归获取引用文件的引用
            this.getAllPath(filename)
          }
        }
      }
      return ts.visitEachChild(node, visitor, context);
    }
    return function (node) {
      return ts.visitNode(node, visitor);
    };
  }

  getAllPath(filename) {
    const code = fs.readFileSync(filename, 'utf-8');
    const ast = ts.createSourceFile(
      filename,
      code,
      ts.ScriptTarget.ES2015,
      true,  /* setParentNodes */
      ts.ScriptKind.TSX
    )
    ts.transform(ast, [this.getPathTransformer(filename)])
  }

  createFileMap = () => {
    // 获取入口绝对路径
    const entryFile = this.getEntryPath();
    // 获取所有要替换的路径
    this.getAllPath(entryFile);
  }

  formaterBaseWordMap = (data, index, url) => {
    const basename = path.basename(url);
    const name = basename.split('.')[0];
    let result = {}
    const str = data.split(`['${name}']`)[1];

    try{
      result = JSON.parse(str)['zh_CN'];
      return result
    }catch(err){
      log.red('请求结果不是默认格式，请自定义 formaterBaseWordMap 函数转换: ', url);

      this.padding();
    }
  }

  fetchBaseWordMap = (url, formaterBaseWordMap, index = 0) => {
    return axios.get(url).then(res => {
      if (formaterBaseWordMap) {
        res = formaterBaseWordMap(res.data, index, url);

        if(this.PADDING) return;

        if (!res) {
          log.red('formaterBaseWordMap 需返回处理后的结果！');
          this.padding();
        } else {
          if (checkType(res) !== 'Object') {
            log.red('formaterBaseWordMap 需返回 JSON 对象');
            this.padding();
          }
        }
      } else {
        try {
          res = JSON.parse(res);
        } catch (err) {
          log.red('请求到的 baseWordMap 不是 JSON 对象，请使用 formaterBaseWordMap 自行处理！');
          this.padding();
        }
      }
      return res;
    }).catch(err => {
      if (err.code === 'ERR_BAD_REQUEST') {
        log.red('baseWordMap 请求失败: ', err.message);
      } else {
        log.red('formaterBaseWordMap 函数报错: ', err.message);
      }
      this.padding();
    })
  }

  createBaseWordMap = async () => {
    const baseWordMap = this.config.baseWordMap;
    const formaterBaseWordMap = this.config.formaterBaseWordMap || this.formaterBaseWordMap;

    const type = checkType(baseWordMap);
    if (type === 'Object') {
      this.baseWordMap = baseWordMap;
    }
    if (type === 'String') {
      this.baseWordMap = await this.fetchBaseWordMap(baseWordMap, formaterBaseWordMap);
    }
    if (type === 'Array') {
      const noType = [];
      const fetchString = [];
      let wordMap = {};
      baseWordMap.forEach((item, index) => {
        if (!['Object', 'String'].includes(checkType(item))) {
          noType.push(item);
        }
        if (checkType(item) === 'Object') {
          wordMap = {
            ...wordMap,
            ...item
          }
        }
        if (checkType(item) === 'String') {
          fetchString.push({ url: item, index });
        }
      })

      // 存在不能处理的类型
      if (noType.length) {
        this.padding();
        log.red('baseWordMap 中以下类型不能处理：')
        log.red(noType)
      }

      if (this.PADDING) return;

      // 获取需要请求的数据
      if (fetchString.length) {
        const p = await Promise.allSettled(fetchString.map((item) => {
          return this.fetchBaseWordMap(item.url, formaterBaseWordMap, item.index)
        }))
        // 查找请求失败的
        const failed = [];
        p.forEach((item, index) => {
          if (!item.value) {
            failed.push(fetchString[index].url);
          }
        })

        if (failed.length) {
          this.padding();
          log.red('baseWordMap 中请求失败项：')
          log.red(failed.toString().split(','))
        }
        if (this.PADDING) return;

        this.baseWordMap = p.reduce((obj, data) => {
          return { ...obj, ...(data.value) }
        }, wordMap);
        // console.log(this.baseWordMap)
      }
    }
  }

  init = async () => {
    // 建立文件依赖图谱
    log.green('建立文件依赖图谱...')
    this.createFileMap();

    // 创建基础字典
    log.green('创建基础字典...')
    await this.createBaseWordMap()
  }
}

module.exports = BaseClass;
