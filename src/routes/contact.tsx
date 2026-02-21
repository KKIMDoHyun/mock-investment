import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import ContactPage from "@/components/static/ContactPage";

export const contactRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/contact",
  component: ContactPage,
});
