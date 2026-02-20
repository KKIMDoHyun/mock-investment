import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import CommunityPage from "@/components/CommunityPage";

export const communityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/community",
  component: CommunityPage,
});
