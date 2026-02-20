import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { setSoundEnabled } from "@/lib/sound";

export type NotifType =
  | "comment"
  | "reply"
  | "tp"
  | "sl"
  | "liquidation"
  | "limit_fill";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotifType;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface UserSettings {
  notify_positions: boolean;
  notify_comments: boolean;
  sound_enabled: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  notify_positions: true,
  notify_comments: true,
  sound_enabled: true,
};

/**
 * 내가 직접 생성한 알림 ID 집합.
 * saveNotification()에서 insert 전 UUID를 미리 등록해
 * Realtime 이벤트가 도착해도 훅에서 이중 표시하지 않도록 방지.
 */
export const locallyCreatedIds = new Set<string>();

interface NotifState {
  notifications: AppNotification[];
  unreadCount: number;
  settings: UserSettings;
  settingsLoaded: boolean;

  fetchNotifications: (userId: string) => Promise<void>;
  addLocal: (notif: AppNotification) => void;
  markAsRead: (notifId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  saveNotification: (params: {
    userId: string;
    type: NotifType;
    title: string;
    body: string;
    link?: string;
  }) => Promise<void>;

  fetchSettings: (userId: string) => Promise<void>;
  updateSettings: (
    userId: string,
    updates: Partial<UserSettings>
  ) => Promise<boolean>;
  reset: () => void;
}

export const useNotificationStore = create<NotifState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,

  fetchNotifications: async (userId) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const notifs = (data ?? []) as AppNotification[];
    set({
      notifications: notifs,
      unreadCount: notifs.filter((n) => !n.is_read).length,
    });
  },

  addLocal: (notif) => {
    set((s) => ({
      notifications: [notif, ...s.notifications].slice(0, 50),
      unreadCount: s.unreadCount + (notif.is_read ? 0 : 1),
    }));
  },

  markAsRead: async (notifId) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notifId);

    if (!error) {
      set((s) => ({
        notifications: s.notifications.map((n) =>
          n.id === notifId ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    }
  },

  markAllAsRead: async (userId) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (!error) {
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    }
  },

  saveNotification: async ({ userId, type, title, body, link }) => {
    // UUID를 클라이언트에서 미리 생성하여 insert 전에 locallyCreatedIds에 등록.
    // 이렇게 해야 Realtime 이벤트 도착 전 Set이 준비되어 이중 표시를 막을 수 있음.
    const id = crypto.randomUUID();
    locallyCreatedIds.add(id);

    const { data, error } = await supabase
      .from("notifications")
      .insert({
        id,
        user_id: userId,
        type,
        title,
        body,
        link: link ?? null,
      })
      .select()
      .single();

    if (!error && data) {
      get().addLocal(data as AppNotification);
    } else if (error) {
      // insert 실패 시 Set 정리
      locallyCreatedIds.delete(id);
    }
  },

  fetchSettings: async (userId) => {
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (data) {
      const settings: UserSettings = {
        notify_positions: data.notify_positions ?? true,
        notify_comments: data.notify_comments ?? true,
        sound_enabled: data.sound_enabled ?? true,
      };
      setSoundEnabled(settings.sound_enabled);
      set({ settings, settingsLoaded: true });
    } else {
      // 최초 로그인: 기본값 저장
      await supabase
        .from("user_settings")
        .upsert({ user_id: userId, ...DEFAULT_SETTINGS });
      setSoundEnabled(DEFAULT_SETTINGS.sound_enabled);
      set({ settings: DEFAULT_SETTINGS, settingsLoaded: true });
    }
  },

  updateSettings: async (userId, updates) => {
    const newSettings = { ...get().settings, ...updates };
    const { error } = await supabase.from("user_settings").upsert({
      user_id: userId,
      ...newSettings,
      updated_at: new Date().toISOString(),
    });

    if (error) return false;

    if (updates.sound_enabled !== undefined) {
      setSoundEnabled(updates.sound_enabled);
    }
    set({ settings: newSettings });
    return true;
  },

  reset: () =>
    set({
      notifications: [],
      unreadCount: 0,
      settings: DEFAULT_SETTINGS,
      settingsLoaded: false,
    }),
}));
