import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import TermsPage from "@/components/TermsPage";

export const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: TermsPage,
});
