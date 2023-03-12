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
