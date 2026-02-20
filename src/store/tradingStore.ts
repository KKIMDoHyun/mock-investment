import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { playSuccessSound, playErrorSound, playCheckSound } from "@/lib/sound";

// ── 수수료율 상수 ──

/** 시장가(Taker) 수수료 0.04% */
export const MARKET_FEE_RATE = 0.0004;
/** 지정가(Maker) 수수료 0.02% */
export const LIMIT_FEE_RATE = 0.0002;

/** 수수료 계산: (증거금 × 레버리지) × 수수료율 */
export function calcFee(
  margin: number,
  leverage: number,
  feeRate: number
): number {
  return margin * leverage * feeRate;
}

// ── 타입 정의 ──

export interface Trade {
  id: string;
  user_id: string;
  position_type: "LONG" | "SHORT";
  leverage: number;
  margin: number;
  entry_price: number;
  liquidation_price: number | null;
  close_price: number | null;
  profit_loss: number | null;
  tp_price: number | null;
  sl_price: number | null;
  status: "OPEN" | "CLOSED";
  created_at: string;
  closed_at: string | null;
}

export interface LimitOrder {
  id: string;
  user_id: string;
  position_type: "LONG" | "SHORT";
  leverage: number;
  margin: number;
  limit_price: number;
  tp_price: number | null;
  sl_price: number | null;
  fee: number;
  type: "LIMIT";
  status: "PENDING" | "FILLED" | "CANCELLED";
  created_at: string;
}

interface TradingState {
  /** 바이낸스 실시간 BTCUSDT 현재가 */
  currentPrice: number;
  /** 유저 잔고 (USDT) */
  balance: number;
  /** OPEN 상태인 포지션 목록 */
  positions: Trade[];
  /** CLOSED 포지션 목록 (거래 내역) */
  closedTrades: Trade[];
  /** PENDING 지정가 주문 목록 */
  pendingOrders: LimitOrder[];
  /** 마지막 출석체크 날짜 (YYYY-MM-DD) */
  lastAttendanceDate: string | null;
  /** 데이터 로딩 중 여부 */
  loading: boolean;

  setCurrentPrice: (price: number) => void;

  /** Supabase에서 포트폴리오(잔고) 가져오기 */
  fetchPortfolio: (userId: string) => Promise<void>;

