import { create } from "zustand";
import { supabase } from "@/lib/supabase";

// ── 타입 정의 ──

export type SortBy = "latest" | "popular";

export interface Post {
  id: string;
  user_id: string;
  title: string;
  content: string;
  images: string[];
  view_count: number;
  comment_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  // join된 프로필 정보
  nickname: string;
  avatar_url: string | null;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  // join된 프로필 정보
  nickname: string;
  avatar_url: string | null;
}

const PAGE_SIZE = 10;

// ── PnL 계산 (tradingStore와 동일 로직, 순환 의존 방지를 위해 인라인) ──
function calcUnrealizedPnl(
  positionType: "LONG" | "SHORT",
  entryPrice: number,
  leverage: number,
  margin: number,
  currentPrice: number,
): number {
  if (entryPrice <= 0 || currentPrice <= 0 || leverage <= 0 || margin <= 0) return 0;
  const pnl =
    positionType === "LONG"
      ? ((currentPrice - entryPrice) / entryPrice) * leverage * margin
      : ((entryPrice - currentPrice) / entryPrice) * leverage * margin;
  return Number.isFinite(pnl) ? pnl : 0;
}

interface CommunityState {
  // 게시글 목록 (무한스크롤)
  posts: Post[];
  totalCount: number;
  page: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;

  // 게시글 상세
  selectedPost: Post | null;
  postLoading: boolean;

  // 댓글
  comments: Comment[];
  commentsLoading: boolean;

  // 유저 랭킹 (userId → rank)
  userRanks: Record<string, number>;

  // 좋아요
  likedPostIds: Set<string>;
  sortBy: SortBy;

  // 액션
  _fetchPage: (page: number) => Promise<Post[]>;
  fetchPosts: () => Promise<void>;
  fetchNextPage: () => Promise<void>;
  resetPosts: () => Promise<void>;
  fetchPostById: (postId: string) => Promise<void>;
  fetchUserRanks: () => Promise<void>;
  createPost: (params: {
    userId: string;
    title: string;
    content: string;
    images: string[];
  }) => Promise<{ success: boolean; message: string; postId?: string }>;
  deletePost: (postId: string) => Promise<{ success: boolean; message: string }>;
  incrementViewCount: (postId: string) => Promise<void>;
  fetchComments: (postId: string) => Promise<void>;
  createComment: (params: {
    postId: string;
    userId: string;
    content: string;
    parentId?: string | null;
  }) => Promise<{ success: boolean; message: string }>;
  deleteComment: (commentId: string) => Promise<{ success: boolean; message: string }>;
  setSortBy: (sortBy: SortBy) => Promise<void>;
  fetchLikedPostIds: (userId: string) => Promise<void>;
  toggleLike: (postId: string, userId: string) => Promise<void>;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  posts: [],
  totalCount: 0,
  page: 0,
  loading: false,
  loadingMore: false,
  hasMore: true,

  selectedPost: null,
  postLoading: false,

  comments: [],
  commentsLoading: false,

  userRanks: {},
  likedPostIds: new Set<string>(),
  sortBy: "latest",

  // ── 유저 총자산 랭킹 조회 ──
  fetchUserRanks: async () => {
    // 1) 포트폴리오 조회
    const { data: portfolioData } = await supabase
      .from("portfolios")
      .select("user_id, balance");

    if (!portfolioData) return;

    // 2) 모든 OPEN 포지션 조회
    const { data: tradesData } = await supabase
      .from("trades")
      .select("user_id, symbol, position_type, entry_price, leverage, margin")
      .eq("status", "OPEN");

    // 3) 현재 시세 조회
    const priceMap: Record<string, number> = {};
    try {
      const res = await fetch("https://fapi.binance.com/fapi/v1/ticker/price");
      const json = (await res.json()) as { symbol: string; price: string }[];
      for (const item of json) {
        priceMap[item.symbol] = parseFloat(item.price) || 0;
      }
    } catch {
      // 시세 조회 실패 시 무시
    }

    // 4) 유저별 포지션 가치 합산
    const positionValueMap = new Map<string, number>();
    for (const t of tradesData ?? []) {
      const uid = t.user_id as string;
      const sym = (t.symbol as string) || "BTCUSDT";
      const symPrice = priceMap[sym] || 0;
      const margin = Number(t.margin) || 0;
      const pnl = calcUnrealizedPnl(
        t.position_type as "LONG" | "SHORT",
        Number(t.entry_price) || 0,
        Number(t.leverage) || 0,
        margin,
        symPrice,
      );
      positionValueMap.set(uid, (positionValueMap.get(uid) ?? 0) + margin + pnl);
    }

    // 5) equity 계산 후 정렬
    const rows = portfolioData.map((row) => ({
      userId: row.user_id as string,
      equity: (Number(row.balance) || 0) + (positionValueMap.get(row.user_id as string) ?? 0),
    }));
    rows.sort((a, b) => b.equity - a.equity);

    // 6) 랭킹 맵 생성
    const ranks: Record<string, number> = {};
    rows.forEach((r, idx) => {
      ranks[r.userId] = idx + 1;
    });

    set({ userRanks: ranks });
  },

