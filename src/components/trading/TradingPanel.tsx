import { useState, useCallback, useEffect, useRef, memo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, Gift, Check, Ticket } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { useAuthStore } from "@/store/authStore";
import {
  useTradingStore,
  SYMBOLS,
  MARKET_FEE_RATE,
  LIMIT_FEE_RATE,
  calcFee,
  calcPnl,
} from "@/store/tradingStore";
import { Button } from "@/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/tabs";

const LEVERAGE_PRESETS = [1, 2, 5, 10, 25, 50, 75, 100, 125];
const PERCENT_PRESETS = [10, 25, 50, 100];
const TP_PRESETS = [5, 10, 25, 50]; // +%
const SL_PRESETS = [-1, -2, -5, -10]; // -%

type OrderType = "market" | "limit";

// ── KST 기준 오늘 날짜 ──
function getTodayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// ── 잔고 + 출석 + 리필권 섹션 ──
// TradingPanel은 currentPrice 틱마다 re-render되므로, refilling 상태와 equity 계산을
// 이 컴포넌트 안으로 colocate해 불필요한 상위 re-render 영향을 차단합니다.
function BalanceSection({ user }: { user: User | null }) {
  const balance = useTradingStore((s) => s.balance);
  const refillTickets = useTradingStore((s) => s.refillTickets);
  const positions = useTradingStore((s) => s.positions);
  const lastAttendanceDate = useTradingStore((s) => s.lastAttendanceDate);
  const claimAttendance = useTradingStore((s) => s.claimAttendance);
  const useRefillTicket = useTradingStore((s) => s.useRefillTicket);

  // equity를 selector로 계산 → 수치가 같으면 Zustand가 re-render를 건너뜀
  const equity = useTradingStore((s) => {
    const posVal = s.positions.reduce((sum, pos) => {
      const p = s.prices[pos.symbol] || 0;
      const { pnl } = calcPnl(pos, p);
      return sum + pos.margin + pnl;
    }, 0);
    return s.balance + posVal;
  });

  const alreadyClaimed = lastAttendanceDate === getTodayKST();
  const [refilling, setRefilling] = useState(false);

  const handleAttendance = useCallback(async () => {
    if (!user) return;
    const result = await claimAttendance(user.id);
    if (result.success) toast.success(result.message);
    else toast.info(result.message);
  }, [user, claimAttendance]);

  const handleRefill = useCallback(async () => {
    if (!user) return;
    setRefilling(true);
    const result = await useRefillTicket(user.id);
    if (result.success) toast.success(result.message);
    else toast.error(result.message);
    setRefilling(false);
  }, [user, useRefillTicket]);

  // 비로그인 상태: 잔고 없이 안내만 표시
  if (!user) {
    return (
      <p className="text-[11px] text-muted-foreground text-center py-1">
        로그인 후 거래할 수 있습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">잔고 (USDT)</p>
          <p className="text-sm font-bold text-foreground tabular-nums">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        {user && (
          <button
            onClick={handleAttendance}
            disabled={alreadyClaimed}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg transition-colors ${
              alreadyClaimed
                ? "bg-emerald-500/10 text-emerald-400/60 cursor-default"
                : "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 cursor-pointer"
            }`}
          >
            {alreadyClaimed ? (
              <><Check className="h-3 w-3" />출석 완료</>
            ) : (
              <><Gift className="h-3 w-3" />출석체크</>
            )}
          </button>
        )}
      </div>
      {user && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Ticket className="h-3 w-3 text-amber-400" />
            리필권 <span className="font-bold text-foreground">{refillTickets}개</span>
          </div>
          <button
            onClick={handleRefill}
            disabled={refilling || positions.length > 0 || equity >= 500_000 || refillTickets <= 0}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              positions.length === 0 && equity < 500_000 && refillTickets > 0 && !refilling
                ? "bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 cursor-pointer"
                : "bg-secondary text-muted-foreground/50 cursor-not-allowed pointer-events-none"
            }`}
          >
            <Ticket className="h-3 w-3" />리필하기
          </button>
        </div>
      )}
    </div>
  );
}

