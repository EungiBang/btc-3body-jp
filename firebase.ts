
// Firebase SDK를 초기화하고 Firestore 및 Auth 인스턴스를 제공하는 서비스 설정
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigLocal from './firebase-applet-config.json';

// Vite 빌드 타임 환경 변수 확인
const apiEnv = import.meta.env;

const resolvedConfig = apiEnv.VITE_FIREBASE_API_KEY ? {
  apiKey: apiEnv.VITE_FIREBASE_API_KEY,
  authDomain: apiEnv.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: apiEnv.VITE_FIREBASE_PROJECT_ID,
  storageBucket: apiEnv.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: apiEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: apiEnv.VITE_FIREBASE_APP_ID
} : firebaseConfigLocal;

// Initialize Firebase SDK
const app = initializeApp(resolvedConfig);

// Use the default database
export const db = getFirestore(app);
export const auth = getAuth(app);
