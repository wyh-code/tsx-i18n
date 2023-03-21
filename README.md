### 这是一个替换tsx内中文文案的脚本。

## 使用方法
1、在项目根目录新建js脚本文件
```js
// i18n.js
const TsxI18n = require('tsx-i18n');

// 配置信息
const config = {
  area: 'area', // 业务场景
  moduleName: 'moduleName', // 业务模块
  point: 'point', // 功能点
  entry: '/src/index.tsx', // 入口文件，相对项目根路径地址
  transResult: true, // log 中是否包含翻译结果
  importI18n: `import i18n from '@/config/i18n';`, //
  prettierOption: {}, // 输出文件格式化配置
  exclude: (name) => { // 需要排除的文件
    // console.log(name, '==name==')
    return /api|config|utils/.test(name);
  },
  getWordMap: () => ({}), // 获取已有的文案字典
  getLog: (log) => { /*获取替换日志*/ },
};

const tsxI18n = new TsxI18n(config);
tsxI18n.init();
```

2、在命令行启动脚本
```js
  node i18n.js
```

## 工作原理
### 分析
1、在tsx代码中，文案类型可大致分为三类：string、templateString、jsxText。
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

### 替换流程
替换脚本从入口文件入手，通过编译入口文件获取所有依赖，并对依赖模块进行递归查找，建立依赖图谱。循环所有依赖模块，编译、收集文案。若文案已存在字典中，则不做处理，否则使用百度翻译对文案进行翻译，根据配置项生成取值key，更新字典。之后再次循环编译所有依赖，替换文案，并将替换后的代码覆写入原文件。

大致流程如下：
> 获取入口文件绝对路径 -> 获取所有本地依赖模块 -> 遍历所有依赖文件收集文案 -> 建立字典 -> 替换文案 -> 覆写文件。      

## 代码演示
### 一、基础替换
对于一般字符串、模版字符串、jsxText，脚本会直接替换。若模版字符串中包含变量，则会将变量提取，在词条中使用占位符代替变量，并将变量数据作为i18n函数的第二个参数传递。 

如下所示：
```js
  // 源代码
  ...
  const tem = `这是一个模版字符串-${str}`
  ...

  // 替换后代码
  ...
  const tem = i18n("area.moduleName.thisIsATemplateString", { str: str });
  ...

  // 字典词条
  {
    ...
    "area.moduleName.thisIsATemplateString": "这是一个模版字符串-${str}",
    ...
  }
```

demo 演示：
```js
  node index.js demo1
```

源代码：
```js
  import React, { FC, useRef, useState } from 'react';
  import i18n from '@/config/i18n';
  import PageHeader from '@/components/PageHeader';
  import { getUrlParams } from '@/utils/globalFn';
  import List from './List';
  import Search, { ISearchValues } from './Search';

  interface IEntryListPageProps {}

  const EntryListPage: FC<IEntryListPageProps> = () => {

    const str = '这是一个中文字符串'
    const tem = `这是一个模版字符串-${str}`

    const info = {
      user: {
        age: 18
      },
      name: '这是一个中文属性',
      adress: `这是一个中文模版字符串属性-${str}`
    }
  
    return (
      <div>
        <div>中文文案</div>
        <Component name="tom" age={`年龄是${info.user.age}`} />
      </div>
    );
  };

  export default EntryListPage;

```

替换后：
```js
  import React, { FC, useRef, useState } from "react";
  import i18n from "@/config/i18n";
  import PageHeader from "@/components/PageHeader";
  import { getUrlParams } from "@/utils/globalFn";
  import List from "./List";
  import Search, { ISearchValues } from "./Search";
  interface IEntryListPageProps {}
  const EntryListPage: FC<IEntryListPageProps> = () => {
    const str = i18n("area.moduleName.thisIsAChineseString");
    const tem = i18n("area.moduleName.thisIsATemplateString", { str: str });
    const info = {
      user: {
        age: 18,
      },
      name: i18n("area.moduleName.thisIsAChineseAttribute"),
      adress: i18n("area.moduleName.thisIsAChineseTemplate", { str: str }),
    };
    return (
      <div>
        <div>{i18n("area.moduleName.chineseCopy")}</div>
        <Component
          name="tom"
          age={i18n("area.moduleName.theAgeIsInfoUser", {
            info_user_age: info.user.age,
          })}
        />
      </div>
    );
  };
  export default EntryListPage;

```

