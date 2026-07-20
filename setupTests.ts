// 로컬 테스트 실행 시 필요한 전역 모킹 및 Jest-DOM 확장을 설정하는 파일.

import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Firebase SDK 모킹
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
}));

// 글로벌 fetch 모킹 (필요시 각 테스트에서 개별 재정의 가능)
vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
));
