import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, SendHorizontal } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";

// ── 타입 ──
interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  nickname: string;
}

// ── 닉네임 캐시 (프로필 조인 결과) ──
const nicknameCache = new Map<string, string>();

async function fetchNickname(userId: string): Promise<string> {
  if (nicknameCache.has(userId)) return nicknameCache.get(userId)!;

  const { data } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", userId)
    .single();

  const nickname = (data?.nickname as string) ?? "익명";
  nicknameCache.set(userId, nickname);
  return nickname;
}

export default function ChatWidget() {
  const user = useAuthStore((s) => s.user);
  const nickname = useAuthStore((s) => s.nickname);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── 자동 스크롤 ──
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  // ── 초기 메시지 로드 (최근 50개) ──
  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, user_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("메시지 로드 에러:", error.message);
      return;
    }

    // 역순 → 시간순 정렬
    const rows = (data ?? []).reverse();

    // 닉네임 병렬 fetch
    const enriched = await Promise.all(
      rows.map(async (row) => ({
        id: row.id as string,
        user_id: row.user_id as string,
        content: row.content as string,
        created_at: row.created_at as string,
        nickname: await fetchNickname(row.user_id as string),
      }))
    );

    setMessages(enriched);
    setLoaded(true);
  }, []);

  // ── 채팅창 열릴 때 로드 + 실시간 구독 ──
  useEffect(() => {
    if (!isOpen) return;

    // 열릴 때 읽지 않은 메시지 카운트 초기화
    setUnreadCount(0);

    if (!loaded) {
      loadMessages().then(scrollToBottom);
    } else {
      scrollToBottom();
    }
  }, [isOpen, loaded, loadMessages, scrollToBottom]);

  // ── Supabase Realtime 구독 (항상 활성화 — 안 읽은 메시지 카운트용) ──
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

          const msgNickname = await fetchNickname(row.user_id);

          const newMsg: ChatMessage = {
            id: row.id,
            user_id: row.user_id,
            content: row.content,
            created_at: row.created_at,
            nickname: msgNickname,
          };

          setMessages((prev) => [...prev, newMsg]);

          // 채팅창이 닫혀있으면 읽지 않은 메시지 카운트 증가
          setUnreadCount((prev) => {
            // isOpen 상태를 직접 참조하면 클로저 문제 → ref 대신 state 체크
            return prev; // 아래에서 별도 처리
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 새 메시지 올 때 처리: 열려있으면 스크롤, 닫혀있으면 카운트 증가
  const prevLengthRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      if (isOpen) {
        scrollToBottom();
      } else {
        setUnreadCount((prev) => prev + (messages.length - prevLengthRef.current));
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages.length, isOpen, scrollToBottom]);

  // ── 메시지 전송 ──
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
      setInput(content); // 실패 시 복원
    }

    setSending(false);
  }, [user, input, sending]);

  // ── 시간 포맷 ──
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // 현재 유저의 닉네임을 캐시에 등록
  useEffect(() => {
    if (user?.id && nickname) {
      nicknameCache.set(user.id, nickname);
    }
  }, [user?.id, nickname]);

  return (
    <>
      {/* ── 채팅 버튼 ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6" />
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
        <div className="fixed bottom-24 right-6 z-50 w-80 h-[28rem] bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-foreground">
                글로벌 채팅방
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 메시지 영역 */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
          >
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-muted-foreground">
                  아직 메시지가 없습니다. 첫 메시지를 보내보세요!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = user?.id === msg.user_id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    {/* 닉네임 + 시간 */}
                    <div className="flex items-center gap-1.5 mb-0.5 px-1">
                      <span
                        className={`text-[11px] font-medium ${
                          isMe ? "text-indigo-400" : "text-muted-foreground"
                        }`}
                      >
                        {isMe ? "나" : msg.nickname}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                    {/* 메시지 말풍선 */}
                    <div
                      className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-sm break-words ${
                        isMe
                          ? "bg-indigo-500/20 text-foreground rounded-br-md"
                          : "bg-secondary text-foreground rounded-bl-md"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="px-3 py-2.5 border-t border-border bg-card">
            {user ? (
              <div className="flex items-center gap-2">
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
                  className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-indigo-500/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="w-8 h-8 flex items-center justify-center text-indigo-400 hover:text-indigo-300 disabled:text-muted-foreground/40 transition-colors"
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
        </div>
      )}
    </>
  );
}