/** 숫자 문자열에 천 단위 쉼표 추가 (예: "100000.5" → "100,000.5") */
function addCommas(s: string): string {
  if (!s) return s;
  const parts = s.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

/**
 * 현재가 · 전일 대비 변동액 · 변동률 표시 컴포넌트.
 * memo로 격리되어 있으므로 부모(TradingPanel)가 다른 이유(잔고·포지션)로
 * 리렌더링될 때 이 컴포넌트는 자체 store 구독이 변경될 때만 업데이트됩니다.
 */
const PriceTicker = memo(function PriceTicker() {
  const currentPrice = useTradingStore((s) => s.currentPrice);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const openPrice = useTradingStore((s) => s.openPrices[s.selectedSymbol]);
  const symbolInfo = SYMBOLS[selectedSymbol];

  const hasRef = openPrice > 0 && currentPrice > 0;
  const change = hasRef ? currentPrice - openPrice : 0;
  const changeRate = hasRef ? (change / openPrice) * 100 : 0;
  const isUp = change >= 0;

  // 기준가 없을 때는 중립색, 있으면 등락 색상
  const colorClass = !hasRef
    ? "text-foreground"
    : isUp
      ? "text-red-500"
      : "text-blue-500";

  const changeText = hasRef
    ? `${isUp ? "▲" : "▼"} ${isUp ? "+" : ""}${change.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} (${isUp ? "+" : ""}${changeRate.toFixed(2)}%)`
    : null;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
            selectedSymbol === "BTCUSDT"
              ? "bg-orange-500/20 text-orange-400"
              : "bg-indigo-500/20 text-indigo-400"
          }`}
        >
          {symbolInfo.icon}
        </div>
        <span className="text-xs font-medium text-foreground">
          {symbolInfo.label}
        </span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <p className={`text-xs font-semibold tabular-nums ${colorClass}`}>
          {currentPrice > 0
            ? `$${currentPrice.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "—"}
        </p>
        {changeText && (
          <p className={`text-[10px] tabular-nums leading-none ${colorClass}`}>
            {changeText}
          </p>
        )}
      </div>
    </div>
  );
});

