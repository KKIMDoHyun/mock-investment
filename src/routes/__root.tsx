import { createRootRoute } from "@tanstack/react-router";
import RootLayout from "@/components/RootLayout";
import NotFoundPage from "@/components/NotFoundPage";

export const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});
