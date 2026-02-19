import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { loginRoute } from "./routes/login";

const routeTree = rootRoute.addChildren([indexRoute, loginRoute]);

export const router = createRouter({ routeTree });

// 타입 안전성을 위한 선언 (TanStack Router의 Register 인터페이스)
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
