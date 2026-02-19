import { useEffect, useRef } from "react";

export default function TradingChart() {
  const containerRef = useRef<HTMLDivElement>(null);

  // ── TradingView Advanced Chart 위젯 ──
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

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full h-full min-h-[450px]"
    />
  );
}
