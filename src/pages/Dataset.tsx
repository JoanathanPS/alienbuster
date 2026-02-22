import { useState, useRef } from "react";
import { Download, Loader2, Database, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

type IngestStage = "start" | "resolving_taxon" | "resolving_place" | "fetching" | "inserted" | "recompute_outbreaks" | "done" | "error";

interface IngestState {
  stage: IngestStage;
  message: string;
  page?: number;
  inserted_total?: number;
  skipped_total?: number;
  outbreaks?: number;
  inserted?: number;
  skipped?: number;
  tasks_created?: number;
}

export default function DatasetPage() {
  const [species, setSpecies] = useState("Lantana camara");
  const [place, setPlace] = useState("India");
  const [pages, setPages] = useState(5);
  const [researchOnly, setResearchOnly] = useState(true);
  
  const [ingesting, setIngesting] = useState(false);
  const [progress, setProgress] = useState<IngestState | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleIngest = () => {
    if (ingesting) return;
    
    setIngesting(true);
    setProgress({ stage: "start", message: "Initializing..." });
    
    // Build URL
    const baseUrl = "http://127.0.0.1:8000"; // Hardcoded as per constraints, or use env
    const url = new URL(`${baseUrl}/inat/ingest/stream`);
    url.searchParams.set("species_query", species);
    url.searchParams.set("place_query", place);
    url.searchParams.set("pages", String(pages));
    url.searchParams.set("per_page", "200");
    url.searchParams.set("research_only", String(researchOnly));

    const es = new EventSource(url.toString());
    eventSourceRef.current = es;

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as IngestState;
        setProgress(prev => ({ ...prev, ...data }));
        
        if (data.stage === "done") {
          es.close();
          setIngesting(false);
          toast.success("Ingestion complete!");
        } else if (data.stage === "error") {
          es.close();
          setIngesting(false);
          toast.error(data.message);
        }
      } catch (e) {
        console.error("Error parsing SSE", e);
      }
    };

    es.onerror = (e) => {
      console.error("SSE Error", e);
      es.close();
      setIngesting(false);
      if (progress?.stage !== "done") {
        toast.error("Connection lost or backend error.");
      }
    };
  };

  const handleCancel = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIngesting(false);
    toast.info("Ingestion cancelled.");
  };

  const calculateProgress = () => {
    if (!progress) return 0;
    if (progress.stage === "done") return 100;
    if (progress.stage === "start") return 5;
    if (progress.stage === "resolving_taxon") return 10;
    if (progress.stage === "resolving_place") return 15;
    
    if (progress.stage === "fetching" || progress.stage === "inserted") {
      const base = 20;
      const perPage = 70 / pages;
      const current = progress.page || 0;
      return Math.min(90, base + (current * perPage));
    }
    
    if (progress.stage === "recompute_outbreaks") return 95;
    return 0;
  };

  return (
    <div className="container mx-auto p-4 space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dataset Ingestion</h1>
        <p className="text-muted-foreground">
          Populate the database with real-world observations from iNaturalist.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Import Parameters
            </CardTitle>
            <CardDescription>
              Configure the search query for iNaturalist API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Target Species</Label>
              <Input 
                value={species} 
                onChange={(e) => setSpecies(e.target.value)} 
                placeholder="e.g. Lantana camara" 
                disabled={ingesting}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Target Region (Place)</Label>
              <Input 
                value={place} 
                onChange={(e) => setPlace(e.target.value)} 
                placeholder="e.g. India, Tamil Nadu" 
                disabled={ingesting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pages (200/page)</Label>
                <Input 
                  type="number" 
                  min={1} 
                  max={20} 
                  value={pages} 
                  onChange={(e) => setPages(parseInt(e.target.value))} 
                  disabled={ingesting}
                />
              </div>
              <div className="flex flex-col justify-end pb-2">
                <div className="flex items-center justify-between space-x-2 border p-2.5 rounded-lg">
                  <Label htmlFor="research-mode" className="text-sm cursor-pointer">Research Grade</Label>
                  <Switch 
                    id="research-mode" 
                    checked={researchOnly} 
                    onCheckedChange={setResearchOnly} 
                    disabled={ingesting}
                  />
                </div>
              </div>
            </div>

            {ingesting ? (
              <Button 
                variant="destructive" 
                className="w-full" 
                onClick={handleCancel}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Ingestion
              </Button>
            ) : (
              <Button 
                className="w-full" 
                onClick={handleIngest} 
                disabled={!species || !place}
              >
                <Database className="mr-2 h-4 w-4" />
                Start Ingestion
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Ingestion Status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {!progress && !ingesting && (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[200px] text-muted-foreground text-sm border-2 border-dashed rounded-lg bg-secondary/20">
                <Database className="h-8 w-8 mb-2 opacity-50" />
                Ready to import data.
              </div>
            )}

            {ingesting && progress && progress.stage !== "done" && (
              <div className="space-y-6 flex-1 flex flex-col justify-center">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      {progress.message}
                    </span>
                    <span className="text-muted-foreground">{Math.round(calculateProgress())}%</span>
                  </div>
                  <Progress value={calculateProgress()} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                   <div className="p-3 bg-secondary/50 rounded-lg border border-border">
                    <span className="block text-muted-foreground text-xs uppercase mb-1">Inserted</span>
                    <span className="text-2xl font-bold">{progress.inserted_total || 0}</span>
                  </div>
                  <div className="p-3 bg-secondary/50 rounded-lg border border-border">
                    <span className="block text-muted-foreground text-xs uppercase mb-1">Skipped</span>
                    <span className="text-2xl font-bold text-muted-foreground">{progress.skipped_total || 0}</span>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground p-3 bg-secondary/30 rounded border font-mono">
                   Stage: {progress.stage}
                </div>
              </div>
            )}

            {progress && progress.stage === "done" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 flex-1">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-green-600">Import Successful</h4>
                    <p className="text-sm text-green-600/80">
                      Dataset ingestion and fusion pipeline completed.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-secondary rounded-lg border border-border">
                    <span className="block text-muted-foreground text-xs uppercase mb-1">Total Inserted</span>
                    <span className="text-2xl font-bold text-primary">{progress.inserted}</span>
                  </div>
                  <div className="p-3 bg-secondary rounded-lg border border-border">
                    <span className="block text-muted-foreground text-xs uppercase mb-1">Outbreaks</span>
                    <span className="text-2xl font-bold">{progress.outbreaks}</span>
                  </div>
                  <div className="p-3 bg-secondary rounded-lg border border-border col-span-2">
                    <span className="block text-muted-foreground text-xs uppercase mb-1">Tasks Created</span>
                    <span className="text-2xl font-bold">{progress.tasks_created || 0}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-auto pt-4">
                  <Button asChild variant="default" className="w-full">
                    <Link to="/response">View Outbreaks</Link>
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                     <Button asChild variant="outline" className="w-full">
                        <Link to="/hotspots">Map View</Link>
                      </Button>
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/expert">Expert Review</Link>
                      </Button>
                  </div>
                </div>
              </div>
            )}
            
            {progress && progress.stage === "error" && (
               <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-600">Import Failed</h4>
                    <p className="text-sm text-red-600/80">
                      {progress.message}
                    </p>
                  </div>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
