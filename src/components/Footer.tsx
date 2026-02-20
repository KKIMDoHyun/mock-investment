import { Link } from "@tanstack/react-router";
import { AlertTriangle, Shield } from "lucide-react";
import DonationButton from "@/components/DonationButton";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-card/50 border-t border-border">

      {/* ── 투자 주의사항 전문 ── */}
      <div className="border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mt-0.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-amber-400/90">투자 주의사항 (Investment Disclaimer)</p>
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                모두모투(modumotu.com)는 <strong className="text-muted-foreground/90">실제 금융 투자 서비스가 아닌 암호화폐 모의투자 시뮬레이션 게임</strong>입니다.
                서비스 내에서 발생하는 모든 수익·손실은 가상의 데이터이며 실제 자산의 거래·손익이 발생하지 않습니다.
                표시되는 암호화폐 시세는 참고용으로 실제 시세와 차이가 있을 수 있으며, 이는 투자 권유·금융 조언이 아닙니다.
                실제 암호화폐 투자는 원금 손실의 위험이 있으므로 신중한 판단과 본인의 책임 하에 진행하시기 바랍니다.
                본 서비스는 교육·오락 목적으로만 제공되며, 운영자는 서비스 이용에 따른 실제 투자 결과에 대해 어떠한 책임도 지지 않습니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 하단 푸터 ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">

          {/* 좌측: 로고 + 저작권 */}
          <div className="flex items-center gap-3 order-2 sm:order-1">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="모두모투" className="w-5 h-5 rounded object-contain opacity-60" />
              <span className="text-[11px] text-muted-foreground/60 font-medium">모두모투</span>
            </div>
            <span className="text-border text-[11px]">·</span>
            <p className="text-[11px] text-muted-foreground/50">© {year} All rights reserved.</p>
          </div>

          {/* 우측: 링크 + 후원 */}
          <div className="flex items-center gap-1 order-1 sm:order-2 flex-wrap justify-center sm:justify-end">
            <Shield className="h-3 w-3 text-muted-foreground/40 mr-1" />
            <FooterLink to="/privacy">개인정보처리방침</FooterLink>
            <Divider />
            <FooterLink to="/terms">이용약관</FooterLink>
            <Divider />
            <FooterLink to="/contact">문의하기</FooterLink>
            <Divider />
            <DonationButton />
          </div>

        </div>
      </div>
    </footer>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors no-underline px-1"
    >
      {children}
    </Link>
  );
}

function Divider() {
  return <span className="text-border/60 text-[11px] select-none">·</span>;
}
