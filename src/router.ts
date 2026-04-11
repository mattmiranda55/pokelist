import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/collection',
    },
    {
      path: '/collection',
      component: () => import('@/views/CollectionView.vue'),
    },
    {
      path: '/master-sets',
      component: () => import('@/views/MasterSetsView.vue'),
    },
    {
      path: '/pokedex',
      component: () => import('@/views/PokedexView.vue'),
    },
  ],
})

router.afterEach((to) => {
  const tab = to.path.replace('/', '')
  if (tab) {
    localStorage.setItem('ptcg-last-tab', tab)
  }
})

export default router
