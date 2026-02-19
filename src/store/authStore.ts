import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Role = "user" | "admin";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: Role;
  nickname: string | null;
  /** 인증 초기화 로딩 (세션 복원) */
  loading: boolean;
  /** role 정보 로딩 완료 여부 */
  roleLoaded: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => () => void;
  /** 닉네임 변경 (UNIQUE 제약조건 에러 처리 포함) */
  updateNickname: (
    nickname: string
  ) => Promise<{ success: boolean; message: string }>;
}

// ── 랜덤 닉네임 생성 (user_ + 영문/숫자 6자리) ──
function generateRandomNickname(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `user_${suffix}`;
}

/**
 * 로그인 성공 시 profiles 테이블에 유저 정보를 upsert합니다.
 * nickname이 없으면 랜덤 닉네임을 생성합니다.
 */
async function upsertProfile(user: User): Promise<string | null> {
  // 1) 먼저 기존 프로필이 있는지 확인
  const { data: existing } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .single();

  // 기존 닉네임이 있으면 그대로 사용
  if (existing?.nickname) {
    return existing.nickname as string;
  }

  // 2) 닉네임이 없으면 랜덤 생성 후 upsert
  const randomNickname = generateRandomNickname();

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email,
        nickname: randomNickname,
      },
      { onConflict: "id" }
    )
    .select("nickname")
    .single();

  if (error) {
    console.error("프로필 upsert 에러:", error.message);
    return null;
  }

  return (data?.nickname as string) ?? randomNickname;
}

/**
 * profiles 테이블에서 해당 유저의 role과 nickname을 가져옵니다.
 */
async function fetchProfile(
  userId: string
): Promise<{ role: Role; nickname: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, nickname")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("프로필 조회 에러:", error.message);
    return { role: "user", nickname: null };
  }

  return {
    role: (data?.role as Role) ?? "user",
    nickname: (data?.nickname as string) ?? null,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  role: "user",
  nickname: null,
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
    set({ role: "user", roleLoaded: true, nickname: null });
  },

  updateNickname: async (nickname: string) => {
    const { user } = get();
    if (!user) {
      return { success: false, message: "로그인이 필요합니다." };
    }

    const trimmed = nickname.trim();
    if (!trimmed) {
      return { success: false, message: "닉네임을 입력해주세요." };
    }
    if (trimmed.length < 2 || trimmed.length > 20) {
      return {
        success: false,
        message: "닉네임은 2~20자 사이로 입력해주세요.",
      };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ nickname: trimmed })
      .eq("id", user.id);

    if (error) {
      // UNIQUE 제약조건 위반 (code: 23505)
      if (error.code === "23505") {
        return {
          success: false,
          message: "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.",
        };
      }
      return { success: false, message: `닉네임 변경 에러: ${error.message}` };
    }

    set({ nickname: trimmed });
    return { success: true, message: "닉네임이 변경되었습니다! ✨" };
  },

  initialize: () => {
    // 현재 세션을 즉시 가져옴 (localStorage에서 토큰 복원)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;

      // 로딩 즉시 해제 (UI 렌더링 차단 방지)
      set({ session, user, loading: false });

      // role + nickname은 비동기로 가져온 뒤 플래그 설정
      if (user) {
        fetchProfile(user.id).then(({ role, nickname }) =>
          set({ role, nickname, roleLoaded: true })
        );
      } else {
        set({ role: "user", nickname: null, roleLoaded: true });
      }
    });

    // auth 상태 변경 구독 (동기 콜백)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;

      // 로딩 즉시 해제
      set({ session, user, loading: false });

      // role + nickname 비동기 fetch
      if (user) {
        set({ roleLoaded: false });
        fetchProfile(user.id).then(({ role, nickname }) =>
          set({ role, nickname, roleLoaded: true })
        );
      } else {
        set({ role: "user", nickname: null, roleLoaded: true });
      }

      // 로그인 성공 시 profiles 테이블에 유저 정보 upsert + 닉네임 생성
      if (event === "SIGNED_IN" && session?.user) {
        upsertProfile(session.user).then((nickname) => {
          if (nickname) {
            set({ nickname });
          }
        });

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
