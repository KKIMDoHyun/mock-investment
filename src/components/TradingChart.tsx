import { useEffect, useRef, useState } from "react";
import { Eye, Pencil } from "lucide-react";
import { createChart, CandlestickSeries, LineStyle } from "lightweight-charts";
import type { UTCTimestamp } from "lightweight-charts";
import { useTradingStore } from "@/store/tradingStore";

type ChartMode = "view" | "draw";

// ── 타임프레임 정의 ──
const TIMEFRAMES = [
  { label: "1초", interval: "1s" },
  { label: "1분", interval: "1m" },
  { label: "5분", interval: "5m" },
  { label: "15분", interval: "15m" },
  { label: "1시간", interval: "1h" },
  { label: "4시간", interval: "4h" },
  { label: "1일", interval: "1d" },
  { label: "1주", interval: "1w" },
  { label: "1월", interval: "1M" },
];

// ── Binance API 엔드포인트 헬퍼 ──
function getRestUrl(interval: string): string {
  // 1초는 현물 API (선물은 1s 미지원)
  if (interval === "1s") {
    return `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1s&limit=500`;
  }
  return `https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=${interval}&limit=500`;
}

function getWsUrl(interval: string): string {
  if (interval === "1s") {
    return `wss://stream.binance.com:9443/ws/btcusdt@kline_1s`;
  }
  return `wss://fstream.binance.com/ws/btcusdt@kline_${interval}`;
}