  /** 출석체크 보상 (1,000,000 포인트) */
  claimAttendance: (userId: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  /** OPEN 상태 포지션 조회 */
  fetchOpenPositions: (userId: string) => Promise<void>;

  /** CLOSED 포지션 조회 (거래 내역) */
  fetchClosedTrades: (userId: string) => Promise<void>;

  /** PENDING 지정가 주문 조회 */
  fetchPendingOrders: (userId: string) => Promise<void>;

  /** 포지션 오픈 (시장가) */
  openPosition: (params: {
    userId: string;
    positionType: "LONG" | "SHORT";
    leverage: number;
    margin: number;
    entryPrice: number;
  }) => Promise<{ success: boolean; message: string }>;

  /** 포지션 종료 (시장가) */
  closePosition: (
    tradeId: string,
    closePrice: number
  ) => Promise<{ success: boolean; message: string }>;

  /** 지정가 주문 제출 */
  submitLimitOrder: (params: {
    userId: string;
    positionType: "LONG" | "SHORT";
    leverage: number;
    margin: number;
    limitPrice: number;
    tpPrice?: number;
    slPrice?: number;
  }) => Promise<{ success: boolean; message: string }>;

  /** 지정가 주문 취소 */
  cancelLimitOrder: (
    orderId: string
  ) => Promise<{ success: boolean; message: string }>;

  /** 호가창에서 선택된 가격 (→ TradingPanel 연동) */
  orderBookPrice: number | null;
  setOrderBookPrice: (price: number | null) => void;
}

// ────────────────────────────────────────────
// 모듈-레벨 WebSocket 관리 (컴포넌트 생명주기와 무관)
// ────────────────────────────────────────────
const PRICE_WS_URL = "wss://fstream.binance.com/ws/btcusdt@aggTrade";
const THROTTLE_MS = 250; // 250ms마다 가격 업데이트 (초당 최대 4회)
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;

let priceWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = RECONNECT_BASE_MS;
let lastPriceTs = 0;
let streamActive = false; // startPriceStream 호출 여부

// ── 헬퍼: 청산가 계산 ──
function calcLiquidationPrice(
  positionType: "LONG" | "SHORT",
  entryPrice: number,
  leverage: number
): number {
  if (entryPrice <= 0 || leverage <= 0) return 0;
  return positionType === "LONG"
    ? entryPrice * (1 - 1 / leverage)
    : entryPrice * (1 + 1 / leverage);
}

// ── 헬퍼: 포지션 병합(물타기) 또는 신규 생성 ──

interface MergeResult {
  trade: Trade | null;
  merged: boolean;
  mergedFromId?: string;
  hasTpSl?: boolean;
  error?: string;
}

async function mergeOrCreatePosition(params: {
  userId: string;
  positionType: "LONG" | "SHORT";
  leverage: number;
  margin: number;
  entryPrice: number;
  tpPrice?: number | null;
  slPrice?: number | null;
}): Promise<MergeResult> {
  // 1) 동일 방향 OPEN 포지션이 이미 있는지 확인
  const { data: existingRows } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", params.userId)
    .eq("position_type", params.positionType)
    .eq("status", "OPEN")
    .limit(1);

  const existingRaw =
    existingRows && existingRows.length > 0 ? existingRows[0] : null;

  if (existingRaw) {
    const existing = sanitizeTrade(existingRaw as Record<string, unknown>);

    // ── 가중평균 진입가 계산 ──
    // 수량(BTC) = (증거금 × 레버리지) / 진입가
    const oldNotional = existing.margin * existing.leverage;
    const newNotional = params.margin * params.leverage;
    const oldQty = oldNotional / existing.entry_price;
    const newQty = newNotional / params.entryPrice;
    const totalQty = oldQty + newQty;

    const mergedEntry =
      (oldQty * existing.entry_price + newQty * params.entryPrice) / totalQty;

    // ── 증거금 합산 ──
    const mergedMargin = existing.margin + params.margin;

    // ── 실효 레버리지 재계산 ──
    // 총 명목가치 / 총 증거금 (DB integer 컬럼이므로 반올림)
    const mergedLeverage = Math.round(
      (oldNotional + newNotional) / mergedMargin
    );

    // ── 기존 TP/SL 유지 ──
    const hasTpSl = existing.tp_price != null || existing.sl_price != null;

    // 청산가 재계산
    const mergedLiqPrice = calcLiquidationPrice(
      params.positionType,
      mergedEntry,
      mergedLeverage
    );

    const { data: updated, error: updateErr } = await supabase
      .from("trades")
      .update({
        entry_price: mergedEntry,
        margin: mergedMargin,
        leverage: mergedLeverage,
        liquidation_price: mergedLiqPrice,
        // tp_price, sl_price는 기존 값 유지 (건드리지 않음)
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateErr || !updated) {
      return {
        trade: null,
        merged: false,
        error: updateErr?.message ?? "포지션 병합 실패",
      };
    }

    return {
      trade: sanitizeTrade(updated as Record<string, unknown>),
      merged: true,
      mergedFromId: existing.id,
      hasTpSl,
    };
  }

  // 2) 기존 포지션 없음 → 신규 생성
  const newLiqPrice = calcLiquidationPrice(
    params.positionType,
    params.entryPrice,
    params.leverage
  );

  const { data: newTrade, error: tradeErr } = await supabase
    .from("trades")
    .insert({
      user_id: params.userId,
      position_type: params.positionType,
      leverage: params.leverage,
      margin: params.margin,
      entry_price: params.entryPrice,
      liquidation_price: newLiqPrice,
      tp_price: params.tpPrice ?? null,
      sl_price: params.slPrice ?? null,
      status: "OPEN",
    })
    .select()
    .single();

  if (tradeErr || !newTrade) {
    return {
      trade: null,
      merged: false,
      error: tradeErr?.message ?? "포지션 생성 실패",
    };
  }

  return {
    trade: sanitizeTrade(newTrade as Record<string, unknown>),
    merged: false,
  };
}

// ── 지정가 주문 체결 감시 ──
let isCheckingOrders = false;

async function checkAndFillPendingOrders(currentPrice: number) {
  if (isCheckingOrders) return;
  const { pendingOrders } = useTradingStore.getState();
  if (pendingOrders.length === 0) return;

  isCheckingOrders = true;
  try {
    const ordersToFill = pendingOrders.filter((o) => {
      if (o.position_type === "LONG") return currentPrice <= o.limit_price;
      if (o.position_type === "SHORT") return currentPrice >= o.limit_price;
      return false;
    });

    for (const order of ordersToFill) {
      // 1) 주문 상태 → FILLED
      const { error: orderErr } = await supabase
        .from("orders")
        .update({ status: "FILLED" })
        .eq("id", order.id);

      if (orderErr) continue;

      // 2) 포지션 병합 또는 신규 생성 (TP/SL 전이)
      const result = await mergeOrCreatePosition({
        userId: order.user_id,
        positionType: order.position_type,
        leverage: order.leverage,
        margin: order.margin,
        entryPrice: order.limit_price,
        tpPrice: order.tp_price,
        slPrice: order.sl_price,
      });

      if (!result.trade) continue;

      // 3) 로컬 상태 동기화
      if (result.merged && result.mergedFromId) {
        // 물타기: 기존 포지션 교체
        useTradingStore.setState((s) => ({
          pendingOrders: s.pendingOrders.filter((o) => o.id !== order.id),
          positions: s.positions.map((p) =>
            p.id === result.mergedFromId ? result.trade! : p
          ),
        }));

        toast.success(
          `${order.position_type} ${
            order.leverage
          }x 지정가 체결 (물타기)! @ $${order.limit_price.toLocaleString()}`
        );
        playSuccessSound();
        if (result.hasTpSl) {
          toast.info("📊 평단가가 변경되었습니다. TP/SL을 확인해주세요.");
        }
      } else {
        // 신규 포지션
        useTradingStore.setState((s) => ({
          pendingOrders: s.pendingOrders.filter((o) => o.id !== order.id),
          positions: [result.trade!, ...s.positions],
        }));

        toast.success(
          `${order.position_type} ${
            order.leverage
          }x 지정가 체결! @ $${order.limit_price.toLocaleString()}`
        );
        playSuccessSound();
      }
    }
  } finally {
    isCheckingOrders = false;
  }
}

// ── 강제 청산(Liquidation) 감시 ──
let isCheckingLiquidation = false;

async function checkLiquidation(currentPrice: number) {
  if (isCheckingLiquidation) return;
  const state = useTradingStore.getState();
  if (state.positions.length === 0) return;

  // 청산가가 설정된 포지션만 대상
  const candidates = state.positions.filter(
    (t) => t.liquidation_price != null && t.liquidation_price > 0
  );
  if (candidates.length === 0) return;

  isCheckingLiquidation = true;
  try {
    for (const trade of [...candidates]) {
      const liqPrice = trade.liquidation_price!;
      let shouldLiquidate = false;

      if (trade.position_type === "LONG" && currentPrice <= liqPrice) {
        shouldLiquidate = true;
      } else if (trade.position_type === "SHORT" && currentPrice >= liqPrice) {
        shouldLiquidate = true;
      }

      if (shouldLiquidate) {
        // 강제 청산: 청산가에서 포지션 종료 (증거금 전액 손실)
        const result = await useTradingStore
          .getState()
          .closePosition(trade.id, liqPrice);

        if (result.success) {
          toast.error(
            `⚠️ 강제 청산! ${trade.position_type} ${
              trade.leverage
            }x @ $${liqPrice.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })} — 증거금 $${trade.margin.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })} 전액 손실`,
            { duration: 10000 }
          );
          playErrorSound();
        }
      }
    }
  } finally {
    isCheckingLiquidation = false;
  }
}

// ── TP/SL 자동 체결 감시 ──
let isCheckingTpSl = false;

async function checkTpSlPositions(currentPrice: number) {
  if (isCheckingTpSl) return;
  const state = useTradingStore.getState();
  if (state.positions.length === 0) return;

  // TP/SL이 설정된 포지션만 필터
  const candidates = state.positions.filter(
    (t) => t.tp_price != null || t.sl_price != null
  );
  if (candidates.length === 0) return;

  isCheckingTpSl = true;
  try {
    // 이터레이션 중 positions 변경 방지를 위해 스냅샷 사용
    for (const trade of [...candidates]) {
      let closePrice = 0;
      let reason = "";

      if (trade.position_type === "LONG") {
        if (trade.tp_price && currentPrice >= trade.tp_price) {
          closePrice = trade.tp_price;
          reason = "🎯 TP";
        } else if (trade.sl_price && currentPrice <= trade.sl_price) {
          closePrice = trade.sl_price;
          reason = "🛑 SL";
        }
      } else {
        // SHORT
        if (trade.tp_price && currentPrice <= trade.tp_price) {
          closePrice = trade.tp_price;
          reason = "🎯 TP";
        } else if (trade.sl_price && currentPrice >= trade.sl_price) {
          closePrice = trade.sl_price;
          reason = "🛑 SL";
        }
      }

      if (closePrice > 0) {
        const result = await useTradingStore
          .getState()
          .closePosition(trade.id, closePrice);
        if (result.success) {
          toast.info(
            `${reason} 체결! ${trade.position_type} ${
              trade.leverage
            }x @ $${closePrice.toLocaleString()}`
          );
          playSuccessSound();
        }
      }
    }
  } finally {
    isCheckingTpSl = false;
  }
}

function connectPriceWs() {
  if (!streamActive) return;
  if (
    priceWs?.readyState === WebSocket.OPEN ||
    priceWs?.readyState === WebSocket.CONNECTING
  )
    return;

  priceWs = new WebSocket(PRICE_WS_URL);

  priceWs.onopen = () => {
    reconnectDelay = RECONNECT_BASE_MS; // 성공 시 딜레이 초기화
  };

  priceWs.onmessage = (event: MessageEvent) => {
    try {
      const now = Date.now();
      if (now - lastPriceTs < THROTTLE_MS) return; // 쓰로틀링

      const msg = JSON.parse(event.data as string);
      const price = parseFloat(msg.p); // aggTrade → "p" = price
      if (Number.isFinite(price) && price > 0) {
        lastPriceTs = now;
        useTradingStore.setState({ currentPrice: price });

        // 강제 청산 체크 (최우선 — 청산가 도달 시 즉시 종료)
        checkLiquidation(price);
        // 지정가 주문 체결 체크 (비동기 — WebSocket 블로킹 X)
        checkAndFillPendingOrders(price);
        // TP/SL 자동 체결 체크
        checkTpSlPositions(price);
      }
    } catch {
      // 비정상 메시지 무시
    }
  };

  priceWs.onclose = () => {
    priceWs = null;
    if (streamActive) {
      reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 1.5, RECONNECT_MAX_MS);
        connectPriceWs();
      }, reconnectDelay);
    }
  };

  priceWs.onerror = () => {
    priceWs?.close(); // onclose가 재연결을 처리
  };
}

