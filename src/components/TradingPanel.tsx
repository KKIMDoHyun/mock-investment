import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/ui/button";

export default function TradingPanel() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [amount, setAmount] = useState("100000");

  const handleTrade = (direction: "long" | "short") => {
    // 로그인 안 되어 있으면 /login으로 리다이렉트
    if (!user) {
      navigate({ to: "/login" });
      return;
    }

    // TODO: 실제 거래 로직 구현
    console.log(`${direction} 포지션 오픈: ₩${amount}`);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-foreground">주문</h3>

      {/* Coin info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400 text-xs font-bold">
            ₿
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">BTC/KRW</p>
            <p className="text-xs text-muted-foreground">비트코인</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">₩65,432,100</p>
          <p className="text-xs text-emerald-400">+2.34%</p>
        </div>
      </div>

      {/* Amount input */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">
          주문 금액 (KRW)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            ₩
          </span>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full bg-secondary border border-border rounded-lg pl-7 pr-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            placeholder="금액 입력"
          />
        </div>
        {/* Quick amount buttons */}
        <div className="flex gap-1.5 mt-2">
          {["100000", "500000", "1000000", "5000000"].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className="flex-1 text-xs py-1 rounded-md bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {Number(v).toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Leverage */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">
          레버리지
        </label>
        <div className="flex gap-1.5">
          {["1x", "2x", "5x", "10x"].map((lev) => (
            <button
              key={lev}
              className="flex-1 text-xs py-1.5 rounded-md bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {lev}
            </button>
          ))}
        </div>
      </div>

      {/* Long / Short buttons */}
      <div className="flex gap-2 mt-1">
        <Button
          onClick={() => handleTrade("long")}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <TrendingUp className="h-4 w-4" />
          Long
        </Button>
        <Button
          onClick={() => handleTrade("short")}
          className="flex-1 bg-red-600 hover:bg-red-500 text-white"
        >
          <TrendingDown className="h-4 w-4" />
          Short
        </Button>
      </div>

      {/* Login hint for non-auth users */}
      {!user && (
        <p className="text-xs text-center text-muted-foreground">
          거래하려면 로그인이 필요합니다
        </p>
      )}
    </div>
  );
}
