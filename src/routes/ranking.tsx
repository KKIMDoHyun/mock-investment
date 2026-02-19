import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import RankingPage from "@/components/RankingPage";

export const rankingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ranking",
  component: RankingPage,
});
