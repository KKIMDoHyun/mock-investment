import { useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import {
  LogOut,
  User,
  ChevronDown,
  Shield,
  UserCog,
  Trophy,
  Volume2,
  VolumeOff,
  MessageSquare,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useOnlineCount } from "@/hooks/useOnlineCount";
import { getSoundEnabled, setSoundEnabled } from "@/lib/sound";
import { Button } from "@/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const nickname = useAuthStore((s) => s.nickname);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const signOut = useAuthStore((s) => s.signOut);
  const onlineCount = useOnlineCount();

  const [soundOn, setSoundOn] = useState(getSoundEnabled);
  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      setSoundEnabled(next);
      return next;
    });
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12 sm:h-14">
          {/* Logo + Online count */}
          <div className="flex items-center gap-3 sm:gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 sm:gap-2.5 no-underline"
          >
            <img
              src="/logo.png"
              alt="모두모투"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-contain"
            />
            <span className="text-base sm:text-lg font-semibold text-foreground">
              모두모투
            </span>
          </Link>

          {/* Online count */}
          {onlineCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="tabular-nums">
                <span className="hidden sm:inline">접속 </span>{onlineCount}<span className="hidden sm:inline">명</span>
              </span>
            </div>
          )}

          {/* 랭킹 / 커뮤니티 바로가기 */}
          <nav className="flex items-center gap-0.5">
            <Link
              to="/ranking"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors no-underline"
            >
              <Trophy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">랭킹</span>
            </Link>
            <Link
              to="/community"
              onClick={() => {
                sessionStorage.removeItem("community_restore");
                sessionStorage.removeItem("community_scrollY");
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors no-underline"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">커뮤니티</span>
            </Link>
          </nav>
          </div>

          {/* Auth area */}
          <div className="flex items-center gap-1 sm:gap-1.5">
          {/* 사운드 토글 */}
          <button
            onClick={toggleSound}
            className="p-1.5 sm:p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            title={soundOn ? "사운드 끄기" : "사운드 켜기"}
          >
            {soundOn ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeOff className="h-4 w-4" />
            )}
          </button>

          {user ? (
            /* 로그인 상태: 유저 드롭다운 */
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-1.5 sm:gap-2 px-2 sm:px-3"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={nickname ?? ""}
                      className="w-7 h-7 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-xs font-medium text-white">
                      {(nickname ?? user.email)?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:inline text-sm text-muted-foreground max-w-[160px] truncate">
                    {nickname ?? user.email}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex items-center gap-2.5">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={nickname ?? ""}
                        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-sm font-medium text-white flex-shrink-0">
                        {(nickname ?? user.email)?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col space-y-1 min-w-0">
                      <p className="text-sm font-medium leading-none truncate">
                        {nickname ?? "닉네임 없음"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <UserCog className="mr-2 h-4 w-4" />
                    <span>내 정보</span>
                  </Link>
                </DropdownMenuItem>
                {role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>관리자 대시보드</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            /* 비로그인 상태: 로그인 드롭다운 */
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 sm:gap-2"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden xs:inline">로그인</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={signInWithGoogle}>
                  <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Google로 로그인</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          </div>
        </div>
      </div>
    </header>
  );
}
