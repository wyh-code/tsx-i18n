### 这是一个替换tsx文件内中文文案的脚本。

### 分析
1、在jsx代码中，文案类型可大致分为三类：string、templateString、jsxText。
```js
  const str = 'string';
  const templateStr = `template ${str}`;
  <div>jsxText</div>
```

2、其中string、templateString出现的位置也可大致分为三处：变量声明赋值、对象属性赋值、组件属性赋值。   
```js
  // 变量声明赋值
  const str = 'jack';
  const templateStr = `这是模版字符串 ${name}`;

  // 对象属性赋值
  const info = {
    name: 'tom',
    adress: `${str} 在杭州`
  }

  // 组件属性赋值
  <Component name="tom" age={`${age}`} />
```       
本仓库替换脚本基于以上场景分析进行文案替换。

## 代码演示
#### 一、基础替换
```js
  node index.js demo1
```
