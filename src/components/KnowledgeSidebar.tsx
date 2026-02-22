import { useState, useEffect } from "react";
import { BookOpen, Activity, AlertTriangle, CheckCircle, Clock, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AuthDebug } from "@/components/AuthDebug";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

type ActionLog = {
  action: string;
  timestamp: string;
};

export function KnowledgeSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [actions, setActions] = useState<ActionLog[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [eeStatus, setEeStatus] = useState<string>("checking...");
  const [verifiedSpecies, setVerifiedSpecies] = useState<any[]>([]);

  useEffect(() => {
    // Load actions from localStorage
    const stored = localStorage.getItem("alienbuster_actions");
    if (stored) {
      setActions(JSON.parse(stored).slice(0, 10));
    }

    // Poll health
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        const data = await res.json();
        setHealth(data);
      } catch (e) {
        setHealth({ status: "offline" });
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);

    // Check EE Status (dummy call)
    const checkEE = async () => {
      try {
        const res = await fetch(`${API_BASE}/satellite_change?lat=0&lon=0&radius_m=100`);
        const data = await res.json();
        if (data.status && data.status.includes("unavailable")) {
          setEeStatus("Offline (Auth Required)");
        } else {
          setEeStatus("Online");
        }
      } catch (e) {
        setEeStatus("Error");
      }
    };
    checkEE();
    
    // Fetch Verified Species (mock logic for now or real endpoint)
    const fetchVerified = async () => {
       // Using the endpoint we created
       try {
         const res = await fetch(`${API_BASE}/exports/verified_species.geojson`);
         const data = await res.json();
         if (data.features) {
            setVerifiedSpecies(data.features.slice(0, 5));
         }
       } catch (e) {
         // ignore
       }
    };
    fetchVerified();

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={cn(
        "fixed right-0 top-20 z-40 flex transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-[320px]"
      )}
    >
      {/* Floating Handle */}
      <Button
        variant="secondary"
        size="icon"
        className="h-12 w-8 rounded-l-xl rounded-r-none border-l border-y shadow-md"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      {/* Sidebar Content */}
      <div className="w-80 h-[calc(100vh-6rem)] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-l shadow-xl flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Knowledge Base
          </h2>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            
            {/* System Status */}
            <section className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Activity className="h-4 w-4" /> System Status
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-muted rounded border flex flex-col gap-1">
                  <span className="text-muted-foreground">Backend</span>
                  <Badge variant={health?.status === "ok" ? "default" : "destructive"} className="w-fit">
                    {health?.status === "ok" ? "Online" : "Offline"}
                  </Badge>
                </div>
                <div className="p-2 bg-muted rounded border flex flex-col gap-1">
                  <span className="text-muted-foreground">ML Model</span>
                  <Badge variant={health?.model?.loaded ? "default" : "secondary"} className="w-fit">
                    {health?.model?.loaded ? "Ready" : "Warming"}
                  </Badge>
                </div>
                <div className="col-span-2 p-2 bg-muted rounded border flex flex-col gap-1">
                  <span className="text-muted-foreground">Satellite Engine</span>
                  <div className="flex items-center gap-2">
                     <div className={cn("h-2 w-2 rounded-full", eeStatus === "Online" ? "bg-green-500" : "bg-red-500")} />
                     <span>{eeStatus}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Auth Debug (Dev only) */}
            <AuthDebug />

            {/* Recent Actions */}
            <section className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" /> Recent Actions
              </h3>
              {actions.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No actions recorded yet.</div>
              ) : (
                <div className="space-y-2">
                  {actions.map((log, i) => (
                    <div key={i} className="text-xs flex justify-between border-b pb-1 last:border-0">
                      <span className="truncate max-w-[180px]">{log.action}</span>
                      <span className="text-muted-foreground opacity-70">
                        {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* FAQ / Verified */}
            <Tabs defaultValue="verified">
              <TabsList className="w-full">
                <TabsTrigger value="verified" className="flex-1">Verified</TabsTrigger>
                <TabsTrigger value="faq" className="flex-1">FAQ</TabsTrigger>
              </TabsList>
              <TabsContent value="verified" className="space-y-2 pt-2">
                {verifiedSpecies.length === 0 ? (
                   <div className="text-xs text-muted-foreground">No verified reports nearby.</div>
                ) : (
                   verifiedSpecies.map((f: any) => (
                     <div key={f.properties.id} className="text-xs p-2 border rounded flex justify-between items-center">
                        <span className="font-medium">{f.properties.species}</span>
                        <Badge variant="outline" className="text-[10px]">
                           Risk: {f.properties.risk?.toFixed(2) ?? "?"}
                        </Badge>
                     </div>
                   ))
                )}
              </TabsContent>
              <TabsContent value="faq" className="text-xs space-y-2 pt-2 text-muted-foreground">
                <details>
                  <summary className="cursor-pointer font-medium text-foreground">What is Fused Risk?</summary>
                  <p className="mt-1 pl-2">Combination of ML confidence, satellite anomalies, and report density.</p>
                </details>
                <details>
                  <summary className="cursor-pointer font-medium text-foreground">How does satellite works?</summary>
                  <p className="mt-1 pl-2">We analyze Sentinel-2 imagery for vegetation changes (NDVI) compared to 1 year ago.</p>
                </details>
              </TabsContent>
            </Tabs>

          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
