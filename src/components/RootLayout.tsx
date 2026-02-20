import { useEffect, useRef, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { useAuthStore } from "@/store/authStore";
import {
  startPriceStream,
  stopPriceStream,
  useTradingStore,
  SYMBOLS,
} from "@/store/tradingStore";
import type { SymbolId } from "@/store/tradingStore";
import Header from "@/components/Header";
import NicknameSetupModal from "@/components/NicknameSetupModal";
import TermsAgreementModal from "@/components/TermsAgreementModal";
import ChatWidget from "@/components/ChatWidget";
import InAppBrowserGuard from "@/components/InAppBrowserGuard";
import SplashScreen from "@/components/SplashScreen";

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
      <SplashScreen isLoading={!isAppReady} />
      <InAppBrowserGuard />
      <TermsAgreementModal />
      <Header />
      <Outlet />
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
