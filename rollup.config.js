const commonjs = require('rollup-plugin-commonjs');
// const { babel } = require('@rollup/plugin-babel');

module.exports = {
  input: './lib/index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'cjs'
  },
  plugins: [
    commonjs(),
    // babel({
    //   "presets": ['@babel/preset-env'],
    // }),
  ],
};