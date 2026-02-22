import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchSystemStatus } from "@/lib/systemStatus";

export function BackendOfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const s = await fetchSystemStatus();
      setOffline(!s.backend_ok);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    check();
    const t = window.setInterval(check, 10_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!offline) return null;

  return (
    <div className="sticky top-0 z-50 w-full border-b border-white/10 bg-destructive/10 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2 md:px-6">
        <div className="flex items-center gap-2 text-sm">
          <CloudOff className="h-4 w-4 text-destructive" />
          <span className="font-medium text-destructive">Backend offline</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Start FastAPI on 127.0.0.1:8000 to enable detection, satellite, fusion, and alerts.
          </span>
        </div>
        <Button variant="outline" size="sm" className="h-9" onClick={check} disabled={checking}>
          <RefreshCw className={checking ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
          Retry
        </Button>
      </div>
    </div>
  );
}
