import { useEffect } from "react";
import { Mail, MessageSquare, AlertTriangle } from "lucide-react";
import { Seo } from "@/hooks/useSeo";

export default function ContactPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <Seo
        title="문의하기"
        description="모두모투 서비스 문의, 버그 신고, 개인정보 삭제 요청 등 연락처 안내."
        url="/contact"
      />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl font-bold text-foreground mb-2">문의하기</h1>
        <p className="text-sm text-muted-foreground mb-8">
          서비스 이용 중 불편한 점이나 개선 의견이 있으시면 아래로 연락해 주세요.
        </p>

        <div className="space-y-4">

          {/* 이메일 문의 */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-foreground">이메일 문의</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              서비스 관련 전반적인 문의는 이메일로 연락 주세요. 영업일 기준 1~3일 내 답변드립니다.
            </p>
            <a
              href="mailto:kdh5998@gmail.com"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              kdh5998@gmail.com
            </a>
          </div>

          {/* 문의 유형 안내 */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-foreground">문의 유형</h2>
            </div>
            <ul className="space-y-2.5">
              {[
                { label: "버그 신고", desc: "서비스 오류, 표시 이상 등" },
                { label: "계정 문의", desc: "로그인 오류, 계정 삭제 요청" },
                { label: "개인정보 삭제 요청", desc: "회원 탈퇴 및 데이터 삭제" },
                { label: "부적절한 게시물 신고", desc: "커뮤니티 내 불법·유해 콘텐츠" },
                { label: "서비스 개선 제안", desc: "새로운 기능 또는 개선 의견" },
              ].map((item) => (
                <li key={item.label} className="flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-1.5" />
                  <span>
                    <strong className="text-foreground">{item.label}</strong>
                    <span className="text-muted-foreground"> — {item.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 면책 고지 */}
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-300">서비스 안내</p>
                <p className="text-xs text-amber-300/80 leading-relaxed">
                  모두모투는 <strong>실제 금융 투자 서비스가 아닌 모의투자 시뮬레이션 게임</strong>입니다.
                  실제 투자 상담, 자산 관리, 금융 조언은 제공하지 않습니다.
                  투자 관련 결정은 공인된 금융 전문가와 상담하시기 바랍니다.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
