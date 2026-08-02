// 전각 문자를 반각 문자로 변환하는 등의 문자열 처리 유틸리티 함수
export const toHalfWidth = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ');
};
