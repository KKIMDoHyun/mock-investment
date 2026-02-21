import { useEffect, useRef } from "react";
import { getToken } from "firebase/messaging";
import { getFirebaseMessaging } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";
import { sanitizeNotifLink } from "@/store/notificationStore";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

/**
 * SW가 active 상태가 될 때까지 대기합니다.
 * 이미 active이면 즉시 resolve, installing/waiting이면 statechange를 기다립니다.
 */
function waitForServiceWorkerActive(reg: ServiceWorkerRegistration): Promise<void> {
  return new Promise((resolve) => {
    if (reg.active) {
      resolve();
      return;
    }

    const sw = reg.installing ?? reg.waiting;
    if (!sw) {
      resolve();
      return;
    }

    const handler = (e: Event) => {
      if ((e.target as ServiceWorker).state === "activated") {
        sw.removeEventListener("statechange", handler);
        resolve();
      }
    };
    sw.addEventListener("statechange", handler);
  });
}

/**
 * FCM 푸시 토큰을 수집하고 Supabase push_tokens 테이블에 저장합니다.
 * 알림 클릭 시 SW가 postMessage로 보낸 링크를 받아 SPA 라우팅으로 이동합니다.
 *
 * - 로그인 상태일 때만 실행
 * - 알림 권한 요청 → 거부 시 조용히 종료
 * - SW active 확인 후 getToken() 호출
 * - token upsert: onConflict("token") → 중복 저장 없음
 */
export function usePushToken(userId: string | undefined) {
  const registeredRef = useRef(false);

  // ── SW → 앱 postMessage 수신 (탭이 열린 상태에서 알림 클릭 시 이동) ──
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "FCM_NOTIFICATION_CLICK" && event.data?.link) {
        // DB 트리거 등에서 잘못 저장된 링크도 이 시점에 정규화
        const link: string = sanitizeNotifLink(event.data.link) ?? "/";
        if (link.startsWith("http") && !link.startsWith(window.location.origin)) {
          window.open(link, "_blank");
        } else {
          window.location.href = link;
        }
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, []);

  // ── FCM 토큰 등록 ──
  useEffect(() => {
    if (!userId || registeredRef.current) return;

    let cancelled = false;

    async function registerToken() {
      try {
        // FCM 지원 여부 확인 (Safari 구버전 등은 null 반환)
        const messaging = await getFirebaseMessaging();
        if (!messaging || cancelled) return;

        // 브라우저 알림 권한 명시적 요청
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.warn("[usePushToken] 알림 권한 거부됨 — 푸시 알림이 비활성화됩니다.");
          return;
        }
        if (cancelled) return;

        // Service Worker 등록 (이미 등록된 경우 기존 것을 반환)
        const swRegistration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/" }
        );

        // SW가 active 상태일 때까지 대기
        // (installing → waiting → active 단계 완료 전에 getToken()하면 실패)
        await waitForServiceWorkerActive(swRegistration);

        if (cancelled) return;

        // FCM 토큰 발급 (VAPID 키 + SW를 명시적으로 연결)
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swRegistration,
        });

        if (!token) {
          console.warn("[usePushToken] FCM 토큰 발급 실패 — VAPID 키 또는 Firebase 콘솔 설정을 확인하세요.");
          return;
        }
        if (cancelled) return;

        console.log("[usePushToken] FCM 토큰 발급 완료");

        // Supabase push_tokens 테이블에 upsert
        // onConflict: "token" → 같은 토큰이 있으면 updated_at만 갱신
        const { error } = await supabase.from("push_tokens").upsert(
          {
            user_id: userId,
            token,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "token" }
        );

        if (error) {
          console.error("[usePushToken] 토큰 저장 실패:", error.message);
          return;
        }

        console.log("[usePushToken] 토큰 저장 완료 ✓");
        registeredRef.current = true;
      } catch (err) {
        if (!cancelled) {
          console.warn("[usePushToken] 토큰 등록 중 오류:", err);
        }
      }
    }

    registerToken();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
