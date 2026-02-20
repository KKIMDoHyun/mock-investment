import { useEffect } from "react";
import { Seo } from "@/hooks/useSeo";

const SECTIONS = [
  { id: "t1", title: "목적" },
  { id: "t2", title: "서비스의 성격 및 면책" },
  { id: "t3", title: "회원가입" },
  { id: "t4", title: "서비스 이용" },
  { id: "t5", title: "금지 행위" },
  { id: "t6", title: "게시물 관리" },
  { id: "t7", title: "서비스 중단 및 변경" },
  { id: "t8", title: "면책 조항" },
  { id: "t9", title: "준거법 및 관할" },
];

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) {
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
  }
}

export default function TermsPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <Seo
        title="이용약관"
        description="모두모투 이용약관. 서비스 이용 조건, 금지 행위, 면책 사항 등을 안내합니다."
        url="/terms"
      />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* 페이지 헤더 */}
        <div className="mb-8 pb-6 border-b border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <span>법적 고지</span>
            <span>/</span>
            <span className="text-foreground">이용약관</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">이용약관</h1>
          <p className="text-sm text-muted-foreground">최종 수정일: 2025년 1월 1일 · 시행일: 2025년 1월 1일</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">

          {/* 목차 */}
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
                      {`제${i + 1}조`}
                    </span>
                    <span className="leading-snug">{s.title}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* 본문 */}
          <div className="flex-1 min-w-0 space-y-10">

            <Section id="t1" article="제1조" title="목적">
              <p className="text-sm text-muted-foreground leading-relaxed">
                본 약관은 모두모투(이하 "서비스")가 제공하는 암호화폐 모의투자 시뮬레이션 서비스의 이용 조건 및 절차,
                운영자와 이용자 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.
              </p>
            </Section>

            <Section id="t2" article="제2조" title="서비스의 성격 및 면책">
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-4 py-4 mb-4">
                <p className="text-sm text-amber-300 font-semibold mb-1.5">⚠️ 반드시 확인하세요</p>
                <ul className="space-y-1.5">
                  {[
                    "모두모투는 실제 금융 투자 서비스가 아닙니다.",
                    "서비스 내 모든 수익·손실은 가상의 데이터입니다.",
                    "실제 자산에 어떠한 영향도 미치지 않습니다.",
                    "서비스 내 정보는 투자 권유나 금융 조언이 아닙니다.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-amber-300/80">
                      <span className="mt-1 flex-shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                본 서비스는 교육 및 오락 목적의 암호화폐 모의투자 시뮬레이션 게임으로,
                이용자는 본 서비스가 게임임을 인지하고 이용에 동의합니다.
              </p>
            </Section>

            <Section id="t3" article="제3조" title="회원가입">
              <p className="text-sm text-muted-foreground leading-relaxed">
                서비스는 Google 계정을 통한 소셜 로그인 방식으로 회원가입을 제공합니다.
                이용자는 타인의 정보를 도용하거나 허위 정보를 제공해서는 안 됩니다.
                만 14세 미만의 아동은 회원가입이 제한될 수 있습니다.
              </p>
            </Section>

            <Section id="t4" article="제4조" title="서비스 이용">
              <ul className="space-y-2">
                {[
                  "이용자는 서비스를 개인적·비상업적 목적으로만 이용할 수 있습니다.",
                  "서비스 내 모의 자산은 실제 화폐 가치가 없으며, 현금화할 수 없습니다.",
                  "랭킹, 수익률 등의 게임 데이터는 운영 정책에 따라 초기화될 수 있습니다.",
                  "이용자는 서비스 이용 시 관련 법령 및 본 약관을 준수해야 합니다.",
                ].map((item) => <ListItem key={item}>{item}</ListItem>)}
              </ul>
            </Section>

            <Section id="t5" article="제5조" title="금지 행위">
              <div className="bg-red-500/5 border border-red-500/15 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-red-400 mb-2">다음 행위를 하는 경우 서비스 이용이 즉시 제한됩니다.</p>
                <ul className="space-y-2">
                  {[
                    "타인을 사칭하거나 허위 정보를 유포하는 행위",
                    "음란물, 혐오 표현, 불법 콘텐츠 게시 행위",
                    "서비스를 해킹하거나 비정상적인 방법으로 이용하는 행위",
                    "타인의 개인정보를 무단으로 수집·저장하는 행위",
                    "서비스를 상업적 목적으로 무단 이용하는 행위",
                    "스팸·광고성 게시물을 반복적으로 작성하는 행위",
                    "타 이용자를 괴롭히거나 위협하는 행위",
                  ].map((item) => <ListItem key={item} color="red">{item}</ListItem>)}
                </ul>
              </div>
            </Section>

            <Section id="t6" article="제6조" title="게시물 관리">
              <p className="text-sm text-muted-foreground leading-relaxed">
                운영자는 서비스의 커뮤니티 게시물이 법령·약관에 위반되거나 서비스 운영에 지장을 주는 경우,
                사전 통지 없이 해당 게시물을 삭제하거나 이용자의 이용을 제한할 수 있습니다.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                게시물의 저작권은 작성자에게 있으나, 서비스 운영에 필요한 범위 내에서 무상으로 사용을 허락한 것으로 봅니다.
              </p>
            </Section>

            <Section id="t7" article="제7조" title="서비스 중단 및 변경">
              <p className="text-sm text-muted-foreground leading-relaxed">
                운영자는 서비스의 전부 또는 일부를 변경·중단할 수 있으며, 이로 인해 발생한 손해에 대해 책임을 지지 않습니다.
                서비스 내 게임 데이터(가상 자산, 수익률 등)는 운영 상황에 따라 변경·초기화될 수 있습니다.
              </p>
            </Section>

            <Section id="t8" article="제8조" title="면책 조항">
              <div className="bg-secondary/30 rounded-lg px-4 py-4 space-y-3">
                {[
                  "운영자는 서비스 내 정보를 기반으로 실제 투자를 결정한 결과에 대해 어떠한 책임도 지지 않습니다.",
                  "서비스는 암호화폐 시장 가격을 참조하지만, 실제 시세와 차이가 있을 수 있습니다.",
                  "운영자는 천재지변, 서비스 장애 등 불가항력적 사유로 인한 손해에 대해 책임을 지지 않습니다.",
                  "이용자는 본 서비스가 교육·오락 목적의 게임임을 인지하고 이용에 동의합니다.",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xs font-bold text-indigo-400/60 flex-shrink-0 tabular-nums mt-0.5">{i + 1}</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="t9" article="제9조" title="준거법 및 관할">
              <p className="text-sm text-muted-foreground leading-relaxed">
                본 약관은 대한민국 법률에 따라 해석되며, 서비스 이용과 관련하여 분쟁이 발생하는 경우
                대한민국 법원을 관할로 합니다.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                약관 관련 문의:{" "}
                <a href="mailto:kdh5998@gmail.com" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                  kdh5998@gmail.com
                </a>
              </p>
            </Section>

          </div>
        </div>
      </main>
    </>
  );
}

// ── 섹션 래퍼 ──
function Section({ id, article, title, children }: { id: string; article: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-bold text-indigo-400/60">{article}</span>
        <h2 className="text-base sm:text-lg font-semibold text-foreground">({title})</h2>
      </div>
      <div>{children}</div>
    </section>
  );
}

function ListItem({ children, color = "indigo" }: { children: React.ReactNode; color?: "indigo" | "red" }) {
  return (
    <li className="flex items-start gap-2 text-sm text-muted-foreground">
      <span className={`w-1 h-1 rounded-full flex-shrink-0 mt-2 ${color === "red" ? "bg-red-400/60" : "bg-indigo-400/60"}`} />
      {children}
    </li>
  );
}
