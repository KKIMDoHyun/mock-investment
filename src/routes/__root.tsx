import { createRootRoute } from "@tanstack/react-router";
import RootLayout from "@/components/common/RootLayout";
import NotFoundPage from "@/components/static/NotFoundPage";

export const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});
