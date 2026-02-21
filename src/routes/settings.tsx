import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { useAuthStore } from "@/store/authStore";
import NotificationSettingsPage from "@/components/settings/NotificationSettingsPage";

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  beforeLoad: () => {
    const { user, loading } = useAuthStore.getState();
    if (!loading && !user) {
      throw redirect({ to: "/login" });
    }
  },
  component: NotificationSettingsPage,
});
