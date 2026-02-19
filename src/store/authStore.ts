import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => () => void;
}

/**
 * 로그인 성공 시 profiles 테이블에 유저 정보를 upsert합니다.
 * 이미 존재하는 유저라면 무시(onConflict)됩니다.
 */
async function upsertProfile(user: User) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("프로필 upsert 에러:", error.message);
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      console.error("Google 로그인 에러:", error.message);
    }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("로그아웃 에러:", error.message);
    }
  },

  /**
   * Supabase는 기본적으로 localStorage에 access_token과 refresh_token을 저장합니다.
   * getSession()이 페이지 새로고침 시 localStorage에서 토큰을 읽어 세션을 복원하고,
   * 만료된 토큰은 자동으로 refresh합니다.
   * onAuthStateChange를 구독하여 실시간 auth 상태 변경을 감지합니다.
   */
  initialize: () => {
    // 현재 세션을 즉시 가져옴 (localStorage에서 토큰 복원)
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session, user: session?.user ?? null, loading: false });
    });

    // auth 상태 변경 구독
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      set({ session, user: session?.user ?? null, loading: false });

      // 로그인 성공 시 profiles 테이블에 유저 정보 upsert
      if (event === "SIGNED_IN" && session?.user) {
        upsertProfile(session.user);

        // Supabase OAuth 콜백 후 URL 해시 프래그먼트(#access_token=...) 정리
        if (window.location.hash) {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search
          );
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },
}));
