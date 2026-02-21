import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();

/**
 * Resolve a report photo URL.
 * - If it's already an http(s) URL, return as-is.
 * - Otherwise treat it as a Storage object path in bucket `reports-photos` and return a signed URL.
 *
 * NOTE: For true private media, set the bucket to NOT public in Supabase.
 */
export async function resolveReportPhotoUrl(photoUrlOrPath: string | null, expiresInSeconds = 60 * 60): Promise<string | null> {
  if (!photoUrlOrPath) return null;

  if (/^https?:\/\//i.test(photoUrlOrPath)) {
    return photoUrlOrPath;
  }

  const key = `${photoUrlOrPath}|${expiresInSeconds}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const { data, error } = await supabase.storage
    .from("reports-photos")
    .createSignedUrl(photoUrlOrPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  cache.set(key, data.signedUrl);
  return data.signedUrl;
}
