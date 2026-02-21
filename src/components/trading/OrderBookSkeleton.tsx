import { useTradingStore } from "@/store/tradingStore";

const MAX_ROWS = 8;

// 실제 OrderRow와 동일한 px-3 py-[3px] 높이 유지
function SkeletonRow() {
  return (
    <div className="relative flex items-center w-full px-3 h-[22.5px]">
      {/* 잔량 바 자리 — 고정 연회색, 애니메이션 없음 */}
      <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-muted/10" />
      {/* 가격 skeleton */}
      <div className="relative z-10 flex-1">
        <div className="h-[11px] w-16 rounded-sm bg-muted/30 animate-pulse" />
      </div>
      {/* 수량 skeleton */}
      <div className="relative z-10 w-16 flex justify-end">
        <div className="h-[10px] w-10 rounded-sm bg-muted/30 animate-pulse" />
      </div>
    </div>
  );
}

export default function OrderBookSkeleton() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const coinName = selectedSymbol.replace("USDT", "");

  return (
    <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold text-foreground">호가창</h3>
      </div>

      {/* 테이블 헤더 */}
      <div className="flex items-center text-[10px] text-muted-foreground px-3 py-1 border-b border-border/50 shrink-0">
        <span className="flex-1">가격(USDT)</span>
        <span className="text-right w-16">수량({coinName})</span>
      </div>

      {/* 매도 호가 8행 */}
      <div className="flex flex-col justify-end overflow-hidden">
        {Array.from({ length: MAX_ROWS }).map((_, i) => (
          <SkeletonRow key={`ask-skel-${i}`} />
        ))}
      </div>

      {/* 현재가 — "현재가" 레이블은 유지, 가격만 skeleton */}
      <div className="px-3 py-1.5 border-y border-border/50 bg-secondary/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="h-[12px] w-20 rounded-sm bg-muted/30 animate-pulse" />
          <span className="text-[9px] text-muted-foreground">현재가</span>
        </div>
      </div>

      {/* 매수 호가 8행 */}
      <div className="flex flex-col overflow-hidden">
        {Array.from({ length: MAX_ROWS }).map((_, i) => (
          <SkeletonRow key={`bid-skel-${i}`} />
        ))}
      </div>
    </div>
  );
}
