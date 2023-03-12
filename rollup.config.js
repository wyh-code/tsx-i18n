const { babel } = require('@rollup/plugin-babel');

module.exports = {
  input: './lib/index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'cjs'
  },
  plugins: [
    babel({
      "presets": ['@babel/preset-env'],
    }),
  ],
};