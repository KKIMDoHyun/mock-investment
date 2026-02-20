import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageCircle,
  X,
  SendHorizontal,
  TrendingUp,
  ChevronUp,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { useTradingStore, calcPnl } from "@/store/tradingStore";
import type { Trade } from "@/store/tradingStore";

const SYSTEM_MSG_PREFIX = "[SYSTEM]";

// ── 타입 ──
interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  nickname: string;
  avatar_url: string | null;
}

/** 포지션 공유 메시지 데이터 */
interface SharedPosition {
  position_type: "LONG" | "SHORT";
  leverage: number;
  entry_price: number;
  margin: number;
  pnl: number;
  roe: number;
  current_price: number;
}

// ── 포지션 메시지 접두사 ──
const POSITION_PREFIX = "[POSITION]";

function isPositionMessage(content: string): boolean {
  return content.startsWith(POSITION_PREFIX);
}

function parsePositionMessage(content: string): SharedPosition | null {
  try {
    const json = content.slice(POSITION_PREFIX.length);
    return JSON.parse(json) as SharedPosition;
  } catch {
    return null;
  }
}

function buildPositionMessage(data: SharedPosition): string {
  return POSITION_PREFIX + JSON.stringify(data);
}

// ── 프로필 캐시 (닉네임 + 아바타) ──
const profileCache = new Map<
  string,
  { nickname: string; avatarUrl: string | null }
>();

async function fetchUserProfile(
  userId: string
): Promise<{ nickname: string; avatarUrl: string | null }> {
  if (profileCache.has(userId)) return profileCache.get(userId)!;

  const { data } = await supabase
    .from("profiles")
    .select("nickname, avatar_url")
    .eq("id", userId)
    .single();

  const result = {
    nickname: (data?.nickname as string) ?? "익명",
    avatarUrl: (data?.avatar_url as string) ?? null,
  };
  profileCache.set(userId, result);
  return result;
}

