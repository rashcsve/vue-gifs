import { onScopeDispose } from 'vue'

export interface Debounced<A extends unknown[]> {
  /** (Re)start the timer; `fn` runs once with the latest args when it fires */
  run: (...args: A) => void
  /** Drop the pending call, if any */
  cancel: () => void
}

/**
 * Debounce `fn` by `delay` ms.
 * - Cancels the pending call when the owning scope (e.g. component) is disposed
 */
export function useDebounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number
): Debounced<A> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  function cancel() {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    timeoutId = undefined
  }

  function run(...args: A) {
    cancel()
    timeoutId = setTimeout(() => {
      timeoutId = undefined
      fn(...args)
    }, delay)
  }

  onScopeDispose(cancel)

  return { run, cancel }
}
