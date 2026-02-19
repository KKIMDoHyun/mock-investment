import { useEffect, useRef } from "react";
import { useTradingStore } from "@/store/tradingStore";

/** 바이낸스 선물 WebSocket — 현재가 업데이트 전용 */
const BINANCE_PRICE_WS = "wss://fstream.binance.com/ws/btcusdt@kline_1m";

export default function TradingChart() {
  const containerRef = useRef<HTMLDivElement>(null);

  // ── 1) TradingView Advanced Chart 위젯 ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 위젯 내부 구조 생성
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
      symbol: "BINANCE:BTCUSDT",
      interval: "1",
      timezone: "Asia/Seoul",
      theme: "dark",
      style: "1",
      locale: "ko",
      allow_symbol_change: true,
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

  // ── 2) 바이낸스 WebSocket — 현재가만 별도 수신 ──
  useEffect(() => {
    const ws = new WebSocket(BINANCE_PRICE_WS);

    ws.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string) as {
        k: { c: string };
      };
      useTradingStore.getState().setCurrentPrice(parseFloat(msg.k.c));
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full h-full min-h-[450px]"
    />
  );
}