// ── 랭킹 뱃지 컴포넌트 ──
function RankBadge({ rank }: { rank: number | undefined }) {
  if (rank == null) return null;

  if (rank === 1) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400 bg-amber-400/15 px-1.5 py-0.5 rounded-full leading-none">
        🥇 1위
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-300 bg-slate-300/15 px-1.5 py-0.5 rounded-full leading-none">
        🥈 2위
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-600/15 px-1.5 py-0.5 rounded-full leading-none">
        🥉 3위
      </span>
    );
  }

  return (
    <span className="inline-flex items-center text-[9px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full leading-none">
      {rank}위
    </span>
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

  // 닉네임 첫 글자 기반 아바타
  const initial = nickname.charAt(0).toUpperCase();
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium flex-shrink-0`}
    >
      {initial}
    </div>
  );
}

// ── 포지션 카드 컴포넌트 (채팅 메시지 내) ──
function PositionCard({ data, isMe }: { data: SharedPosition; isMe: boolean }) {
  const isLong = data.position_type === "LONG";
  const isProfitable = data.pnl >= 0;

  return (
    <div
      className={`max-w-[90%] rounded-xl overflow-hidden border ${
        isMe ? "border-indigo-500/30" : "border-border"
      }`}
    >
      {/* 카드 헤더 */}
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
            BTC/USDT {data.position_type} {data.leverage}x
          </span>
        </div>
        <span className="text-[10px] opacity-70">포지션 공유</span>
      </div>

      {/* 카드 바디 */}
      <div className="bg-card/80 px-3 py-2 space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">진입가</span>
          <span className="text-foreground tabular-nums">
            $
            {data.entry_price.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">공유 시점 가격</span>
          <span className="text-foreground tabular-nums">
            $
            {data.current_price.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">증거금</span>
          <span className="text-foreground tabular-nums">
            $
            {data.margin.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        {/* 수익 */}
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

// ── 포지션 선택 패널 ──
function PositionPicker({
  positions,
  onSelect,
  onClose,
}: {
  positions: Trade[];
  onSelect: (trade: Trade) => void;
  onClose: () => void;
}) {
  const currentPrice = useTradingStore((s) => s.currentPrice);
  if (positions.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-xl shadow-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-foreground">
            포지션 자랑하기 📈
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center py-3">
          현재 열려있는 포지션이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-foreground">
          포지션 자랑하기 📈
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {positions.map((trade) => {
          const { pnl, roe } = calcPnl(trade, currentPrice);
          const isLong = trade.position_type === "LONG";
          const isProfitable = pnl >= 0;

          return (
            <button
              key={trade.id}
              type="button"
              onClick={() => onSelect(trade)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-secondary/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                    isLong
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-red-500/15 text-red-400"
                  }`}
                >
                  {trade.position_type} {trade.leverage}x
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  $
                  {trade.entry_price.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
              <span
                className={`text-[11px] font-semibold tabular-nums ${
                  isProfitable ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {isProfitable ? "+" : ""}
                {roe.toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── 채팅 규정 동의 화면 ──
function ChatRulesAgreement({ onAgreed }: { onAgreed: () => void }) {
  const agreeToChatRules = useAuthStore((s) => s.agreeToChatRules);
  const [submitting, setSubmitting] = useState(false);

  const handleAgree = async () => {
    setSubmitting(true);
    const result = await agreeToChatRules();
    setSubmitting(false);

    if (result.success) {
      toast.success("채팅방에 입장합니다!");
      onAgreed();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-amber-500/15 rounded-xl flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-amber-400" />
          </div>
          <h3 className="text-base font-bold text-foreground text-center">
            채팅방 이용 규정
          </h3>
          <p className="text-xs text-muted-foreground text-center">
            원활한 채팅 이용을 위해 아래 규정에 동의해 주세요.
          </p>
        </div>

        <div className="bg-secondary/40 border border-border rounded-xl p-3.5 text-[13px] text-muted-foreground space-y-2.5 leading-relaxed">
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              <strong className="text-foreground">욕설, 비하, 혐오 표현</strong>
              을 포함한 메시지는 삭제될 수 있습니다.
            </li>
            <li>
              <strong className="text-foreground">
                광고, 스팸, 외부 링크 홍보
              </strong>
              는 금지됩니다.
            </li>
            <li>
              <strong className="text-foreground">
                개인정보(실명, 연락처, 주소 등)
              </strong>
              를 공개하지 마세요.
            </li>
            <li>
              타인에 대한{" "}
              <strong className="text-foreground">
                사칭, 명예훼손, 괴롭힘
              </strong>
              은 금지됩니다.
            </li>
            <li>
              본 채팅방의 메시지는{" "}
              <strong className="text-foreground">투자 조언이 아니며</strong>,
              다른 유저의 의견을 투자 근거로 삼아서는 안 됩니다.
            </li>
            <li>
              <strong className="text-foreground">
                20분이 지난 메시지는 자동 삭제
              </strong>
              됩니다.
            </li>
            <li>
              규정 위반 시 채팅 이용이{" "}
              <strong className="text-foreground">제한</strong>될 수 있습니다.
            </li>
          </ul>

          <div className="border-t border-border pt-2.5 mt-2.5">
            <p className="text-[11px] text-muted-foreground/80">
              동의 시각은 서버에 영구 기록됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 하단 동의 버튼 */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <button
          onClick={handleAgree}
          disabled={submitting}
          className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              처리 중...
            </>
          ) : (
            "동의하고 입장하기"
          )}
        </button>
      </div>
    </div>
  );
}

// ── 메인 ChatWidget ──
export default function ChatWidget() {
  const user = useAuthStore((s) => s.user);
  const nickname = useAuthStore((s) => s.nickname);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const chatRulesAgreedAt = useAuthStore((s) => s.chatRulesAgreedAt);
  const positions = useTradingStore((s) => s.positions);
  const fetchOpenPositions = useTradingStore((s) => s.fetchOpenPositions);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [userRanks, setUserRanks] = useState<Map<string, number>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // ── 즉시 스크롤 (맨 아래로) ──
  const scrollToBottom = useCallback((instant = false) => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: instant ? "instant" : "smooth",
      });
    });
  }, []);

  // ── 초기 메시지 로드 (최근 50개) ──
  const loadMessages = useCallback(async () => {
    setLoadingMessages(true);

    const { data, error } = await supabase
      .from("messages")
      .select("id, user_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("메시지 로드 에러:", error.message);
      setLoadingMessages(false);
      return;
    }

    const rows = (data ?? []).reverse();

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const userId = row.user_id as string;
        const rawContent = row.content as string;
        const isSystem = rawContent.startsWith(SYSTEM_MSG_PREFIX);

        const profile = userId
          ? await fetchUserProfile(userId)
          : { nickname: "익명", avatarUrl: null };

        return {
          id: row.id as string,
          user_id: isSystem ? "system" : userId,
          content: isSystem ? rawContent.slice(SYSTEM_MSG_PREFIX.length) : rawContent,
          created_at: row.created_at as string,
          nickname: isSystem ? "📢 알림" : profile.nickname,
          avatar_url: isSystem ? null : (profile.avatarUrl ?? null),
        };
      })
    );

    setMessages(enriched);
    setLoaded(true);
    setLoadingMessages(false);
  }, []);

  // ── 채팅창 열릴 때 로드 ──
  useEffect(() => {
    if (!isOpen) return;

    if (!loaded) {
      loadMessages().then(() => scrollToBottom(true));
    } else {
      scrollToBottom(true);
    }
  }, [isOpen, loaded, loadMessages, scrollToBottom]);

  // ── 채팅창 열릴 때 랭킹 데이터 패칭 ──
  useEffect(() => {
    if (!isOpen) return;

    const fetchRanks = async () => {
      const { data, error } = await supabase
        .from("portfolios")
        .select("user_id, balance")
        .order("balance", { ascending: false });

      if (error) {
        console.error("랭킹 조회 에러:", error.message);
        return;
      }

      const rankMap = new Map<string, number>();
      (data ?? []).forEach((row, idx) => {
        rankMap.set(row.user_id as string, idx + 1);
      });
      setUserRanks(rankMap);
    };

    fetchRanks();
  }, [isOpen]);

  // ── Supabase Realtime 구독 (INSERT + DELETE) ──
  useEffect(() => {
    const channel = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            user_id: string;
            content: string;
            created_at: string;
          };

          const rawContent = row.content as string;
          const isSystem = rawContent.startsWith(SYSTEM_MSG_PREFIX);

          const profile = row.user_id
            ? await fetchUserProfile(row.user_id)
            : { nickname: "익명", avatarUrl: null };

          const newMsg: ChatMessage = {
            id: row.id,
            user_id: isSystem ? "system" : row.user_id,
            content: isSystem ? rawContent.slice(SYSTEM_MSG_PREFIX.length) : rawContent,
            created_at: row.created_at,
            nickname: isSystem ? "📢 알림" : profile.nickname,
            avatar_url: isSystem ? null : profile.avatarUrl,
          };

          setMessages((prev) => [...prev, newMsg]);

          if (isOpenRef.current) {
            requestAnimationFrame(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            });
          } else {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setMessages((prev) => prev.filter((msg) => msg.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── 일반 메시지 전송 ──
  const handleSend = useCallback(async () => {
    if (!user || !input.trim() || sending) return;

    const content = input.trim();
    setInput("");
    setSending(true);

    const { error } = await supabase.from("messages").insert({
      user_id: user.id,
      content,
    });

    if (error) {
      console.error("메시지 전송 에러:", error.message);
      setInput(content);
    }

    setSending(false);
  }, [user, input, sending]);

  // ── 포지션 공유 메시지 전송 ──
  const handleSharePosition = useCallback(
    async (trade: Trade) => {
      if (!user || sending) return;

      // 전송 시점의 최신 가격을 스토어에서 직접 읽기
      const latestPrice = useTradingStore.getState().currentPrice;
      const { pnl, roe } = calcPnl(trade, latestPrice);

      const positionData: SharedPosition = {
        position_type: trade.position_type,
        leverage: trade.leverage,
        entry_price: trade.entry_price,
        margin: trade.margin,
        pnl,
        roe,
        current_price: latestPrice,
      };

      const content = buildPositionMessage(positionData);

      setSending(true);
      setShowPositionPicker(false);

      const { error } = await supabase.from("messages").insert({
        user_id: user.id,
        content,
      });

      if (error) {
        console.error("포지션 공유 에러:", error.message);
      }

      setSending(false);
    },
    [user, sending]
  );

  // ── 시간 포맷 ──
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // 현재 유저의 프로필을 캐시에 등록
  useEffect(() => {
    if (user?.id && nickname) {
      profileCache.set(user.id, {
        nickname,
        avatarUrl: avatarUrl ?? null,
      });
    }
  }, [user?.id, nickname, avatarUrl]);

  return (
    <>
      {/* ── 채팅 버튼 ── */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => {
            if (!prev) setUnreadCount(0);
            return !prev;
          });
        }}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
      >
        {isOpen ? (
          <X className="h-5 w-5 sm:h-6 sm:w-6" />
        ) : (
          <>
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold px-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* ── 채팅창 ── */}
      {isOpen && (
        <div className="fixed z-50 bg-card border border-border shadow-2xl shadow-black/40 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 bottom-0 left-0 right-0 h-[55vh] rounded-t-2xl md:inset-auto md:bottom-24 md:right-6 md:w-[440px] md:h-[640px] md:rounded-2xl">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-foreground">
                글로벌 채팅방
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <X className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
          </div>

          {/* 채팅 규정 미동의 시 동의 화면 표시 */}
          {user && !chatRulesAgreedAt ? (
            <ChatRulesAgreement
              onAgreed={() => {
                // 동의 후 메시지 로드
                if (!loaded) {
                  loadMessages().then(() => scrollToBottom(true));
                }
              }}
            />
          ) : (
            <>
              {/* 투자 면책 안내 배너 */}
              <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 shrink-0">
                <p className="text-[10px] sm:text-[11px] text-amber-400/90 text-center leading-relaxed">
                  ⚠️ 채팅 내용은 투자 조언이 아닙니다. 투자 판단의 근거로
                  사용하지 마세요.
                </p>
              </div>

              {/* 메시지 영역 */}
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
              >
                {loadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
                    <p className="text-xs text-muted-foreground">
                      메시지를 불러오는 중...
                    </p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-muted-foreground">
                      아직 메시지가 없습니다. 첫 메시지를 보내보세요!
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSystem = msg.user_id === "system";
                    const isMe = !isSystem && user?.id === msg.user_id;
                    const posData = isPositionMessage(msg.content)
                      ? parsePositionMessage(msg.content)
                      : null;

                    if (isSystem) {
                      return (
                        <div
                          key={msg.id}
                          className="flex justify-center px-2 py-1"
                        >
                          <div className="max-w-[90%] px-3 py-1.5 rounded-xl text-xs text-center bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {msg.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2 ${
                          isMe ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {/* 아바타 */}
                        <UserAvatar
                          nickname={isMe ? nickname ?? "나" : msg.nickname}
                          avatarUrl={isMe ? avatarUrl : msg.avatar_url}
                        />

                        {/* 메시지 본문 */}
                        <div
                          className={`flex flex-col flex-1 min-w-0 ${
                            isMe ? "items-end" : "items-start"
                          }`}
                        >
                          {/* 닉네임 + 랭킹 뱃지 + 시간 */}
                          <div className="flex items-center gap-1.5 mb-0.5 px-1 flex-wrap">
                            <span
                              className={`text-[11px] font-medium ${
                                isMe
                                  ? "text-indigo-400"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {isMe ? "나" : msg.nickname}
                            </span>
                            <RankBadge rank={userRanks.get(msg.user_id)} />
                            <span className="text-[10px] text-muted-foreground/60">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>

                          {/* 포지션 카드 or 일반 메시지 */}
                          {posData ? (
                            <PositionCard data={posData} isMe={isMe} />
                          ) : (
                            <div
                              className={`w-fit max-w-[85%] px-3 py-1.5 rounded-2xl text-sm break-words whitespace-pre-wrap ${
                                isMe
                                  ? "bg-indigo-500/20 text-foreground rounded-br-md"
                                  : "bg-secondary text-foreground rounded-bl-md"
                              }`}
                            >
                              {msg.content}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* 입력 영역 */}
              <div className="relative px-3 py-2.5 border-t border-border bg-card shrink-0">
                {/* 포지션 선택 패널 */}
                {showPositionPicker && (
                  <PositionPicker
                    positions={positions}
                    onSelect={handleSharePosition}
                    onClose={() => setShowPositionPicker(false)}
                  />
                )}

                {user ? (
                  <div className="flex items-center gap-1.5">
                    {/* 포지션 자랑 버튼 */}
                    <button
                      type="button"
                      onClick={() => {
                        const willOpen = !showPositionPicker;
                        setShowPositionPicker(willOpen);
                        // 포지션 패널을 열 때 최신 포지션을 가져옴 (다른 페이지에서도 동작하도록)
                        if (willOpen && user?.id) {
                          fetchOpenPositions(user.id);
                        }
                      }}
                      title="포지션 자랑하기"
                      className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg transition-colors ${
                        showPositionPicker
                          ? "bg-indigo-500/20 text-indigo-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      {showPositionPicker ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <TrendingUp className="h-4 w-4" />
                      )}
                    </button>

                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="메시지를 입력하세요..."
                      maxLength={500}
                      className="flex-1 min-w-0 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-indigo-500/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-indigo-400 hover:text-indigo-300 disabled:text-muted-foreground/40 transition-colors"
                    >
                      <SendHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="bg-secondary/30 rounded-lg px-3 py-2 text-center">
                    <p className="text-xs text-muted-foreground">
                      로그인 후 이용할 수 있습니다.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
