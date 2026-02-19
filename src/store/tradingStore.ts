import { create } from "zustand";
import { supabase } from "@/lib/supabase";

// ── 타입 정의 ──

export interface Trade {
  id: string;
  user_id: string;
  position_type: "LONG" | "SHORT";
  leverage: number;
  margin: number;
  entry_price: number;
  close_price: number | null;
  status: "OPEN" | "CLOSED";
  created_at: string;
  closed_at: string | null;
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

  /** 포지션 오픈 */
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

/** 가격 스트림 시작 (HomePage 마운트 시 호출) */
export function startPriceStream() {
  streamActive = true;
  connectPriceWs();
}

/** 가격 스트림 중지 (HomePage 언마운트 시 호출) */
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
    close_price: raw.close_price != null ? toNum(raw.close_price) : null,
  } as Trade;
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

  // 청산가는 현재가와 무관 → 항상 계산
  let liqPrice = 0;
  if (entryPrice > 0 && leverage > 0) {
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
  lastAttendanceDate: null,
  loading: false,

  setCurrentPrice: (price) => set({ currentPrice: price }),

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
        .insert({ user_id: userId, balance: 0 })
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

  // ── 포지션 오픈 ──
  openPosition: async ({
    userId,
    positionType,
    leverage,
    margin,
    entryPrice,
  }) => {
    const { balance } = get();

    // 검증
    if (margin <= 0) {
      return { success: false, message: "주문 금액을 입력해주세요." };
    }
    if (margin > balance) {
      return { success: false, message: "잔고가 부족합니다." };
    }
    if (entryPrice <= 0) {
      return {
        success: false,
        message: "현재 가격을 불러오는 중입니다. 잠시 후 다시 시도해주세요.",
      };
    }

    // 1) 잔고 차감
    const newBalance = balance - margin;
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

    // 2) 포지션 저장 — .select().single() 로 삽입된 행 직접 반환
    const { data: newTrade, error: tradeErr } = await supabase
      .from("trades")
      .insert({
        user_id: userId,
        position_type: positionType,
        leverage,
        margin,
        entry_price: entryPrice,
        status: "OPEN",
      })
      .select()
      .single();

    if (tradeErr || !newTrade) {
      // 롤백: 잔고 복구
      await supabase
        .from("portfolios")
        .update({ balance })
        .eq("user_id", userId);
      return {
        success: false,
        message: `포지션 생성 에러: ${tradeErr?.message ?? "데이터 반환 실패"}`,
      };
    }

    // 3) 상태 동기화 — re-fetch 없이 직접 추가
    const trade = sanitizeTrade(newTrade as Record<string, unknown>);
    set((state) => ({
      balance: newBalance,
      positions: [trade, ...state.positions],
    }));

    return {
      success: true,
      message: `${positionType} ${leverage}x 포지션 오픈! 💪`,
    };
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
    const returnAmount = trade.margin + pnl; // 원금 + 손익 (0 이하면 청산)
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

    // 2) 포지션 종료
    const { error: closeErr } = await supabase
      .from("trades")
      .update({
        close_price: closePrice,
        status: "CLOSED",
        closed_at: new Date().toISOString(),
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
      status: "CLOSED",
      closed_at: new Date().toISOString(),
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
      message: `포지션 종료! 손익: ${pnlText}`,
    };
  },
}));
