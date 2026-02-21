import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * 비로그인 유저용 안정적인 ID: localStorage에 저장해
 * 같은 브라우저의 여러 탭이 동일한 키를 공유하도록 함
 */
function getAnonymousPresenceId(): string {
  const STORAGE_KEY = "anon_presence_id";
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function useOnlineCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // 로그인 유저는 user.id, 비로그인 유저는 브라우저 공유 UUID를 키로 사용
      // → 동일 유저의 여러 탭/기기가 같은 키를 가지므로 Supabase가 자동으로 1개로 집계
      const presenceKey = session?.user?.id ?? getAnonymousPresenceId();

      channel = supabase.channel("online-users", {
        config: { presence: { key: presenceKey } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState();
          // 키 수 = 고유 사용자 수 (같은 키의 여러 탭은 배열로 병합되므로 중복 없음)
          const uniqueCount = Object.keys(state).length;
          // 값이 동일하면 setState를 건너뛰어 불필요한 리렌더링 방지
          setCount((prev) => (prev !== uniqueCount ? uniqueCount : prev));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track({ online_at: new Date().toISOString() });
          }
        });
    }

    init();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return count;
}
