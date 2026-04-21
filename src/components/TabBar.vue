<template>
  <nav
    class="print-hide fixed bottom-0 left-0 right-0 z-[900] flex border-t border-border backdrop-blur-xl"
    :style="tabBarStyle"
  >
    <router-link
      v-for="tab in tabs"
      :key="tab.route"
      :to="tab.route"
      class="flex min-h-[44px] flex-1 cursor-pointer select-none flex-col items-center justify-center gap-0.5 py-1.5 text-[0.65rem] font-medium no-underline transition-colors duration-150"
      :class="isActive(tab.route) ? 'text-accent' : 'text-text-muted'"
    >
      <svg viewBox="0 0 24 24" class="h-6 w-6 fill-current" v-html="tab.icon"></svg>
      <span>{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const tabBarStyle = {
  height: 'calc(56px + env(safe-area-inset-bottom))',
  paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
  background: 'rgba(22,33,62,0.92)',
}

const tabs = [
  {
    route: '/collection',
    label: 'Collection',
    icon: '<path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>',
  },
  {
    route: '/master-sets',
    label: 'Master Sets',
    icon: '<path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zM6 20V4h5v7h7v9H6z"/>',
  },
  {
    route: '/pokedex',
    label: 'Pok\u00e9dex',
    icon: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  },
]

function isActive(path: string): boolean {
  return route.path.startsWith(path)
}
</script>
