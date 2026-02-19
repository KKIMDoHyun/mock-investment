import { useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, Gift } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { useTradingStore } from "@/store/tradingStore";
import { Button } from "@/ui/button";

const LEVERAGE_PRESETS = [1, 2, 5, 10, 20, 50, 75, 100, 125];
const PERCENT_PRESETS = [10, 25, 50, 100];

export default function TradingPanel() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const currentPrice = useTradingStore((s) => s.currentPrice);
  const balance = useTradingStore((s) => s.balance);
  const claimAttendance = useTradingStore((s) => s.claimAttendance);
  const openPosition = useTradingStore((s) => s.openPosition);

  const [leverage, setLeverage] = useState(10);
  const [marginInput, setMarginInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 출석체크
  const handleAttendance = useCallback(async () => {
    if (!user) return;
    const result = await claimAttendance(user.id);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.info(result.message);
    }
  }, [user, claimAttendance]);

  // 비율 버튼
  const handlePercentClick = useCallback(
    (percent: number) => {
      const amount = (balance * percent) / 100;
      setMarginInput(amount.toFixed(2));
    },
    [balance]
  );

  // 주문 실행
  const handleTrade = useCallback(
    async (direction: "LONG" | "SHORT") => {
      if (!user) {
        navigate({ to: "/login" });
        return;
      }

      const margin = parseFloat(marginInput);
      if (isNaN(margin) || margin <= 0) {
        toast.error("주문 금액을 입력해주세요.");
        return;
      }
      if (currentPrice <= 0) {
        toast.error(
          "현재 가격을 불러오는 중입니다. 잠시 후 다시 시도해주세요."
        );
        return;
      }

      setSubmitting(true);
      const result = await openPosition({
        userId: user.id,
        positionType: direction,
        leverage,
        margin,
        entryPrice: currentPrice,
      });
      setSubmitting(false);

      if (result.success) {
        toast.success(result.message);
        setMarginInput("");
      } else {
        toast.error(result.message);
      }
    },
    [user, marginInput, leverage, currentPrice, openPosition, navigate]
  );

  const marginValue = parseFloat(marginInput) || 0;
  const positionSize = marginValue * leverage;

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      {/* ── 잔고 + 출석체크 ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">잔고 (USDT)</p>
          <p className="text-lg font-bold text-foreground tabular-nums">
            $
            {balance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        {user && (
          <button
            onClick={handleAttendance}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 rounded-lg transition-colors cursor-pointer"
          >
            <Gift className="h-3.5 w-3.5" />
            보상 받기
          </button>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* ── 현재가 ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400 text-xs font-bold">
            ₿
          </div>
          <span className="text-sm font-medium text-foreground">BTC/USDT</span>
        </div>
        <p className="text-sm font-semibold text-foreground tabular-nums">
          {currentPrice > 0
            ? `$${currentPrice.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "—"}
        </p>
      </div>

      {/* ── 레버리지 슬라이더 ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-muted-foreground">레버리지</label>
          <span className="text-sm font-bold text-indigo-400">{leverage}x</span>
        </div>
        <input
          type="range"
          min={1}
          max={125}
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-indigo-500
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
        />
        {/* 프리셋 버튼 */}
        <div className="flex gap-1 mt-2 flex-wrap">
          {LEVERAGE_PRESETS.map((lev) => (
            <button
              key={lev}
              onClick={() => setLeverage(lev)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors cursor-pointer ${
                leverage === lev
                  ? "bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {lev}x
            </button>
          ))}
        </div>
      </div>

      {/* ── 주문 금액 ── */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">
          증거금 (USDT)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <input
            type="text"
            value={marginInput}
            onChange={(e) =>
              setMarginInput(e.target.value.replace(/[^0-9.]/g, ""))
            }
            className="w-full bg-secondary border border-border rounded-lg pl-7 pr-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring tabular-nums"
            placeholder="금액 입력"
          />
        </div>
        {/* % 버튼 */}
        <div className="flex gap-1.5 mt-2">
          {PERCENT_PRESETS.map((pct) => (
            <button
              key={pct}
              onClick={() => handlePercentClick(pct)}
              className="flex-1 text-xs py-1 rounded-md bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* ── 포지션 사이즈 미리보기 ── */}
      {marginValue > 0 && (
        <div className="bg-secondary/60 rounded-lg px-3 py-2 text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>포지션 사이즈</span>
            <span className="text-foreground font-medium tabular-nums">
              $
              {positionSize.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>예상 청산가 (Long)</span>
            <span className="text-foreground font-medium tabular-nums">
              $
              {currentPrice > 0
                ? (currentPrice * (1 - 1 / leverage)).toLocaleString(
                    undefined,
                    {
                      maximumFractionDigits: 2,
                    }
                  )
                : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>예상 청산가 (Short)</span>
            <span className="text-foreground font-medium tabular-nums">
              $
              {currentPrice > 0
                ? (currentPrice * (1 + 1 / leverage)).toLocaleString(
                    undefined,
                    {
                      maximumFractionDigits: 2,
                    }
                  )
                : "—"}
            </span>
          </div>
        </div>
      )}

      {/* ── Long / Short 버튼 ── */}
      <div className="flex gap-2">
        <Button
          onClick={() => handleTrade("LONG")}
          disabled={submitting}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
        >
          <TrendingUp className="h-4 w-4" />
          Long
        </Button>
        <Button
          onClick={() => handleTrade("SHORT")}
          disabled={submitting}
          className="flex-1 bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
        >
          <TrendingDown className="h-4 w-4" />
          Short
        </Button>
      </div>

      {/* 비로그인 안내 */}
      {!user && (
        <p className="text-xs text-center text-muted-foreground">
          거래하려면 로그인이 필요합니다
        </p>
      )}
    </div>
  );
}
