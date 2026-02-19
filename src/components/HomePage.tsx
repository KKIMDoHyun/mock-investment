import Chart from "@/components/Chart";
import TradingPanel from "@/components/TradingPanel";

export default function HomePage() {
  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Title */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">BTC/KRW</h2>
        <p className="text-sm text-muted-foreground">비트코인 · 실시간 차트</p>
      </div>

      {/* Chart + Trading Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Chart area */}
        <div className="bg-card border border-border rounded-xl p-4 min-h-[450px]">
          <Chart />
        </div>

        {/* Trading Panel */}
        <TradingPanel />
      </div>
    </main>
  );
}
