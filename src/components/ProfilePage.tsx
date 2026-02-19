import { useEffect, useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { UserCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const nickname = useAuthStore((s) => s.nickname);
  const updateNickname = useAuthStore((s) => s.updateNickname);
  const navigate = useNavigate();

  const [newNickname, setNewNickname] = useState(nickname ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // nickname이 비동기로 로드될 수 있으므로, 최초 로드 시 한 번만 동기화
  const initializedRef = useRef(false);
  if (nickname && !initializedRef.current && newNickname === "") {
    initializedRef.current = true;
    // 렌더 중 setState 호출을 피하기 위해 초기값으로 직접 세팅
    setNewNickname(nickname);
  }

  // 비로그인 → 홈으로
  useEffect(() => {
    if (!user) {
      navigate({ to: "/" });
    }
  }, [user, navigate]);

  const handleSubmit = async () => {
    const trimmed = newNickname.trim();
    if (trimmed === nickname) {
      toast.info("현재 닉네임과 동일합니다.");
      return;
    }

    setSaving(true);
    setError("");

    const result = await updateNickname(trimmed);

    setSaving(false);

    if (result.success) {
      toast.success(result.message);
    } else {
      setError(result.message);
    }
  };

  if (!user) return null;

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
      {/* ── 헤더 ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
          <UserCircle className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">내 정보 설정</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {/* ── 프로필 카드 ── */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-6">
        {/* 이메일 (읽기 전용) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">이메일</label>
          <Input
            type="text"
            value={user.email ?? ""}
            disabled
            className="h-10 bg-secondary/50"
          />
          <p className="text-xs text-muted-foreground">
            이메일은 변경할 수 없습니다.
          </p>
        </div>

        {/* 닉네임 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">닉네임</label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="닉네임 (2~20자)"
              value={newNickname}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setNewNickname(e.target.value);
                setError("");
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter" && !saving) handleSubmit();
              }}
              maxLength={20}
              className="h-10 flex-1"
            />
            <Button
              onClick={handleSubmit}
              disabled={saving || newNickname.trim() === nickname}
              className="h-10"
            >
              {saving ? "저장 중..." : "변경하기"}
            </Button>
          </div>
          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              채팅과 프로필에 표시되는 고유한 닉네임입니다.
            </p>
          )}
        </div>

        {/* 현재 닉네임 미리보기 */}
        <div className="bg-secondary/30 border border-border rounded-lg px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-sm font-medium text-white">
            {nickname?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {nickname ?? "닉네임 없음"}
            </p>
            <p className="text-xs text-muted-foreground">
              현재 표시되는 닉네임
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
