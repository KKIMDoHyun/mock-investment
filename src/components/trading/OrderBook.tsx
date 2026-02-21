import { useEffect, useState, useCallback, memo } from "react";
import { useTradingStore, SYMBOLS } from "@/store/tradingStore";
import OrderBookSkeleton from "./OrderBookSkeleton";

interface OrderLevel {
  price: number;
  qty: number;
}

// 호가창에 표시할 최대 행 수 (양방향 각각)
// 8행 × 2 + 헤더/현재가 ≈ 400px → 모바일/데스크탑 모두 적정 크기
const MAX_ROWS = 8;

// ── 호가 행 (memo로 가격/수량이 바뀐 행만 리렌더) ──
const OrderRow = memo(function OrderRow({
  price,
  qty,
  maxQty,
  side,
  symbol,
  onClick,
}: {
  price: number;
  qty: number;
  maxQty: number;
  side: "ask" | "bid";
  symbol: string;
  onClick: (price: number) => void;
}) {
  const isAsk = side === "ask";
  const barColor = isAsk
    ? "bg-red-500/8 group-hover:bg-red-500/15"
    : "bg-emerald-500/8 group-hover:bg-emerald-500/15";
  const textColor = isAsk ? "text-red-400" : "text-emerald-400";
  const hoverBg = isAsk ? "hover:bg-red-500/10" : "hover:bg-emerald-500/10";

  return (
    <button
      onClick={() => onClick(price)}
      className={`relative flex items-center w-full px-3 py-[3px] ${hoverBg} transition-colors cursor-pointer group`}
    >
      <div
        className={`absolute right-0 top-0 bottom-0 ${barColor} transition-colors`}
        style={{ width: `${(qty / maxQty) * 100}%` }}
      />
      <span className={`relative z-10 flex-1 text-[11px] tabular-nums ${textColor} font-medium`}>
        {price.toLocaleString(undefined, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}
      </span>
      <span className="relative z-10 text-right w-16 text-[10px] tabular-nums text-muted-foreground">
        {qty.toFixed(3)}
      </span>
      <span className="sr-only">{symbol.replace("USDT", "")} {qty.toFixed(3)}</span>
    </button>
  );
});

// ── 현재가 표시 (독립 구독으로 나머지 행에 영향 없음) ──
function CurrentPrice() {
  const currentPrice = useTradingStore((s) => s.currentPrice);
  return (
    <div className="px-3 py-1.5 border-y border-border/50 bg-secondary/30 shrink-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground tabular-nums">
          {currentPrice > 0
            ? `$${currentPrice.toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}`
            : "—"}
        </span>
        <span className="text-[9px] text-muted-foreground">현재가</span>
      </div>
    </div>
  );
}

export default function OrderBook() {
  const setOrderBookPrice = useTradingStore((s) => s.setOrderBookPrice);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const depthWsUrl = SYMBOLS[selectedSymbol].depthStream;

  const [loading, setLoading] = useState(true);
  const [asks, setAsks] = useState<OrderLevel[]>([]);
  const [bids, setBids] = useState<OrderLevel[]>([]);

  // WebSocket 연결
  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (!active) return;
      ws = new WebSocket(depthWsUrl);

      ws.onmessage = (event: MessageEvent) => {
        if (!active) return;
        try {
          const data = JSON.parse(event.data as string);
          const newAsks: OrderLevel[] = (data.a ?? [])
            .map(([p, q]: [string, string]) => ({
              price: parseFloat(p),
              qty: parseFloat(q),
            }))
            .sort((a: OrderLevel, b: OrderLevel) => a.price - b.price)
            .slice(0, MAX_ROWS);

          const newBids: OrderLevel[] = (data.b ?? [])
            .map(([p, q]: [string, string]) => ({
              price: parseFloat(p),
              qty: parseFloat(q),
            }))
            .sort((a: OrderLevel, b: OrderLevel) => b.price - a.price)
            .slice(0, MAX_ROWS);

          setAsks(newAsks);
          setBids(newBids);
          setLoading(false);
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (active) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws?.close();
    }

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
    };
  }, [depthWsUrl]);

  const handlePriceClick = useCallback(
    (price: number) => setOrderBookPrice(price),
    [setOrderBookPrice]
  );

  // 전체 maxQty (depth bar 비율 계산용)
  const maxQty = Math.max(
    ...asks.map((a) => a.qty),
    ...bids.map((b) => b.qty),
    0.001
  );

  const symbol = selectedSymbol;

  if (loading) return <OrderBookSkeleton />;

  return (
    // 자연 높이로 렌더링, 최대 높이만 제한 → 고해상도에서도 무한히 늘어나지 않음
    <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold text-foreground">호가창</h3>
      </div>

      {/* 테이블 헤더 */}
      <div className="flex items-center text-[10px] text-muted-foreground px-3 py-1 border-b border-border/50 shrink-0">
        <span className="flex-1">가격(USDT)</span>
        <span className="text-right w-16">수량({symbol.replace("USDT", "")})</span>
      </div>

      {/* 매도 호가 (Asks) — 높은 가격 위, 낮은 가격 아래 */}
      <div className="flex flex-col justify-end overflow-hidden">
        {[...asks].reverse().map((level, i) => (
          <OrderRow
            key={`ask-${i}`}
            price={level.price}
            qty={level.qty}
            maxQty={maxQty}
            side="ask"
            symbol={symbol}
            onClick={handlePriceClick}
          />
        ))}
      </div>

      {/* 현재가 */}
      <CurrentPrice />

      {/* 매수 호가 (Bids) */}
      <div className="flex flex-col overflow-hidden">
        {bids.map((level, i) => (
          <OrderRow
            key={`bid-${i}`}
            price={level.price}
            qty={level.qty}
            maxQty={maxQty}
            side="bid"
            symbol={symbol}
            onClick={handlePriceClick}
          />
        ))}
      </div>
    </div>
  );
}
