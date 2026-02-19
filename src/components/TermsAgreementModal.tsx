import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";

export default function TermsAgreementModal() {
  const user = useAuthStore((s) => s.user);
  const termsAgreedAt = useAuthStore((s) => s.termsAgreedAt);
  const roleLoaded = useAuthStore((s) => s.roleLoaded);
  const agreeToTerms = useAuthStore((s) => s.agreeToTerms);

  const [submitting, setSubmitting] = useState(false);

  // 미로그인, 이미 동의, 또는 role 아직 로드 안 됨 → 렌더 안 함
  if (!user || !roleLoaded || termsAgreedAt) return null;

  const handleAgree = async () => {
    setSubmitting(true);
    const result = await agreeToTerms();
    setSubmitting(false);

    if (result.success) {
      toast.success("서비스 이용에 동의했습니다.");
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl shadow-black/50 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 sm:px-6 pt-5 sm:pt-6 pb-3">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              서비스 이용 동의
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              서비스 이용 전 아래 내용을 확인해 주세요.
            </p>
          </div>
        </div>

        {/* 본문 (스크롤 영역) */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-3">
          <div className="bg-secondary/40 border border-border rounded-xl p-4 text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p className="font-semibold text-foreground text-base">
              모의투자 서비스 면책 조항
            </p>

            <p>
              본 서비스는 <strong className="text-foreground">가상의 자금</strong>을
              이용한 모의투자(시뮬레이션) 플랫폼이며, 실제 금융 거래와는 무관합니다.
            </p>

            <ul className="list-disc list-inside space-y-1.5 text-[13px]">
              <li>
                본 서비스에서 사용되는 모든 자산, 잔고, 수익률 등은{" "}
                <strong className="text-foreground">
                  가상의 데이터이며 실제 화폐 가치가 없습니다.
                </strong>
              </li>
              <li>
                본 서비스는 투자 조언, 금융 자문, 또는 어떠한 형태의 투자 권유도
                제공하지 않습니다.
              </li>
              <li>
                모의투자 결과는 실제 시장에서의 수익을 보장하지 않으며, 실제 투자
                결정의 근거로 사용해서는 안 됩니다.
              </li>
              <li>
                본 서비스 이용으로 인한 실제 금전적 손실에 대해 서비스 제공자는
                어떠한 책임도 지지 않습니다.
              </li>
              <li>
                시세 데이터는 실시간 시장 데이터를 기반으로 하나, 지연이나 오차가
                발생할 수 있습니다.
              </li>
              <li>
                서비스 제공자는 사전 고지 없이 서비스 내용을 변경하거나 중단할 수
                있습니다.
              </li>
            </ul>

            <div className="border-t border-border pt-3 mt-3">
              <p className="text-xs text-muted-foreground/80">
                위 내용을 충분히 이해하였으며, 본 서비스가 모의투자 목적임을
                인지합니다. 동의 시각은 서버에 영구 기록됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-3">
          <button
            onClick={handleAgree}
            disabled={submitting}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                처리 중...
              </>
            ) : (
              "동의합니다"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
