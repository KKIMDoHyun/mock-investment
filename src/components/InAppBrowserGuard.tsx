import { useState, useEffect } from "react";
import { ExternalLink, AlertTriangle, Chrome, Globe } from "lucide-react";
import {
  detectInAppBrowser,
  openInChrome,
  getExternalBrowserGuide,
  type InAppBrowserInfo,
} from "@/lib/inAppBrowser";

/**
 * 인앱 브라우저 접속 시 전체 화면을 덮는 안내 오버레이.
 * 인앱 브라우저가 아니면 아무것도 렌더링하지 않습니다.
 */
export default function InAppBrowserGuard() {
  const [info, setInfo] = useState<InAppBrowserInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const detected = detectInAppBrowser();
    if (detected.isInApp) {
      setInfo(detected);

      // 안드로이드인 경우 자동으로 Chrome intent 시도
      if (detected.isAndroid) {
        // 약간의 딜레이 후 intent 시도 (UI를 먼저 보여주기 위해)
        const timer = setTimeout(() => {
          openInChrome();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // 인앱 브라우저가 아니거나 유저가 닫은 경우
  if (!info || dismissed) return null;

  const guide = getExternalBrowserGuide(info);

  return (
    <div className="fixed inset-0 z-[9999] bg-background/98 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-6">
        {/* 아이콘 */}
        <div className="w-20 h-20 bg-amber-500/15 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-amber-400" />
        </div>

        {/* 제목 */}
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold text-foreground">
            외부 브라우저로 접속해 주세요
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            현재{" "}
            <span className="text-foreground font-medium">
              {info.browserName}
            </span>{" "}
            인앱 브라우저로 접속 중입니다.
            <br />
            안전한 구글 로그인을 위해 외부 브라우저가 필요합니다.
          </p>
        </div>

        {/* 안내 카드 */}
        <div className="w-full bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
          {/* 안드로이드: 크롬 자동 열기 버튼 */}
          {info.isAndroid && (
            <button
              onClick={() => openInChrome()}
              className="w-full flex items-center justify-center gap-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              <Chrome className="w-5 h-5" />
              Chrome으로 열기
            </button>
          )}

          {/* URL 복사 버튼 */}
          <button
            onClick={() => {
              navigator.clipboard
                .writeText(window.location.href)
                .then(() => {
                  alert("URL이 복사되었습니다! 브라우저에 붙여넣기 해주세요.");
                })
                .catch(() => {
                  // clipboard API 실패 시 prompt 폴백
                  prompt("아래 URL을 복사해 브라우저에 붙여넣기 해주세요:", window.location.href);
                });
            }}
            className="w-full flex items-center justify-center gap-2.5 bg-secondary hover:bg-accent text-foreground font-medium py-3 px-4 rounded-lg transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
            URL 복사하기
          </button>

          {/* 가이드 텍스트 */}
          <div className="flex items-start gap-2.5 bg-secondary/50 rounded-lg px-3.5 py-3">
            <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground text-left leading-relaxed">
              {guide}
            </p>
          </div>
        </div>

        {/* 무시하고 계속하기 (로그인 없이 둘러볼 수 있도록) */}
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-2 transition-colors"
        >
          로그인 없이 계속 둘러보기
        </button>

        {/* 현재 URL 표시 */}
        <p className="text-[10px] text-muted-foreground/40 break-all px-4 select-all">
          {window.location.href}
        </p>
      </div>
    </div>
  );
}
