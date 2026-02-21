import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import PrivacyPage from "@/components/static/PrivacyPage";

export const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: PrivacyPage,
});
