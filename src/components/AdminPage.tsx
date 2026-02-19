import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Shield,
  Send,
  RefreshCw,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table";

// ── 타입 ──
interface UserRow {
  id: string;
  email: string;
  role: string;
  balance: number;
}

type SortKey = "email" | "balance";
type SortDir = "asc" | "desc";

// ── 숫자 안전 변환 ──
function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const roleLoaded = useAuthStore((s) => s.roleLoaded);
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [grantInputs, setGrantInputs] = useState<Record<string, string>>({});
  const [granting, setGranting] = useState<Record<string, boolean>>({});

  // ── 검색 ──
  const [searchQuery, setSearchQuery] = useState("");

  // ── 정렬 ──
  const [sortKey, setSortKey] = useState<SortKey>("email");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // ── 권한 체크: role 확인이 완료된 후에만 판단 ──
  useEffect(() => {
    if (roleLoaded && role !== "admin") {
      navigate({ to: "/" });
    }
  }, [role, roleLoaded, navigate]);

  // ── 유저 목록 fetch ──
  const loadUsers = useCallback(async () => {
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("id, email, role")
      .order("email", { ascending: true });

    if (profilesErr) {
      console.error("유저 목록 조회 에러:", profilesErr.message);
      toast.error("유저 목록을 불러오는 데 실패했습니다.");
      return null;
    }

    const { data: portfolios, error: portfoliosErr } = await supabase
      .from("portfolios")
      .select("user_id, balance");

    if (portfoliosErr) {
      console.error("포트폴리오 조회 에러:", portfoliosErr.message);
    }

    const balanceMap = new Map<string, number>();
    for (const p of portfolios ?? []) {
      balanceMap.set(p.user_id as string, toNum(p.balance));
    }

    return (profiles ?? []).map((p) => ({
      id: p.id as string,
      email: (p.email as string) ?? "",
      role: (p.role as string) ?? "user",
      balance: balanceMap.get(p.id as string) ?? 0,
    }));
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const result = await loadUsers();
    if (result) setUsers(result);
    setLoading(false);
  }, [loadUsers]);

  useEffect(() => {
    if (!roleLoaded || role !== "admin") return;

    let cancelled = false;

    loadUsers().then((result) => {
      if (cancelled) return;
      if (result) setUsers(result);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [role, roleLoaded, loadUsers]);

  // ── 정렬 토글 ──
  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  // ── 검색 + 정렬 적용된 유저 목록 ──
  const filteredAndSortedUsers = useMemo(() => {
    // 1) 검색 필터
    const query = searchQuery.trim().toLowerCase();
    let filtered = users;
    if (query) {
      filtered = users.filter((u) => u.email.toLowerCase().includes(query));
    }

    // 2) admin / user 분리 → admin은 맨 위 고정, user만 정렬
    const admins = filtered.filter((u) => u.role === "admin");
    const nonAdmins = filtered.filter((u) => u.role !== "admin");

    const compareFn = (a: UserRow, b: UserRow) => {
      let cmp = 0;
      switch (sortKey) {
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "balance":
          cmp = a.balance - b.balance;
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    };

    admins.sort((a, b) => a.email.localeCompare(b.email)); // admin은 항상 이메일순
    nonAdmins.sort(compareFn);

    return [...admins, ...nonAdmins];
  }, [users, searchQuery, sortKey, sortDir]);

  // ── 자산 지급 ──
  const handleGrant = useCallback(
    async (targetUserId: string) => {
      const amountStr = grantInputs[targetUserId];
      const amount = parseFloat(amountStr);

      if (!amountStr || isNaN(amount) || amount <= 0) {
        toast.error("올바른 금액을 입력해주세요.");
        return;
      }

      setGranting((prev) => ({ ...prev, [targetUserId]: true }));

      const { data: portfolio, error: fetchErr } = await supabase
        .from("portfolios")
        .select("balance")
        .eq("user_id", targetUserId)
        .single();

      if (fetchErr && fetchErr.code === "PGRST116") {
        const { error: insertErr } = await supabase
          .from("portfolios")
          .insert({ user_id: targetUserId, balance: amount });

        if (insertErr) {
          toast.error(`지급 실패: ${insertErr.message}`);
          setGranting((prev) => ({ ...prev, [targetUserId]: false }));
          return;
        }
      } else if (fetchErr) {
        toast.error(`잔고 조회 실패: ${fetchErr.message}`);
        setGranting((prev) => ({ ...prev, [targetUserId]: false }));
        return;
      } else {
        const currentBalance = toNum(portfolio?.balance);
        const newBalance = currentBalance + amount;

        const { error: updateErr } = await supabase
          .from("portfolios")
          .update({ balance: newBalance })
          .eq("user_id", targetUserId);

        if (updateErr) {
          toast.error(`지급 실패: ${updateErr.message}`);
          setGranting((prev) => ({ ...prev, [targetUserId]: false }));
          return;
        }
      }

      toast.success(
        `$${amount.toLocaleString()} USDT를 성공적으로 지급했습니다.`
      );

      setGrantInputs((prev) => ({ ...prev, [targetUserId]: "" }));
      setGranting((prev) => ({ ...prev, [targetUserId]: false }));
      await fetchUsers();
    },
    [grantInputs, fetchUsers]
  );

  // ── 정렬 아이콘 렌더 함수 ──
  const renderSortIcon = (column: SortKey) => {
    if (sortKey !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-indigo-400" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-indigo-400" />
    );
  };

  // role 로딩 중이면 스피너 표시
  if (!roleLoaded) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">권한 확인 중...</p>
        </div>
      </main>
    );
  }

  // admin이 아니면 렌더링 안 함 (useEffect에서 리다이렉트)
  if (role !== "admin") return null;

  return (
    <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
            <Shield className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              관리자 대시보드
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.email} · 관리자
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchUsers}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      {/* ── 통계 요약 ── */}
      {!loading && users.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="총 유저" value={`${users.length}명`} />
          <StatCard
            label="관리자"
            value={`${users.filter((u) => u.role === "admin").length}명`}
          />
          <StatCard
            label="총 자산 합계"
            value={`$${users
              .reduce((sum, u) => sum + u.balance, 0)
              .toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}`}
          />
          <StatCard
            label="평균 자산"
            value={`$${(
              users.reduce((sum, u) => sum + u.balance, 0) / users.length
            ).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}`}
          />
        </div>
      )}

      {/* ── 검색 바 + 건수 ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="이메일로 검색..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchQuery(e.target.value)
            }
            className="pl-9 h-9"
          />
        </div>
        {!loading && users.length > 0 && (
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            {searchQuery
              ? `${filteredAndSortedUsers.length}명 검색됨 / 전체 ${users.length}명`
              : `전체 ${users.length}명`}
          </p>
        )}
      </div>

      {/* ── 유저 테이블 ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[280px]">
                <button
                  type="button"
                  onClick={() => handleSort("email")}
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  이메일
                  {renderSortIcon("email")}
                </button>
              </TableHead>
              <TableHead className="w-[100px]">역할</TableHead>
              <TableHead className="w-[160px]">
                <button
                  type="button"
                  onClick={() => handleSort("balance")}
                  className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                >
                  현재 자산
                  {renderSortIcon("balance")}
                </button>
              </TableHead>
              <TableHead className="w-[280px]">자산 지급</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    불러오는 중...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredAndSortedUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-12 text-muted-foreground"
                >
                  {searchQuery
                    ? `"${searchQuery}" 검색 결과가 없습니다.`
                    : "가입된 유저가 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedUsers.map((u) => (
                <TableRow key={u.id}>
                  {/* 이메일 */}
                  <TableCell className="font-medium">{u.email}</TableCell>

                  {/* 역할 */}
                  <TableCell>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        u.role === "admin"
                          ? "bg-indigo-500/15 text-indigo-400"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {u.role}
                    </span>
                  </TableCell>

                  {/* 현재 자산 */}
                  <TableCell className="text-right tabular-nums font-semibold">
                    $
                    {u.balance.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>

                  {/* 자산 지급 */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder="금액 (USDT)"
                        value={grantInputs[u.id] ?? ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setGrantInputs((prev) => ({
                            ...prev,
                            [u.id]: e.target.value.replace(/[^0-9.]/g, ""),
                          }))
                        }
                        className="h-8 w-32 text-sm tabular-nums"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGrant(u.id)}
                        disabled={granting[u.id]}
                        className="h-8 gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                      >
                        <Send className="h-3.5 w-3.5" />
                        지급
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}
