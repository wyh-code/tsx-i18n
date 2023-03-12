
const COLLECT = 'collect' // 收集
const REPLACE = 'replace' // 替换

const log = {
  red: (...args) => console.log('\x1B[31m%s\x1B[0m', ...args),
  green: (...args) => console.log('\x1B[32m%s\x1B[0m', ...args),
}

module.exports = {
  COLLECT,
  REPLACE,
  log
}
