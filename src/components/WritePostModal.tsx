import { useState, useRef, useCallback } from "react";
import {
  ImagePlus,
  X,
  TrendingUp,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useTradingStore, calcPnl } from "@/store/tradingStore";
import type { Trade } from "@/store/tradingStore";
import { useCommunityStore } from "@/store/communityStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

interface WritePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WritePostModal({
  open,
  onOpenChange,
}: WritePostModalProps) {
  const user = useAuthStore((s) => s.user);
  const positions = useTradingStore((s) => s.positions);
  const fetchOpenPositions = useTradingStore((s) => s.fetchOpenPositions);
  const createPost = useCommunityStore((s) => s.createPost);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPositionPicker, setShowPositionPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── 이미지 선택 ──
  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);

      const remaining = MAX_IMAGES - imageFiles.length;
      if (remaining <= 0) {
        toast.error(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
        return;
      }

      const selected = files.slice(0, remaining);

      for (const file of selected) {
        if (file.size > MAX_IMAGE_SIZE) {
          toast.error(`${file.name}: 5MB 이하의 이미지만 업로드 가능합니다.`);
          return;
        }
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name}: 이미지 파일만 업로드 가능합니다.`);
          return;
        }
      }

      // 미리보기 생성
      const newPreviews = selected.map((file) => URL.createObjectURL(file));

      setImageFiles((prev) => [...prev, ...selected]);
      setImagePreviews((prev) => [...prev, ...newPreviews]);

      // input 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [imageFiles.length]
  );

  // ── 이미지 제거 ──
  const removeImage = useCallback((index: number) => {
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── 수익 인증 삽입 ──
  const handleInsertProfit = useCallback(
    (trade: Trade) => {
      const latestPrice =
        useTradingStore.getState().prices[trade.symbol] ||
        useTradingStore.getState().currentPrice;
      const { pnl, roe } = calcPnl(trade, latestPrice);

      const profitCard = `[PROFIT_CARD]${JSON.stringify({
        symbol: trade.symbol,
        position_type: trade.position_type,
        leverage: trade.leverage,
        entry_price: trade.entry_price,
        margin: trade.margin,
        pnl: Math.round(pnl * 100) / 100,
        roe: Math.round(roe * 100) / 100,
        current_price: latestPrice,
      })}[/PROFIT_CARD]`;

      setContent((prev) => {
        const insertText = prev ? `${prev}\n\n${profitCard}` : profitCard;
        return insertText;
      });

      setShowPositionPicker(false);
      toast.success("수익 인증이 삽입되었습니다!");
    },
    []
  );

  // ── 이미지 업로드 (Supabase Storage) ──
  const uploadImages = async (): Promise<string[]> => {
    if (!user || imageFiles.length === 0) return [];

    const urls: string[] = [];

    for (const file of imageFiles) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from("post-images")
        .upload(path, file, { upsert: true });

      if (error) {
        console.error("이미지 업로드 에러:", error.message);
        toast.error(`이미지 업로드 실패: ${file.name}`);
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("post-images").getPublicUrl(path);

      urls.push(publicUrl);
    }

    return urls;
  };

  // ── 게시글 작성 ──
  const handleSubmit = async () => {
    if (!user) return;

    if (!title.trim()) {
      toast.error("제목을 입력해 주세요.");
      return;
    }
    if (!content.trim()) {
      toast.error("내용을 입력해 주세요.");
      return;
    }

    setSubmitting(true);

    try {
      // 이미지 업로드
      const imageUrls = await uploadImages();

      const result = await createPost({
        userId: user.id,
        title: title.trim(),
        content: content.trim(),
        images: imageUrls,
      });

      if (result.success) {
        toast.success(result.message);
        resetForm();
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("게시글 작성 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    // 미리보기 URL 해제
    for (const url of imagePreviews) {
      URL.revokeObjectURL(url);
    }
    setImageFiles([]);
    setImagePreviews([]);
    setShowPositionPicker(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>새 글 작성</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 제목 */}
          <Input
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />

          {/* 본문 */}
          <textarea
            ref={textareaRef}
            placeholder="내용을 입력하세요..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full min-h-[200px] bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-indigo-500/50 transition-colors resize-y"
            maxLength={5000}
          />

          {/* 도구 버튼들 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 이미지 첨부 - label 방식으로 file input 트리거 (Radix Dialog 호환) */}
            <label
              className={`inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 h-8 text-xs font-medium shadow-xs transition-colors cursor-pointer hover:bg-accent hover:text-accent-foreground ${
                imageFiles.length >= MAX_IMAGES
                  ? "opacity-50 pointer-events-none"
                  : ""
              }`}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              이미지 첨부 ({imageFiles.length}/{MAX_IMAGES})
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={handleImageSelect}
                disabled={imageFiles.length >= MAX_IMAGES}
              />
            </label>

            {/* 수익 인증 */}
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  const willOpen = !showPositionPicker;
                  setShowPositionPicker(willOpen);
                  if (willOpen && user?.id) {
                    fetchOpenPositions(user.id);
                  }
                }}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                내 수익 인증하기
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    showPositionPicker ? "rotate-180" : ""
                  }`}
                />
              </Button>

              {/* 포지션 선택 드롭다운 */}
              {showPositionPicker && (
                <PositionPickerDropdown
                  positions={positions}
                  onSelect={handleInsertProfit}
                  onClose={() => setShowPositionPicker(false)}
                />
              )}
            </div>
          </div>

          {/* 이미지 미리보기 */}
          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {imagePreviews.map((url, idx) => (
                <div key={idx} className="relative aspect-square group">
                  <img
                    src={url}
                    alt={`미리보기 ${idx + 1}`}
                    className="w-full h-full object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 제출 버튼 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={submitting}
            >
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  게시 중...
                </>
              ) : (
                "게시하기"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── 포지션 선택 드롭다운 ──
function PositionPickerDropdown({
  positions,
  onSelect,
  onClose,
}: {
  positions: Trade[];
  onSelect: (trade: Trade) => void;
  onClose: () => void;
}) {
  const currentPrice = useTradingStore((s) => s.currentPrice);
  const prices = useTradingStore((s) => s.prices);

  if (positions.length === 0) {
    return (
      <div className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-xl shadow-xl z-50 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-foreground">
            포지션 선택
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center py-3">
          현재 열려있는 포지션이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="absolute top-full left-0 mt-1 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-foreground">
          수익 인증할 포지션 선택
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {positions.map((trade) => {
          const price = prices[trade.symbol] || currentPrice;
          const { pnl, roe } = calcPnl(trade, price);
          const isLong = trade.position_type === "LONG";
          const isProfitable = pnl >= 0;

          return (
            <button
              key={trade.id}
              type="button"
              onClick={() => onSelect(trade)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-secondary/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                    isLong
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-red-500/15 text-red-400"
                  }`}
                >
                  {trade.symbol.replace("USDT", "")} {trade.position_type}{" "}
                  {trade.leverage}x
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  $
                  {trade.entry_price.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
              <span
                className={`text-[11px] font-semibold tabular-nums ${
                  isProfitable ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {isProfitable ? "+" : ""}
                {roe.toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
