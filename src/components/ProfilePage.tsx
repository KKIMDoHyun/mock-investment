import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { UserCircle, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const nickname = useAuthStore((s) => s.nickname);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const updateNickname = useAuthStore((s) => s.updateNickname);
  const updateAvatar = useAuthStore((s) => s.updateAvatar);
  const navigate = useNavigate();

  const [newNickname, setNewNickname] = useState(nickname ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // nickname이 비동기로 로드될 수 있으므로, 최초 로드 시 한 번만 동기화
  const initializedRef = useRef(false);
  if (nickname && !initializedRef.current && newNickname === "") {
    initializedRef.current = true;
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

  // ── 프로필 이미지 변경 ──
  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // input 리셋 (같은 파일 다시 선택 가능하도록)
      e.target.value = "";

      setUploadingAvatar(true);
      const result = await updateAvatar(file);
      setUploadingAvatar(false);

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    },
    [updateAvatar]
  );

  if (!user) return null;

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex flex-col gap-4 sm:gap-8">
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
      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
        {/* 프로필 이미지 */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative group">
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
              className="relative w-24 h-24 rounded-full overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-card disabled:cursor-wait"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="프로필"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-2xl font-bold text-white">
                  {nickname?.charAt(0).toUpperCase() ?? "?"}
                </div>
              )}

              {/* 오버레이 */}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
            </button>

            {/* 업로드 중 표시 */}
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:text-muted-foreground"
            >
              {uploadingAvatar ? "업로드 중..." : "이미지 변경"}
            </button>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              JPG, PNG, WebP, GIF · 최대 2MB
            </p>
          </div>

          {/* 숨김 파일 input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

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

        {/* 현재 프로필 미리보기 */}
        <div className="bg-secondary/30 border border-border rounded-lg px-4 py-3 flex items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="프로필"
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-sm font-medium text-white flex-shrink-0">
              {nickname?.charAt(0).toUpperCase() ?? "?"}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">
              {nickname ?? "닉네임 없음"}
            </p>
            <p className="text-xs text-muted-foreground">
              현재 표시되는 프로필
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
