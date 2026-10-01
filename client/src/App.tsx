import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

// Hash routes can carry options (e.g. #/embed/research?area=references); match on the path only.
function useHashPath(): [string, (to: string, opts?: any) => void] {
  const [loc, nav] = useHashLocation();
  return [loc.split("?")[0], nav];
}
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Session1 from "@/pages/session1";
import Session2 from "@/pages/session2";
import Session3 from "@/pages/session3";
import Session4 from "@/pages/session4";
import Session5 from "@/pages/session5";
import Report from "@/pages/report";
import FreeAssessment from "@/pages/free-assessment";
import FreeResults from "@/pages/free-results";
import Admin from "@/pages/admin";
import ResearchWidget from "@/pages/research-widget";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={FreeAssessment} />
      <Route path="/free-assessment/:id/results" component={FreeResults} />
      <Route path="/admin" component={Admin} />
      <Route path="/embed/research" component={ResearchWidget} />
      <Route path="/coaching" component={Landing} />
      <Route path="/assessment/:id/session/1" component={Session1} />
      <Route path="/assessment/:id/session/2" component={Session2} />
      <Route path="/assessment/:id/session/3" component={Session3} />
      <Route path="/assessment/:id/session/4" component={Session4} />
      <Route path="/assessment/:id/session/5" component={Session5} />
      <Route path="/assessment/:id/report" component={Report} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashPath as any}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
