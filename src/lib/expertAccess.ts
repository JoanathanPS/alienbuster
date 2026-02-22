export const EXPERT_EMAILS = [
  // Default test expert account (create in Supabase Auth Users for quick testing)
  "expert@alienbuster.test",

  // Real expert accounts
  "joanathanps2006@gmail.com",
  "mrmousingh1@gmail.com",
] as const;

export function isExpertEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return EXPERT_EMAILS.some((e) => e.toLowerCase() === normalized);
}
