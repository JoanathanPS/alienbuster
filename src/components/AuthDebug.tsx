import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Trash2 } from "lucide-react";

export function AuthDebug() {
  const { user, session, loading } = useAuth();
  const [storageKeys, setStorageKeys] = useState<string[]>([]);

  useEffect(() => {
    const updateKeys = () => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith("sb-"));
      setStorageKeys(keys);
    };
    
    updateKeys();
    window.addEventListener("storage", updateKeys);
    return () => window.removeEventListener("storage", updateKeys);
  }, []);

  const forceClear = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <Card className="mt-4 border-red-500/20 bg-red-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-mono text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-3 w-3" /> Auth Debug
        </CardTitle>
      </CardHeader>
      <CardContent className="text-[10px] font-mono space-y-2">
        <div>User: {user ? user.email : "null"}</div>
        <div>Session: {session ? "Active" : "Null"}</div>
        <div>Loading: {String(loading)}</div>
        <div>
          Storage Keys:
          <ul className="list-disc pl-3 text-muted-foreground">
            {storageKeys.length > 0 ? (
              storageKeys.map(k => (
                <li key={k} className="truncate max-w-[150px]" title={k}>{k}</li>
              ))
            ) : (
              <li>No auth keys found</li>
            )}
          </ul>
        </div>
        <Button 
          variant="destructive" 
          size="sm" 
          className="h-6 w-full text-[10px]"
          onClick={forceClear}
        >
          <Trash2 className="mr-1 h-3 w-3" /> Force Reset
        </Button>
      </CardContent>
    </Card>
  );
}