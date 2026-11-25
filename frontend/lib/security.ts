import { cookies } from "next/headers";
import { apiOriginForBrowser } from "./api-origin";

const apiOrigin = process.env.BILLGENIE_API_URL ?? "http://127.0.0.1:8000";

export async function securityApi<T>(path: string): Promise<T | null> {
  try {
    const jar = await cookies();
    const response = await fetch(`${apiOrigin}${path}`, {
      headers: { cookie: jar.toString() },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}
