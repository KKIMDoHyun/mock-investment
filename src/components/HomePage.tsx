import { useEffect, useState, useRef } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { BarChart3, BookOpen, ChevronDown } from "lucide-react";
import { Seo } from "@/hooks/useSeo";
import TradingChart from "@/components/TradingChart";
import OrderBook from "@/components/OrderBook";
import TradingPanel from "@/components/TradingPanel";
import PositionsPanel from "@/components/PositionsPanel";
import { useTradingStore, SYMBOLS } from "@/store/tradingStore";
import type { SymbolId } from "@/store/tradingStore";
import { useAuthStore } from "@/store/authStore";
import { indexRoute } from "@/routes/index";

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
        <div className="border border-border border-t-0 rounded-b-xl overflow-hidden h-[250px] sm:h-[350px]">
          <OrderBook />
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const fetchPortfolio = useTradingStore((s) => s.fetchPortfolio);
  const fetchOpenPositions = useTradingStore((s) => s.fetchOpenPositions);
  const fetchClosedTrades = useTradingStore((s) => s.fetchClosedTrades);
  const fetchPendingOrders = useTradingStore((s) => s.fetchPendingOrders);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const positions = useTradingStore((s) => s.positions);

  const { symbol: urlSymbol } = useSearch({ from: indexRoute.id });
  const autoRedirectedRef = useRef(false);

  // URL searchParams → store 동기화 (마운트 및 URL 변경 시)
  useEffect(() => {
    if (urlSymbol && urlSymbol !== selectedSymbol) {
      setSelectedSymbol(urlSymbol);
    }
  }, [urlSymbol]); // eslint-disable-line react-hooks/exhaustive-deps

  // URL에 symbol이 없으면 보유 포지션의 심볼로 자동 이동
  useEffect(() => {
    if (urlSymbol || autoRedirectedRef.current) return;
    if (positions.length > 0) {
      autoRedirectedRef.current = true;
      const firstSymbol = positions[0].symbol;
      setSelectedSymbol(firstSymbol);
      navigate({ to: "/", search: { symbol: firstSymbol }, replace: true });
    }
  }, [positions, urlSymbol, setSelectedSymbol, navigate]);

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
    <main className="flex-1 w-full px-2 sm:px-4 lg:px-8 py-2 sm:py-4 flex flex-col gap-2 sm:gap-3">
      {/* ── 상단 종목 정보 바 ── */}
      <SymbolBar />

      {/* ── 차트 + 호가창 + 주문 패널 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px_320px] gap-2 sm:gap-3">
        {/* 모바일: 차트/호가 탭 전환 */}
        <MobileChartOrderBook />

        {/* 데스크탑: 차트 (항상 보임) */}
        <div className="hidden lg:flex lg:flex-col bg-card border border-border rounded-xl overflow-hidden"
             style={{ height: "calc(100dvh - 220px)", minHeight: 480 }}>
          <TradingChart />
        </div>

        {/* 데스크탑: 호가창 (항상 보임) */}
        <div className="hidden lg:block overflow-hidden rounded-xl"
             style={{ height: "calc(100dvh - 220px)", minHeight: 480 }}>
          <OrderBook />
        </div>

        {/* 주문 패널 */}
        <div className="lg:overflow-y-auto lg:rounded-xl"
             style={{ maxHeight: "calc(100dvh - 220px)" }}>
          <TradingPanel />
        </div>
      </div>

      {/* ── 하단: 포지션 / 거래 내역 ── */}
      <PositionsPanel />
    </main>
    </>
  );
}
