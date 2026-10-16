/**
 * Minimal HTTP client for JSON APIs.
 * - Returns `null` on failure and logs the error.
 * - Accepts AbortSignal for cancellations (debounce / route changes).
 */
export async function getJson<T>(url: string, opts?: { signal?: AbortSignal }): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: opts?.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    return (await res.json()) as T
  } catch (err) {
    console.error('[HTTP] GET failed:', err)
    return null
  }
}
