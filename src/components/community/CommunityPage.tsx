import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Seo } from "@/hooks/useSeo";
import {
  MessageSquare,
  Eye,
  MessageCircle,
  PenSquare,
  Loader2,
  TrendingUp,
  ArrowUp,
  Trophy,
  RefreshCw,
  Heart,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { useCommunityStore } from "@/store/communityStore";
import type { Post, SortBy } from "@/store/communityStore";
import { Button } from "@/ui/button";
import WritePostModal from "./WritePostModal";

// ── 시간 포맷 ──
function formatRelativeTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

// ── 수익 카드 미리보기 파싱 ──
const PROFIT_CARD_REGEX = /\[PROFIT_CARD\]([\s\S]*?)\[\/PROFIT_CARD\]/;

interface ProfitData {
  symbol?: string;
  position_type: "LONG" | "SHORT";
  leverage: number;
  pnl: number;
  roe: number;
}

function parseProfitCard(content: string): ProfitData | null {
  const match = PROFIT_CARD_REGEX.exec(content);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as ProfitData;
  } catch {
    return null;
  }
}

// 본문에서 카드 태그를 제거한 순수 텍스트
function getPlainContent(content: string): string {
  return content.replace(/\[PROFIT_CARD\][\s\S]*?\[\/PROFIT_CARD\]/g, "").trim();
}

// ── 아바타 ──
function UserAvatar({
  nickname,
  avatarUrl,
}: {
  nickname: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={nickname}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
      {nickname.charAt(0).toUpperCase()}
    </div>
  );
}

// ── 수익 인증 뱃지 (피드 내) ──
function ProfitBadge({ data }: { data: ProfitData }) {
  const isLong = data.position_type === "LONG";
  const isProfitable = data.pnl >= 0;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border ${
        isLong
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          : "bg-red-500/10 border-red-500/20 text-red-400"
      }`}
    >
      <TrendingUp className="h-3 w-3" />
      <span>
        {data.symbol ? data.symbol.replace("USDT", "") : "BTC"}{" "}
        {data.position_type} {data.leverage}x
      </span>
      <span
        className={`ml-1 font-bold ${
          isProfitable ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {isProfitable ? "+" : ""}
        {data.roe.toFixed(2)}%
      </span>
    </div>
  );
}

