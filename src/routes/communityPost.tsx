import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import CommunityPostPage from "@/components/community/CommunityPostPage";

export const communityPostRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/community/$postId",
  component: CommunityPostPage,
});
