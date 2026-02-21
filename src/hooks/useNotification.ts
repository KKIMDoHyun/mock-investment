/**
 * useNotification 훅
 *
 * notifications 테이블을 Supabase Realtime으로 구독한다.
 * - 내가 직접 생성한 알림(locallyCreatedIds)은 이미 표시했으므로 스킵
 * - 외부에서 수신한 알림(ex. 다른 유저가 생성)은:
 *   - visibilityState === 'hidden' → OS 시스템 알림
 *   - visibilityState === 'visible' → Sonner 토스트
 *   - sound_enabled === true → notification.mp3 재생
 */

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { showNotification } from "@/lib/notification";
import {
  useNotificationStore,
  locallyCreatedIds,
  sanitizeNotifLink,
  type AppNotification,
} from "@/store/notificationStore";
import { playNotificationSound } from "@/lib/sound";

const POSITION_TYPES = new Set(["tp", "sl", "liquidation", "limit_fill"]);
const COMMENT_TYPES = new Set(["comment", "reply"]);

export function useNotification(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const raw = payload.new as AppNotification;
          // DB 트리거 등 외부 경로에서 잘못 저장된 링크를 정규화
          const notif: AppNotification = { 
            ...raw,
            link: sanitizeNotifLink(raw.link),
          };
          const { settings, addLocal } = useNotificationStore.getState();

          // 내가 직접 saveNotification()으로 삽입한 알림은
          // 이미 표시·로컬 추가했으므로 Realtime에서 다시 처리하지 않음
          if (locallyCreatedIds.has(notif.id)) {
            locallyCreatedIds.delete(notif.id);
            return;
          }

          // 설정별 필터링
          if (POSITION_TYPES.has(notif.type) && !settings.notify_positions) return;
          if (COMMENT_TYPES.has(notif.type) && !settings.notify_comments) return;

          // 로컬 상태 갱신 (unreadCount + 목록)
          addLocal(notif);

          // 사운드 재생
          if (settings.sound_enabled) {
            playNotificationSound();
          }

          // 표시 방식 결정
          if (document.visibilityState === "hidden") {
            // 탭이 숨겨져 있으면 OS 시스템 알림 발송
            showNotification(
              notif.title,
              notif.body,
              undefined,
              notif.link ?? undefined
            );
          } else {
            // 포그라운드에서는 인앱 토스트
            toast.info(notif.title, {
              description: notif.body,
              action: notif.link
                ? {
                    label: "보러가기",
                    onClick: () => {
                      window.location.href = notif.link!;
                    },
                  }
                : undefined,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
