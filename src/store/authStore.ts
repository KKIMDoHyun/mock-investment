import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Role = "user" | "admin";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: Role;
  /** 인증 초기화 로딩 (세션 복원) */
  loading: boolean;
  /** role 정보 로딩 완료 여부 */
  roleLoaded: boolean;
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

/**
 * profiles 테이블에서 해당 유저의 role을 가져옵니다.
 */
async function fetchRole(userId: string): Promise<Role> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("role 조회 에러:", error.message);
    return "user"; // 기본값
  }

  return (data?.role as Role) ?? "user";
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  role: "user",
  loading: true,
  roleLoaded: false,

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
    set({ role: "user", roleLoaded: true });
  },

  initialize: () => {
    // 현재 세션을 즉시 가져옴 (localStorage에서 토큰 복원)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;

      // 로딩 즉시 해제 (UI 렌더링 차단 방지)
      set({ session, user, loading: false });

      // role은 비동기로 가져온 뒤 roleLoaded 플래그 설정
      if (user) {
        fetchRole(user.id).then((role) => set({ role, roleLoaded: true }));
      } else {
        set({ role: "user", roleLoaded: true });
      }
    });

    // auth 상태 변경 구독 (동기 콜백)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;

      // 로딩 즉시 해제
      set({ session, user, loading: false });

      // role 비동기 fetch
      if (user) {
        set({ roleLoaded: false });
        fetchRole(user.id).then((role) => set({ role, roleLoaded: true }));
      } else {
        set({ role: "user", roleLoaded: true });
      }

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
