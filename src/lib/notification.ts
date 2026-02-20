/**
 * 브라우저 Notification API 유틸리티
 *
 * - showNotification: 페이지가 hidden일 때만 시스템 알림, visible일 때는 무시(호출 측에서 toast 처리)
 * - requestNotificationPermission: 최초 1회만 권한 요청
 */

const DEDUP_MS = 1_000;
const STORAGE_KEY = "notif_asked";

/** 최근 표시된 알림 타임스탬프 맵 (중복 방지) */
const recentNotifs = new Map<string, number>();

/**
 * 브라우저 시스템 알림을 표시한다.
 * - 페이지가 visible 상태이면 무시 (호출 측에서 이미 Sonner toast를 표시함)
 * - Notification.permission !== "granted" 이면 무시
 * - 동일 title+body 가 DEDUP_MS 이내에 재호출되면 무시
 * - 알림 클릭 시 창 포커스 + 해당 링크로 이동
 */
export function showNotification(
  title: string,
  body: string,
  symbol?: string,
  link?: string
): void {
  if (typeof window === "undefined") return;

  // 페이지가 포그라운드면 시스템 알림 불필요 (인앱 toast로 충분)
  if (document.visibilityState !== "hidden") return;

  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const key = `${title}|${body}`;
  const now = Date.now();

  // 중복 방지
  if ((recentNotifs.get(key) ?? 0) + DEDUP_MS > now) return;
  recentNotifs.set(key, now);

  // 30초 이상 된 항목 정리 (메모리 누수 방지)
  for (const [k, ts] of recentNotifs) {
    if (now - ts > 30_000) recentNotifs.delete(k);
  }

  const notif = new Notification(title, {
    body,
    icon: "/logo.png",
    badge: "/logo.png",
    // 시스템 레벨 중복 방지 (같은 tag면 기존 알림을 교체)
    tag: key,
    requireInteraction: false,
  });

  notif.onclick = () => {
    window.focus();
    if (link) {
      window.location.href = link;
    } else if (symbol) {
      window.location.href = `/?symbol=${encodeURIComponent(symbol)}`;
    }
    notif.close();
  };
}

/**
 * 알림 권한을 요청한다.
 * - 이미 granted/denied 인 경우 즉시 반환 (API 재호출 없음)
 * - localStorage 에 플래그를 남겨 반복 요청 방지
 */
export async function requestNotificationPermission(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;

  // 이미 결정된 경우 재요청하지 않음
  if (Notification.permission !== "default") return;

  // 이전 세션에서 이미 요청한 경우 재요청하지 않음
  if (localStorage.getItem(STORAGE_KEY)) return;
  localStorage.setItem(STORAGE_KEY, "1");

  try {
    await Notification.requestPermission();
  } catch {
    // 구형 브라우저 callback 방식 폴백 (무시해도 무방)
  }
}
