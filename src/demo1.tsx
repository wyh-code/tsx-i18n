import React, { FC, useRef, useState } from 'react';
import i18n from '@/config/i18n';
import PageHeader from '@/components/PageHeader';
import { getUrlParams } from '@/utils/globalFn';
import List from './List';
import Search, { ISearchValues } from './Search';

interface IEntryListPageProps {

}

const getStyles = (str?) => {
  const zh = '函数内部的中文';
  return 'getStyles'
}

const info = {
  user: {
    age: 18
  },
  name: 'jack'
}


const EntryListPage: FC<IEntryListPageProps> = () => {
 const str1 = '这是一个模版字符串说明啊'
  const str2 = '这是一个模版字符串说明啊。'

  return (
    <div>11</div>
  );
};

export default EntryListPage;
