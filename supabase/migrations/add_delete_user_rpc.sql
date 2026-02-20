-- ============================================================
-- 회원 탈퇴용 RPC 함수
-- Supabase 대시보드 → SQL Editor 에서 실행하세요.
-- ============================================================

-- 1) 호출한 유저 자신의 auth.users 레코드를 삭제하는 함수
--    SECURITY DEFINER 로 postgres 권한으로 실행됩니다.
CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  -- 현재 로그인한 유저 ID
  _uid := auth.uid();

  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- auth.users 삭제 (profiles 등 FK ON DELETE CASCADE 가 걸려 있으면 연쇄 삭제)
  DELETE FROM auth.users WHERE id = _uid;
END;
$$;

-- 2) 일반 유저(authenticated role)가 이 함수를 호출할 수 있도록 권한 부여
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;


-- ============================================================
-- (선택) 참조 무결성 CASCADE 확인용 메모
-- 아래 FK들이 ON DELETE CASCADE 로 설정되어 있으면
-- auth.users 삭제 시 연쇄 삭제가 자동으로 처리됩니다.
--
-- profiles.id           → auth.users.id   ON DELETE CASCADE
-- posts.user_id         → auth.users.id   ON DELETE CASCADE
-- comments.user_id      → auth.users.id   ON DELETE CASCADE
-- trades.user_id        → auth.users.id   ON DELETE CASCADE
-- portfolios.user_id    → auth.users.id   ON DELETE CASCADE
-- post_likes.user_id    → auth.users.id   ON DELETE CASCADE
--
-- CASCADE 가 설정되지 않은 경우에도 클라이언트 코드(deleteAccount 함수)에서
-- 각 테이블을 명시적으로 삭제하므로 안전합니다.
-- ============================================================
