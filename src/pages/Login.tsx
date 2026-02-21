import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Bug, Loader2, Mail } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

type Values = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const redirectTo = useMemo(() => {
    try {
      return sessionStorage.getItem("post-login-redirect") || "/";
    } catch {
      return "/";
    }
  }, []);

  useEffect(() => {
    if (!session) return;

    try {
      sessionStorage.removeItem("post-login-redirect");
    } catch {
      // ignore
    }

    navigate(redirectTo, { replace: true });
  }, [session, navigate, redirectTo]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const sendMagicLink = async (values: Values) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;
      toast.success("Magic link sent — check your email");
    } catch (e: any) {
      toast.error(e?.message || "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
      // Redirect handled by Supabase
    } catch (e: any) {
      toast.error(e?.message || "Google sign-in failed");
      setOauthLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Bug className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <CardTitle className="text-xl">Alien Buster</CardTitle>
                <CardDescription>Sign in to submit reports and view hotspots.</CardDescription>
              </div>
            </div>
            <Badge variant="secondary">Auth</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(sendMagicLink)}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <Input className="pl-9" type="email" placeholder="you@example.com" autoComplete="email" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full min-h-[48px] bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={loading || oauthLoading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Sending magic link...
                  </>
                ) : (
                  "Send magic link"
                )}
              </Button>
            </form>
          </Form>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              or
            </span>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full min-h-[48px]"
            onClick={signInWithGoogle}
            disabled={loading || oauthLoading}
          >
            {oauthLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Connecting Google...
              </>
            ) : (
              "Continue with Google"
            )}
          </Button>

          <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Supabase setup</div>
            <div className="mt-1">Enable Email (magic link) + Google in Supabase Authentication → Providers.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
