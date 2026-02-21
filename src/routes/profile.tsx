import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { useAuthStore } from "@/store/authStore";
import ProfilePage from "@/components/profile/ProfilePage";

export const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  beforeLoad: () => {
    const { user, loading } = useAuthStore.getState();
    if (!loading && !user) {
      throw redirect({ to: "/login" });
    }
  },
  component: ProfilePage,
});
