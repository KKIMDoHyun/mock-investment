import { useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";

export default function NicknameSetupModal() {
  const user = useAuthStore((s) => s.user);
  const nickname = useAuthStore((s) => s.nickname);
  const termsAgreedAt = useAuthStore((s) => s.termsAgreedAt);
  const roleLoaded = useAuthStore((s) => s.roleLoaded);
  const updateNickname = useAuthStore((s) => s.updateNickname);

  const [newNickname, setNewNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  // 약관 동의가 완료된 이후에만 표시 (TermsAgreementModal과 동시에 뜨지 않도록)
  const isRandomNickname = nickname?.startsWith("user_") ?? false;
  const isOpen = !!user && roleLoaded && !!termsAgreedAt && isRandomNickname && !dismissed;

  const handleSubmit = async () => {
    if (!newNickname.trim()) {
      setError("닉네임을 입력해주세요.");
      return;
    }

    setSaving(true);
    setError("");

    const result = await updateNickname(newNickname);

    setSaving(false);

    if (result.success) {
      toast.success(result.message);
      setDismissed(true);
    } else {
      setError(result.message);
    }
  };

  const handleDismiss = () => {
    // 닫기 시 랜덤 닉네임 유지
    setDismissed(true);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open: boolean) => !open && handleDismiss()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            닉네임을 설정해주세요 👋
          </DialogTitle>
          <DialogDescription>
            채팅과 프로필에 사용될 고유한 닉네임을 입력해주세요.
            <br />
            지금 설정하지 않으면 기본 닉네임(
            <span className="font-mono text-foreground">{nickname}</span>)이
            사용됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-2">
            <Input
              type="text"
              placeholder="새 닉네임 (2~20자)"
              value={newNickname}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setNewNickname(e.target.value);
                setError("");
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter" && !saving) handleSubmit();
              }}
              maxLength={20}
              className="h-10"
              autoFocus
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={handleDismiss} disabled={saving}>
              나중에
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "저장 중..." : "설정 완료"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
