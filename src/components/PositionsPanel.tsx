import { useState } from "react";

type Tab = "positions" | "orders" | "history";

const TABS: { key: Tab; label: string }[] = [
  { key: "positions", label: "포지션" },
  { key: "orders", label: "미체결 주문" },
  { key: "history", label: "거래 내역" },
];

// ── 임시 데이터 (나중에 Supabase 연동) ──

interface Position {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
}

interface Order {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  price: number;
  amount: number;
  filled: number;
  time: string;
}

interface Trade {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  amount: number;
  pnl: number;
  time: string;
}

const MOCK_POSITIONS: Position[] = [];
const MOCK_ORDERS: Order[] = [];
const MOCK_HISTORY: Trade[] = [];

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

function PositionsTable({ data }: { data: Position[] }) {
  if (data.length === 0) {
    return <EmptyState message="보유 중인 포지션이 없습니다" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border">
            <th className="text-left py-2.5 px-3 font-medium">종목</th>
            <th className="text-left py-2.5 px-3 font-medium">방향</th>
            <th className="text-right py-2.5 px-3 font-medium">수량</th>
            <th className="text-right py-2.5 px-3 font-medium">진입가</th>
            <th className="text-right py-2.5 px-3 font-medium">현재가</th>
            <th className="text-right py-2.5 px-3 font-medium">레버리지</th>
            <th className="text-right py-2.5 px-3 font-medium">미실현 손익</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr
              key={p.id}
              className="border-b border-border/50 hover:bg-accent/30 transition-colors"
            >
              <td className="py-2.5 px-3 font-medium text-foreground">
                {p.symbol}
              </td>
              <td className="py-2.5 px-3">
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    p.side === "LONG"
                      ? "text-emerald-400 bg-emerald-400/10"
                      : "text-red-400 bg-red-400/10"
                  }`}
                >
                  {p.side}
                </span>
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-foreground">
                {p.size.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-foreground">
                ${p.entryPrice.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-foreground">
                ${p.markPrice.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right text-foreground">
                {p.leverage}x
              </td>
              <td
                className={`py-2.5 px-3 text-right tabular-nums font-medium ${
                  p.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(2)} ({p.pnlPercent >= 0 ? "+" : ""}
                {p.pnlPercent.toFixed(2)}%)
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({ data }: { data: Order[] }) {
  if (data.length === 0) {
    return <EmptyState message="미체결 주문이 없습니다" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border">
            <th className="text-left py-2.5 px-3 font-medium">시간</th>
            <th className="text-left py-2.5 px-3 font-medium">종목</th>
            <th className="text-left py-2.5 px-3 font-medium">유형</th>
            <th className="text-left py-2.5 px-3 font-medium">방향</th>
            <th className="text-right py-2.5 px-3 font-medium">가격</th>
            <th className="text-right py-2.5 px-3 font-medium">수량</th>
            <th className="text-right py-2.5 px-3 font-medium">체결</th>
            <th className="text-center py-2.5 px-3 font-medium">취소</th>
          </tr>
        </thead>
        <tbody>
          {data.map((o) => (
            <tr
              key={o.id}
              className="border-b border-border/50 hover:bg-accent/30 transition-colors"
            >
              <td className="py-2.5 px-3 text-muted-foreground text-xs">
                {o.time}
              </td>
              <td className="py-2.5 px-3 font-medium text-foreground">
                {o.symbol}
              </td>
              <td className="py-2.5 px-3 text-muted-foreground">{o.type}</td>
              <td className="py-2.5 px-3">
                <span
                  className={`text-xs font-semibold ${
                    o.side === "BUY" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {o.side}
                </span>
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-foreground">
                ${o.price.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-foreground">
                {o.amount}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                {o.filled}
              </td>
              <td className="py-2.5 px-3 text-center">
                <button className="text-xs text-red-400 hover:text-red-300 cursor-pointer">
                  취소
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTable({ data }: { data: Trade[] }) {
  if (data.length === 0) {
    return <EmptyState message="거래 내역이 없습니다" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border">
            <th className="text-left py-2.5 px-3 font-medium">시간</th>
            <th className="text-left py-2.5 px-3 font-medium">종목</th>
            <th className="text-left py-2.5 px-3 font-medium">방향</th>
            <th className="text-right py-2.5 px-3 font-medium">가격</th>
            <th className="text-right py-2.5 px-3 font-medium">수량</th>
            <th className="text-right py-2.5 px-3 font-medium">실현 손익</th>
          </tr>
        </thead>
        <tbody>
          {data.map((t) => (
            <tr
              key={t.id}
              className="border-b border-border/50 hover:bg-accent/30 transition-colors"
            >
              <td className="py-2.5 px-3 text-muted-foreground text-xs">
                {t.time}
              </td>
              <td className="py-2.5 px-3 font-medium text-foreground">
                {t.symbol}
              </td>
              <td className="py-2.5 px-3">
                <span
                  className={`text-xs font-semibold ${
                    t.side === "BUY" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {t.side}
                </span>
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-foreground">
                ${t.price.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-foreground">
                {t.amount}
              </td>
              <td
                className={`py-2.5 px-3 text-right tabular-nums font-medium ${
                  t.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PositionsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("positions");

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* 탭 헤더 */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-medium transition-colors cursor-pointer relative ${
              activeTab === tab.key
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.key === "positions" && MOCK_POSITIONS.length > 0 && (
              <span className="ml-1.5 text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full">
                {MOCK_POSITIONS.length}
              </span>
            )}
            {tab.key === "orders" && MOCK_ORDERS.length > 0 && (
              <span className="ml-1.5 text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">
                {MOCK_ORDERS.length}
              </span>
            )}
            {/* 활성 탭 하단 인디케이터 */}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
            )}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div className="min-h-[160px]">
        {activeTab === "positions" && <PositionsTable data={MOCK_POSITIONS} />}
        {activeTab === "orders" && <OrdersTable data={MOCK_ORDERS} />}
        {activeTab === "history" && <HistoryTable data={MOCK_HISTORY} />}
      </div>
    </div>
  );
}
