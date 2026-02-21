import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import TermsPage from "@/components/static/TermsPage";

export const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: TermsPage,
});
