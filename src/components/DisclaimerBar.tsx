import { AlertTriangle } from "lucide-react";

export default function DisclaimerBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-amber-500/20">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
        <p className="text-[10px] sm:text-[11px] text-amber-300/75 leading-relaxed">
          <strong className="text-amber-300/90">투자 주의:</strong>{" "}
          모두모투는 실제 금융 투자 서비스가 아닌{" "}
          <strong className="text-amber-300/90">암호화폐 모의투자 시뮬레이션 게임</strong>
          입니다. 서비스 내 수익·손실은 가상 데이터이며, 실제 자산과 무관합니다.
        </p>
      </div>
    </div>
  );
}
