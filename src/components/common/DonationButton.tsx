import { useState } from "react";
import { Coffee, Copy, Check, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { toast } from "sonner";

const ACCOUNT_BANK = "카카오뱅크";
const ACCOUNT_NUMBER = "3333-11-2414946";
const ACCOUNT_HOLDER = "김도현";

export default function DonationButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ACCOUNT_NUMBER);
      setCopied(true);
      toast.success("계좌번호가 복사되었습니다! 🙏");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {/* ── 트리거 버튼 ── */}
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-muted-foreground/60 hover:text-amber-400/80 hover:bg-amber-500/5 transition-colors group"
        >
          <Coffee className="h-3 w-3 group-hover:text-amber-400 transition-colors" />
          <span>커피 한 잔</span>
        </button>
      </DialogPrimitive.Trigger>

      {/* ── 모달 ── */}
      <DialogPrimitive.Portal>
        {/* 오버레이 */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* 콘텐츠 */}
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-sm outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="relative rounded-2xl overflow-hidden border border-[#f9e000]/20 bg-card/95 backdrop-blur-md shadow-2xl shadow-black/50">

            {/* 상단 카카오 포인트 그라디언트 라인 */}
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#f9e000]/60 to-transparent" />

            {/* 닫기 버튼 */}
            <DialogPrimitive.Close className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-secondary/60 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </DialogPrimitive.Close>

            {/* ── 헤더 ── */}
            <div className="px-5 pt-5 pb-3 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#f9e000]/10 border border-[#f9e000]/20 mb-3">
                <Coffee className="h-5 w-5 text-[#f9e000]/80" />
              </div>
              <DialogPrimitive.Title className="text-base font-bold text-foreground">
                개발자에게 카페인 충전해주기 ☕
              </DialogPrimitive.Title>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                모두모투는 무료 서비스입니다. 후원은 서버 유지에 큰 힘이 됩니다 🙏
              </p>
            </div>

            {/* ── 카카오페이 QR ── */}
            <div className="px-5 pb-4">
              <div className="relative rounded-xl overflow-hidden border border-[#f9e000]/15 bg-white">
                <img
                  src="/kakao-qr.png"
                  alt="카카오페이 송금 QR 코드"
                  className="w-full object-contain"
                  style={{ maxHeight: 260 }}
                />
                {/* 카카오 배지 */}
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-[#f9e000] rounded-md px-2 py-0.5">
                  <span className="text-[10px] font-black text-[#3c1e1e]">kakao</span>
                  <span className="text-[10px] font-bold text-[#3c1e1e]">pay</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
                카메라로 QR을 스캔하면 바로 송금할 수 있어요
              </p>
            </div>

            {/* ── 계좌번호 복사 ── */}
            <div className="px-5 pb-4">
              <button
                type="button"
                onClick={handleCopy}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ${
                  copied
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border bg-secondary/30 hover:border-[#f9e000]/30 hover:bg-[#f9e000]/5"
                }`}
              >
                <div className="text-left">
                  <p className="text-[10px] text-muted-foreground">
                    {ACCOUNT_BANK} · {ACCOUNT_HOLDER}
                  </p>
                  <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">
                    {ACCOUNT_NUMBER}
                  </p>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  copied ? "text-emerald-400" : "text-muted-foreground"
                }`}>
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      계좌번호 복사
                    </>
                  )}
                </div>
              </button>
            </div>

            {/* ── 면책 문구 ── */}
            <div className="px-5 pb-5">
              <p className="text-[10px] text-muted-foreground/40 text-center leading-relaxed">
                본 후원은 자발적이며 서비스 이용과는 무관합니다.
                <br />후원 여부와 상관없이 동일한 서비스가 제공됩니다.
              </p>
            </div>

            {/* 하단 카카오 포인트 그라디언트 라인 */}
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#f9e000]/40 to-transparent" />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
