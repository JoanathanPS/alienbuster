import { supabase } from "@/integrations/supabase/client";

function clearSupabaseStorage() {
  // Supabase v2 stores session in localStorage with keys that start with "sb-"
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith("sb-")) localStorage.removeItem(k);
  }
  for (const k of Object.keys(sessionStorage)) {
    if (k.startsWith("sb-")) sessionStorage.removeItem(k);
  }
}

export async function supabaseHardLogout() {
  try {
    // IMPORTANT: await this
    const { error } = await supabase.auth.signOut({ scope: "global" });
    // scope: "global" signs out all sessions; can use "local" too
    if (error) console.warn("Supabase signOut error:", error.message);
  } finally {
    clearSupabaseStorage();

    // Optional: if you use React Query / SWR, clear cache here
    // queryClient.clear();

    // Force a clean app state (prevents stale auth context)
    window.location.assign("/login");
  }
}