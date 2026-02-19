import { create } from "zustand";

interface TradingState {
  /** 바이낸스 실시간 BTCUSDT 현재가 */
  currentPrice: number;
  setCurrentPrice: (price: number) => void;
}

export const useTradingStore = create<TradingState>((set) => ({
  currentPrice: 0,
  setCurrentPrice: (price) => set({ currentPrice: price }),
}));
