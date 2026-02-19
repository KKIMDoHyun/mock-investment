import { useEffect } from "react";
import TradingChart from "@/components/TradingChart";
import TradingPanel from "@/components/TradingPanel";
import PositionsPanel from "@/components/PositionsPanel";
import {
  useTradingStore,
  startPriceStream,
  stopPriceStream,
} from "@/store/tradingStore";
import { useAuthStore } from "@/store/authStore";

// ── 현재가 표시 (독립 컴포넌트로 분리 → 가격 변동 시 이것만 리렌더) ──
function PriceDisplay() {
  const currentPrice = useTradingStore((s) => s.currentPrice);

  return (
    <p className="text-lg font-bold text-foreground tabular-nums leading-tight">
      {currentPrice > 0
        ? `$${currentPrice.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : "불러오는 중..."}
    </p>
  );
}

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const fetchPortfolio = useTradingStore((s) => s.fetchPortfolio);
  const fetchOpenPositions = useTradingStore((s) => s.fetchOpenPositions);
  const fetchClosedTrades = useTradingStore((s) => s.fetchClosedTrades);

  // 가격 스트림 시작/중지 (모듈 레벨 WebSocket)
  useEffect(() => {
    startPriceStream();
    return () => stopPriceStream();
  }, []);

  // 유저 데이터 로드
  useEffect(() => {
    if (user?.id) {
      fetchPortfolio(user.id);
      fetchOpenPositions(user.id);
      fetchClosedTrades(user.id);
    }
  }, [user?.id, fetchPortfolio, fetchOpenPositions, fetchClosedTrades]);

  return (
    <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4">
      {/* ── 상단 종목 정보 바 ── */}
      <div className="flex items-center gap-6 bg-card border border-border rounded-xl px-5 py-3">
        {/* 심볼 */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400 text-sm font-bold">
            ₿
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground leading-tight">
              BTC/USDT
            </h2>
            <p className="text-xs text-muted-foreground">바이낸스 · 선물</p>
          </div>
        </div>

        {/* 구분선 */}
        <div className="h-8 w-px bg-border" />

        {/* 현재가 — 독립 컴포넌트 */}
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">현재가</p>
          <PriceDisplay />
        </div>

        {/* 구분선 */}
        <div className="h-8 w-px bg-border hidden sm:block" />

        {/* 24시간 변동 — 추후 실제 데이터 연동 */}
        <div className="hidden sm:block">
          <p className="text-xs text-muted-foreground mb-0.5">24h 변동</p>
          <p className="text-sm font-semibold text-muted-foreground tabular-nums leading-tight">
            —
          </p>
        </div>

        <div className="h-8 w-px bg-border hidden md:block" />

        <div className="hidden md:block">
          <p className="text-xs text-muted-foreground mb-0.5">24h 최고가</p>
          <p className="text-sm font-semibold text-muted-foreground tabular-nums leading-tight">
            —
          </p>
        </div>

        <div className="h-8 w-px bg-border hidden md:block" />

        <div className="hidden md:block">
          <p className="text-xs text-muted-foreground mb-0.5">24h 최저가</p>
          <p className="text-sm font-semibold text-muted-foreground tabular-nums leading-tight">
            —
          </p>
        </div>

        <div className="h-8 w-px bg-border hidden lg:block" />

        <div className="hidden lg:block">
          <p className="text-xs text-muted-foreground mb-0.5">24h 거래량</p>
          <p className="text-sm font-semibold text-muted-foreground tabular-nums leading-tight">
            —
          </p>
        </div>
      </div>

      {/* ── 차트 + 주문 패널 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 flex-1">
        {/* 차트 */}
        <div className="bg-card border border-border rounded-xl overflow-hidden min-h-[500px]">
          <TradingChart />
        </div>

        {/* 주문 패널 */}
        <TradingPanel />
      </div>

      {/* ── 하단: 포지션 / 거래 내역 ── */}
      <PositionsPanel />
    </main>
  );
}
