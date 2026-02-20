import { useEffect, useRef, useState } from "react";
import { Outlet } from "@tanstack/react-router";
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

const MIN_SPLASH_MS = 2000;

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const [isAppReady, setIsAppReady] = useState(false);
  const prefetchedRef = useRef(false);

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

          // 닉네임 조회
          const { data: profile } = await supabase
            .from("profiles")
            .select("nickname")
            .eq("id", row.user_id)
            .single();
          const nickname = (profile?.nickname as string) ?? "누군가";

          // 1) 대댓글인 경우: 부모 댓글이 내 것인지 확인
          if (row.parent_id) {
            const { data: parentComment } = await supabase
              .from("comments")
              .select("user_id")
              .eq("id", row.parent_id)
              .single();

            if (parentComment?.user_id === user.id) {
              toast.info(`${nickname}님이 회원님의 댓글에 답글을 남겼습니다.`);
              return;
            }
          }

          // 2) 내가 작성한 게시글에 댓글이 달린 경우
          const { data: post } = await supabase
            .from("posts")
            .select("user_id")
            .eq("id", row.post_id)
            .single();

          if (post?.user_id === user.id) {
            toast.info(`${nickname}님이 회원님의 글에 댓글을 남겼습니다.`);
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