log 记录：
```json
  {
    "importFile": [
      "/Users/mac/git/tsx-i18n/src/demo1.tsx"
    ],
    "replaceFile": [
      "/Users/mac/git/tsx-i18n/src/demo1.tsx"
    ],
    "noReplace": [],
    "excludeMap": {
      "/Users/mac/git/tsx-i18n/src/demo1.tsx": {
        "@/config/i18n": "不需要编译的引用",
        "@/utils/globalFn": "不需要编译的引用"
      }
    },
    "wordList": [
      "这是一个中文字符串",
      "这是一个模版字符串-${str}",
      "这是一个中文属性",
      "这是一个中文模版字符串属性-${str}",
      "中文文案",
      "年龄是${info_user_age}"
    ],
    "findWord": [],
    "newWordMap": {
      "area.moduleName.thisIsAChineseString": "这是一个中文字符串",
      "area.moduleName.thisIsATemplateString": "这是一个模版字符串-${str}",
      "area.moduleName.thisIsAChineseAttribute": "这是一个中文属性",
      "area.moduleName.thisIsAChineseTemplate": "这是一个中文模版字符串属性-${str}",
      "area.moduleName.chineseCopy": "中文文案",
      "area.moduleName.theAgeIsInfoUser": "年龄是${info_user_age}"
    },
    "writeError": [],
    "handler": {},
    "giveUp": {
      "/Users/mac/git/tsx-i18n/src/components/PageHeader": {
        "/Users/mac/git/tsx-i18n/src/components/PageHeader.tsx": "未找到",
        "/Users/mac/git/tsx-i18n/src/components/PageHeader/index.tsx": "未找到"
      },
      "/Users/mac/git/tsx-i18n/src/List": {
        "/Users/mac/git/tsx-i18n/src/List.tsx": "未找到",
        "/Users/mac/git/tsx-i18n/src/List/index.tsx": "未找到"
      },
      "/Users/mac/git/tsx-i18n/src/Search": {
        "/Users/mac/git/tsx-i18n/src/Search.tsx": "未找到",
        "/Users/mac/git/tsx-i18n/src/Search/index.tsx": "未找到"
      }
    }
  }
```

### 二、特殊情况处理
#### 1、模版字符串中包含三目运算
对于此类复杂的模版字符串，替换脚本不会进行文案替换。而是通过日志记录，提示用户手动替换。

demo 演示：
```js
  node index.js demo2
```

log记录：
```json
  {
    "importFile": [
      "/Users/mac/git/tsx-i18n/src/demo2.tsx"
    ],
    "replaceFile": [],
    "noReplace": [
      "/Users/mac/git/tsx-i18n/src/demo2.tsx"
    ],
    "excludeMap": {},
    "wordList": [],
    "findWord": [],
    "newWordMap": {},
    "writeError": [],
    "handler": {
      "/Users/mac/git/tsx-i18n/src/demo2.tsx": {
        "`我的名字是 ${true ? '张三' : 'zhangsan'}`": "包含三目判断、引号时需手动处理"
      }
    },
    "giveUp": {},
    "transResult": {},
    "translateError": {}
  }
```

#### 2、两条文案产生相同的取值key
文案取值key的生成法则为：默认获取翻译结果的前五个单词进行驼峰拼接，生成字段编码，然后和 `area`、`moduleName`、`point` 进行拼接。
```js
  // 取值key生成规则
  const resolveKey = [area, moduleName, point, wordKey].filter(it => it).join('.')
```
因此，若文案前段相同，极有可能获取相同字段编码。大致可分为以下四类：          

1、翻译后生成的取值key已存在旧字典中，但对应的中文文案不同
```js
  // 旧字典
  {
    ...
    "thisIsAChineseCopy": "这里是一条中文文案"
    ...
  }
  // 当前文案
  这是一条中文文案啊 -> This is a Chinese copy（thisIsAChineseCopy /*驼峰拼接后*/）
```
2、已有文案比当前文案短
```text
  这是一条中文文案 -> This is a Chinese copy （已有文案）
  这是一条中文文案重复 -> This is a Chinese copy repetition （当前文案）
```

3、已有文案比当前文案长
```text
  这是一条中文文案重复 -> This is a Chinese copy repetition（已有文案）
  这是一条中文文案 -> This is a Chinese copy（当前文案）
```
4、已有文案与当前文案不相同，但翻译结果相同
```text
  这是一条中文文案 -> This is a Chinese copy（已有文案）
  这是一条中文文案啊 -> This is a Chinese copy（当前文案）
```

对于以上三种情况，脚本采用以下处理策略：          
  - 若新获取的取值key已存在旧字典中，则该条文案不会被替换，并记录log信息，提示用户手动处理。
  - 遍历当前文案翻译单词，查找与已有文案翻译的不同，并在字段编码后拼接不同单词。
  - 遍历已有文案翻译，查找与当前文案翻译的不同，将不同单词拼接，产生新key，用新key替换翻译记录信息中的旧key。旧key让渡给当前文案，并记录信息。
  - 查找不到新老词条翻译的不同，当前文案不会被替换，并记录log信息，提示用户手动处理。

demo 演示：
```js
  node index.js demo3
```

#### 3、文案以冒号结尾
当文案以冒号结尾时，脚本在匹配取值key时，会匹配包含冒号和不包含冒号两种情况，并进行记录，提示用户检查结果是否缺失冒号。

demo 演示：
```js
  node index.js demo4
```


## 发布记录
2023-03-21
新增 `getPrveKeys` 属性。若该属性为 `true`，则脚本只会收集代码中已有的 `key`，并将收集的 `key` 写入 `log`，不会进行文案替换。         

如下所示：
```js
  // 配置信息
  const config = {
    ...
    getPrveKeys: true
    ...
  }
  
  // 源代码
  ...
  Message.error(i18n('employee.transaction.changeList.pleaseFillInAPiece'));
  ...

  // log 信息
  {
    ...
    "prveKeys": {
      ...
      "employee.transaction.changeList.pleaseFillInAPiece": "i18n('employee.transaction.changeList.pleaseFillInAPiece')"
      ...
    }
    ...
  }
```