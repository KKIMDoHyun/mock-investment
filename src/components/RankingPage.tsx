import { useState, useEffect, useCallback } from "react";
import { Trophy, Loader2, TrendingUp, DollarSign, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ── 타입 ──
type Period = "daily" | "weekly" | "monthly";

interface RankedUser {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  balance: number;
  totalPrincipal: number;
  profit: number | null;
  roe: number | null;
}

interface PortfolioRow {
  userId: string;
  balance: number;
  totalPrincipal: number;
  nickname: string;
  avatarUrl: string | null;
}

interface SnapshotInfo {
  totalAssets: number;
  totalPrincipal: number;
}

const MAX_RANK = 15;

// ── 날짜 헬퍼 (KST 기준) ──
function getTodayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function getMondayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  kst.setUTCDate(kst.getUTCDate() - diff);
  return kst.toISOString().slice(0, 10);
}

function getFirstOfMonthKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-01`;
}

function getSnapshotDate(period: Period): string {
  switch (period) {
    case "daily":
      return getTodayKST();
    case "weekly":
      return getMondayKST();
    case "monthly":
      return getFirstOfMonthKST();
  }
}

// ── 숫자 포맷 ──
const fmtUsd = (v: number) =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtPct = (v: number) =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ── 탭 옵션 ──
const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: "일간", value: "daily" },
  { label: "주간", value: "weekly" },
  { label: "월간", value: "monthly" },
];

// ── 아바타 ──
function RankAvatar({
  nickname,
  avatarUrl,
}: {
  nickname: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={nickname}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
      {nickname.charAt(0).toUpperCase()}
    </div>
  );
}

// ── 순위 뱃지 ──
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-base leading-none">🥇</span>;
  if (rank === 2) return <span className="text-base leading-none">🥈</span>;
  if (rank === 3) return <span className="text-base leading-none">🥉</span>;
  return (
    <span className="text-xs font-bold text-muted-foreground tabular-nums w-5 text-center">
      {rank}
    </span>
  );
}

// ── 순위 행 배경 ──
function rankRowBg(rank: number): string {
  if (rank === 1) return "bg-amber-500/8";
  if (rank === 2) return "bg-slate-300/5";
  if (rank === 3) return "bg-amber-700/5";
  return "";
}

// ── 기간 선택 탭 (작은 버전) ──
function PeriodTabs({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex gap-1">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-[11px] sm:text-xs px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
            value === opt.value
              ? "bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40"
              : "bg-secondary/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── 기본 스냅샷 (데이터 없을 때) ──
const DEFAULT_ASSETS = 1000000;
const DEFAULT_PRINCIPAL = 1000000;

// ── 스냅샷 데이터 가져오기 (폴백 포함) ──
async function fetchSnapshotMap(
  snapshotDate: string,
  userIds: string[]
): Promise<Map<string, SnapshotInfo>> {
  const snapshotMap = new Map<string, SnapshotInfo>();

  // 해당 날짜 스냅샷
  const { data: snapshotData, error } = await supabase
    .from("portfolio_snapshots")
    .select("user_id, total_assets, total_principal")
    .eq("snapshot_date", snapshotDate);

  if (error) {
    console.error("스냅샷 조회 에러:", error.message);
  }

  if (snapshotData) {
    for (const row of snapshotData) {
      snapshotMap.set(row.user_id as string, {
        totalAssets: Number(row.total_assets) || DEFAULT_ASSETS,
        totalPrincipal: Number(row.total_principal) || DEFAULT_PRINCIPAL,
      });
    }
  }

  // 스냅샷 없는 유저 → 가장 오래된 스냅샷 폴백
  const missingIds = userIds.filter((id) => !snapshotMap.has(id));
  if (missingIds.length > 0) {
    const { data: fallbackData } = await supabase
      .from("portfolio_snapshots")
      .select("user_id, total_assets, total_principal, snapshot_date")
      .in("user_id", missingIds)
      .order("snapshot_date", { ascending: true });

    if (fallbackData) {
      const seen = new Set<string>();
      for (const row of fallbackData) {
        const uid = row.user_id as string;
        if (!seen.has(uid)) {
          seen.add(uid);
          snapshotMap.set(uid, {
            totalAssets: Number(row.total_assets) || DEFAULT_ASSETS,
            totalPrincipal: Number(row.total_principal) || DEFAULT_PRINCIPAL,
          });
        }
      }
    }
  }

  // 여전히 없는 유저 → 기본값
  for (const uid of userIds) {
    if (!snapshotMap.has(uid)) {
      snapshotMap.set(uid, {
        totalAssets: DEFAULT_ASSETS,
        totalPrincipal: DEFAULT_PRINCIPAL,
      });
    }
  }

  return snapshotMap;
}

// ══════════════════════════════════════════════
// ── 수익률 랭킹 테이블 ──
// ══════════════════════════════════════════════
function RoeRankingTable({ users }: { users: PortfolioRow[] }) {
  const [period, setPeriod] = useState<Period>("daily");
  const [rankings, setRankings] = useState<RankedUser[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const compute = useCallback(async () => {
    const isFirst = rankings.length === 0;
    if (isFirst) setInitialLoading(true);
    else setRefreshing(true);

    const date = getSnapshotDate(period);
    const ids = users.map((u) => u.userId);
    const snapMap = await fetchSnapshotMap(date, ids);

    // 순수 수익 계산:
    // 현재 순수 누적 수익 = balance - totalPrincipal
    // 과거 스냅샷 순수 수익 = snap.totalAssets - snap.totalPrincipal
    // 기간별 수익금 = 현재 순수 누적 수익 - 과거 스냅샷 순수 수익
    // 기간별 수익률 = 기간별 수익금 / snap.totalAssets * 100
    const ranked: RankedUser[] = users.map((u) => {
      const snap = snapMap.get(u.userId)!;
      const currentPureProfit = u.balance - u.totalPrincipal;
      const pastPureProfit = snap.totalAssets - snap.totalPrincipal;
      const periodProfit = currentPureProfit - pastPureProfit;
      const periodRoe =
        snap.totalAssets > 0 ? (periodProfit / snap.totalAssets) * 100 : 0;

      return {
        ...u,
        profit: periodProfit,
        roe: periodRoe,
      };
    });

    ranked.sort((a, b) => (b.roe ?? 0) - (a.roe ?? 0));

    setRankings(ranked.slice(0, MAX_RANK));
    setInitialLoading(false);
    setRefreshing(false);
  }, [users, period, rankings.length]);

  useEffect(() => {
    if (users.length > 0) compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, period]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* 테이블 헤더 */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-foreground">수익률 랭킹</h2>
          {refreshing && (
            <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
          )}
        </div>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>

      {/* 리스트 */}
      {initialLoading ? (
        <SkeletonRows count={5} />
      ) : rankings.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className={`divide-y divide-border/30 max-h-[240px] overflow-y-auto transition-opacity duration-200 ${
            refreshing ? "opacity-50 pointer-events-none" : "opacity-100"
          }`}
        >
          {rankings.map((user, idx) => {
            const rank = idx + 1;
            return (
              <RankRow key={user.userId} rank={rank} user={user}>
                <span
                  className={`text-xs sm:text-sm font-semibold tabular-nums ${
                    (user.roe ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {(user.roe ?? 0) >= 0 ? "+" : ""}
                  {fmtPct(user.roe ?? 0)}%
                </span>
              </RankRow>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// ── 수익금 랭킹 테이블 ──
// ══════════════════════════════════════════════
function ProfitRankingTable({ users }: { users: PortfolioRow[] }) {
  const [period, setPeriod] = useState<Period>("daily");
  const [rankings, setRankings] = useState<RankedUser[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const compute = useCallback(async () => {
    const isFirst = rankings.length === 0;
    if (isFirst) setInitialLoading(true);
    else setRefreshing(true);

    const date = getSnapshotDate(period);
    const ids = users.map((u) => u.userId);
    const snapMap = await fetchSnapshotMap(date, ids);

    const ranked: RankedUser[] = users.map((u) => {
      const snap = snapMap.get(u.userId)!;
      const currentPureProfit = u.balance - u.totalPrincipal;
      const pastPureProfit = snap.totalAssets - snap.totalPrincipal;
      const periodProfit = currentPureProfit - pastPureProfit;
      const periodRoe =
        snap.totalAssets > 0 ? (periodProfit / snap.totalAssets) * 100 : 0;

      return {
        ...u,
        profit: periodProfit,
        roe: periodRoe,
      };
    });

    ranked.sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0));

    setRankings(ranked.slice(0, MAX_RANK));
    setInitialLoading(false);
    setRefreshing(false);
  }, [users, period, rankings.length]);

  useEffect(() => {
    if (users.length > 0) compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, period]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-foreground">수익금 랭킹</h2>
          {refreshing && (
            <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
          )}
        </div>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>

      {initialLoading ? (
        <SkeletonRows count={5} />
      ) : rankings.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className={`divide-y divide-border/30 max-h-[240px] overflow-y-auto transition-opacity duration-200 ${
            refreshing ? "opacity-50 pointer-events-none" : "opacity-100"
          }`}
        >
          {rankings.map((user, idx) => {
            const rank = idx + 1;
            return (
              <RankRow key={user.userId} rank={rank} user={user}>
                <span
                  className={`text-xs sm:text-sm font-semibold tabular-nums ${
                    (user.profit ?? 0) >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {(user.profit ?? 0) >= 0 ? "+" : ""}$
                  {fmtUsd(user.profit ?? 0)}
                </span>
              </RankRow>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// ── 총자산 랭킹 테이블 ──
// ══════════════════════════════════════════════
function TotalRankingTable({ users }: { users: PortfolioRow[] }) {
  const rankings = users.slice(0, MAX_RANK);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-foreground">총자산 랭킹</h2>
        </div>
        <span className="text-[10px] sm:text-[11px] text-muted-foreground bg-secondary/60 px-2 py-1 rounded-md">
          현재 기준
        </span>
      </div>

      {rankings.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="divide-y divide-border/30 max-h-[240px] overflow-y-auto">
          {rankings.map((user, idx) => {
            const rank = idx + 1;
            const rankedUser: RankedUser = {
              ...user,
              profit: null,
              roe: null,
            };
            return (
              <RankRow key={user.userId} rank={rank} user={rankedUser}>
                <span className="text-xs sm:text-sm font-semibold tabular-nums text-foreground">
                  ${fmtUsd(user.balance)}
                </span>
              </RankRow>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// ── 공통 컴포넌트들 ──
// ══════════════════════════════════════════════
function RankRow({
  rank,
  user,
  children,
}: {
  rank: number;
  user: RankedUser;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 transition-colors ${rankRowBg(
        rank
      )}`}
    >
      <div className="w-6 flex items-center justify-center shrink-0">
        <RankBadge rank={rank} />
      </div>
      <RankAvatar nickname={user.nickname} avatarUrl={user.avatarUrl} />
      <p className="flex-1 min-w-0 text-xs sm:text-sm font-medium text-foreground truncate">
        {user.nickname}
      </p>
      <div className="text-right shrink-0">{children}</div>
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  const rows = Math.max(count, 5); // 최소 5줄
  return (
    <div className="divide-y divide-border/30 max-h-[240px] overflow-y-auto animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2"
        >
          {/* 순위 */}
          <div className="w-6 flex justify-center shrink-0">
            <div className="w-5 h-4 bg-secondary rounded" />
          </div>
          {/* 아바타 */}
          <div className="w-8 h-8 bg-secondary rounded-full shrink-0" />
          {/* 닉네임 */}
          <div className="flex-1 min-w-0">
            <div
              className="h-3.5 bg-secondary rounded"
              style={{ width: `${50 + ((i * 17) % 30)}%` }}
            />
          </div>
          {/* 수치 */}
          <div className="shrink-0">
            <div className="h-3.5 w-16 sm:w-20 bg-secondary rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
      <Trophy className="h-6 w-6 mb-1.5 opacity-30" />
      <p className="text-xs">데이터가 없습니다</p>
    </div>
  );
}

// ══════════════════════════════════════════════
// ── 메인 페이지 ──
// ══════════════════════════════════════════════
export default function RankingPage() {
  const [users, setUsers] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from("portfolios")
        .select(
          "user_id, balance, total_principal, profiles(nickname, avatar_url)"
        )
        .order("balance", { ascending: false });

      if (error) {
        console.error("포트폴리오 조회 에러:", error.message);
        setLoading(false);
        return;
      }

      const rows: PortfolioRow[] = (data ?? []).map((row) => {
        const profile = row.profiles as unknown as {
          nickname: string;
          avatar_url: string | null;
        } | null;
        return {
          userId: row.user_id as string,
          balance: Number(row.balance) || 0,
          totalPrincipal: Number(row.total_principal) || 0,
          nickname: (profile?.nickname as string) ?? "익명",
          avatarUrl: (profile?.avatar_url as string) ?? null,
        };
      });

      setUsers(rows);
      setLoading(false);
    };

    fetch();
  }, []);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
          <p className="text-xs text-muted-foreground">랭킹을 불러오는 중...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex flex-col gap-4 sm:gap-5">
      {/* ── 헤더 ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
          <Trophy className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">랭킹</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            상위 {MAX_RANK}위까지 표시됩니다
          </p>
        </div>
      </div>

      {/* ── 3개 테이블 ── */}
      <RoeRankingTable users={users} />
      <ProfitRankingTable users={users} />
      <TotalRankingTable users={users} />
    </main>
  );
}
