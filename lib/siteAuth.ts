import { cookies } from "next/headers";

export const SITE_AUTH_COOKIE = "moobie_access";

export function hasSitePasswordConfigured() {
  return Boolean(process.env.SITE_PASSWORD && process.env.SITE_PASSWORD.trim());
}

export async function isSiteAuthenticated() {
  if (!hasSitePasswordConfigured()) return true;
  const store = await cookies();
  return store.get(SITE_AUTH_COOKIE)?.value === "1";
}
