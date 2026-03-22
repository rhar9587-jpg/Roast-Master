import { Switch, Route, Link } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrandLogo } from "@/components/BrandLogo";

import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";
import LeagueHistoryPage from "@/pages/LeagueHistory";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/league-history/dominance" component={LeagueHistoryPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-50 border-b border-border/50 bg-background">
            <div className="mx-auto flex min-h-14 max-w-5xl items-center gap-6 px-4 py-2 md:py-2.5">
              <Link
                href="/"
                className="flex shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                aria-label="Fantasy Roast home"
              >
                <span className="hidden md:block">
                  <BrandLogo variant="horizontal" />
                </span>
                <span className="md:hidden">
                  <BrandLogo variant="icon" />
                </span>
              </Link>
            </div>
          </header>
          <div className="flex-1">
            <Router />
          </div>

          <footer className="py-4 text-center text-xs text-gray-400">
            <a
              href="https://forms.gle/U8cHAgJdSnv2HKk9A"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-600 transition-colors"
              data-testid="link-feedback"
            >
              Feedback / Ideas
            </a>
          </footer>
        </div>

        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;