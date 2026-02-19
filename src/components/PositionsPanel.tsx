import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTradingStore, calcPnl, type Trade } from "@/store/tradingStore";

type Tab = "positions" | "history";

// ── 빈 상태 ──
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <svg
        className="w-10 h-10 mb-3 opacity-30"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162M3.75 17.25h16.5"
        />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── 숫자 포매팅 헬퍼 ──
const fmtUsd = (v: number) =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const fmtDateShort = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

// ── 개별 OPEN 포지션 행 (데스크탑 테이블용) ──
function PositionRow({ trade }: { trade: Trade }) {
  const currentPrice = useTradingStore((s) => s.currentPrice);
  const closePosition = useTradingStore((s) => s.closePosition);
  const [closing, setClosing] = useState(false);

  const { pnl, roe, liqPrice } = calcPnl(trade, currentPrice);
  const isProfit = pnl >= 0;

  const handleClose = useCallback(async () => {
    setClosing(true);
    const result = await closePosition(trade.id, currentPrice);
    setClosing(false);

    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  }, [trade.id, currentPrice, closePosition]);

  return (
    <tr className="border-b border-border/50 hover:bg-accent/20 transition-colors">
      {/* 종목 */}
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground text-sm">BTCUSDT</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              trade.position_type === "LONG"
                ? "text-emerald-400 bg-emerald-400/10"
                : "text-red-400 bg-red-400/10"
            }`}
          >
            {trade.position_type}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {trade.leverage}x
          </span>
        </div>
      </td>

      {/* 증거금 */}
      <td className="py-2.5 px-3 text-right tabular-nums text-sm text-foreground">
        ${fmtUsd(trade.margin)}
      </td>

      {/* 진입가 */}
      <td className="py-2.5 px-3 text-right tabular-nums text-sm text-foreground">
        ${fmtUsd(trade.entry_price)}
      </td>

      {/* 현재가 */}
      <td className="py-2.5 px-3 text-right tabular-nums text-sm text-foreground">
        ${fmtUsd(currentPrice)}
      </td>

      {/* 청산가 */}
      <td className="py-2.5 px-3 text-right tabular-nums text-sm text-yellow-400">
        ${fmtUsd(liqPrice)}
      </td>

      {/* 미실현 손익 */}
      <td
        className={`py-2.5 px-3 text-right tabular-nums text-sm font-semibold ${
          isProfit ? "text-emerald-400" : "text-red-400"
        }`}
      >
        <div>
          {isProfit ? "+" : ""}${fmtUsd(pnl)}
        </div>
        <div className="text-[10px] font-medium">
          ({isProfit ? "+" : ""}
          {roe.toFixed(2)}%)
        </div>
      </td>

      {/* 종료 */}
      <td className="py-2.5 px-3 text-center">
        <button
          onClick={handleClose}
          disabled={closing}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="h-3 w-3" />
          종료
        </button>
      </td>
    </tr>
  );
}

// ── 개별 OPEN 포지션 카드 (모바일용) ──
function PositionCard({ trade }: { trade: Trade }) {
  const currentPrice = useTradingStore((s) => s.currentPrice);
  const closePosition = useTradingStore((s) => s.closePosition);
  const [closing, setClosing] = useState(false);

  const { pnl, roe, liqPrice } = calcPnl(trade, currentPrice);
  const isProfit = pnl >= 0;

  const handleClose = useCallback(async () => {
    setClosing(true);
    const result = await closePosition(trade.id, currentPrice);
    setClosing(false);

    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  }, [trade.id, currentPrice, closePosition]);

  return (
    <div className="border-b border-border/50 px-3 py-3 space-y-2">
      {/* 헤더: 종목 + 종료 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground text-sm">BTCUSDT</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              trade.position_type === "LONG"
                ? "text-emerald-400 bg-emerald-400/10"
                : "text-red-400 bg-red-400/10"
            }`}
          >
            {trade.position_type}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {trade.leverage}x
          </span>
        </div>
        <button
          onClick={handleClose}
          disabled={closing}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="h-3 w-3" />
          종료
        </button>
      </div>

      {/* 수익 */}
      <div
        className={`flex items-baseline gap-2 ${
          isProfit ? "text-emerald-400" : "text-red-400"
        }`}
      >
        <span className="text-base font-bold tabular-nums">
          {isProfit ? "+" : ""}${fmtUsd(pnl)}
        </span>
        <span className="text-xs font-medium tabular-nums">
          ({isProfit ? "+" : ""}
          {roe.toFixed(2)}%)
        </span>
      </div>

      {/* 상세 정보 2x2 그리드 */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">증거금</span>
          <span className="text-foreground tabular-nums">
            ${fmtUsd(trade.margin)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">진입가</span>
          <span className="text-foreground tabular-nums">
            ${fmtUsd(trade.entry_price)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">현재가</span>
          <span className="text-foreground tabular-nums">
            ${fmtUsd(currentPrice)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">청산가</span>
          <span className="text-yellow-400 tabular-nums">
            ${fmtUsd(liqPrice)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── OPEN 포지션 테이블 (데스크탑) ──
function PositionsTable() {
  const positions = useTradingStore((s) => s.positions);

  if (positions.length === 0) {
    return <EmptyState message="보유 중인 포지션이 없습니다" />;
  }

  return (
    <>
      {/* 데스크탑 테이블 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              <th className="text-left py-2.5 px-3 font-medium">종목</th>
              <th className="text-right py-2.5 px-3 font-medium">증거금</th>
              <th className="text-right py-2.5 px-3 font-medium">진입가</th>
              <th className="text-right py-2.5 px-3 font-medium">현재가</th>
              <th className="text-right py-2.5 px-3 font-medium">청산가</th>
              <th className="text-right py-2.5 px-3 font-medium">
                미실현 손익
              </th>
              <th className="text-center py-2.5 px-3 font-medium">종료</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((trade) => (
              <PositionRow key={trade.id} trade={trade} />
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden">
        {positions.map((trade) => (
          <PositionCard key={trade.id} trade={trade} />
        ))}
      </div>
    </>
  );
}

// ── CLOSED 거래 내역 (데스크탑 + 모바일) ──
function HistoryTable() {
  const closedTrades = useTradingStore((s) => s.closedTrades);

  if (closedTrades.length === 0) {
    return <EmptyState message="거래 내역이 없습니다" />;
  }

  return (
    <>
      {/* 데스크탑 테이블 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              <th className="text-left py-2.5 px-3 font-medium">종료 일시</th>
              <th className="text-left py-2.5 px-3 font-medium">포지션</th>
              <th className="text-right py-2.5 px-3 font-medium">투자 원금</th>
              <th className="text-right py-2.5 px-3 font-medium">
                진입가 / 청산가
              </th>
              <th className="text-right py-2.5 px-3 font-medium">실현 수익</th>
            </tr>
          </thead>
          <tbody>
            {closedTrades.map((trade) => {
              const closePrice = trade.close_price ?? 0;
              const { pnl } = calcPnl(trade, closePrice);
              const isProfit = pnl >= 0;

              return (
                <tr
                  key={trade.id}
                  className="border-b border-border/50 hover:bg-accent/20 transition-colors"
                >
                  <td className="py-2.5 px-3 text-sm text-muted-foreground whitespace-nowrap">
                    {fmtDate(trade.closed_at)}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-sm font-bold ${
                        trade.position_type === "LONG"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {trade.position_type}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1.5">
                      {trade.leverage}x
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-sm text-foreground">
                    ${fmtUsd(trade.margin)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-sm text-foreground whitespace-nowrap">
                    ${fmtUsd(trade.entry_price)} / ${fmtUsd(closePrice)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right tabular-nums text-sm font-semibold ${
                      isProfit ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {isProfit ? "+" : ""}${fmtUsd(pnl)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden">
        {closedTrades.map((trade) => {
          const closePrice = trade.close_price ?? 0;
          const { pnl } = calcPnl(trade, closePrice);
          const isProfit = pnl >= 0;

          return (
            <div
              key={trade.id}
              className="border-b border-border/50 px-3 py-3 space-y-1.5"
            >
              {/* 상단: 포지션 + 수익 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold ${
                      trade.position_type === "LONG"
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {trade.position_type}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {trade.leverage}x
                  </span>
                </div>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    isProfit ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {isProfit ? "+" : ""}${fmtUsd(pnl)}
                </span>
              </div>

              {/* 상세 */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">원금</span>
                  <span className="text-foreground tabular-nums">
                    ${fmtUsd(trade.margin)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">진입/청산</span>
                  <span className="text-foreground tabular-nums">
                    ${fmtUsd(trade.entry_price)} / ${fmtUsd(closePrice)}
                  </span>
                </div>
              </div>

              {/* 날짜 */}
              <p className="text-[10px] text-muted-foreground/70">
                {fmtDateShort(trade.closed_at)}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── 메인 컴포넌트 ──
export default function PositionsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("positions");
  const positions = useTradingStore((s) => s.positions);
  const closedTrades = useTradingStore((s) => s.closedTrades);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* 탭 헤더 */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("positions")}
          className={`px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors cursor-pointer relative ${
            activeTab === "positions"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          현재 포지션
          {positions.length > 0 && (
            <span className="ml-1.5 text-[10px] sm:text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full">
              {positions.length}
            </span>
          )}
          {activeTab === "positions" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors cursor-pointer relative ${
            activeTab === "history"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          거래 내역
          {closedTrades.length > 0 && (
            <span className="ml-1.5 text-[10px] sm:text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
              {closedTrades.length}
            </span>
          )}
          {activeTab === "history" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
          )}
        </button>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="min-h-[120px] sm:min-h-[160px]">
        {activeTab === "positions" && <PositionsTable />}
        {activeTab === "history" && <HistoryTable />}
      </div>
    </div>
  );
}
