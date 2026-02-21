// Firebase SDK를 importScripts로 로드 (Service Worker 환경에서는 ESM 불가)
// CDN 버전은 npm 배포보다 느리게 갱신되므로 확인된 안정 버전으로 고정
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

/**
 * SW 업데이트 시 "waiting" 상태를 건너뛰고 즉시 활성화합니다.
 * 이 핸들러가 없으면 CDN 버전을 바꿔도 기존 SW가 계속 살아있어
 * onBackgroundMessage가 새 버전에서 등록되지 않습니다.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

/**
 * 활성화 즉시 현재 열린 모든 탭을 이 SW가 제어하도록 합니다.
 * 탭을 새로 고침하지 않아도 새 SW 로직이 바로 적용됩니다.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ⚠️ Service Worker는 import.meta.env / process.env에 접근 불가
// .env.local의 VITE_FIREBASE_* 값과 반드시 동기화 유지
firebase.initializeApp({
  apiKey: "AIzaSyBLqlJo6e4CxGxb7DrU0xbse_rdtk-1bhQ",
  authDomain: "modumotu-c1b16.firebaseapp.com",
  projectId: "modumotu-c1b16",
  storageBucket: "modumotu-c1b16.firebasestorage.app",
  messagingSenderId: "918204897487",
  appId: "1:918204897487:web:824975f84a83a421ef3fba",
});

const messaging = firebase.messaging();

/**
 * 백그라운드 메시지 수신 핸들러.
 *
 * ⚠️ FCM 스펙: 이 핸들러는 페이로드에 "notification" 필드가 없는
 *    data-only 메시지일 때만 호출됩니다.
 *    Edge Function에서 notification 필드 없이 data 필드만 보내야 합니다.
 *
 * 앱이 백그라운드(탭 숨김) 또는 완전히 닫힌 상태에서도 수신됩니다.
 */
messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title ?? "새 알림";
  const body  = payload.data?.body  ?? "";
  const link  = payload.data?.link  ?? "/";

  // 시스템 알림 표시
  self.registration.showNotification(title, {
    body,
    icon: "/logo.png",
    badge: "/logo.png",
    tag: `fcm-${Date.now()}`,       // 중복 알림 방지용 태그
    requireInteraction: false,       // 자동으로 사라지도록
    data: { link },                  // notificationclick에서 꺼내 씀
  });
});

/**
 * 알림 클릭 핸들러.
 * - 이미 열린 탭이 있으면 포커스 후 해당 링크로 이동
 * - 없으면 새 탭을 열어 이동
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const link = event.notification.data?.link ?? "/";
  // 상대 경로도 처리할 수 있도록 origin 기준으로 절대 URL 생성
  const targetUrl = link.startsWith("http")
    ? link
    : new URL(link, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // 같은 origin의 탭 중 이미 열린 탭이 있으면 포커스 후 이동
        for (const client of windowClients) {
          if (
            new URL(client.url).origin === self.location.origin &&
            "focus" in client
          ) {
            client.focus();
            // postMessage로 앱에 라우팅 요청 (앱이 살아있으면 SPA 라우팅 동작)
            client.postMessage({ type: "FCM_NOTIFICATION_CLICK", link });
            return;
          }
        }
        // 열린 탭이 없으면 새 창
        return clients.openWindow(targetUrl);
      })
  );
});
