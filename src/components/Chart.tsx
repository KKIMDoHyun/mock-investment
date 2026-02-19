import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts";

/** 임시 캔들 데이터 생성 */
function generateCandleData(): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
  let time = new Date("2024-01-01").getTime() / 1000;
  let open = 42000;

  for (let i = 0; i < 120; i++) {
    const close = open + (Math.random() - 0.48) * 1200;
    const high = Math.max(open, close) + Math.random() * 600;
    const low = Math.min(open, close) - Math.random() * 600;

    data.push({
      time: time as Time,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
    });

    time += 86400;
    open = close;
  }

  return data;
}

export default function Chart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#9ca3af",
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        vertLine: {
          color: "rgba(99,102,241,0.3)",
          labelBackgroundColor: "#6366f1",
        },
        horzLine: {
          color: "rgba(99,102,241,0.3)",
          labelBackgroundColor: "#6366f1",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: false,
      },
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      wickUpColor: "#22c55e",
    });

    series.setData(generateCandleData());
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  return <div className="w-full h-full min-h-[400px]" ref={containerRef} />;
}