/** 가격 스트림 시작 (RootLayout 마운트 시 호출) */
export function startPriceStream() {
  streamActive = true;
  connectPriceWs();
}

/** 가격 스트림 중지 (RootLayout 언마운트 시 호출) */
export function stopPriceStream() {
  streamActive = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (priceWs) {
    priceWs.onclose = null; // 자동 재연결 방지
    priceWs.close();
    priceWs = null;
  }
}

// ── 헬퍼: 오늘 날짜 (YYYY-MM-DD, 한국 시간) ──
function getTodayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// ── 헬퍼: Supabase numeric → JS number 안전 변환 ──
function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Trade 객체의 숫자 필드를 실제 number 타입으로 보정 (Supabase numeric → string 대비) */
export function sanitizeTrade(raw: Record<string, unknown>): Trade {
  return {
    ...raw,
    leverage: toNum(raw.leverage),
    margin: toNum(raw.margin),
    entry_price: toNum(raw.entry_price),
    liquidation_price:
      raw.liquidation_price != null ? toNum(raw.liquidation_price) : null,
    close_price: raw.close_price != null ? toNum(raw.close_price) : null,
    profit_loss: raw.profit_loss != null ? toNum(raw.profit_loss) : null,
    tp_price: raw.tp_price != null ? toNum(raw.tp_price) : null,
    sl_price: raw.sl_price != null ? toNum(raw.sl_price) : null,
  } as Trade;
}

