翻译返回格式
```js
  // 成功格式
  {
    data:   {
      from: 'zh',
      to: 'en',
      trans_result: [ { src: '测试返回文案', dst: 'Test return copy' } ]
    } 
  }
  // 错误格式
  {
    data: { error_code: '54003', error_msg: 'Invalid Access Limit' }
  }
```
特殊文案记录
```jsx
  <div>{`${item.name} ${item.workNo} 甲方主管：${item.regularManagerName}(${item.regularManagerNickName}) ${item.projectName}`}</div>
  <div>{`甲方主管：${item.regularManagerName}${item?.regularManagerNickName ? `(${item?.regularManagerNickName})` : ''}`}</div>
  <div>{`共${dataSource?.length}条`}</div>
···
