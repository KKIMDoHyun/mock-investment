import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import HomePage from "@/components/HomePage";
import { SYMBOLS, type SymbolId } from "@/store/tradingStore";

const VALID_SYMBOLS = Object.keys(SYMBOLS) as SymbolId[];

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
  validateSearch: (
    search: Record<string, unknown>
  ): { symbol?: SymbolId } => {
    const raw = search.symbol as string | undefined;
    if (raw && VALID_SYMBOLS.includes(raw as SymbolId)) {
      return { symbol: raw as SymbolId };
    }
    return {};
  },
});
