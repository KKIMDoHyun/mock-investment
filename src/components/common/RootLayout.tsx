import { useEffect, useRef, useState } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { useAuthStore } from "@/store/authStore";
import {
  startPriceStream,
  stopPriceStream,
  useTradingStore,
  SYMBOLS,
} from "@/store/tradingStore";
import type { SymbolId } from "@/store/tradingStore";
import Header from "./Header";
import Footer from "./Footer";
import NicknameSetupModal from "./NicknameSetupModal";
import TermsAgreementModal from "./TermsAgreementModal";
import ChatWidget from "./ChatWidget";
import InAppBrowserGuard from "./InAppBrowserGuard";
import SplashScreen from "./SplashScreen";
import { Seo } from "@/hooks/useSeo";
import { useNotificationStore } from "@/store/notificationStore";
import { useNotification } from "@/hooks/useNotification";
import { useCommentNotification } from "@/hooks/useCommentNotification";
import { usePushToken } from "@/hooks/usePushToken";

const MIN_SPLASH_MS = 2000;

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const [isAppReady, setIsAppReady] = useState(false);
  const prefetchedRef = useRef(false);

  // 라우트 이동 시 스크롤 최상단으로
  // community_restore 플래그는 /community로 돌아갈 때만 유효합니다.
  // 다른 페이지(내정보, 알림설정 등)로 이동할 때는 플래그 여부와 무관하게 최상단으로 이동합니다.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (pathname === "/community" && sessionStorage.getItem("community_restore")) return;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  // notifications 테이블 Realtime 구독 (외부 알림 수신 + unreadCount 갱신)
  useNotification(user?.id);

  // 댓글/대댓글 실시간 알림 구독
  useCommentNotification(user);

  // FCM 푸시 토큰 수집 (로그인 시 자동 실행)
  usePushToken(user?.id);

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSym = params.get("symbol");
    if (urlSym && urlSym in SYMBOLS) {
      useTradingStore.setState({ selectedSymbol: urlSym as SymbolId, currentPrice: 0 });
    }
    startPriceStream();
    return () => stopPriceStream();
  }, []);

  // ── 알림 스토어 초기화 (로그인 시) ──
  useEffect(() => {
    if (!user) {
      useNotificationStore.getState().reset();
      return;
    }
    useNotificationStore.getState().fetchNotifications(user.id);
    useNotificationStore.getState().fetchSettings(user.id);
    // 알림 권한 요청은 usePushToken 훅에서 FCM 토큰 발급과 함께 처리합니다.
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    if (loading || prefetchedRef.current) return;
    prefetchedRef.current = true;

    const minDelay = new Promise((r) => setTimeout(r, MIN_SPLASH_MS));

    const dataFetch = user
      ? Promise.all([
          useTradingStore.getState().fetchPortfolio(user.id),
          useTradingStore.getState().fetchOpenPositions(user.id),
          useTradingStore.getState().fetchPendingOrders(user.id),
        ])
      : Promise.resolve();

    Promise.all([minDelay, dataFetch]).then(() => setIsAppReady(true));
  }, [loading, user]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo url="/" />
      <SplashScreen isLoading={!isAppReady} />
      <InAppBrowserGuard />
      <TermsAgreementModal />
      <Header />
      <Outlet />
      <Footer />
      <NicknameSetupModal />
      <ChatWidget />
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            color: "var(--color-foreground)",
          },
        }}
      />
    </div>
  );
}
