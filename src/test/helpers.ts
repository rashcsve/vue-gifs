/**
 * Shared test-only helpers for specs. Plain TypeScript (no vitest import) so it
 * typechecks under the app tsconfig.
 */
import type { GifItem, GifsError, GifsResponse, Result } from '@/services'

/** Result shape returned by fetchGifsFromApi */
export type GifsResult = Result<GifsResponse, GifsError>

/** Promise whose settlement is controlled by the test */
export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

/** Create a Deferred to resolve/reject responses in a chosen order */
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** GifItems with predictable title and url for each id */
export function gifs(...ids: string[]): GifItem[] {
  return ids.map((id) => ({ id, title: `Title ${id}`, url: `https://x/${id}.gif` }))
}

/** One page of results with the given next cursor */
export function page(ids: string[], next: string | null): GifsResponse {
  return { results: gifs(...ids), next }
}

/** Successful GifsResult */
export function ok(data: GifsResponse): GifsResult {
  return { ok: true, data }
}

/** Failed GifsResult */
export function fail(error: GifsError): GifsResult {
  return { ok: false, error }
}

/** Real Response with a JSON-serialised body */
export function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), init)
}
