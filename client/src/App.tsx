import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

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