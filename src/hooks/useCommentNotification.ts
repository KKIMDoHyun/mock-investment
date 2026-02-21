import { useEffect } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { showNotification } from "@/lib/notification";
import { useNotificationStore } from "@/store/notificationStore";
import { playNotificationSound } from "@/lib/sound";

/**
 * 댓글/대댓글 실시간 알림 구독
 * - RootLayout에서 거대한 useEffect 블록을 이 훅으로 분리
 * - user가 바뀔 때만 채널을 재구독
 */
export function useCommentNotification(user: User | null) {
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("comment-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            post_id: string;
            user_id: string;
            parent_id: string | null;
            content: string;
          };

          if (row.user_id === user.id) return;

          const { settings } = useNotificationStore.getState();
          if (!settings.notify_comments) return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("nickname")
            .eq("id", row.user_id)
            .single();
          const nickname = (profile?.nickname as string) ?? "누군가";

          const showAlert = (title: string, body: string, link: string) => {
            const { settings: s } = useNotificationStore.getState();
            if (s.sound_enabled) playNotificationSound();

            if (document.visibilityState === "hidden") {
              showNotification(title, body, undefined, link);
            } else {
              toast.info(title, {
                description: body,
                action: { label: "보러가기", onClick: () => { window.location.href = link; } },
              });
            }
          };

          // 대댓글: 내 댓글에 달린 답글인지 확인
          if (row.parent_id) {
            const { data: parentComment } = await supabase
              .from("comments")
              .select("user_id")
              .eq("id", row.parent_id)
              .single();

            if (parentComment?.user_id === user.id) {
              const title = `${nickname}님이 답글을 남겼습니다`;
              const body = row.content.slice(0, 80);
              const link = `/community/${row.post_id}`;

              await useNotificationStore.getState().saveNotification({
                userId: user.id, type: "reply", title, body, link,
              });
              showAlert(title, body, link);
              return;
            }
          }

          // 내 게시글에 달린 새 댓글
          const { data: post } = await supabase
            .from("posts")
            .select("user_id")
            .eq("id", row.post_id)
            .single();

          if (post?.user_id === user.id) {
            const title = `${nickname}님이 댓글을 남겼습니다`;
            const body = row.content.slice(0, 80);
            const link = `/community/${row.post_id}`;

            await useNotificationStore.getState().saveNotification({
              userId: user.id, type: "comment", title, body, link,
            });
            showAlert(title, body, link);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}
