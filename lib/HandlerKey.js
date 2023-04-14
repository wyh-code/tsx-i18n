const BaseClass = require('./BaseClass');

class HandlerKey extends BaseClass{
  constructor(config){
    super(config);
  }

  start = () => {
    console.log('HandlerKey start')
  }
}

module.exports = HandlerKey;
