import { useEffect } from "react";
import { Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { startPriceStream, stopPriceStream } from "@/store/tradingStore";
import Header from "@/components/Header";
import NicknameSetupModal from "@/components/NicknameSetupModal";
import TermsAgreementModal from "@/components/TermsAgreementModal";
import ChatWidget from "@/components/ChatWidget";
import InAppBrowserGuard from "@/components/InAppBrowserGuard";

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  // 바이낸스 실시간 가격 스트림 (전역 — 모든 페이지에서 동작)
  useEffect(() => {
    startPriceStream();
    return () => stopPriceStream();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
