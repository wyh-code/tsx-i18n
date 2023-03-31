const fs = require('fs')
const path = require('path')
const axios = require('axios')
const md5 = require('md5');

const log = {
  red: (...args) => console.log('\x1B[31m%s\x1B[0m', ...args),
  green: (...args) => console.log('\x1B[32m%s\x1B[0m', ...args),
}

// 首字母大写
const firstToUpperCase = (str) => {
  // 首字母大写
  str = str.toLowerCase();
  var reg = /\b(\w)|\s(\w)/g; //  \b判断边界\s判断空格
  return str.replace(reg, function (m) {
    return m.toUpperCase()
  });
}

// 根据翻译获取字段编码
const getWordKey = (keys, len = 5) => {
  // 默认获取前5个单词
  return keys.slice(0, len).map(key => key.toLowerCase()).map((it, index) => {
    if (index) {
      return firstToUpperCase(it)
    }
    return it
  }).join('')
}

// 模版字符串替换
const replaceTemplate = (code) => {
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

// 百度翻译
const fetchTranslate = (value) => {
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

// 查询已有key
const findKey = (currText, wordMap) => {
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

// 收集的文本最外层包含引号、前后空格,需要清理
const clearText = (text) => {
  return text.trim().slice(1, -1).trim();
}

// 拼接绝对路径
const splicePath = (name, resolvedPath, rootPath) => {
  let pathName = name;

  // 相对路径开头
  if (/^\./.test(name)) {
    const dir = resolvedPath.split('/').slice(0, -1).join('/');
    pathName = path.join(dir, name)
  }

  // 相对项目根路径
  if (/^\@\//.test(name)) {
    pathName = name.replace(/^\@\//, `${rootPath}/src/`)
  }

  return pathName;
}

const resolveFilename = (filename) => {
  const filePath = filename;
  if (!/(.tsx)$/.test(filename)) {
    filename = `${filePath}.tsx`;
    // 如果直接添加后缀读取不到，则默认为导入了文件夹
    try {
      fs.readFileSync(filename, 'utf-8')
    } catch (err) {
      // 导入文件夹
      try {
        filename = `${filePath}/index.tsx`;
        fs.readFileSync(filename, 'utf-8')
      } catch (err) {
        // 如果不是.tsx文件和文件夹则放弃替换
        filename = undefined
      }
    }
  }

  return filename;
}

const checkModuleSpecifier = (moduleSpecifier) => {
  /**
   * 匹配本地文件引用
   * 排除样式文件
   */
  return /^(\.|\@\/)/.test(moduleSpecifier) && !/\.less|\.css|\.scss|\.sass/.test(moduleSpecifier);
}

const checkType = (target) => {
  return Object.prototype.toString.call(target).replace(/.*\s(.*)\]/, (a, b, c) => b)
}

module.exports = {
  log,
  firstToUpperCase,
  getWordKey,
  replaceTemplate,
  fetchTranslate,
  findKey,
  clearText,
  splicePath,
  resolveFilename,
  checkModuleSpecifier,
  checkType
}
