const commonjs = require('rollup-plugin-commonjs');

module.exports = {
  input: './lib/index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'cjs'
  },
  plugins: [
    commonjs(),
  ],
};