// ── 이미지 그리드 (피드 내) ──
function ImageGrid({ images }: { images: string[] }) {
  if (images.length === 0) return null;

  return (
    <div className="flex gap-1.5 overflow-hidden">
      {images.slice(0, 4).map((url, idx) => (
        <div
          key={idx}
          className="relative w-20 h-20 flex-shrink-0 overflow-hidden rounded-md bg-secondary"
        >
          <img
            src={url}
            alt=""
            className="w-full h-full object-cover"
          />
          {idx === 3 && images.length > 4 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-medium">
              +{images.length - 4}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 랭킹 뱃지 ──
function RankBadge({ rank }: { rank: number | undefined }) {
  if (!rank) return null;
  let emoji = "";
  let color = "text-muted-foreground bg-secondary/60";
  if (rank === 1) { emoji = "🥇"; color = "text-amber-400 bg-amber-500/10"; }
  else if (rank === 2) { emoji = "🥈"; color = "text-slate-300 bg-slate-300/10"; }
  else if (rank === 3) { emoji = "🥉"; color = "text-amber-600 bg-amber-700/10"; }

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${color}`}>
      {emoji || <Trophy className="h-2.5 w-2.5" />}
      {rank}위
    </span>
  );
}

// ── 하단 플로팅 버튼 그룹 (맨 위로 + 글쓰기) ──
function BottomFloatingButtons({ onWrite }: { onWrite: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded-full shadow-lg transition-colors"
      >
        <ArrowUp className="h-3.5 w-3.5" />
        맨 위로
      </button>
      <button
        type="button"
        onClick={onWrite}
        className="flex items-center gap-1.5 px-4 py-2 bg-card border border-border text-muted-foreground hover:text-foreground hover:border-indigo-500/40 text-xs font-medium rounded-full shadow-lg transition-colors"
      >
        <PenSquare className="h-3.5 w-3.5" />
        글쓰기
      </button>
    </div>
  );
}

// ── 스크롤 위치 저장 키 ──
const SCROLL_RESTORE_KEY = "community_restore";
const SCROLL_Y_KEY = "community_scrollY";

// ── 단일 피드 카드 ──
function FeedCard({
  post,
  rank,
  isLiked,
  onLike,
}: {
  post: Post;
  rank: number | undefined;
  isLiked: boolean;
  onLike: (e: React.MouseEvent) => void;
}) {
  const profitData = parseProfitCard(post.content);
  const plainText = getPlainContent(post.content);

  const handleClick = () => {
    sessionStorage.setItem(SCROLL_RESTORE_KEY, "1");
    sessionStorage.setItem(SCROLL_Y_KEY, String(window.scrollY));
  };

  return (
    <Link
      to="/community/$postId"
      params={{ postId: post.id }}
      onClick={handleClick}
      className="block bg-card border border-border rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-colors no-underline"
    >
      <div className="px-4 py-3 space-y-2.5">
        {/* 작성자 + 시간 */}
        <div className="flex items-center gap-2.5">
          <UserAvatar nickname={post.nickname} avatarUrl={post.avatar_url} />
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">
              {post.nickname}
            </span>
            <RankBadge rank={rank} />
            <span className="text-[11px] text-muted-foreground ml-1">
              {formatRelativeTime(post.created_at)}
            </span>
          </div>
        </div>

        {/* 제목 */}
        <h3 className="text-[15px] font-semibold text-foreground leading-snug line-clamp-2">
          {post.title}
        </h3>

        {/* 수익 인증 뱃지 */}
        {profitData && <ProfitBadge data={profitData} />}

        {/* 본문 미리보기 */}
        {plainText && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {plainText}
          </p>
        )}

        {/* 이미지 그리드 (본문 아래) */}
        <ImageGrid images={post.images} />

        {/* 하단: 조회수 + 댓글수 + 좋아요 */}
        <div className="flex items-center gap-4 pt-1 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {post.view_count}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {post.comment_count}
          </span>
          <button
            type="button"
            onClick={onLike}
            className={`flex items-center gap-1 transition-colors ${
              isLiked
                ? "text-rose-400"
                : "text-muted-foreground hover:text-rose-400"
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-rose-400" : ""}`} />
            {post.like_count}
          </button>
        </div>
      </div>
    </Link>
  );
}

// ── 정렬 탭 ──
const SORT_OPTIONS: { label: string; value: SortBy; icon: React.ReactNode }[] = [
  { label: "최신순", value: "latest", icon: <Clock className="h-3 w-3" /> },
  { label: "추천순", value: "popular", icon: <Heart className="h-3 w-3" /> },
];

// ── 메인 페이지 ──
export default function CommunityPage() {
  const user = useAuthStore((s) => s.user);
  const {
    posts,
    loading,
    loadingMore,
    hasMore,
    fetchPosts,
    fetchNextPage,
    resetPosts,
    userRanks,
    fetchUserRanks,
    likedPostIds,
    sortBy,
    setSortBy,
    fetchLikedPostIds,
    toggleLike,
  } = useCommunityStore();
  const [writeOpen, setWriteOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 스크롤 복원 진행 중일 때 콘텐츠를 숨겨 "위→아래 흘러내림" 깜빡임 방지
  // 초기값을 sessionStorage에서 읽어 마운트 즉시 hidden 상태로 시작
  const [scrollRestoring, setScrollRestoring] = useState(
    () => !!sessionStorage.getItem(SCROLL_RESTORE_KEY)
  );

  // IntersectionObserver 감지용 ref
  const bottomRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  // 초기 로드 또는 스크롤 복원
  useEffect(() => {
    // StrictMode 이중 실행 방지
    if (initRef.current) return;
    initRef.current = true;

    const shouldRestore = sessionStorage.getItem(SCROLL_RESTORE_KEY);
    const storePosts = useCommunityStore.getState().posts;

    if (shouldRestore && storePosts.length > 0) {
      // 뒤로 가기: 기존 데이터 유지, 스크롤 복원
      const savedY = Number(sessionStorage.getItem(SCROLL_Y_KEY)) || 0;
      sessionStorage.removeItem(SCROLL_RESTORE_KEY);
      sessionStorage.removeItem(SCROLL_Y_KEY);

      // DOM이 저장된 높이로 그려진 뒤 스크롤 이동 → 그 후 콘텐츠 표시
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, savedY);
          // 스크롤 위치가 확정된 후에만 콘텐츠를 보여줌
          setScrollRestoring(false);
        });
      });
    } else {
      // 새로 진입: 즉시 표시 후 첫 페이지 로드
      sessionStorage.removeItem(SCROLL_RESTORE_KEY);
      sessionStorage.removeItem(SCROLL_Y_KEY);
      setScrollRestoring(false);
      fetchPosts();
      fetchUserRanks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 유저 변경 시 좋아요 목록 동기화
  useEffect(() => {
    if (user) {
      fetchLikedPostIds(user.id);
    } else {
      useCommunityStore.setState({ likedPostIds: new Set() });
    }
  }, [user?.id, fetchLikedPostIds]);

  // 무한스크롤: 하단 감지 시 다음 페이지 로드
  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchNextPage]);

  // 새로고침
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([resetPosts(), fetchUserRanks()]);
    setRefreshing(false);
  }, [resetPosts, fetchUserRanks]);

  // 좋아요 핸들러
  const handleLike = useCallback(
    (e: React.MouseEvent, postId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!user) {
        toast.error("로그인 후 추천할 수 있습니다.");
        return;
      }
      toggleLike(postId, user.id);
    },
    [user, toggleLike],
  );

  return (
    <>
    <Seo title="커뮤니티" description="모두모투 트레이더들의 투자 이야기. 수익 인증, 시황 분석, 자유로운 소통." url="/community" />
    <main
      className="flex-1 w-full max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6"
      style={scrollRestoring ? { visibility: "hidden" } : undefined}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-indigo-400" />
          <h1 className="text-lg font-bold text-foreground">커뮤니티</h1>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        <Button
          size="sm"
          className="gap-1.5 rounded-xl"
          onClick={() => {
            if (!user) {
              toast.error("로그인 후 글을 작성할 수 있습니다.");
              return;
            }
            setWriteOpen(true);
          }}
        >
          <PenSquare className="h-3.5 w-3.5" />
          글쓰기
        </Button>
      </div>

      {/* 정렬 탭 */}
      <div className="flex items-center gap-1 mb-4">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSortBy(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sortBy === opt.value
                ? "bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {/* 피드 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
          <p className="text-sm text-muted-foreground">
            게시글을 불러오는 중...
          </p>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            아직 게시글이 없습니다. 첫 글을 작성해 보세요!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <FeedCard
              key={post.id}
              post={post}
              rank={userRanks[post.user_id]}
              isLiked={likedPostIds.has(post.id)}
              onLike={(e) => handleLike(e, post.id)}
            />
          ))}

          {/* 무한스크롤 감지 영역 + 로딩 스피너 */}
          <div ref={bottomRef} className="flex justify-center py-4">
            {loadingMore && (
              <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
            )}
            {!hasMore && posts.length > 0 && (
              <p className="text-xs text-muted-foreground">
                모든 게시글을 불러왔습니다.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 글쓰기 모달 */}
      <WritePostModal open={writeOpen} onOpenChange={setWriteOpen} />

      {/* 하단 플로팅 버튼 */}
      <BottomFloatingButtons
        onWrite={() => {
          if (!user) {
            toast.error("로그인 후 글을 작성할 수 있습니다.");
            return;
          }
          setWriteOpen(true);
        }}
      />
    </main>
    </>
  );
}
