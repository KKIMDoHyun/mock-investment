import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/ui/button";
import { Seo } from "@/hooks/useSeo";

export default function LoginScreen() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  // 이미 로그인 상태면 홈으로 리다이렉트
  useEffect(() => {
    if (user) {
      navigate({ to: "/" });
    }
  }, [user, navigate]);

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <Seo title="로그인" url="/login" noIndex />
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-background to-purple-950/30 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl shadow-2xl shadow-black/40 p-8 sm:p-10">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src="/logo.png"
              alt="모두모투"
              className="w-16 h-16 object-contain"
            />
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-2">
            모두모투
          </h1>
          <p className="text-muted-foreground text-center text-sm sm:text-base mb-8">
            로그인하고 모의 거래를 시작하세요
          </p>

          {/* Divider */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-3 text-muted-foreground">
                소셜 계정으로 시작하기
              </span>
            </div>
          </div>

          {/* Google Login Button */}
          <Button
            onClick={signInWithGoogle}
            variant="outline"
            className="w-full h-11 gap-3 text-foreground bg-white hover:bg-gray-50 border-gray-300 text-gray-700"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google로 계속하기
          </Button>

          {/* Footer note */}
          <p className="text-muted-foreground/60 text-xs text-center mt-6">
            로그인하면 서비스 이용약관에 동의하는 것으로 간주됩니다.
          </p>
        </div>

        {/* Bottom glow */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-indigo-500/10 blur-2xl rounded-full" />
      </div>
    </main>
  );
}
