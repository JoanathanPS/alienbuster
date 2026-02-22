import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilePlus, Map, Radar, Shield, Sparkles, Download, Layers } from "lucide-react";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { logAction } from "@/lib/actionLog";

type Cmd = {
  id: string;
  title: string;
  subtitle?: string;
  keywords: string;
  icon: any;
  group: "Navigate" | "Actions";
  run: () => void;
};

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const cmds = useMemo<Cmd[]>(
    () => [
      {
        id: "new-report",
        title: "New report",
        subtitle: "Capture photo + submit",
        keywords: "new report submit capture camera",
        icon: FilePlus,
        group: "Actions",
        run: () => navigate("/submit"),
      },
      {
        id: "go-home",
        title: "Dashboard",
        subtitle: "System overview",
        keywords: "home dashboard overview",
        icon: Sparkles,
        group: "Navigate",
        run: () => navigate("/"),
      },
      {
        id: "go-intel",
        title: "Satellite & Correlation",
        subtitle: "Investigate a location",
        keywords: "intel satellite correlation ndvi landcover",
        icon: Radar,
        group: "Navigate",
        run: () => navigate("/satellite"),
      },
      {
        id: "go-expert",
        title: "Expert review",
        subtitle: "Verify / reject / request more info",
        keywords: "expert review verify reject",
        icon: Shield,
        group: "Navigate",
        run: () => navigate("/expert"),
      },
      {
        id: "go-hotspots",
        title: "Hotspots map",
        subtitle: "Crowdsourced reports",
        keywords: "hotspots map reports",
        icon: Map,
        group: "Navigate",
        run: () => navigate("/hotspots"),
      },
      {
        id: "toggle-layers",
        title: "Toggle map layers",
        subtitle: "(coming soon)",
        keywords: "layers toggle",
        icon: Layers,
        group: "Actions",
        run: () => {
          // Placeholder – wired when map layer state is centralized.
          logAction({ title: "Map layers", detail: "Layer toggles coming soon" });
        },
      },
      {
        id: "export-geojson",
        title: "Export verified species (GeoJSON)",
        subtitle: "(coming soon)",
        keywords: "export geojson verified species",
        icon: Download,
        group: "Actions",
        run: () => logAction({ title: "Export", detail: "Verified GeoJSON export coming soon" }),
      },
    ],
    [navigate],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return cmds;
    return cmds.filter((c) => (c.title + " " + c.subtitle + " " + c.keywords).toLowerCase().includes(query));
  }, [cmds, q]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key ? e.key.toLowerCase() : "";
      const isK = key === "k";
      const isCmd = e.metaKey || e.ctrlKey;
      if (isCmd && isK) {
        e.preventDefault();
        onOpenChange(!open);
      }

      if (open && key === "escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl border-white/10 bg-card/55 p-0 backdrop-blur-2xl">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">Search and execute commands</DialogDescription>
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search actions…"
              className="h-12 rounded-2xl border-white/10 bg-card/25"
            />
            <Badge variant="outline">Ctrl K</Badge>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No results.</div>
          ) : (
            <div className="space-y-1">
              {filtered.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      c.run();
                      logAction({ title: c.title, detail: c.subtitle });
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition",
                      "hover:border-white/10 hover:bg-card/25",
                    )}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-card/25">
                      <Icon className="h-4 w-4 text-primary" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{c.title}</span>
                      {c.subtitle ? <span className="block text-xs text-muted-foreground">{c.subtitle}</span> : null}
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      {c.group}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
