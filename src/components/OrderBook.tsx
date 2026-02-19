import { useEffect, useRef, useState, useCallback } from "react";
import { useTradingStore } from "@/store/tradingStore";

interface OrderLevel {
  price: number;
  qty: number;
}

const DEPTH_WS_URL = "wss://fstream.binance.com/ws/btcusdt@depth10@500ms";

export default function OrderBook() {
  const currentPrice = useTradingStore((s) => s.currentPrice);
  const setOrderBookPrice = useTradingStore((s) => s.setOrderBookPrice);

  const [asks, setAsks] = useState<OrderLevel[]>([]);
  const [bids, setBids] = useState<OrderLevel[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // WebSocket 연결
  useEffect(() => {
    let active = true;

    function connect() {
      if (!active) return;
      const ws = new WebSocket(DEPTH_WS_URL);
      wsRef.current = ws;

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string);
          const newAsks: OrderLevel[] = (data.a ?? [])
            .map(([p, q]: [string, string]) => ({
              price: parseFloat(p),
              qty: parseFloat(q),
            }))
            .sort((a: OrderLevel, b: OrderLevel) => a.price - b.price) // 낮은 가격부터
            .slice(0, 8);

          const newBids: OrderLevel[] = (data.b ?? [])
            .map(([p, q]: [string, string]) => ({
              price: parseFloat(p),
              qty: parseFloat(q),
            }))
            .sort((a: OrderLevel, b: OrderLevel) => b.price - a.price) // 높은 가격부터
            .slice(0, 8);

          setAsks(newAsks);
          setBids(newBids);
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (active) {
          reconnectRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      active = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []);

  // 호가 클릭 핸들러
  const handlePriceClick = useCallback(
    (price: number) => {
      setOrderBookPrice(price);
    },
    [setOrderBookPrice]
  );

  // 최대 수량 (depth bar 비율 계산용)
  const maxQty = Math.max(
    ...asks.map((a) => a.qty),
    ...bids.map((b) => b.qty),
    0.001
  );

  return (
    <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden h-full">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-border">
        <h3 className="text-xs font-semibold text-foreground">호가창</h3>
      </div>

      {/* 테이블 헤더 */}
      <div className="flex items-center text-[10px] text-muted-foreground px-3 py-1 border-b border-border/50">
        <span className="flex-1">가격(USDT)</span>
        <span className="text-right w-16">수량(BTC)</span>
      </div>

      {/* 매도 호가 (Asks) — 역순 (위에서 높은 가격, 아래로 갈수록 낮은 가격) */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end min-h-0">
        {[...asks].reverse().map((level, i) => (
          <button
            key={`ask-${i}`}
            onClick={() => handlePriceClick(level.price)}
            className="relative flex items-center px-3 py-[3px] hover:bg-red-500/10 transition-colors cursor-pointer group"
          >
            {/* depth bar */}
            <div
              className="absolute right-0 top-0 bottom-0 bg-red-500/8 group-hover:bg-red-500/15 transition-colors"
              style={{ width: `${(level.qty / maxQty) * 100}%` }}
            />
            <span className="relative z-10 flex-1 text-[11px] tabular-nums text-red-400 font-medium">
              {level.price.toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </span>
            <span className="relative z-10 text-right w-16 text-[10px] tabular-nums text-muted-foreground">
              {level.qty.toFixed(3)}
            </span>
          </button>
        ))}
      </div>

      {/* 현재가 */}
      <div className="px-3 py-1.5 border-y border-border/50 bg-secondary/30">
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

      {/* 매수 호가 (Bids) */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {bids.map((level, i) => (
          <button
            key={`bid-${i}`}
            onClick={() => handlePriceClick(level.price)}
            className="relative flex items-center px-3 py-[3px] hover:bg-emerald-500/10 transition-colors cursor-pointer group"
          >
            {/* depth bar */}
            <div
              className="absolute right-0 top-0 bottom-0 bg-emerald-500/8 group-hover:bg-emerald-500/15 transition-colors"
              style={{ width: `${(level.qty / maxQty) * 100}%` }}
            />
            <span className="relative z-10 flex-1 text-[11px] tabular-nums text-emerald-400 font-medium">
              {level.price.toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </span>
            <span className="relative z-10 text-right w-16 text-[10px] tabular-nums text-muted-foreground">
              {level.qty.toFixed(3)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
