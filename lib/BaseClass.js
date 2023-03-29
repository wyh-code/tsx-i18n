const path = require('path');
const axios = require('axios')
const md5 = require('md5');

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

  // 拼接绝对路径
  splicePath = (name, root) => {
    let pathName = name;

    // 相对路径开头
    if (/^\./.test(name)) {
      const dir = root.split('/').slice(0, -1).join('/');
      pathName = path.join(dir, name)
    }

    // 相对项目根路径
    if (/^\@\//.test(name)) {
      pathName = name.replace(/^\@\//, `${this.rootPath}/src/`)
    }

    return pathName;
  }

  // 查询已有key
  findKey = (currText, wordMap = this.wordMap) => {
    const current = [currText]

    // 如果文案以冒号结尾
    if (/(:|：)$/.test(currText)) {
      current.push(currText.slice(0, -1))
    }

    let key;
    let prevText;
    for (let k in wordMap) {
      if (current.includes(wordMap[k])) {
        prevText = wordMap[k];
        key = k;
        break;
      }
    }
    return key ? { key, prevText, currText } : key;
  }

  /**
   * 收集的文本最外层包含引号、前后空格,需要清理
   */
  clearText = (text) => {
    return text.trim().slice(1, -1).trim();
  }

  // 根据翻译获取字段编码
  getWordKey = (keys, len = 5) => {
    // 默认获取前5个单词
    return keys.slice(0, len).map(key => key.toLowerCase()).map((it, index) => {
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
    const data = []
    let newCode = code.replace(/\${(.*?)}/g, (a, b, c, d) => {
      const key = b.replace(/\??\./g, '_')

      if (/\(.*\)/.test(b)) {
        // 函数调用 `str ${fn()}`
        data.push(`'${key}': ${b}`);
      } else {
        data.push(`${key}: ${b}`)
      }

      return a.replace(b, `${key}`)
    }).replace(/`/g, "") // 去除反引号

    return { newCode, data };
  }
}

module.exports = BaseClass;
