import { useEffect, useRef, useState, useCallback, useMemo, Fragment } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Seo } from "@/hooks/useSeo";
import {
  ArrowLeft,
  ArrowUp,
  Eye,
  Clock,
  Trash2,
  Loader2,
  SendHorizontal,
  Reply,
  TrendingUp,
  Trophy,
  ChevronLeft,
  ChevronRight,
  X,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { useCommunityStore } from "@/store/communityStore";
import type { Comment } from "@/store/communityStore";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/ui/dialog";
import AdSlot from "@/components/ads/AdSlot";

// ── 수익 인증 카드 파싱 ──

const PROFIT_CARD_REGEX = /\[PROFIT_CARD\]([\s\S]*?)\[\/PROFIT_CARD\]/g;

interface ProfitData {
  symbol?: string;
  position_type: "LONG" | "SHORT";
  leverage: number;
  entry_price: number;
  margin: number;
  pnl: number;
  roe: number;
  current_price: number;
}

function ProfitCard({ data }: { data: ProfitData }) {
  const isLong = data.position_type === "LONG";
  const isProfitable = data.pnl >= 0;

  return (
    <div className="my-3 max-w-sm rounded-xl overflow-hidden border border-border">
      <div
        className={`px-3 py-1.5 flex items-center justify-between text-[11px] font-semibold ${
          isLong
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-red-500/15 text-red-400"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3" />
          <span>
            {data.symbol ? data.symbol.replace("USDT", "/USDT") : "BTC/USDT"}{" "}
            {data.position_type} {data.leverage}x
          </span>
        </div>
        <span className="text-[10px] opacity-70">수익 인증</span>
      </div>

      <div className="bg-card/80 px-3 py-2 space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">진입가</span>
          <span className="text-foreground tabular-nums">
            ${data.entry_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">인증 시점 가격</span>
          <span className="text-foreground tabular-nums">
            ${data.current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">증거금</span>
          <span className="text-foreground tabular-nums">
            ${data.margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="pt-1 border-t border-border/50 flex justify-between items-center">
          <span className="text-[11px] text-muted-foreground">수익 (ROE)</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs font-bold tabular-nums ${
                isProfitable ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {isProfitable ? "+" : ""}
              {data.roe.toFixed(2)}%
            </span>
            <span
              className={`text-[11px] font-semibold tabular-nums ${
                isProfitable ? "text-emerald-400" : "text-red-400"
              }`}
            >
              ({isProfitable ? "+" : ""}$
              {data.pnl.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              )
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 본문 렌더러 (수익 카드 파싱) ──
function PostContent({ content }: { content: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(PROFIT_CARD_REGEX.source, "g");

  while ((match = regex.exec(content)) !== null) {
    // 카드 이전 텍스트
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {text}
        </span>
      );
    }

    // 수익 카드
    let parsed: ProfitData | null = null;
    try {
      parsed = JSON.parse(match[1]) as ProfitData;
    } catch {
      // invalid JSON, fall through to raw text
    }
    if (parsed !== null) {
      parts.push(<ProfitCard key={`card-${match.index}`} data={parsed} />);
    } else {
      parts.push(
        <span key={`err-${match.index}`} className="whitespace-pre-wrap">
          {match[0]}
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // 남은 텍스트
  if (lastIndex < content.length) {
    parts.push(
      <span key={`text-end`} className="whitespace-pre-wrap">
        {content.slice(lastIndex)}
      </span>
    );
  }

  return <div className="text-sm text-foreground leading-relaxed">{parts}</div>;
}

// ── 이미지 갤러리 ──
function ImageGallery({ images }: { images: string[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  return (
    <>
      <div className="flex gap-2 my-4 flex-wrap">
        {images.map((url, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setSelectedIndex(idx)}
            className="w-32 h-32 flex-shrink-0 overflow-hidden rounded-lg bg-secondary hover:opacity-80 transition-opacity cursor-pointer"
          >
            <img
              src={url}
              alt={`첨부 이미지 ${idx + 1}`}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* 이미지 확대 모달 */}
      <Dialog
        open={selectedIndex !== null}
        onOpenChange={() => setSelectedIndex(null)}
      >
        <DialogContent className="sm:max-w-4xl p-2 bg-black/90 border-none">
          {selectedIndex !== null && (
            <div className="relative flex items-center justify-center min-h-[300px]">
              <img
                src={images[selectedIndex]}
                alt={`이미지 ${selectedIndex + 1}`}
                className="max-w-full max-h-[80vh] object-contain rounded"
              />

              {/* 이전/다음 버튼 */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIndex(
                        (selectedIndex - 1 + images.length) % images.length
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIndex((selectedIndex + 1) % images.length)
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}

              {/* 인디케이터 */}
              {images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        idx === selectedIndex
                          ? "bg-white"
                          : "bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── @닉네임 멘션 렌더러 ──
const MENTION_REGEX = /(@\S+)/g;

function CommentContent({ content }: { content: string }) {
  const parts = content.split(MENTION_REGEX);
  return (
    <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (/^@\S+$/.test(part)) {
          return (
            <span key={i} className="text-indigo-400 font-medium">
              {part}
            </span>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </p>
  );
}

// ── 아바타 컴포넌트 ──
function UserAvatar({
  nickname,
  avatarUrl,
  size = "sm",
}: {
  nickname: string;
  avatarUrl: string | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={nickname}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
        referrerPolicy="no-referrer"
      />
    );
  }

  const initial = nickname.charAt(0).toUpperCase();
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium flex-shrink-0`}
    >
      {initial}
    </div>
  );
}

// ── 날짜 포맷 ──
function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatCommentTime(dateStr: string) {
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

// ── 맨 위로 버튼 ──
function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded-full shadow-lg transition-colors"
    >
      <ArrowUp className="h-3.5 w-3.5" />
      맨 위로
    </button>
  );
}

