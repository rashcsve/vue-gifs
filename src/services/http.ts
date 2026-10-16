export type HttpError =
  | { kind: 'aborted' }
  | { kind: 'network'; cause: unknown }
  | { kind: 'http'; status: number; statusText: string }
  | { kind: 'parse'; cause: unknown }

export type Result<T, E = HttpError> = { ok: true; data: T } | { ok: false; error: E }

// Match by name, not `instanceof DOMException`: fetch may come from another realm or a polyfill
function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError'
}

/**
 * Minimal HTTP client for JSON APIs.
 * - Never throws: every failure comes back as `{ ok: false, error }`.
 * - Pass an AbortSignal to cancel (debounce / route changes); a cancel returns `aborted`.
 */
export async function getJson<T>(url: string, opts?: { signal?: AbortSignal }): Promise<Result<T>> {
  let res: Response
  try {
    res = await fetch(url, { signal: opts?.signal })
  } catch (cause) {
    return {
      ok: false,
      error: isAbortError(cause) ? { kind: 'aborted' } : { kind: 'network', cause }
    }
  }

  if (!res.ok) {
    return { ok: false, error: { kind: 'http', status: res.status, statusText: res.statusText } }
  }

  try {
    return { ok: true, data: await res.json() }
  } catch (cause) {
    // The body stream also rejects with AbortError if the signal fires mid-read
    return {
      ok: false,
      error: isAbortError(cause) ? { kind: 'aborted' } : { kind: 'parse', cause }
    }
  }
}
