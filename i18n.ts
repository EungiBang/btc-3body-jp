// 다국어(i18n) 번역 및 일본어 로케일 설정을 관리하는 설정 파일
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import translationKO from './locales/ko.json';
import translationEN from './locales/en.json';
import translationJA from './locales/ja.json';

const resources = {
  ko: {
    translation: translationKO
  },
  en: {
    translation: translationEN
  },
  ja: {
    translation: translationJA
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    // 일본 지점용 서비스이므로 기본 언어를 일본어('ja')로 설정합니다.
    lng: 'ja', 
    fallbackLng: 'ja',
    debug: false,
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
