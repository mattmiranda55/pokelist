<template>
  <Lightbox>
    <router-view />
    <TabBar />
  </Lightbox>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import Lightbox from '@/components/Lightbox.vue'
import TabBar from '@/components/TabBar.vue'
import { useSetsStore } from '@/stores/useSetsStore'
import { usePokedexStore } from '@/stores/usePokedexStore'
import { useCollectionStore } from '@/stores/useCollectionStore'

const setsStore = useSetsStore()
const pokedexStore = usePokedexStore()
const collectionStore = useCollectionStore()

onMounted(() => {
  // Init stores from localStorage
  setsStore.initTrackedSets()
  pokedexStore.initTracked()
  collectionStore.initOwned()

  // Load sets in background
  setsStore.loadSets()
})
</script>
