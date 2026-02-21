import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { useAuthStore } from "@/store/authStore";
import LoginScreen from "@/components/auth/LoginScreen";

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: () => {
    // 이미 로그인된 유저가 /login에 직접 접속하면 홈으로 리다이렉트
    const { user, loading } = useAuthStore.getState();
    if (!loading && user) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginScreen,
});