// ── 댓글 컴포넌트 ──
function CommentItem({
  comment,
  replies,
  isAuthor,
  currentUserId,
  onReply,
  onDelete,
}: {
  comment: Comment;
  replies: Comment[];
  isAuthor: boolean;
  currentUserId: string | undefined;
  onReply: (parentId: string, nickname: string) => void;
  onDelete: (commentId: string) => void;
}) {
  return (
    <div>
      {/* 부모 댓글 */}
      <SingleComment
        comment={comment}
        isAuthor={isAuthor}
        isOwn={currentUserId === comment.user_id}
        onReply={() => onReply(comment.id, comment.nickname)}
        onDelete={() => onDelete(comment.id)}
      />

      {/* 대댓글들 */}
      {replies.length > 0 && (
        <div className="ml-8 border-l-2 border-border/50 pl-3 space-y-0">
          {replies.map((reply) => (
            <SingleComment
              key={reply.id}
              comment={reply}
              isAuthor={false}
              isOwn={currentUserId === reply.user_id}
              onReply={() => onReply(comment.id, reply.nickname)}
              onDelete={() => onDelete(reply.id)}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SingleComment({
  comment,
  isAuthor,
  isOwn,
  onReply,
  onDelete,
  isReply = false,
}: {
  comment: Comment;
  isAuthor: boolean;
  isOwn: boolean;
  onReply: () => void;
  onDelete: () => void;
  isReply?: boolean;
}) {
  return (
    <div className={`flex gap-2.5 py-3 ${!isReply ? "border-b border-border/50" : ""}`}>
      <UserAvatar nickname={comment.nickname} avatarUrl={comment.avatar_url} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground">
            {comment.nickname}
          </span>
          {isAuthor && (
            <span className="text-[10px] font-medium text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded-full">
              작성자
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {formatCommentTime(comment.created_at)}
          </span>
        </div>
        <CommentContent content={comment.content} />
        <div className="flex items-center gap-3 mt-1.5">
          <button
            type="button"
            onClick={onReply}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Reply className="h-3 w-3" />
            답글 달기
          </button>
          {isOwn && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 댓글 입력폼 ──
function CommentForm({
  onSubmit,
  placeholder,
  onCancel,
  prefill,
}: {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  onCancel?: () => void;
  prefill?: string;
}) {
  const [text, setText] = useState(prefill ?? "");
  const [prevPrefill, setPrevPrefill] = useState(prefill);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // prefill 변경 시 텍스트 세팅 (React "Adjusting state when a prop changes" 패턴)
  if (prevPrefill !== prefill && prefill !== undefined) {
    setPrevPrefill(prefill);
    setText(prefill);
  }

  // DOM 조작(포커스·커서)만 effect에서 처리 — setState 호출 없음
  useEffect(() => {
    if (prefill === undefined) return;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(prefill.length, prefill.length);
    });
  }, [prefill]);

  const handleSubmit = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await onSubmit(text.trim());
    setText("");
    setSending(false);
  };

  return (
    <div className="flex gap-2 items-start">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? "댓글을 입력하세요..."}
        maxLength={1000}
        rows={2}
        className="flex-1 min-w-0 bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-indigo-500/50 transition-colors resize-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!text.trim() || sending}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── 메인 페이지 ──
export default function CommunityPostPage() {
  const { postId } = useParams({ from: "/community/$postId" });
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const {
    selectedPost: post,
    postLoading,
    comments,
    commentsLoading,
    userRanks,
    likedPostIds,
    fetchPostById,
    incrementViewCount,
    fetchComments,
    fetchUserRanks,
    fetchLikedPostIds,
    createComment,
    deleteComment,
    deletePost,
    toggleLike,
  } = useCommunityStore();

  const [replyingTo, setReplyingTo] = useState<{ id: string; nickname: string } | null>(null);
  const replyFormRef = useRef<HTMLDivElement>(null);
  const viewCountedRef = useRef<string | null>(null);

  // 게시글 + 댓글 로드
  useEffect(() => {
    fetchPostById(postId);
    fetchComments(postId);
    fetchUserRanks();
  }, [postId, fetchPostById, fetchComments, fetchUserRanks]);

  // 유저 변경 시 좋아요 목록 동기화
  useEffect(() => {
    if (user) {
      fetchLikedPostIds(user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, fetchLikedPostIds]);

  // 좋아요 핸들러
  const handleLike = useCallback(() => {
    if (!user) {
      toast.error("로그인 후 추천할 수 있습니다.");
      return;
    }
    if (!post) return;
    toggleLike(post.id, user.id);
  }, [user, post, toggleLike]);

  // 조회수: 세션당 1회만 증가 (StrictMode 이중 실행 방지 포함)
  useEffect(() => {
    if (viewCountedRef.current === postId) return;
    const key = `viewed_${postId}`;
    if (sessionStorage.getItem(key)) return;
    viewCountedRef.current = postId;
    sessionStorage.setItem(key, "1");
    incrementViewCount(postId);
  }, [postId, incrementViewCount]);

  // 댓글을 부모-자식 구조로 그룹핑
  const commentTree = useMemo(() => {
    const rootComments: Comment[] = [];
    const repliesMap = new Map<string, Comment[]>();

    for (const c of comments) {
      if (!c.parent_id) {
        rootComments.push(c);
      } else {
        const existing = repliesMap.get(c.parent_id) ?? [];
        existing.push(c);
        repliesMap.set(c.parent_id, existing);
      }
    }

    return { rootComments, repliesMap };
  }, [comments]);

  // 댓글 작성
  const handleCreateComment = useCallback(
    async (content: string, parentId?: string | null) => {
      if (!user) {
        toast.error("로그인 후 댓글을 작성할 수 있습니다.");
        return;
      }

      const result = await createComment({
        postId,
        userId: user.id,
        content,
        parentId,
      });

      if (result.success) {
        toast.success(result.message);
        setReplyingTo(null);
      } else {
        toast.error(result.message);
      }
    },
    [user, postId, createComment]
  );

  // 댓글 삭제
  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      const result = await deleteComment(commentId);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    },
    [deleteComment]
  );

  // 게시글 삭제
  const handleDeletePost = useCallback(async () => {
    if (!post) return;
    if (!confirm("정말 이 게시글을 삭제하시겠습니까?")) return;

    const result = await deletePost(post.id);
    if (result.success) {
      toast.success(result.message);
      navigate({ to: "/community" });
    } else {
      toast.error(result.message);
    }
  }, [post, deletePost, navigate]);

  // 로딩 상태
  if (postLoading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
          <p className="text-sm text-muted-foreground">게시글을 불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">
            게시글을 찾을 수 없습니다.
          </p>
          <Button variant="outline" onClick={() => navigate({ to: "/community" })}>
            목록으로 돌아가기
          </Button>
        </div>
      </main>
    );
  }

  return (
    <>
    <Seo
      title={post.title}
      description={post.content.replace(/\[PROFIT_CARD\][\s\S]*?\[\/PROFIT_CARD\]/g, "").slice(0, 120).trim() || post.title}
      url={`/community/${post.id}`}
    />
    <div className="flex-1 flex items-start justify-center gap-8">
    {/* 오른쪽 사이드바와 균형을 맞춰 본문 중앙 정렬 */}
    <div className="hidden xl:block w-44 shrink-0" aria-hidden="true" />
    <main className="flex-1 min-w-0 max-w-4xl px-3 sm:px-6 py-4 sm:py-6">
      {/* 상단 네비 */}
      <button
        type="button"
        onClick={() => navigate({ to: "/community" })}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        목록으로
      </button>

      {/* 게시글 헤더 */}
      <div className="border-b border-border pb-4 mb-4">
        <h1 className="text-lg sm:text-xl font-bold text-foreground mb-3">
          {post.title}
        </h1>
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <UserAvatar
                nickname={post.nickname}
                avatarUrl={post.avatar_url}
                size="md"
              />
              <span className="text-sm font-medium text-foreground truncate max-w-[150px] sm:max-w-none">
                {post.nickname}
              </span>
              <RankBadge rank={userRanks[post.user_id]} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 flex-shrink-0" />
                {formatDateTime(post.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3 flex-shrink-0" />
                {post.view_count}
              </span>
            </div>
          </div>

          {user?.id === post.user_id && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-red-400"
              onClick={handleDeletePost}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              삭제
            </Button>
          )}
        </div>
      </div>

      {/* 이미지 갤러리 */}
      <ImageGallery images={post.images} />

      {/* 본문 */}
      <div className="min-h-[100px] mb-6">
        <PostContent content={post.content} />
      </div>

      {/* 좋아요 버튼 */}
      <div className="flex justify-center mb-8">
        <button
          type="button"
          onClick={handleLike}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-medium transition-colors ${
            likedPostIds.has(post.id)
              ? "border-rose-500/50 bg-rose-500/10 text-rose-400"
              : "border-border bg-card text-muted-foreground hover:border-rose-500/40 hover:text-rose-400"
          }`}
        >
          <Heart
            className={`h-4 w-4 ${likedPostIds.has(post.id) ? "fill-rose-400" : ""}`}
          />
          추천 {post.like_count > 0 && <span className="tabular-nums">{post.like_count}</span>}
        </button>
      </div>

      {/* 게시글-댓글 사이 광고 */}
      <div className="mb-6">
        <AdSlot variant="banner-bottom" />
      </div>

      {/* 댓글 섹션 */}
      <div className="border-t border-border pt-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          댓글 {comments.length}개
        </h2>

        {/* 댓글 작성 폼 */}
        {user ? (
          <div className="mb-6">
            <CommentForm
              onSubmit={(content) => handleCreateComment(content)}
              placeholder="댓글을 입력하세요..."
            />
          </div>
        ) : (
          <div className="mb-6 bg-secondary/30 rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">
              로그인 후 댓글을 작성할 수 있습니다.
            </p>
          </div>
        )}

        {/* 댓글 목록 */}
        {commentsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
          </div>
        ) : commentTree.rootComments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
          </p>
        ) : (
          <div className="space-y-0">
            {commentTree.rootComments.map((comment) => (
              <div key={comment.id}>
                <CommentItem
                  comment={comment}
                  replies={commentTree.repliesMap.get(comment.id) ?? []}
                  isAuthor={comment.user_id === post.user_id}
                  currentUserId={user?.id}
                  onReply={(parentId, nickname) => {
                    if (!user) {
                      toast.error("로그인 후 답글을 작성할 수 있습니다.");
                      return;
                    }
                    setReplyingTo({ id: parentId, nickname });
                    // 답글 폼으로 스크롤
                    setTimeout(() => {
                      replyFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }, 50);
                  }}
                  onDelete={handleDeleteComment}
                />

                {/* 대댓글 입력폼 */}
                {replyingTo?.id === comment.id && user && (
                  <div ref={replyFormRef} className="ml-8 pl-3 py-2 border-l-2 border-indigo-500/30">
                    {/* 답글 대상 표시 */}
                    <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-muted-foreground">
                      <Reply className="h-3 w-3 text-indigo-400" />
                      <span className="text-indigo-400 font-medium">@{replyingTo.nickname}</span>
                      <span>님에게 답글 작성 중</span>
                    </div>
                    <CommentForm
                      prefill={`@${replyingTo.nickname} `}
                      onSubmit={(content) =>
                        handleCreateComment(content, comment.id)
                      }
                      placeholder={`@${replyingTo.nickname}님에게 답글...`}
                      onCancel={() => setReplyingTo(null)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 맨 위로 버튼 */}
      <ScrollToTopButton />
    </main>

    {/* 오른쪽 sticky 광고 사이드바 */}
    <aside
      className="hidden xl:flex w-44 shrink-0 sticky self-start flex-col items-center justify-center"
      style={{ top: "56px", height: "calc(100dvh - 56px)" }}
    >
      <AdSlot variant="sidebar-right" />
    </aside>
    </div>
    </>
  );
}
