import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'
import { useDebounce } from '@/composables/useDebounce'

/** Every composable runs inside its own effect scope, stopped after each test */
const scopes: EffectScope[] = []

function setup<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  const scope = effectScope()
  scopes.push(scope)
  const api = scope.run(() => useDebounce(fn, delay))
  if (!api) throw new Error('useDebounce returned nothing')
  return { ...api, scope }
}

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    scopes.splice(0).forEach((s) => s.stop())
    vi.useRealTimers()
  })

  it('calls fn once with the args after the delay', () => {
    const fn = vi.fn<(q: string) => void>()
    const { run } = setup(fn, 500)

    run('cats')
    vi.advanceTimersByTime(499)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('cats')
  })

  it('restarts the timer on each run and uses the latest args', () => {
    const fn = vi.fn<(q: string, n: number) => void>()
    const { run } = setup(fn, 500)

    run('ca', 1)
    vi.advanceTimersByTime(300)
    run('cats', 2)
    vi.advanceTimersByTime(300)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('cats', 2)
  })

  it('calls fn again for a run started after the previous call fired', () => {
    const fn = vi.fn<(q: string) => void>()
    const { run } = setup(fn, 100)

    run('a')
    vi.advanceTimersByTime(100)
    run('b')
    vi.advanceTimersByTime(100)

    expect(fn.mock.calls).toEqual([['a'], ['b']])
  })

  it('works with no arguments', () => {
    const fn = vi.fn<() => void>()
    const { run } = setup(fn, 100)

    run()
    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith()
  })

  it('cancel() prevents a pending call', () => {
    const fn = vi.fn<(q: string) => void>()
    const { run, cancel } = setup(fn, 500)

    run('cats')
    vi.advanceTimersByTime(300)
    cancel()
    vi.advanceTimersByTime(1000)

    expect(fn).not.toHaveBeenCalled()
  })

  it('cancel() is a no-op when nothing is pending', () => {
    const fn = vi.fn<(q: string) => void>()
    const { run, cancel } = setup(fn, 100)

    expect(() => cancel()).not.toThrow()

    run('a')
    vi.advanceTimersByTime(100)
    expect(() => cancel()).not.toThrow()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('can run again after cancel()', () => {
    const fn = vi.fn<(q: string) => void>()
    const { run, cancel } = setup(fn, 100)

    run('a')
    cancel()
    run('b')
    vi.advanceTimersByTime(100)

    expect(fn.mock.calls).toEqual([['b']])
  })

  it('cancels a pending call when the owning scope is disposed', () => {
    const fn = vi.fn<(q: string) => void>()
    const { run, scope } = setup(fn, 500)

    run('cats')
    scope.stop()
    vi.advanceTimersByTime(1000)

    expect(fn).not.toHaveBeenCalled()
  })

  it('keeps separate timers for separate instances', () => {
    const a = vi.fn<() => void>()
    const b = vi.fn<() => void>()
    const first = setup(a, 100)
    const second = setup(b, 100)

    first.run()
    second.run()
    first.cancel()
    vi.advanceTimersByTime(100)

    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
  })
})
