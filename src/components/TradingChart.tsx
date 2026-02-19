import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineStyle,
  CrosshairMode,
} from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  IPriceLine,
  Time,
  CandlestickData,
} from "lightweight-charts";
import { useTradingStore, calcPnl } from "@/store/tradingStore";

// ── 타임프레임 정의 ──
const TIMEFRAMES = [
  { label: "1s", value: "1s" },
  { label: "1m", value: "1m" },
  { label: "3m", value: "3m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "1M", value: "1M" },
] as const;

// ── Binance REST: 과거 캔들 데이터 ──
async function fetchKlines(
  interval: string,
  limit = 1000
): Promise<CandlestickData<Time>[]> {
  const res = await fetch(
    `https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`
  );
  const raw = (await res.json()) as unknown[][];
  return raw.map((k) => ({
    time: (Math.floor(Number(k[0]) / 1000)) as Time,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
  }));
}

export default function TradingChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  const [timeframe, setTimeframe] = useState("1m");
  const positions = useTradingStore((s) => s.positions);

  // ── 1. 차트 인스턴스 생성 (마운트 1회) ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: true,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderDownColor: "#ef5350",
      borderUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      wickUpColor: "#26a69a",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // 반응형 리사이즈
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // ── 2. 타임프레임 변경 시 데이터 로드 + WebSocket ──
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    let cancelled = false;

    // 기존 WebSocket 종료
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // REST API로 초기 캔들 데이터 로드
    fetchKlines(timeframe).then((data) => {
      if (cancelled) return;
      series.setData(data);

      // 실시간 캔들 WebSocket 연결
      const ws = new WebSocket(
        `wss://fstream.binance.com/ws/btcusdt@kline_${timeframe}`
      );
      wsRef.current = ws;

      ws.onmessage = (ev: MessageEvent) => {
        try {
          const msg = JSON.parse(ev.data as string);
          const k = msg.k;
          if (!k) return;
          series.update({
            time: (Math.floor(k.t / 1000)) as Time,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
          });
        } catch {
          /* 비정상 메시지 무시 */
        }
      };
    });

    return () => {
      cancelled = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [timeframe]);

  // ── 3. 포지션 라인 동기화 (진입가 + 청산가) ──
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // 기존 라인 모두 제거
    for (const line of priceLinesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {
        /* 이미 제거된 경우 무시 */
      }
    }
    priceLinesRef.current = [];

    // 새 라인 추가
    for (const pos of positions) {
      if (pos.entry_price <= 0) continue;

      const isLong = pos.position_type === "LONG";
      const { liqPrice } = calcPnl(pos, pos.entry_price);

      // ── 진입가 라인 ──
      const entryLine = series.createPriceLine({
        price: pos.entry_price,
        color: isLong ? "#26a69a" : "#ef5350",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${isLong ? "▲ LONG" : "▼ SHORT"} ${pos.leverage}x 진입`,
      });
      priceLinesRef.current.push(entryLine);

      // ── 청산가 라인 ──
      if (liqPrice > 0) {
        const liqLine = series.createPriceLine({
          price: liqPrice,
          color: "#f59e0b",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `${isLong ? "▲" : "▼"} 청산가`,
        });
        priceLinesRef.current.push(liqLine);
      }
    }
  }, [positions]);

  return (
    <div className="flex flex-col w-full h-full">
      {/* ── 타임프레임 셀렉터 ── */}
      <div className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 border-b border-border overflow-x-auto shrink-0 scrollbar-none">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setTimeframe(tf.value)}
            className={`px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              timeframe === tf.value
                ? "bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* ── 차트 ── */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
