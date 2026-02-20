import { useEffect } from "react";
import { Seo } from "@/hooks/useSeo";

const SECTIONS = [
  { id: "s1", title: "서비스 개요 및 면책 고지" },
  { id: "s2", title: "수집하는 개인정보 항목" },
  { id: "s3", title: "수집·이용 목적" },
  { id: "s4", title: "보유 및 이용 기간" },
  { id: "s5", title: "제3자 제공" },
  { id: "s6", title: "처리 위탁" },
  { id: "s7", title: "이용자 권리" },
  { id: "s8", title: "쿠키 및 로컬 스토리지" },
  { id: "s9", title: "개인정보 보호책임자" },
];

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) {
    const offset = 80;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }
}

export default function PrivacyPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <Seo
        title="개인정보처리방침"
        description="모두모투 개인정보처리방침. 수집 항목, 이용 목적, 보유 기간 등을 안내합니다."
        url="/privacy"
      />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* 페이지 헤더 */}
        <div className="mb-8 pb-6 border-b border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <span>법적 고지</span>
            <span>/</span>
            <span className="text-foreground">개인정보처리방침</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">개인정보처리방침</h1>
          <p className="text-sm text-muted-foreground">최종 수정일: 2025년 1월 1일 · 시행일: 2025년 1월 1일</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">

          {/* 목차 (데스크탑: sticky 사이드바 / 모바일: 상단 박스) */}
          <aside className="lg:w-52 flex-shrink-0">
            <div className="lg:sticky lg:top-20 bg-card border border-border rounded-xl p-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">목차</p>
              <nav className="space-y-1">
                {SECTIONS.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => scrollTo(s.id)}
                    className="w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                  >
                    <span className="text-indigo-400/60 tabular-nums flex-shrink-0 mt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="leading-snug">{s.title}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* 본문 */}
          <div className="flex-1 min-w-0 space-y-10">

            <Section id="s1" number="01" title="서비스 개요 및 면책 고지">
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-4 py-3 mb-4">
                <p className="text-sm text-amber-300 font-semibold mb-1">⚠️ 중요 안내</p>
                <p className="text-sm text-amber-300/80 leading-relaxed">
                  모두모투는 <strong className="text-amber-300">실제 금융 투자 서비스가 아닌 암호화폐 모의투자 시뮬레이션 게임</strong>입니다.
                  서비스 내에서 발생하는 모든 수익·손실은 가상의 데이터이며, 실제 자산의 거래·손익이 발생하지 않습니다.
                  본 서비스는 투자 권유를 목적으로 하지 않습니다.
                </p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                모두모투(이하 "서비스")는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 및 관련 법령을 준수합니다.
                본 방침은 서비스가 어떤 정보를 수집하고, 어떻게 이용하며, 어떤 조치를 취하는지 안내합니다.
              </p>
            </Section>

            <Section id="s2" number="02" title="수집하는 개인정보 항목">
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">서비스 이용 시 아래와 같은 개인정보를 수집합니다.</p>
              <div className="space-y-3">
                <InfoCard label="Google 소셜 로그인" items={["이름", "이메일 주소", "프로필 이미지 URL"]} />
                <InfoCard label="서비스 이용 과정" items={["닉네임(사용자 직접 설정)", "게시글·댓글 내용", "모의 투자 내역 (가상 자산)"]} />
                <InfoCard label="자동 수집" items={["접속 IP 주소", "브라우저 종류·버전", "서비스 이용 기록"]} />
              </div>
            </Section>

            <Section id="s3" number="03" title="수집·이용 목적">
              <ul className="space-y-2">
                {[
                  "회원 식별 및 서비스 제공",
                  "모의투자 게임 기록 관리 및 랭킹 운영",
                  "커뮤니티 서비스 운영 (게시글, 댓글)",
                  "서비스 개선 및 이용 통계 분석",
                  "부정 이용 방지 및 서비스 보안 유지",
                ].map((item) => <ListItem key={item}>{item}</ListItem>)}
              </ul>
            </Section>

            <Section id="s4" number="04" title="보유 및 이용 기간">
              <p className="text-sm text-muted-foreground leading-relaxed">
                개인정보는 <strong className="text-foreground">회원 탈퇴 시까지</strong> 보유·이용되며, 탈퇴 후 지체 없이 파기합니다.
                단, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관합니다.
              </p>
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <LegalBasis law="전자상거래 등에서의 소비자보호에 관한 법률" period="5년" />
                <LegalBasis law="통신비밀보호법" period="3개월" />
              </div>
            </Section>

            <Section id="s5" number="05" title="제3자 제공">
              <p className="text-sm text-muted-foreground leading-relaxed">
                서비스는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다.
                다만, 아래의 경우 예외적으로 제공할 수 있습니다.
              </p>
              <ul className="mt-3 space-y-2">
                <ListItem>이용자가 사전에 동의한 경우</ListItem>
                <ListItem>법률에 특별한 규정이 있거나 수사기관의 적법한 요청이 있는 경우</ListItem>
              </ul>
            </Section>

            <Section id="s6" number="06" title="처리 위탁">
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                서비스는 원활한 운영을 위해 아래 업체에 일부 업무를 위탁합니다.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">수탁 업체</th>
                      <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">위탁 업무</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    <tr>
                      <td className="px-4 py-2.5 text-foreground font-medium">Supabase Inc.</td>
                      <td className="px-4 py-2.5 text-muted-foreground">데이터베이스 운영, 인증 서비스</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-foreground font-medium">Google LLC</td>
                      <td className="px-4 py-2.5 text-muted-foreground">소셜 로그인(OAuth 2.0)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-foreground font-medium">Vercel Inc.</td>
                      <td className="px-4 py-2.5 text-muted-foreground">웹 호스팅 서비스</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="s7" number="07" title="이용자 권리">
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                이용자는 언제든지 자신의 개인정보에 대해 아래 권리를 행사할 수 있습니다.
              </p>
              <ul className="space-y-2">
                {["개인정보 열람 요청", "개인정보 수정·정정 요청", "개인정보 삭제 요청 (회원 탈퇴)", "개인정보 처리 정지 요청"].map(
                  (item) => <ListItem key={item}>{item}</ListItem>
                )}
              </ul>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                권리 행사는 서비스 내 계정 설정 또는{" "}
                <a href="mailto:kdh5998@gmail.com" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                  kdh5998@gmail.com
                </a>
                으로 연락하시기 바랍니다.
              </p>
            </Section>

            <Section id="s8" number="08" title="쿠키 및 로컬 스토리지">
              <p className="text-sm text-muted-foreground leading-relaxed">
                서비스는 로그인 상태 유지 및 사용자 설정 저장을 위해 브라우저의 로컬 스토리지를 사용합니다.
                브라우저 설정에서 이를 거부할 수 있으나, 일부 서비스 기능이 제한될 수 있습니다.
              </p>
            </Section>

            <Section id="s9" number="09" title="개인정보 보호책임자">
              <div className="bg-card border border-border rounded-lg px-4 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20">담당자</span>
                  <span className="text-sm text-foreground font-medium">모두모투 운영팀</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20">이메일</span>
                  <a href="mailto:kdh5998@gmail.com" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                    kdh5998@gmail.com
                  </a>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                개인정보 침해에 관한 상담은 개인정보보호위원회(privacy.go.kr, 국번 없이 182) 또는
                한국인터넷진흥원(kisa.or.kr, 국번 없이 118)에 신고하실 수 있습니다.
              </p>
            </Section>

          </div>
        </div>
      </main>
    </>
  );
}

// ── 섹션 래퍼 ──
function Section({ id, number, title, children }: { id: string; number: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-bold text-indigo-400/60 tabular-nums">{number}</span>
        <h2 className="text-base sm:text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <div>{children}</div>
    </section>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-muted-foreground">
      <span className="w-1 h-1 rounded-full bg-indigo-400/60 flex-shrink-0 mt-2" />
      {children}
    </li>
  );
}

function InfoCard({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex gap-3 bg-secondary/30 rounded-lg px-3 py-2.5">
      <span className="text-xs font-medium text-indigo-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item} className="text-xs text-muted-foreground">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function LegalBasis({ law, period }: { law: string; period: string }) {
  return (
    <div className="bg-secondary/30 rounded-lg px-3 py-2.5">
      <p className="text-xs text-muted-foreground leading-snug">{law}</p>
      <p className="text-sm font-semibold text-foreground mt-1">{period} 보관</p>
    </div>
  );
}
