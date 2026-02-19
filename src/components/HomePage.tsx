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
    <p className="text-base sm:text-lg font-bold text-foreground tabular-nums leading-tight">
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
    <main className="flex-1 w-full px-2 sm:px-4 lg:px-8 py-2 sm:py-4 flex flex-col gap-2 sm:gap-4">
      {/* ── 상단 종목 정보 바 ── */}
      <div className="flex items-center gap-3 sm:gap-6 bg-card border border-border rounded-xl px-3 sm:px-5 py-2.5 sm:py-3">
        {/* 심볼 */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400 text-xs sm:text-sm font-bold">
            ₿
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground leading-tight">
              BTC/USDT
            </h2>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              바이낸스 · 선물
            </p>
          </div>
        </div>

        {/* 구분선 */}
        <div className="h-7 sm:h-8 w-px bg-border" />

        {/* 현재가 — 독립 컴포넌트 */}
        <div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">
            현재가
          </p>
          <PriceDisplay />
        </div>
      </div>

      {/* ── 차트 + 주문 패널 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-2 sm:gap-4 flex-1">
        {/* 차트 */}
        <div className="bg-card border border-border rounded-xl overflow-hidden min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]">
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
