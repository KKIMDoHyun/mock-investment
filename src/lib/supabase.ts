import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY 환경 변수를 .env.local에 설정해주세요."
  );
}

/**
 * Supabase 클라이언트.
 * 기본 설정으로 localStorage에 access_token, refresh_token을 자동 저장하여
 * 새로고침 후에도 세션이 유지됩니다.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