/** LimitOrder 객체의 숫자 필드를 실제 number 타입으로 보정 */
export function sanitizeLimitOrder(raw: Record<string, unknown>): LimitOrder {
  return {
    ...raw,
    leverage: toNum(raw.leverage),
    margin: toNum(raw.margin),
    limit_price: toNum(raw.limit_price),
    tp_price: raw.tp_price != null ? toNum(raw.tp_price) : null,
    sl_price: raw.sl_price != null ? toNum(raw.sl_price) : null,
    fee: toNum(raw.fee),
  } as LimitOrder;
}

// ── 헬퍼: PnL 계산 ──
export function calcPnl(
  trade: Trade,
  currentPrice: number
): { pnl: number; roe: number; liqPrice: number } {
  const entryPrice = toNum(trade.entry_price);
  const leverage = toNum(trade.leverage);
  const margin = toNum(trade.margin);
  const price = toNum(currentPrice);

  // 청산가: DB에 저장된 값 우선, 없으면 동적 계산
  let liqPrice =
    trade.liquidation_price != null && trade.liquidation_price > 0
      ? trade.liquidation_price
      : 0;
  if (liqPrice <= 0 && entryPrice > 0 && leverage > 0) {
    liqPrice =
      trade.position_type === "LONG"
        ? entryPrice * (1 - 1 / leverage)
        : entryPrice * (1 + 1 / leverage);
  }

  // PnL 은 현재가 & 진입가가 모두 > 0 일 때만 유의미
  let pnl = 0;
  let roe = 0;
  if (entryPrice > 0 && price > 0 && leverage > 0 && margin > 0) {
    pnl =
      trade.position_type === "LONG"
        ? ((price - entryPrice) / entryPrice) * leverage * margin
        : ((entryPrice - price) / entryPrice) * leverage * margin;
    roe = (pnl / margin) * 100;
  }

  return {
    pnl: Number.isFinite(pnl) ? pnl : 0,
    roe: Number.isFinite(roe) ? roe : 0,
    liqPrice: Number.isFinite(liqPrice) ? liqPrice : 0,
  };
}

