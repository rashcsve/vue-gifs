import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import App from '@/App.vue'
import { RouteName } from '@/router/names'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

const Stub = { render: () => null }

const wrappers: VueWrapper[] = []

/** Router of the most recent mountApp() */
let router: Router

async function mountApp(attach = false): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: RouteName.Trends, component: Stub },
      { path: '/search', name: RouteName.Search, component: Stub },
      { path: '/:pathMatch(.*)*', name: RouteName.NotFound, component: Stub }
    ]
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(App, {
    global: { plugins: [router] },
    ...(attach ? { attachTo: document.body } : {})
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('App', () => {
  afterEach(() => {
    wrappers.splice(0).forEach((w) => w.unmount())
  })

  it('has a "Skip to content" link to #main as the first focusable element', async () => {
    const wrapper = await mountApp()

    const first = wrapper.element.parentElement?.querySelector(FOCUSABLE)
    expect(first?.tagName).toBe('A')
    expect(first?.getAttribute('href')).toBe('#main')
    expect(first?.textContent?.trim()).toBe('Skip to content')
  })

  it('renders a focusable main landmark with id="main" as the skip-link target', async () => {
    const wrapper = await mountApp()

    const main = wrapper.find('main#main')
    expect(main.exists()).toBe(true)
    expect(main.attributes('tabindex')).toBe('-1')
    expect(wrapper.findAll('main')).toHaveLength(1)
  })

  it('focuses main#main when "Skip to content" is clicked, without changing the route', async () => {
    const wrapper = await mountApp(true)
    const link = wrapper.findAll('a').find((a) => a.text() === 'Skip to content')
    expect(link).toBeDefined()
    expect(link?.attributes('href')).toBe('#main')

    await link?.trigger('click')
    await flushPromises()

    expect(document.activeElement).toBe(wrapper.get('main#main').element)
    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(link?.attributes('href')).toBe('#main')
  })
})
