import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.warn("404 Error: Non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card text-primary ab-glow-leaf mb-6">
        <Compass className="h-8 w-8 animate-pulse" aria-hidden="true" />
      </div>
      <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">404</h1>
      <p className="mt-2 text-lg text-muted-foreground">Uncharted Coordinate</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground/80">
        The ecological sector or URL you requested does not exist in the AlienBuster database.
      </p>
      <Button asChild className="mt-6 gap-2" variant="default">
        <Link to="/">
          <Home className="h-4 w-4" />
          Return to Console
        </Link>
      </Button>
    </div>
  );
};

export default NotFound;