// ── 스토어 ──

export const useTradingStore = create<TradingState>((set, get) => ({
  currentPrice: 0,
  balance: 0,
  positions: [],
  closedTrades: [],
  pendingOrders: [],
  lastAttendanceDate: null,
  loading: false,

  setCurrentPrice: (price) => set({ currentPrice: price }),

  orderBookPrice: null,
  setOrderBookPrice: (price) => set({ orderBookPrice: price }),

  // ── 포트폴리오 조회 ──
  fetchPortfolio: async (userId) => {
    const { data, error } = await supabase
      .from("portfolios")
      .select("balance, last_attendance_date")
      .eq("user_id", userId)
      .single();

    if (error && error.code === "PGRST116") {
      // 행이 없으면 새로 생성
      const { data: newRow, error: insertErr } = await supabase
        .from("portfolios")
        .insert({ user_id: userId, balance: 0, total_principal: 0 })
        .select("balance, last_attendance_date")
        .single();

      if (insertErr) {
        console.error("포트폴리오 생성 에러:", insertErr.message);
        return;
      }
      if (newRow) {
        set({
          balance: toNum(newRow.balance),
          lastAttendanceDate: newRow.last_attendance_date,
        });
      }
      return;
    }

    if (error) {
      console.error("포트폴리오 조회 에러:", error.message);
      return;
    }

    if (data) {
      set({
        balance: toNum(data.balance),
        lastAttendanceDate: data.last_attendance_date,
      });
    }
  },

  // ── 출석체크 보상 ──
  claimAttendance: async (userId) => {
    const today = getTodayKST();
    const { lastAttendanceDate } = get();

    if (lastAttendanceDate === today) {
      return { success: false, message: "내일 다시 와주세요! 🕐" };
    }

    const { data, error } = await supabase.rpc("claim_attendance", {
      p_user_id: userId,
      p_today: today,
      p_reward: 1000000,
    });

    if (error) {
      // RPC가 없으면 직접 업데이트
      const { balance } = get();
      const newBalance = balance + 1000000;

      // 현재 total_principal 조회
      const { data: curPortfolio } = await supabase
        .from("portfolios")
        .select("total_principal")
        .eq("user_id", userId)
        .single();
      const curPrincipal = Number(curPortfolio?.total_principal) || 0;

      const { error: updateErr } = await supabase
        .from("portfolios")
        .update({
          balance: newBalance,
          total_principal: curPrincipal + 1000000,
          last_attendance_date: today,
        })
        .eq("user_id", userId);

      if (updateErr) {
        return { success: false, message: `에러: ${updateErr.message}` };
      }

      set({ balance: newBalance, lastAttendanceDate: today });
      playCheckSound();
      return {
        success: true,
        message: "💰 1,000,000 포인트를 받았습니다!",
      };
    }

    if (data === false) {
      set({ lastAttendanceDate: today });
      return { success: false, message: "내일 다시 와주세요! 🕐" };
    }

    // 성공 시 잔고 갱신
    await get().fetchPortfolio(userId);
    playCheckSound();
    return {
      success: true,
      message: "💰 1,000,000 포인트를 받았습니다!",
    };
  },

  // ── OPEN 포지션 조회 ──
  fetchOpenPositions: async (userId) => {
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "OPEN")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("포지션 조회 에러:", error.message);
      return;
    }

    // Supabase numeric 타입이 string 으로 올 수 있으므로 안전 변환
    const positions = (data ?? [])
      .map((row) => sanitizeTrade(row as Record<string, unknown>))
      .filter((t) => t.entry_price > 0); // 진입가 0인 비정상 데이터 제외
    set({ positions });
  },

  // ── CLOSED 포지션 조회 (거래 내역) ──
  fetchClosedTrades: async (userId) => {
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "CLOSED")
      .order("closed_at", { ascending: false });

    if (error) {
      console.error("거래 내역 조회 에러:", error.message);
      return;
    }

    const closedTrades = (data ?? []).map((row) =>
      sanitizeTrade(row as Record<string, unknown>)
    );
    set({ closedTrades });
  },

  // ── PENDING 지정가 주문 조회 ──
  fetchPendingOrders: async (userId) => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("대기 주문 조회 에러:", error.message);
      return;
    }

    const pendingOrders = (data ?? []).map((row) =>
      sanitizeLimitOrder(row as Record<string, unknown>)
    );
    set({ pendingOrders });

    // 현재 가격이 이미 있으면 즉시 체결 체크 (앱 재접속 시)
    const { currentPrice } = get();
    if (currentPrice > 0 && pendingOrders.length > 0) {
      checkAndFillPendingOrders(currentPrice);
    }
  },

  // ── 포지션 오픈 (시장가) ──
  openPosition: async ({
    userId,
    positionType,
    leverage,
    margin,
    entryPrice,
  }) => {
    const { balance } = get();

    // 수수료 계산
    const fee = calcFee(margin, leverage, MARKET_FEE_RATE);
    const totalCost = margin + fee;

    // 검증
    if (margin <= 0) {
      return { success: false, message: "주문 금액을 입력해주세요." };
    }
    if (totalCost > balance) {
      return { success: false, message: "잔고가 부족합니다. (수수료 포함)" };
    }
    if (entryPrice <= 0) {
      return {
        success: false,
        message: "현재 가격을 불러오는 중입니다. 잠시 후 다시 시도해주세요.",
      };
    }

    // 1) 잔고 차감 (증거금 + 수수료)
    const newBalance = balance - totalCost;
    const { error: balanceErr } = await supabase
      .from("portfolios")
      .update({ balance: newBalance })
      .eq("user_id", userId);

    if (balanceErr) {
      return {
        success: false,
        message: `잔고 차감 에러: ${balanceErr.message}`,
      };
    }

    // 2) 포지션 병합 또는 신규 생성
    const result = await mergeOrCreatePosition({
      userId,
      positionType,
      leverage,
      margin,
      entryPrice,
    });

    if (!result.trade) {
      // 롤백: 잔고 복구
      await supabase
        .from("portfolios")
        .update({ balance })
        .eq("user_id", userId);
      return {
        success: false,
        message: `포지션 에러: ${result.error ?? "데이터 반환 실패"}`,
      };
    }

    // 3) 상태 동기화
    if (result.merged && result.mergedFromId) {
      // 물타기: 기존 포지션을 업데이트된 데이터로 교체
      set((state) => ({
        balance: newBalance,
        positions: state.positions.map((p) =>
          p.id === result.mergedFromId ? result.trade! : p
        ),
      }));

      // TP/SL이 있으면 확인 필요 알림
      if (result.hasTpSl) {
        toast.info("📊 평단가가 변경되었습니다. TP/SL을 확인해주세요.");
      }

      playSuccessSound();
      return {
        success: true,
        message: `${positionType} ${leverage}x 물타기 완료! 평단: $${result.trade.entry_price.toLocaleString(
          undefined,
          { maximumFractionDigits: 2 }
        )} (수수료: $${fee.toFixed(2)}) 📊`,
      };
    } else {
      // 신규 포지션
      set((state) => ({
        balance: newBalance,
        positions: [result.trade!, ...state.positions],
      }));

      playSuccessSound();
      return {
        success: true,
        message: `${positionType} ${leverage}x 포지션 오픈! (수수료: $${fee.toFixed(
          2
        )}) 💪`,
      };
    }
  },

  // ── 포지션 종료 ──
  closePosition: async (tradeId, closePrice) => {
    const { positions, balance } = get();
    const trade = positions.find((p) => p.id === tradeId);

    if (!trade) {
      return { success: false, message: "포지션을 찾을 수 없습니다." };
    }

    // PnL 계산
    const { pnl } = calcPnl(trade, closePrice);

    // 종료 수수료 계산 (시장가 기준)
    const closeFee = calcFee(trade.margin, trade.leverage, MARKET_FEE_RATE);

    const returnAmount = trade.margin + pnl - closeFee; // 원금 + 손익 - 수수료
    const finalReturn = Math.max(returnAmount, 0);
    const newBalance = balance + finalReturn;

    // 1) 잔고 업데이트
    const { error: balanceErr } = await supabase
      .from("portfolios")
      .update({ balance: newBalance })
      .eq("user_id", trade.user_id);

    if (balanceErr) {
      return {
        success: false,
        message: `잔고 업데이트 에러: ${balanceErr.message}`,
      };
    }

    // 2) 포지션 종료 (profit_loss 저장)
    const closedAt = new Date().toISOString();
    const { error: closeErr } = await supabase
      .from("trades")
      .update({
        close_price: closePrice,
        profit_loss: pnl,
        status: "CLOSED",
        closed_at: closedAt,
      })
      .eq("id", tradeId);

    if (closeErr) {
      return {
        success: false,
        message: `포지션 종료 에러: ${closeErr.message}`,
      };
    }

    // 3) 상태 동기화
    const closedTrade: Trade = {
      ...trade,
      close_price: closePrice,
      profit_loss: pnl,
      status: "CLOSED",
      closed_at: closedAt,
    };

    set((state) => ({
      balance: newBalance,
      positions: state.positions.filter((p) => p.id !== tradeId),
      closedTrades: [closedTrade, ...state.closedTrades],
    }));

    const pnlText =
      pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;

    return {
      success: true,
      message: `포지션 종료! 손익: ${pnlText} (수수료: $${closeFee.toFixed(
        2
      )})`,
    };
  },

  // ── 지정가 주문 제출 ──
  submitLimitOrder: async ({
    userId,
    positionType,
    leverage,
    margin,
    limitPrice,
    tpPrice,
    slPrice,
  }) => {
    const { balance } = get();

    // 수수료 계산 (지정가 = Maker)
    const fee = calcFee(margin, leverage, LIMIT_FEE_RATE);
    const totalCost = margin + fee;

    // 검증
    if (margin <= 0) {
      return { success: false, message: "주문 금액을 입력해주세요." };
    }
    if (limitPrice <= 0) {
      return { success: false, message: "체결 가격을 입력해주세요." };
    }
    if (totalCost > balance) {
      return { success: false, message: "잔고가 부족합니다. (수수료 포함)" };
    }

    // 1) 잔고 차감 (증거금 + 수수료 Hold)
    const newBalance = balance - totalCost;
    const { error: balanceErr } = await supabase
      .from("portfolios")
      .update({ balance: newBalance })
      .eq("user_id", userId);

    if (balanceErr) {
      return {
        success: false,
        message: `잔고 차감 에러: ${balanceErr.message}`,
      };
    }

    // 2) 주문 삽입 (TP/SL 포함)
    const { data: newOrder, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        position_type: positionType,
        leverage,
        margin,
        limit_price: limitPrice,
        tp_price: tpPrice || null,
        sl_price: slPrice || null,
        fee,
        type: "LIMIT",
        status: "PENDING",
      })
      .select()
      .single();

    if (orderErr || !newOrder) {
      // 롤백: 잔고 복구
      await supabase
        .from("portfolios")
        .update({ balance })
        .eq("user_id", userId);
      return {
        success: false,
        message: `주문 생성 에러: ${orderErr?.message ?? "데이터 반환 실패"}`,
      };
    }

    // 3) 상태 동기화
    const order = sanitizeLimitOrder(newOrder as Record<string, unknown>);
    set((s) => ({
      balance: newBalance,
      pendingOrders: [order, ...s.pendingOrders],
    }));

    playSuccessSound();
    return {
      success: true,
      message: `${positionType} ${leverage}x 지정가 주문 등록! @ $${limitPrice.toLocaleString()} 📝`,
    };
  },

  // ── 지정가 주문 취소 ──
  cancelLimitOrder: async (orderId) => {
    const { pendingOrders, balance } = get();
    const order = pendingOrders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, message: "주문을 찾을 수 없습니다." };
    }

    const refund = order.margin + order.fee;
    const newBalance = balance + refund;

    // 1) DB에서 삭제
    const { error: deleteErr } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId);

    if (deleteErr) {
      return {
        success: false,
        message: `주문 취소 에러: ${deleteErr.message}`,
      };
    }

    // 2) 잔고 복구
    const { error: balanceErr } = await supabase
      .from("portfolios")
      .update({ balance: newBalance })
      .eq("user_id", order.user_id);

    if (balanceErr) {
      return {
        success: false,
        message: `잔고 복구 에러: ${balanceErr.message}`,
      };
    }

    // 3) 상태 동기화
    set((s) => ({
      balance: newBalance,
      pendingOrders: s.pendingOrders.filter((o) => o.id !== orderId),
    }));

    return { success: true, message: "주문이 취소되었습니다." };
  },
}));
