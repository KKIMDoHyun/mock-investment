import { initializeApp, getApps } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";
import type { Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

// 앱이 중복 초기화되지 않도록 기존 인스턴스를 재사용
export const firebaseApp =
  getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);

/**
 * FCM Messaging 인스턴스를 반환합니다.
 * Service Worker 및 Notification API를 지원하지 않는 환경(Safari 구버전 등)에서는 null을 반환합니다.
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(firebaseApp);
}
