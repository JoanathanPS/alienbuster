import { useEffect, useState, useMemo } from "react";
import { Bell, ClipboardList, Siren, CheckCircle, Clock, AlertTriangle, PlusCircle, BarChart3 } from "lucide-react";
import { Page } from "@/components/Page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetchJson } from "@/lib/apiFetch";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

type Task = {
  id: number;
  outbreak_id?: number;
  assigned_to: string;
  agency: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  notes?: string;
};

type Outbreak = {
  outbreak_id: number;
  species: string;
  report_count: number;
  risk_level: number;
  status: string;
};

const COLORS = ["#10b981", "#eab308", "#ef4444", "#3b82f6"];

export default function ResponseCenter() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [outbreaks, setOutbreaks] = useState<Outbreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskDialog, setShowTaskDialog] = useState(false);

  // New Task Form
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState("");
  const [newTaskAgency, setNewTaskAgency] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [newTaskNotes, setNewTaskNotes] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tasksRes, outbreaksRes, overviewRes, topSpeciesRes, statusDistRes] = await Promise.all([
        apiFetchJson<Task[]>("/tasks"),
        apiFetchJson<Outbreak[]>("/outbreaks"),
        apiFetchJson<any>("/stats/overview"),
        apiFetchJson<any[]>("/stats/top_species"),
        apiFetchJson<any[]>("/stats/task_status_distribution")
      ]);
      
      setTasks(tasksRes);
      setOutbreaks(outbreaksRes);
      // We can use overviewRes for tiles if we want exact sync, 
      // but computing from tasks/outbreaks arrays is also fine for now.
      // Ideally we should use the stats endpoints for the charts.
      
      // Store these in state if we want to use them directly
      // For now, let's keep using client-side computation for the charts 
      // as it matches the existing code structure, 
      // OR we can refactor to use the server-side stats.
      // Let's refactor to use server-side stats for charts to be consistent with requirements.
      
      setOverview(overviewRes);
      setTopSpecies(topSpeciesRes);
      setTaskDist(statusDistRes);

    } catch (e) {
      toast.error("Failed to load response center data");
    } finally {
      setLoading(false);
    }
  };

  const [overview, setOverview] = useState<any>(null);
  const [topSpecies, setTopSpecies] = useState<any[]>([]);
  const [taskDist, setTaskDist] = useState<any[]>([]);

  // ... (keep useEffect)

  // Use server data for charts
  const speciesData = useMemo(() => {
    return topSpecies.map((s: any) => ({
      name: s.species,
      value: s.count
    }));
  }, [topSpecies]);

  const taskStatusData = useMemo(() => {
    return taskDist.map((t: any) => ({
      name: t.status.replace("_", " ").toUpperCase(),
      value: t.count
    }));
  }, [taskDist]);

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTask = async () => {
    try {
      await apiFetchJson("/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_to: newTaskAssignedTo,
          agency: newTaskAgency,
          priority: newTaskPriority,
          notes: newTaskNotes,
        }),
      });
      toast.success("Task created");
      setShowTaskDialog(false);
      fetchData();
    } catch (e) {
      toast.error("Failed to create task");
    }
  };

  const updateTaskStatus = async (id: number, status: string) => {
    try {
      await apiFetchJson(`/tasks/${id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchData();
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const highRiskOutbreaks = outbreaks.filter((o) => o.risk_level > 0.7).length;


  return (
    <Page
      title="Response Center"
      description="Coordinate incidents, tasks, and rapid response alerts across agencies."
      actions={
        <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <PlusCircle className="h-4 w-4" /> New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Response Task</DialogTitle>
              <DialogDescription>Assign a new task to an agency or field team.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Assigned To</Label>
                <Input value={newTaskAssignedTo} onChange={(e) => setNewTaskAssignedTo(e.target.value)} placeholder="Field Team Alpha" />
              </div>
              <div className="space-y-2">
                <Label>Agency</Label>
                <Input value={newTaskAgency} onChange={(e) => setNewTaskAgency(e.target.value)} placeholder="Dept of Agriculture" />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={newTaskNotes} onChange={(e) => setNewTaskNotes(e.target.value)} placeholder="Describe the task..." />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateTask}>Create Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <StatTile 
            label="Open tasks" 
            value={tasks.filter(t => t.status === "open").length.toString()} 
            sub="Active Assignments" 
            accent="river" 
          />
          <StatTile 
            label="Active outbreaks" 
            value={outbreaks.length.toString()} 
            sub={`${highRiskOutbreaks} High Risk`} 
            accent="leaf" 
          />
          <StatTile 
            label="Resolved" 
            value={tasks.filter(t => t.status === "resolved").length.toString()} 
            sub="Completed Tasks" 
            accent="sun" 
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Top Invasive Species Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={speciesData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis type="number" stroke="#ffffff50" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#ffffff50" fontSize={12} width={100} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#f8fafc" }}
                    itemStyle={{ color: "#f8fafc" }}
                  />
                  <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Task Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                     contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#f8fafc" }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Task Board */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-primary" /> Task Board
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No active tasks.</div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between rounded-lg border p-3 bg-card/50">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 h-2 w-2 rounded-full ${
                          task.priority === "high" ? "bg-red-500" : 
                          task.priority === "medium" ? "bg-yellow-500" : "bg-blue-500"
                        }`} />
                        <div>
                          <div className="font-medium text-sm">{task.notes || "Untitled Task"}</div>
                          <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                            <span>{task.assigned_to}</span>
                            <span>•</span>
                            <span>{task.agency}</span>
                            <span>•</span>
                            <span>{new Date(task.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <Badge variant={task.status === "resolved" ? "secondary" : "outline"}>
                           {task.status}
                         </Badge>
                         {task.status !== "resolved" && (
                           <Button size="icon" variant="ghost" onClick={() => updateTaskStatus(task.id, "resolved")}>
                             <CheckCircle className="h-4 w-4 text-green-500" />
                           </Button>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Outbreak Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Siren className="h-4 w-4 text-primary" /> Active Outbreaks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {outbreaks.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground">No outbreaks detected.</div>
              ) : (
                <div className="space-y-3">
                  {outbreaks.slice(0, 5).map((o) => (
                    <div key={o.outbreak_id} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div>
                        <div className="font-medium text-sm">{o.species} Cluster</div>
                        <div className="text-xs text-muted-foreground">{o.report_count} reports • Risk {(o.risk_level * 100).toFixed(0)}%</div>
                      </div>
                      <Badge variant={o.risk_level > 0.7 ? "destructive" : "default"}>
                        {o.risk_level > 0.7 ? "High" : "Med"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Alert Preview */}
          <Card className="border-white/10 bg-card/25">
             <CardHeader className="pb-3">
               <CardTitle className="flex items-center gap-2 text-base">
                 <Bell className="h-4 w-4 text-primary" /> Alert System
               </CardTitle>
             </CardHeader>
             <CardContent className="text-sm text-muted-foreground">
               <div className="p-3 bg-background/50 rounded border border-dashed">
                 <p className="font-mono text-xs text-primary mb-2">PREVIEW: Agency Email</p>
                 <p>Subject: [ALIENBUSTER] High Risk Outbreak Detected</p>
                 <p className="mt-2">...detected a significant cluster of <strong>{outbreaks[0]?.species || "Species"}</strong> reports in Sector 4...</p>
                 <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="secondary" className="h-7 text-xs">Edit Template</Button>
                    <Button size="sm" className="h-7 text-xs">Send Blast</Button>
                 </div>
               </div>
             </CardContent>
           </Card>
        </div>
      </div>
    </Page>
  );
}