  // ── 게시글 페이지 로드 (내부 공용) ──
  _fetchPage: async (page: number): Promise<Post[]> => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { sortBy } = get();

    let query = supabase
      .from("posts")
      .select("id, user_id, title, content, images, view_count, like_count, created_at, updated_at")
      .range(from, to);

    if (sortBy === "popular") {
      query = query
        .order("like_count", { ascending: false })
        .order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error("게시글 목록 로드 에러:", error.message);
      return [];
    }

    const rows = data ?? [];
    if (rows.length === 0) return [];

    // 프로필 정보 일괄 조회
    const userIds = [...new Set(rows.map((r) => r.user_id as string))];
    const profileMap = new Map<string, { nickname: string; avatar_url: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", userIds);

      for (const p of profiles ?? []) {
        profileMap.set(p.id as string, {
          nickname: (p.nickname as string) ?? "익명",
          avatar_url: (p.avatar_url as string) ?? null,
        });
      }
    }

    // 댓글 수 일괄 조회
    const postIds = rows.map((r) => r.id as string);
    const commentCountMap = new Map<string, number>();

    if (postIds.length > 0) {
      const { data: commentCounts } = await supabase
        .from("comments")
        .select("post_id")
        .in("post_id", postIds);

      for (const c of commentCounts ?? []) {
        const pid = c.post_id as string;
        commentCountMap.set(pid, (commentCountMap.get(pid) ?? 0) + 1);
      }
    }

