import { useEffect, useState, useRef, memo } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { BarChart3, BookOpen, ChevronDown } from "lucide-react";
import { Seo } from "@/hooks/useSeo";
import TradingChart from "@/components/trading/TradingChart";
import OrderBook from "@/components/trading/OrderBook";
import TradingPanel from "@/components/trading/TradingPanel";
import PositionsPanel from "@/components/trading/PositionsPanel";
import { useTradingStore, SYMBOLS } from "@/store/tradingStore";
import type { SymbolId } from "@/store/tradingStore";
import { useAuthStore } from "@/store/authStore";
import AdSlot from "@/components/ads/AdSlot";
import { indexRoute } from "@/routes/index";

// ── 현재가 + 전일 대비 변동 표시 (독립 컴포넌트 → 가격 변동 시 이것만 리렌더) ──
const PriceDisplay = memo(function PriceDisplay() {
  const currentPrice = useTradingStore((s) => s.currentPrice);
  const openPrice = useTradingStore((s) => s.openPrices[s.selectedSymbol]);

  const hasRef = openPrice > 0 && currentPrice > 0;
  const change = hasRef ? currentPrice - openPrice : 0;
  const changeRate = hasRef ? (change / openPrice) * 100 : 0;
  const isUp = change >= 0;

  const colorClass = !hasRef
    ? "text-foreground"
    : isUp
      ? "text-red-500"
      : "text-blue-500";

  return (
    <div className="flex flex-col gap-0.5">
      <p className={`text-base sm:text-lg font-bold tabular-nums leading-tight ${colorClass}`}>
        {currentPrice > 0
          ? `$${currentPrice.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : "불러오는 중..."}
      </p>
      {hasRef && (
        <p className={`text-[10px] sm:text-xs tabular-nums leading-none ${colorClass}`}>
          {isUp ? "▲" : "▼"}
          {" "}
          {isUp ? "+" : ""}
          {change.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          {" "}
          ({isUp ? "+" : ""}{changeRate.toFixed(2)}%)
        </p>
      )}
    </div>
  );
});

const SYMBOL_LIST = Object.values(SYMBOLS);
const ICON_COLORS: Record<SymbolId, string> = {
  BTCUSDT: "bg-orange-500/20 text-orange-400",
  ETHUSDT: "bg-indigo-500/20 text-indigo-400",
};

function SymbolBar() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const navigate = useNavigate();
  const info = SYMBOLS[selectedSymbol];

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSelect = (sym: SymbolId) => {
    setSelectedSymbol(sym);
    navigate({ to: "/", search: { symbol: sym }, replace: true });
    setOpen(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex items-center gap-3 sm:gap-6 bg-card border border-border rounded-xl px-3 sm:px-5 py-2.5 sm:py-3">
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen((p) => !p)}
          className="flex items-center gap-2 sm:gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${ICON_COLORS[selectedSymbol]}`}>
            {info.icon}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1">
              <h2 className="text-sm sm:text-base font-bold text-foreground leading-tight">
                {info.label}
              </h2>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              바이낸스 · 선물
            </p>
          </div>
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1.5 z-50 w-48 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
            {SYMBOL_LIST.map((sym) => (
              <button
                key={sym.id}
                onClick={() => handleSelect(sym.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-secondary transition-colors cursor-pointer ${
                  selectedSymbol === sym.id ? "bg-secondary/60" : ""
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${ICON_COLORS[sym.id]}`}>
                  {sym.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{sym.label}</p>
                  <p className="text-[10px] text-muted-foreground">{sym.id}</p>
                </div>
                {selectedSymbol === sym.id && (
                  <span className="ml-auto text-indigo-400 text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-7 sm:h-8 w-px bg-border" />

      <div>
        <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">현재가</p>
        <PriceDisplay />
      </div>
    </div>
  );
}

// ── 모바일 차트/호가 탭 전환 (lg 이상에서는 숨김) ──
function MobileChartOrderBook() {
  const [mobileTab, setMobileTab] = useState<"chart" | "orderbook">("chart");
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const depthWsUrl = SYMBOLS[selectedSymbol].depthStream;

  return (
    <div className="lg:hidden flex flex-col">
      {/* 탭 토글 */}
      <div className="flex bg-card border border-border rounded-t-xl overflow-hidden">
        <button
          onClick={() => setMobileTab("chart")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
            mobileTab === "chart"
              ? "bg-indigo-500/15 text-indigo-400 border-b-2 border-indigo-500"
              : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          차트
        </button>
        <button
          onClick={() => setMobileTab("orderbook")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
            mobileTab === "orderbook"
              ? "bg-indigo-500/15 text-indigo-400 border-b-2 border-indigo-500"
              : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          호가창
        </button>
      </div>

      {/* 콘텐츠 */}
      {mobileTab === "chart" ? (
        <div className="bg-card border border-border border-t-0 rounded-b-xl overflow-hidden h-[250px] sm:h-[350px]">
          <TradingChart />
        </div>
      ) : (
        <div className="border border-border border-t-0 rounded-b-xl overflow-y-auto">
          <OrderBook key={depthWsUrl} />
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const fetchPortfolio = useTradingStore((s) => s.fetchPortfolio);
  const fetchOpenPositions = useTradingStore((s) => s.fetchOpenPositions);
  const fetchClosedTrades = useTradingStore((s) => s.fetchClosedTrades);
  const fetchPendingOrders = useTradingStore((s) => s.fetchPendingOrders);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const depthWsUrl = SYMBOLS[selectedSymbol].depthStream;

  const { symbol: urlSymbol } = useSearch({ from: indexRoute.id });

  // URL searchParams → store 동기화
  // urlSymbol이 바뀌면(뒤로가기, 직접 URL 입력 등) store도 갱신
  // symbol이 없으면 기본값 "BTCUSDT" 사용
  useEffect(() => {
    const sym = urlSymbol ?? "BTCUSDT";
    if (sym !== selectedSymbol) {
      setSelectedSymbol(sym);
    }
    // selectedSymbol은 의도적으로 제외: store가 변할 때 다시 URL로 쓰는 순환을 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSymbol, setSelectedSymbol]);

  // 유저 데이터 로드
  useEffect(() => {
    if (user?.id) {
      fetchPortfolio(user.id);
      fetchOpenPositions(user.id);
      fetchClosedTrades(user.id);
      fetchPendingOrders(user.id);
    }
  }, [
    user?.id,
    fetchPortfolio,
    fetchOpenPositions,
    fetchClosedTrades,
    fetchPendingOrders,
  ]);

  return (
    <>
      <Seo url="/" />
    <div className="flex-1 flex">
      {/* 좌측 광고 사이드바 */}
      <aside
        className="hidden xl:flex w-44 shrink-0 sticky self-start flex-col items-center justify-center"
        style={{ top: "56px", height: "calc(100dvh - 56px)" }}
      >
        <AdSlot variant="sidebar-left" />
      </aside>

    <main className="flex-1 min-w-0 px-2 sm:px-4 lg:px-8 pt-6 sm:pt-10 pb-2 sm:pb-4 flex flex-col gap-2 sm:gap-4">
      {/* ── 상단 종목 정보 바 ── */}
      <SymbolBar />

      {/* ── 모바일: 차트/호가 탭 + 주문창 ── */}
      <div className="lg:hidden flex flex-col gap-2 sm:gap-4">
        <MobileChartOrderBook />
        <TradingPanel />
      </div>

      {/* ── 데스크탑: 차트 | [호가창·주문창 + 광고] ──
           우측 세로 묶음 높이 = 차트 높이
           호가창·주문창 행이 flex-1 로 팽창, 광고가 나머지 채움
      */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_auto] gap-4">
        {/* 차트 */}
        <div
          className="flex flex-col bg-card border border-border rounded-xl overflow-hidden"
          style={{ height: "clamp(480px, calc(100dvh - 220px), 760px)" }}
        >
          <TradingChart />
        </div>

        {/* 오른쪽 묶음: [호가창 + 주문창] + 광고 */}
        <div
          className="flex flex-col gap-4 overflow-y-auto"
          style={{ height: "clamp(480px, calc(100dvh - 220px), 760px)" }}
        >
          {/* 호가창 + 주문창 */}
          <div className="flex gap-4">
            <div className="w-[200px] rounded-xl shrink-0 min-h-[420px]">
              <OrderBook key={depthWsUrl} />
            </div>
            <div className="w-[360px] rounded-xl shrink-0 min-h-[460px]">
              <TradingPanel />
            </div>
          </div>

        </div>
      </div>

      {/* ── 하단: 포지션 / 거래 내역 ── */}
      <PositionsPanel />

      {/* ── 하단 배너 광고 ── */}
      <AdSlot variant="banner-bottom" />
    </main>
    </div>
    </>
  );
}
