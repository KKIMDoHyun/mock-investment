import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Role = "user" | "admin";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: Role;
  nickname: string | null;
  avatarUrl: string | null;
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
  /** 프로필 이미지 변경 (Supabase Storage 업로드 + profiles 테이블 갱신) */
  updateAvatar: (file: File) => Promise<{ success: boolean; message: string }>;
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
async function upsertProfile(
  user: User
): Promise<{ nickname: string | null; avatarUrl: string | null }> {
  const googleAvatar =
    (user.user_metadata?.avatar_url as string) ??
    (user.user_metadata?.picture as string) ??
    null;

  // 1) 먼저 기존 프로필이 있는지 확인
  const { data: existing } = await supabase
    .from("profiles")
    .select("nickname, avatar_url")
    .eq("id", user.id)
    .single();

  // 기존 프로필이 있으면 그대로 반환
  // ⚠️ 커스텀 아바타가 설정되어 있을 수 있으므로 구글 아바타로 덮어쓰지 않음
  if (existing?.nickname) {
    // avatar_url이 아예 없을 때만 구글 아바타를 기본값으로 설정
    if (googleAvatar && !existing.avatar_url) {
      await supabase
        .from("profiles")
        .update({ avatar_url: googleAvatar })
        .eq("id", user.id);
      return {
        nickname: existing.nickname as string,
        avatarUrl: googleAvatar,
      };
    }
    return {
      nickname: existing.nickname as string,
      avatarUrl: (existing.avatar_url as string | null) ?? googleAvatar,
    };
  }

  // 2) 닉네임이 없으면 랜덤 생성 후 upsert (최초 가입)
  const randomNickname = generateRandomNickname();

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email,
        nickname: randomNickname,
        avatar_url: googleAvatar,
      },
      { onConflict: "id" }
    )
    .select("nickname, avatar_url")
    .single();

  if (error) {
    console.error("프로필 upsert 에러:", error.message);
    return { nickname: null, avatarUrl: null };
  }

  return {
    nickname: (data?.nickname as string) ?? randomNickname,
    avatarUrl: (data?.avatar_url as string) ?? googleAvatar,
  };
}

/**
 * profiles 테이블에서 해당 유저의 role과 nickname을 가져옵니다.
 */
async function fetchProfile(
  userId: string
): Promise<{ role: Role; nickname: string | null; avatarUrl: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, nickname, avatar_url")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("프로필 조회 에러:", error.message);
    return { role: "user", nickname: null, avatarUrl: null };
  }

  return {
    role: (data?.role as Role) ?? "user",
    nickname: (data?.nickname as string) ?? null,
    avatarUrl: (data?.avatar_url as string) ?? null,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  role: "user",
  nickname: null,
  avatarUrl: null,
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
    set({ role: "user", roleLoaded: true, nickname: null, avatarUrl: null });
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

  updateAvatar: async (file: File) => {
    const { user } = get();
    if (!user) {
      return { success: false, message: "로그인이 필요합니다." };
    }

    // 파일 유효성 검사
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        message: "JPG, PNG, WebP 형식만 지원합니다.",
      };
    }
    if (file.size > 2 * 1024 * 1024) {
      return { success: false, message: "파일 크기는 2MB 이하로 제한됩니다." };
    }

    // 항상 동일한 경로를 사용해 덮어쓰기 (확장자 변경 시 잔여 파일 방지)
    const filePath = `${user.id}/avatar`;

    try {
      // 기존 파일 삭제 시도 (실패해도 무시)
      await supabase.storage.from("avatars").remove([filePath]);
    } catch {
      // 기존 파일이 없을 수 있음 — 무시
    }

    // Supabase Storage 업로드
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "60",
      });

    if (uploadErr) {
      console.error("아바타 업로드 에러:", uploadErr);
      return {
        success: false,
        message: `업로드 실패: ${uploadErr.message}`,
      };
    }

    console.log("아바타 업로드 성공:", uploadData);

    // 공개 URL 가져오기
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    // 캐시 무효화를 위한 타임스탬프 추가
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    // profiles 테이블 갱신
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id);

    if (updateErr) {
      console.error("아바타 URL 갱신 에러:", updateErr);
      return {
        success: false,
        message: `프로필 갱신 실패: ${updateErr.message}`,
      };
    }

    set({ avatarUrl });
    return { success: true, message: "프로필 이미지가 변경되었습니다! 🎉" };
  },

  initialize: () => {
    // 현재 세션을 즉시 가져옴 (localStorage에서 토큰 복원)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;

      // 로딩 즉시 해제 (UI 렌더링 차단 방지)
      set({ session, user, loading: false });

      // role + nickname + avatarUrl은 비동기로 가져온 뒤 플래그 설정
      if (user) {
        fetchProfile(user.id).then(({ role, nickname, avatarUrl }) =>
          set({ role, nickname, avatarUrl, roleLoaded: true })
        );
      } else {
        set({
          role: "user",
          nickname: null,
          avatarUrl: null,
          roleLoaded: true,
        });
      }
    });

    // auth 상태 변경 구독 (동기 콜백)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;

      // 로딩 즉시 해제
      set({ session, user, loading: false });

      // role + nickname + avatarUrl 비동기 fetch
      if (user) {
        set({ roleLoaded: false });
        fetchProfile(user.id).then(({ role, nickname, avatarUrl }) =>
          set({ role, nickname, avatarUrl, roleLoaded: true })
        );
      } else {
        set({
          role: "user",
          nickname: null,
          avatarUrl: null,
          roleLoaded: true,
        });
      }

      // 로그인 성공 시 profiles 테이블에 유저 정보 upsert + 닉네임 생성
      if (event === "SIGNED_IN" && session?.user) {
        upsertProfile(session.user).then(({ nickname, avatarUrl }) => {
          if (nickname) {
            set({ nickname, avatarUrl });
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