    return rows.map((r) => {
      const profile = profileMap.get(r.user_id as string);
      return {
        id: r.id as string,
        user_id: r.user_id as string,
        title: r.title as string,
        content: r.content as string,
        images: (r.images as string[]) ?? [],
        view_count: Number(r.view_count) || 0,
        like_count: Number(r.like_count) || 0,
        comment_count: commentCountMap.get(r.id as string) ?? 0,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
        nickname: profile?.nickname ?? "익명",
        avatar_url: profile?.avatar_url ?? null,
      };
    });
  },

  // ── 첫 페이지 로드 (초기 로딩) ──
  fetchPosts: async () => {
    set({ loading: true, posts: [], page: 0, hasMore: true });

    const { count } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true });

    const totalCount = count ?? 0;
    const posts = await get()._fetchPage(0);

    set({
      posts,
      totalCount,
      page: 0,
      hasMore: posts.length >= PAGE_SIZE,
      loading: false,
    });
  },

  // ── 다음 페이지 로드 (무한스크롤) ──
  fetchNextPage: async () => {
    const { hasMore, loadingMore, loading } = get();
    if (!hasMore || loadingMore || loading) return;

    const nextPage = get().page + 1;
    set({ loadingMore: true });

    const newPosts = await get()._fetchPage(nextPage);

    set((state) => ({
      posts: [...state.posts, ...newPosts],
      page: nextPage,
      hasMore: newPosts.length >= PAGE_SIZE,
      loadingMore: false,
    }));
  },

  // ── 새로고침 (리스트 초기화 후 첫 페이지 다시 로드) ──
  resetPosts: async () => {
    await get().fetchPosts();
  },

  // ── 게시글 상세 ──
  fetchPostById: async (postId) => {
    set({ postLoading: true, selectedPost: null });

    const { data, error } = await supabase
      .from("posts")
      .select("id, user_id, title, content, images, view_count, like_count, created_at, updated_at")
      .eq("id", postId)
      .single();

    if (error || !data) {
      console.error("게시글 로드 에러:", error?.message);
      set({ postLoading: false });
      return;
    }

    // 프로필 조회
    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname, avatar_url")
      .eq("id", data.user_id as string)
      .single();

    // 댓글 수 조회
    const { count: commentCount } = await supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);

    const post: Post = {
      id: data.id as string,
      user_id: data.user_id as string,
      title: data.title as string,
      content: data.content as string,
      images: (data.images as string[]) ?? [],
      view_count: Number(data.view_count) || 0,
      like_count: Number(data.like_count) || 0,
      comment_count: commentCount ?? 0,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
      nickname: (profile?.nickname as string) ?? "익명",
      avatar_url: (profile?.avatar_url as string) ?? null,
    };

    set({ selectedPost: post, postLoading: false });
  },

  // ── 게시글 생성 ──
  createPost: async ({ userId, title, content, images }) => {
    const { data, error } = await supabase
      .from("posts")
      .insert({ user_id: userId, title, content, images })
      .select("id")
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    // 목록 새로고침
    await get().resetPosts();
    return { success: true, message: "게시글이 작성되었습니다.", postId: data?.id as string };
  },

  // ── 게시글 삭제 ──
  deletePost: async (postId) => {
    const { error } = await supabase.from("posts").delete().eq("id", postId);

    if (error) {
      return { success: false, message: error.message };
    }

    await get().resetPosts();
    return { success: true, message: "게시글이 삭제되었습니다." };
  },

  // ── 조회수 증가 ──
  incrementViewCount: async (postId) => {
    // view_count를 1 증가 (RPC 사용 또는 직접 업데이트)
    const { data } = await supabase
      .from("posts")
      .select("view_count")
      .eq("id", postId)
      .single();

    if (data) {
      await supabase
        .from("posts")
        .update({ view_count: (Number(data.view_count) || 0) + 1 })
        .eq("id", postId);
    }
  },

  // ── 댓글 목록 ──
  fetchComments: async (postId) => {
    set({ commentsLoading: true });

    const { data, error } = await supabase
      .from("comments")
      .select("id, post_id, user_id, parent_id, content, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("댓글 로드 에러:", error.message);
      set({ commentsLoading: false });
      return;
    }

    const rows = data ?? [];

    // 프로필 일괄 조회
    const userIds = [...new Set(rows.map((r) => r.user_id as string))];
    const profileMap = new Map<string, { nickname: string; avatar_url: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", userIds);

      for (const p of profiles ?? []) {
        profileMap.set(p.id as string, {
          nickname: (p.nickname as string) ?? "익명",
          avatar_url: (p.avatar_url as string) ?? null,
        });
      }
    }

    const comments: Comment[] = rows.map((r) => {
      const profile = profileMap.get(r.user_id as string);
      return {
        id: r.id as string,
        post_id: r.post_id as string,
        user_id: r.user_id as string,
        parent_id: (r.parent_id as string) ?? null,
        content: r.content as string,
        created_at: r.created_at as string,
        nickname: profile?.nickname ?? "익명",
        avatar_url: profile?.avatar_url ?? null,
      };
    });

    set({ comments, commentsLoading: false });
  },

  // ── 댓글 생성 ──
  createComment: async ({ postId, userId, content, parentId }) => {
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: userId,
      content,
      parent_id: parentId ?? null,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    await get().fetchComments(postId);
    return { success: true, message: "댓글이 작성되었습니다." };
  },

  // ── 댓글 삭제 ──
  deleteComment: async (commentId) => {
    const { data: comment } = await supabase
      .from("comments")
      .select("post_id")
      .eq("id", commentId)
      .single();

    const { error } = await supabase.from("comments").delete().eq("id", commentId);

    if (error) {
      return { success: false, message: error.message };
    }

    if (comment?.post_id) {
      await get().fetchComments(comment.post_id as string);
    }

    return { success: true, message: "댓글이 삭제되었습니다." };
  },

  // ── 정렬 변경 ──
  setSortBy: async (sortBy) => {
    set({ sortBy });
    await get().fetchPosts();
  },

  // ── 현재 유저의 좋아요 목록 조회 ──
  fetchLikedPostIds: async (userId) => {
    const { data } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", userId);

    set({
      likedPostIds: new Set((data ?? []).map((r) => r.post_id as string)),
    });
  },

  // ── 좋아요 토글 (낙관적 업데이트) ──
  toggleLike: async (postId, userId) => {
    const { likedPostIds, posts, selectedPost } = get();
    const isLiked = likedPostIds.has(postId);
    const delta = isLiked ? -1 : 1;

    // 낙관적 업데이트
    const newLikedPostIds = new Set(likedPostIds);
    if (isLiked) {
      newLikedPostIds.delete(postId);
    } else {
      newLikedPostIds.add(postId);
    }

    set({
      likedPostIds: newLikedPostIds,
      posts: posts.map((p) =>
        p.id === postId
          ? { ...p, like_count: Math.max(0, p.like_count + delta) }
          : p,
      ),
      selectedPost:
        selectedPost?.id === postId
          ? { ...selectedPost, like_count: Math.max(0, selectedPost.like_count + delta) }
          : selectedPost,
    });

    // DB 반영
    let error;
    if (isLiked) {
      ({ error } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId));
    } else {
      ({ error } = await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: userId }));
    }

    if (error) {
      // 실패 시 롤백
      set({ likedPostIds, posts, selectedPost });
      return;
    }

    // like_count DB 동기화 (정확한 카운트)
    const { count } = await supabase
      .from("post_likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);

    const syncedCount = count ?? 0;
    await supabase
      .from("posts")
      .update({ like_count: syncedCount })
      .eq("id", postId);

    // 스토어 최종 동기화
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === postId ? { ...p, like_count: syncedCount } : p,
      ),
      selectedPost:
        state.selectedPost?.id === postId
          ? { ...state.selectedPost, like_count: syncedCount }
          : state.selectedPost,
    }));
  },
}));
