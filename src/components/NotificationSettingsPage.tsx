import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BellOff,
  Volume2,
  MessageSquare,
  TrendingUp,
  Check,
  Loader2,
  ArrowLeft,
  X,
  Settings,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import {
  useNotificationStore,
  type AppNotification,
} from "@/store/notificationStore";
import { Seo } from "@/hooks/useSeo";
// ── 토글 스위치 ──────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${
        checked ? "bg-indigo-500" : "bg-secondary border border-border"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

// ── 알림 아이템 ──────────────────────────────
const TYPE_ICON: Record<string, string> = {
  comment: "💬",
  reply: "↩️",
  tp: "🎯",
  sl: "🛑",
  liquidation: "⚠️",
  limit_fill: "📋",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}

function NotifItem({
  notif,
  onRead,
}: {
  notif: AppNotification;
  onRead: (id: string) => void;
}) {
  const handleClick = () => {
    if (!notif.is_read) onRead(notif.id);
    if (notif.link) {
      window.location.href = notif.link;
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors ${
        !notif.is_read ? "bg-indigo-500/5" : ""
      }`}
    >
      <span className="text-base mt-0.5 flex-shrink-0">
        {TYPE_ICON[notif.type] ?? "🔔"}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-snug ${
            !notif.is_read
              ? "text-foreground font-medium"
              : "text-muted-foreground"
          }`}
        >
          {notif.title}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-2">
          {notif.body}
        </p>
        <p className="text-[10px] text-muted-foreground/50 mt-1">
          {timeAgo(notif.created_at)}
        </p>
      </div>
      {!notif.is_read && (
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
      )}
    </button>
  );
}

// ── 브라우저 알림 권한 상태 ───────────────────
function BrowserNotifStatus() {
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >(() => {
    if (typeof window === "undefined" || !("Notification" in window))
      return "unsupported";
    return Notification.permission;
  });

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") toast.success("브라우저 알림이 허용되었습니다.");
    else if (result === "denied")
      toast.error("브라우저 알림이 차단되었습니다. 브라우저 설정을 확인해 주세요.");
  };

  if (permission === "unsupported") return null;

  if (permission === "granted") {
    return (
      <div className="flex items-center gap-3 px-4 py-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-sm">
        <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
        <span className="text-emerald-400 text-sm">
          브라우저 알림이 허용되어 있습니다
        </span>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex items-start gap-3 px-4 py-3.5 bg-red-500/5 border border-red-500/20 rounded-xl">
        <X className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-red-400 font-medium">
            브라우저 알림이 차단되어 있습니다
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            브라우저 주소창 옆 자물쇠 아이콘 → 알림 → 허용으로 변경해 주세요
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-3.5 bg-secondary/50 border border-border rounded-xl">
      <div className="flex items-center gap-3">
        <Bell className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">
            브라우저 알림 허용
          </p>
          <p className="text-xs text-muted-foreground">
            탭을 닫아도 청산·체결 알림을 받을 수 있습니다
          </p>
        </div>
      </div>
      <button
        onClick={requestPermission}
        className="text-xs px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg transition-colors cursor-pointer flex-shrink-0"
      >
        허용하기
      </button>
    </div>
  );
}

// ── 설정 토글 행 ──────────────────────────────
function SettingRow({
  icon,
  iconBg,
  iconColor,
  label,
  description,
  checked,
  onChange,
  saving,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  saving: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <span className={iconColor}>{icon}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {saving && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        )}
        <Toggle checked={checked} onChange={onChange} disabled={saving} />
      </div>
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────
export default function NotificationSettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const {
    notifications,
    unreadCount,
    settings,
    settingsLoaded,
    fetchNotifications,
    fetchSettings,
    updateSettings,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    // 인증 로딩 중에는 리다이렉트 금지 — 로딩 완료 후 판단
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    fetchNotifications(user.id);
    if (!settingsLoaded) fetchSettings(user.id);
  }, [user?.id, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback(
    async (key: keyof typeof settings, value: boolean) => {
      if (!user) return;
      setSavingKey(key);
      const ok = await updateSettings(user.id, { [key]: value });
      setSavingKey(null);
      if (!ok) toast.error("설정 저장에 실패했습니다.");
    },
    [user, updateSettings]
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!user || unreadCount === 0) return;
    await markAllAsRead(user.id);
    toast.success("모든 알림을 읽음 처리했습니다.");
  }, [user, unreadCount, markAllAsRead]);

  // 인증 초기화 중이면 로딩 스피너 표시 (페이지 이동 방지)
  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <p className="text-sm">로딩 중...</p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <>
      <Seo title="알림 설정" url="/settings" noIndex />
      <main className="flex-1 w-full max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex flex-col gap-5">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/" })}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              알림 설정
            </h1>
            <p className="text-xs text-muted-foreground">
              알림 및 사운드 환경을 설정합니다
            </p>
          </div>
        </div>

        {/* 브라우저 알림 권한 */}
        <BrowserNotifStatus />

        {/* 알림 항목 설정 */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-indigo-400" />
              알림 항목
            </h2>
          </div>
          <div className="divide-y divide-border/50">
            <SettingRow
              icon={<TrendingUp className="h-4 w-4" />}
              iconBg="bg-emerald-500/10"
              iconColor="text-emerald-400"
              label="포지션 체결 / 청산 알림"
              description="익절, 손절, 강제청산, 지정가 체결 시 알림"
              checked={settings.notify_positions}
              onChange={(v) => handleToggle("notify_positions", v)}
              saving={savingKey === "notify_positions"}
            />
            <SettingRow
              icon={<MessageSquare className="h-4 w-4" />}
              iconBg="bg-indigo-500/10"
              iconColor="text-indigo-400"
              label="댓글 및 답글 알림"
              description="내 글·댓글에 새 댓글이 달릴 때 알림"
              checked={settings.notify_comments}
              onChange={(v) => handleToggle("notify_comments", v)}
              saving={savingKey === "notify_comments"}
            />
            <SettingRow
              icon={<Volume2 className="h-4 w-4" />}
              iconBg="bg-amber-500/10"
              iconColor="text-amber-400"
              label="사운드 효과"
              description="체결, 청산 시 효과음 재생"
              checked={settings.sound_enabled}
              onChange={(v) => handleToggle("sound_enabled", v)}
              saving={savingKey === "sound_enabled"}
            />
          </div>
        </div>

        {/* 최근 알림 목록 */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              최근 알림
              {unreadCount > 0 && (
                <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {unreadCount}
                </span>
              )}
            </h2>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                <Check className="h-3 w-3" />
                모두 읽음
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="py-14 text-center">
              <BellOff className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">알림이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30 max-h-[480px] overflow-y-auto">
              {notifications.map((n) => (
                <NotifItem key={n.id} notif={n} onRead={markAsRead} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