export default function TradingPanel() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const currentPrice = useTradingStore((s) => s.currentPrice);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const symbolInfo = SYMBOLS[selectedSymbol];
  const balance = useTradingStore((s) => s.balance);
  const openPosition = useTradingStore((s) => s.openPosition);
  const submitLimitOrder = useTradingStore((s) => s.submitLimitOrder);

  const [orderType, setOrderType] = useState<OrderType>("market");
  const [leverage, setLeverage] = useState(10);
  const [marginInput, setMarginInput] = useState("");
  const [limitPriceInput, setLimitPriceInput] = useState("");
  const [tpPriceInput, setTpPriceInput] = useState("");
  const [slPriceInput, setSlPriceInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 지정가 입력 ref (flash animation용)
  const limitPriceRef = useRef<HTMLInputElement>(null);

  // ── 호가창 / 차트 가격 클릭 → 지정가 자동 입력 (store 구독) ──
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const unsub = useTradingStore.subscribe((state, prev) => {
      if (state.orderBookPrice != null && state.orderBookPrice !== prev.orderBookPrice) {
        const price = state.orderBookPrice;

        setOrderType("limit");
        setLimitPriceInput(
          price.toLocaleString("en-US", {
            maximumFractionDigits: 2,
            useGrouping: false,
          })
        );

        useTradingStore.getState().setOrderBookPrice(null);

        clearTimeout(timer);
        timer = setTimeout(() => {
          const el = limitPriceRef.current;
          if (el) {
            el.classList.remove("price-flash");
            void el.offsetWidth; // reflow
            el.classList.add("price-flash");
            el.focus();
          }
        }, 60);
      }
    });

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  // 비율 버튼 (수수료 역산 적용)
  // maxMargin = balance / (1 + leverage * feeRate) → 수수료 포함해도 잔고 초과 안 함
  const handlePercentClick = useCallback(
    (percent: number) => {
      const rate = orderType === "market" ? MARKET_FEE_RATE : LIMIT_FEE_RATE;
      const maxMargin = balance / (1 + leverage * rate);
      const amount = (maxMargin * percent) / 100;
      // 소수점 이하 내림 처리하여 1원이라도 넘치지 않도록
      setMarginInput(Math.floor(amount * 100) / 100 + "");
    },
    [balance, leverage, orderType]
  );

  // 수수료 계산
  const marginValue = parseFloat(marginInput) || 0;
  const feeRate = orderType === "market" ? MARKET_FEE_RATE : LIMIT_FEE_RATE;
  const estimatedFee = calcFee(marginValue, leverage, feeRate);
  const positionSize = marginValue * leverage;
  // totalCost = marginValue + estimatedFee (미리보기에서 제거됨)

  // TP/SL 기준가 및 ROE 계산
  const basePrice = parseFloat(limitPriceInput) || currentPrice;
  const tpValue = parseFloat(tpPriceInput) || 0;
  const slValue = parseFloat(slPriceInput) || 0;
  const tpRoe =
    tpValue > 0 && basePrice > 0
      ? ((tpValue - basePrice) / basePrice) * leverage * 100
      : null;
  const slRoe =
    slValue > 0 && basePrice > 0
      ? ((slValue - basePrice) / basePrice) * leverage * 100
      : null;

  // TP/SL % 프리셋 버튼 핸들러
  const handleTpPercent = useCallback(
    (pct: number) => {
      const base = parseFloat(limitPriceInput) || currentPrice;
      if (base <= 0) return;
      setTpPriceInput((base * (1 + pct / 100)).toFixed(2));
    },
    [limitPriceInput, currentPrice]
  );

  const handleSlPercent = useCallback(
    (pct: number) => {
      const base = parseFloat(limitPriceInput) || currentPrice;
      if (base <= 0) return;
      setSlPriceInput((base * (1 + pct / 100)).toFixed(2));
    },
    [limitPriceInput, currentPrice]
  );

  // 주문 실행 (시장가 + 지정가 통합)
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

      // 수수료 포함 최종 검증
      const rate = orderType === "market" ? MARKET_FEE_RATE : LIMIT_FEE_RATE;
      const fee = calcFee(margin, leverage, rate);
      if (margin + fee > balance) {
        toast.error(
          "잔고가 부족합니다. (수수료 포함) 비율 버튼을 이용해보세요."
        );
        return;
      }

      setSubmitting(true);

      if (orderType === "market") {
        // ── 시장가 주문 ──
        if (currentPrice <= 0) {
          toast.error(
            "현재 가격을 불러오는 중입니다. 잠시 후 다시 시도해주세요."
          );
          setSubmitting(false);
          return;
        }

        const result = await openPosition({
          userId: user.id,
          positionType: direction,
          leverage,
          margin,
          entryPrice: currentPrice,
        });

        if (result.success) {
          toast.success(result.message);
          setMarginInput("");
        } else {
          toast.error(result.message);
        }
      } else {
        // ── 지정가 주문 ──
        const limitPrice = parseFloat(limitPriceInput);
        if (isNaN(limitPrice) || limitPrice <= 0) {
          toast.error("체결 가격을 입력해주세요.");
          setSubmitting(false);
          return;
        }

        const tpPrice = parseFloat(tpPriceInput) || undefined;
        const slPrice = parseFloat(slPriceInput) || undefined;

        const result = await submitLimitOrder({
          userId: user.id,
          positionType: direction,
          leverage,
          margin,
          limitPrice,
          tpPrice,
          slPrice,
        });

        if (result.success) {
          toast.success(result.message);
          setMarginInput("");
          setLimitPriceInput("");
          setTpPriceInput("");
          setSlPriceInput("");
        } else {
          toast.error(result.message);
        }
      }

      setSubmitting(false);
    },
    [
      user,
      marginInput,
      limitPriceInput,
      tpPriceInput,
      slPriceInput,
      leverage,
      balance,
      currentPrice,
      orderType,
      openPosition,
      submitLimitOrder,
      navigate,
    ]
  );

  return (
    <div className="bg-card border border-border rounded-xl p-3 flex flex-col gap-2.5">
      {/* ── 잔고 + 리필권 + 출석체크 ── */}
      <BalanceSection user={user} />

      <div className="h-px bg-border" />

      {/* ── 현재가 + 전일 대비 변동 ── */}
      <PriceTicker />

      {/* ── 주문 유형 탭 (시장가 / 지정가) ── */}
      <Tabs value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
        <TabsList>
          <TabsTrigger value="market">시장가</TabsTrigger>
          <TabsTrigger value="limit">지정가</TabsTrigger>
        </TabsList>

        <TabsContent value="market" />

        <TabsContent value="limit">
          <div className="mt-1.5 space-y-1.5">
            {/* 체결 가격 */}
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">체결 가격 (USDT)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <input
                  ref={limitPriceRef}
                  type="text"
                  value={addCommas(limitPriceInput)}
                  onChange={(e) => setLimitPriceInput(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-full bg-secondary border border-border rounded-lg pl-6 pr-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring tabular-nums"
                  placeholder={currentPrice > 0 ? currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "가격 입력"}
                />
              </div>
            </div>

            {/* TP / SL */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[10px] text-emerald-400/80 mb-0.5 block">TP (익절가)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                  <input
                    type="text"
                    value={addCommas(tpPriceInput)}
                    onChange={(e) => setTpPriceInput(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full bg-secondary border border-border rounded-lg pl-5 pr-1.5 py-1.5 text-[10px] text-foreground outline-none focus:ring-1 focus:ring-emerald-500/50 tabular-nums"
                    placeholder="선택"
                  />
                </div>
                <div className="flex gap-0.5 mt-0.5">
                  {TP_PRESETS.map((pct) => (
                    <button key={pct} onClick={() => handleTpPercent(pct)}
                      className="flex-1 text-[9px] py-0.5 rounded bg-emerald-500/10 text-emerald-400/80 hover:bg-emerald-500/20 transition-colors cursor-pointer">
                      +{pct}%
                    </button>
                  ))}
                </div>
                {tpRoe !== null && (
                  <p className={`text-[9px] mt-0.5 tabular-nums ${tpRoe >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    ROE {tpRoe >= 0 ? "+" : ""}{tpRoe.toFixed(1)}%
                  </p>
                )}
              </div>
              <div>
                <label className="text-[10px] text-red-400/80 mb-0.5 block">SL (손절가)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                  <input
                    type="text"
                    value={addCommas(slPriceInput)}
                    onChange={(e) => setSlPriceInput(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full bg-secondary border border-border rounded-lg pl-5 pr-1.5 py-1.5 text-[10px] text-foreground outline-none focus:ring-1 focus:ring-red-500/50 tabular-nums"
                    placeholder="선택"
                  />
                </div>
                <div className="flex gap-0.5 mt-0.5">
                  {SL_PRESETS.map((pct) => (
                    <button key={pct} onClick={() => handleSlPercent(pct)}
                      className="flex-1 text-[9px] py-0.5 rounded bg-red-500/10 text-red-400/80 hover:bg-red-500/20 transition-colors cursor-pointer">
                      {pct}%
                    </button>
                  ))}
                </div>
                {slRoe !== null && (
                  <p className={`text-[9px] mt-0.5 tabular-nums ${slRoe >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    ROE {slRoe >= 0 ? "+" : ""}{slRoe.toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── 레버리지 슬라이더 ── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-muted-foreground">레버리지</label>
          <span className="text-xs font-bold text-indigo-400">{leverage}x</span>
        </div>
        <input
          type="range" min={1} max={125} value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-indigo-500
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
        />
        <div className="flex gap-0.5 mt-1 flex-wrap">
          {LEVERAGE_PRESETS.map((lev) => (
            <button key={lev} onClick={() => setLeverage(lev)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                leverage === lev
                  ? "bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              {lev}x
            </button>
          ))}
        </div>
      </div>

      {/* ── 증거금 입력 ── */}
      <div>
        <label className="text-[10px] text-muted-foreground mb-1 block">증거금 (USDT)</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
          <input
            type="text"
            value={addCommas(marginInput)}
            onChange={(e) => setMarginInput(e.target.value.replace(/[^0-9.]/g, ""))}
            className="w-full bg-secondary border border-border rounded-lg pl-6 pr-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring tabular-nums"
            placeholder="금액 입력"
          />
        </div>
        <div className="flex gap-1 mt-1.5">
          {PERCENT_PRESETS.map((pct) => (
            <button key={pct} onClick={() => handlePercentClick(pct)}
              className="flex-1 text-[10px] py-1 rounded-md bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* ── 수수료 미리보기 (증거금 입력 시) ── */}
      {marginValue > 0 && (
        <div className="bg-secondary/60 rounded-lg px-2.5 py-1.5 text-[10px] text-muted-foreground space-y-0.5">
          <div className="flex justify-between">
            <span>포지션 사이즈</span>
            <span className="text-foreground font-medium tabular-nums">
              ${positionSize.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>수수료 ({orderType === "market" ? "0.04%" : "0.02%"})</span>
            <span className="text-amber-400 font-medium tabular-nums">
              ${estimatedFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="h-px bg-border/50 my-0.5" />
          {orderType === "market" && currentPrice > 0 && (
            <div className="flex justify-between gap-2">
              <span>청산가 L / S</span>
              <span className="text-foreground font-medium tabular-nums text-right">
                ${(currentPrice * (1 - 1 / leverage)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                {" / "}
                ${(currentPrice * (1 + 1 / leverage)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {orderType === "limit" && parseFloat(limitPriceInput) > 0 && (
            <div className="flex justify-between gap-2">
              <span>청산가 L / S</span>
              <span className="text-foreground font-medium tabular-nums text-right">
                ${(parseFloat(limitPriceInput) * (1 - 1 / leverage)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                {" / "}
                ${(parseFloat(limitPriceInput) * (1 + 1 / leverage)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Long / Short 버튼 ── */}
      <div className="flex gap-2">
        <Button
          onClick={() => handleTrade("LONG")}
          disabled={submitting}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 h-9"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Long
        </Button>
        <Button
          onClick={() => handleTrade("SHORT")}
          disabled={submitting}
          className="flex-1 bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 h-9"
        >
          <TrendingDown className="h-3.5 w-3.5" />
          Short
        </Button>
      </div>

      {/* 비로그인 안내 */}
      {!user && (
        <p className="text-[10px] text-center text-muted-foreground">
          거래하려면 로그인이 필요합니다
        </p>
      )}

      {/* 면책 문구 */}
      <p className="text-[9px] text-center text-muted-foreground/30 leading-relaxed">
        본 서비스는 모의투자 게임입니다. 실제 투자가 아닙니다.
      </p>
    </div>
  );
}
