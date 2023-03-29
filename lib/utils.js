
const COLLECT = 'collect' // 收集
const REPLACE = 'replace' // 替换
const REPLACE_PRE_KEY = 'replacePreKey' // 替换正在使用的key为新字典的key

const log = {
  red: (...args) => console.log('\x1B[31m%s\x1B[0m', ...args),
  green: (...args) => console.log('\x1B[32m%s\x1B[0m', ...args),
}

module.exports = {
  COLLECT,
  REPLACE,
  REPLACE_PRE_KEY,
  log
}
