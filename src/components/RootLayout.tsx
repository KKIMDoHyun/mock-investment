import { useEffect, useRef, useState } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Toaster, toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import {
  startPriceStream,
  stopPriceStream,
  useTradingStore,
  SYMBOLS,
} from "@/store/tradingStore";
import type { SymbolId } from "@/store/tradingStore";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NicknameSetupModal from "@/components/NicknameSetupModal";
import TermsAgreementModal from "@/components/TermsAgreementModal";
import ChatWidget from "@/components/ChatWidget";
import InAppBrowserGuard from "@/components/InAppBrowserGuard";
import SplashScreen from "@/components/SplashScreen";
import { Seo } from "@/hooks/useSeo";
import { showNotification } from "@/lib/notification";
import { useNotificationStore } from "@/store/notificationStore";
import { useNotification } from "@/hooks/useNotification";
import { playNotificationSound } from "@/lib/sound";
import { usePushToken } from "@/hooks/usePushToken";

const MIN_SPLASH_MS = 2000;

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const [isAppReady, setIsAppReady] = useState(false);
  const prefetchedRef = useRef(false);

  // 라우트 이동 시 스크롤 최상단으로
  // CommunityPage가 스크롤 복원 플래그(community_restore)를 갖고 있으면
  // 해당 페이지가 직접 복원하므로 여기서는 리셋을 건너뜁니다.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (sessionStorage.getItem("community_restore")) return;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  // notifications 테이블 Realtime 구독 (외부 알림 수신 + unreadCount 갱신)
  useNotification(user?.id);

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

  // ── 댓글 알림 실시간 구독 ──
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("comment-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            post_id: string;
            user_id: string;
            parent_id: string | null;
            content: string;
          };

          // 내가 작성한 댓글은 무시
          if (row.user_id === user.id) return;

          // notify_comments 설정 확인
          const { settings } = useNotificationStore.getState();
          if (!settings.notify_comments) return;

          // 작성자 닉네임 조회
          const { data: profile } = await supabase
            .from("profiles")
            .select("nickname")
            .eq("id", row.user_id)
            .single();
          const nickname = (profile?.nickname as string) ?? "누군가";

          // 1) 대댓글: 부모 댓글이 내 것인지 확인
          if (row.parent_id) {
            const { data: parentComment } = await supabase
              .from("comments")
              .select("user_id")
              .eq("id", row.parent_id)
              .single();

            if (parentComment?.user_id === user.id) {
              const title = `${nickname}님이 답글을 남겼습니다`;
              const body = row.content.slice(0, 80);
              const link = `/community/${row.post_id}`;

              // DB 저장 (locallyCreatedIds에 UUID 등록 → 훅의 Realtime 이벤트에서 이중 표시 방지)
              await useNotificationStore.getState().saveNotification({
                userId: user.id,
                type: "reply",
                title,
                body,
                link,
              });

              // 직접 표시 (saveNotification이 로컬 상태는 이미 업데이트하므로 UI만 처리)
              const { settings } = useNotificationStore.getState();
              if (settings.sound_enabled) playNotificationSound();

              if (document.visibilityState === "hidden") {
                showNotification(title, body, undefined, link);
              } else {
                toast.info(title, {
                  description: body,
                  action: { label: "보러가기", onClick: () => { window.location.href = link; } },
                });
              }
              return;
            }
          }

          // 2) 내 게시글에 새 댓글
          const { data: post } = await supabase
            .from("posts")
            .select("user_id")
            .eq("id", row.post_id)
            .single();

          if (post?.user_id === user.id) {
            const title = `${nickname}님이 댓글을 남겼습니다`;
            const body = row.content.slice(0, 80);
            const link = `/community/${row.post_id}`;

            await useNotificationStore.getState().saveNotification({
              userId: user.id,
              type: "comment",
              title,
              body,
              link,
            });

            const { settings } = useNotificationStore.getState();
            if (settings.sound_enabled) playNotificationSound();

            if (document.visibilityState === "hidden") {
              showNotification(title, body, undefined, link);
            } else {
              toast.info(title, {
                description: body,
                action: { label: "보러가기", onClick: () => { window.location.href = link; } },
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
