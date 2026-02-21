import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import RankingPage from "@/components/ranking/RankingPage";

export const rankingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ranking",
  component: RankingPage,
});