// ══════════════════════════════════════════
//  보기 모드 — lightweight-charts + 포지션 점선
// ══════════════════════════════════════════
function ViewChart({ timeframe }: { timeframe: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceLinesRef = useRef<any[]>([]);

  const positions = useTradingStore((s) => s.positions);

  // ── 차트 생성 + 데이터 로드 + 실시간 WebSocket ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { color: "transparent" },
        textColor: "#888",
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: { mode: 0 },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: timeframe === "1s" || timeframe === "1m",
      },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    seriesRef.current = series;

    // 히스토리 데이터 로드
    fetch(getRestUrl(timeframe))
      .then((r) => r.json())
      .then((data: unknown[]) => {
        const candles = (data as (string | number)[][]).map((k) => ({
          time: (Number(k[0]) / 1000) as UTCTimestamp,
          open: parseFloat(String(k[1])),
          high: parseFloat(String(k[2])),
          low: parseFloat(String(k[3])),
          close: parseFloat(String(k[4])),
        }));
        series.setData(candles);
        chart.timeScale().fitContent();
      })
      .catch(() => {});

    // 실시간 캔들 WebSocket
    let ws: WebSocket | null = new WebSocket(getWsUrl(timeframe));

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data as string);
        const k = msg.k;
        if (!k) return;
        series.update({
          time: (k.t / 1000) as UTCTimestamp,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
        });
      } catch {
        // ignore
      }
    };
    ws.onerror = () => ws?.close();

    // ── 차트 클릭 → 해당 가격을 지정가 입력창에 전달 ──
    chart.subscribeClick((param) => {
      if (!param.point) return;
      try {
        // y 좌표 → 가격 변환
        const price = series.coordinateToPrice(param.point.y);
        if (price !== null && Number.isFinite(price) && price > 0) {
          useTradingStore
            .getState()
            .setOrderBookPrice(Math.round(price * 100) / 100);
        }
      } catch {
        // coordinateToPrice 미지원 시: 클릭한 캔들의 종가 사용
        const data = param.seriesData?.get(series);
        if (data && "close" in data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const close = (data as any).close;
          if (Number.isFinite(close) && close > 0) {
            useTradingStore.getState().setOrderBookPrice(close);
          }
        }
      }
    });

    // 리사이즈 옵저버
    const ro = new ResizeObserver(() => {
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      ws?.close();
      ws = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current = [];
    };
  }, [timeframe]);

  // ── 포지션 가격선 (점선) ──
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // 기존 라인 제거
    for (const line of priceLinesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {
        // ignore
      }
    }
    priceLinesRef.current = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newLines: any[] = [];

    for (const trade of positions) {
      const isLong = trade.position_type === "LONG";

      // 청산가 계산 (entry_price 기반, currentPrice 불필요)
      const liqPrice = isLong
        ? trade.entry_price * (1 - 1 / trade.leverage)
        : trade.entry_price * (1 + 1 / trade.leverage);

      // 진입가 점선
      newLines.push(
        series.createPriceLine({
          price: trade.entry_price,
          color: isLong ? "#818cf8" : "#c084fc",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${trade.position_type} 진입 ${trade.leverage}x`,
        })
      );

      // 청산가 점선
      if (liqPrice > 0) {
        newLines.push(
          series.createPriceLine({
            price: liqPrice,
            color: "#f59e0b",
            lineWidth: 1,
            lineStyle: LineStyle.SparseDotted,
            axisLabelVisible: true,
            title: `${trade.position_type} 청산`,
          })
        );
      }

      // TP 점선
      if (trade.tp_price) {
        newLines.push(
          series.createPriceLine({
            price: trade.tp_price,
            color: "#10b981",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "TP",
          })
        );
      }

      // SL 점선
      if (trade.sl_price) {
        newLines.push(
          series.createPriceLine({
            price: trade.sl_price,
            color: "#ef4444",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "SL",
          })
        );
      }
    }

    priceLinesRef.current = newLines;
  }, [positions, timeframe]);

  return <div ref={containerRef} className="w-full h-full" />;
}

// ══════════════════════════════════════════
//  드로잉 모드 — TradingView Advanced Chart 위젯
// ══════════════════════════════════════════
function DrawChart() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: "BINANCE:BTCUSDTPERP",
      interval: "1",
      timezone: "Asia/Seoul",
      theme: "dark",
      style: "1",
      locale: "ko",
      allow_symbol_change: false,
      calendar: false,
      hide_side_toolbar: false,
      hide_legend: false,
      withdateranges: true,
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(widgetDiv);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full h-full"
    />
  );
}

// ══════════════════════════════════════════
//  메인 차트 컴포넌트
// ══════════════════════════════════════════
export default function TradingChart() {
  const [mode, setMode] = useState<ChartMode>("view");
  const [timeframe, setTimeframe] = useState("1m");

  return (
    <div className="flex flex-col w-full h-full">
      {/* ── 차트 바깥 상단 바 (타임프레임 + 모드 토글) ── */}
      <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 border-b border-border/50 shrink-0">
        {/* 타임프레임 셀렉터 (보기 모드만 표시) */}
        {mode === "view" ? (
          <div className="flex gap-0.5 overflow-x-auto scrollbar-none">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.interval}
                onClick={() => setTimeframe(tf.interval)}
                className={`px-1.5 sm:px-2 py-1 text-[10px] sm:text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  timeframe === tf.interval
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            TradingView 드로잉 도구 사용 가능
          </span>
        )}

        {/* 모드 토글 (우측 상단) */}
        <div className="flex bg-secondary rounded-lg overflow-hidden shrink-0 ml-2">
          <button
            onClick={() => setMode("view")}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[10px] font-medium transition-colors cursor-pointer ${
              mode === "view"
                ? "bg-indigo-500/20 text-indigo-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="h-3 w-3" />
            <span className="hidden sm:inline">보기</span>
          </button>
          <button
            onClick={() => setMode("draw")}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[10px] font-medium transition-colors cursor-pointer ${
              mode === "draw"
                ? "bg-indigo-500/20 text-indigo-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Pencil className="h-3 w-3" />
            <span className="hidden sm:inline">드로잉</span>
          </button>
        </div>
      </div>

      {/* ── 차트 본체 ── */}
      <div className="flex-1 min-h-0">
        {mode === "view" ? <ViewChart timeframe={timeframe} /> : <DrawChart />}
      </div>
    </div>
  );
}
