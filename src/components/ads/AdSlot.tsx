/**
 * 광고 슬롯 공통 컴포넌트
 *
 * 실제 광고 스크립트가 로드되기 전에도 레이아웃이 흔들리지 않도록(CLS 방지)
 * 각 variant 별로 고정 min-height를 설정합니다.
 *
 * 사용법:
 *   <AdSlot variant="sidebar-left" />
 *   <AdSlot variant="banner-bottom" />
 *   <AdSlot variant="panel-right" />
 */

export type AdSlotVariant = "sidebar-left" | "sidebar-right" | "banner-bottom" | "panel-right";

interface AdSlotProps {
  variant: AdSlotVariant;
  className?: string;
}

/** variant별 CLS 방지 최소 높이 및 표준 광고 규격 레이블 */
const SLOT_CONFIG: Record<AdSlotVariant, { minH: string; size: string }> = {
  "sidebar-left":  { minH: "min-h-[600px]", size: "160 × 600" },
  "sidebar-right": { minH: "min-h-[600px]", size: "160 × 600" },
  "banner-bottom": { minH: "min-h-[90px]",  size: "728 × 90"  },
  "panel-right":   { minH: "min-h-[160px]", size: "300 × 250" },
};

export default function AdSlot({ variant, className = "" }: AdSlotProps) {
  const { minH, size } = SLOT_CONFIG[variant];

  return (
    <div
      className={`w-full ${minH} flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/30 bg-card/20 ${className}`}
      aria-hidden="true"
    >
      <span className="text-[9px] text-muted-foreground/30 select-none tracking-widest uppercase">
        Advertisement
      </span>
      <span className="text-[9px] text-muted-foreground/20 select-none font-mono">
        {size}
      </span>
    </div>
  );
}
