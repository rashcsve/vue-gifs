import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { RouteName } from './names'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: RouteName.Trends,
    component: () => import('@/views/TrendsView.vue'),
    meta: { title: 'Trending GIFs' }
  },
  {
    path: '/search',
    name: RouteName.Search,
    component: () => import('@/views/SearchView.vue'),
    meta: { title: 'Search GIFs' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: RouteName.NotFound,
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Page not found' }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
  linkActiveClass: 'is-active',
  linkExactActiveClass: 'is-exact-active'
})

router.beforeEach((to) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} • GIFs`
  } else {
    document.title = 'GIFs'
  }
  return true
})

export default router
