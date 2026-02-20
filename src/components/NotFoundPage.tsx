import { Link } from "@tanstack/react-router";
import { Home, BarChart3, MessageSquare, Trophy, SearchX } from "lucide-react";
import { Seo } from "@/hooks/useSeo";

const QUICK_LINKS = [
  { to: "/", icon: Home, label: "홈 (모의투자)" },
  { to: "/ranking", icon: Trophy, label: "랭킹" },
  { to: "/community", icon: MessageSquare, label: "커뮤니티" },
];

export default function NotFoundPage() {
  return (
    <>
      <Seo title="페이지를 찾을 수 없음" noIndex />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        {/* 아이콘 */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto">
            <SearchX className="h-10 w-10 text-indigo-400/70" />
          </div>
          {/* 404 배지 */}
          <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-lg">
            404
          </span>
        </div>

        {/* 제목 */}
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          페이지를 찾을 수 없어요
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-8">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
          <br className="hidden sm:block" />
          아래 링크를 통해 원하시는 페이지로 이동해 보세요.
        </p>

        {/* 빠른 이동 */}
        <div className="flex flex-col sm:flex-row gap-2 mb-10">
          {QUICK_LINKS.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary transition-colors text-sm text-muted-foreground hover:text-foreground no-underline"
            >
              <Icon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </div>

        {/* 구분선 + 차트 장식 */}
        <div className="flex items-center gap-2 text-muted-foreground/30 text-xs">
          <BarChart3 className="h-3 w-3" />
          <span>모두모투 — 암호화폐 모의투자 시뮬레이션</span>
          <BarChart3 className="h-3 w-3" />
        </div>
      </main>
    </>
  );
}
