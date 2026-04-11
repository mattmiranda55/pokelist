<template>
  <div>
    <slot />
    <div
      class="lightbox"
      :class="{ open: isOpen, closing: isClosing }"
      @click="onBackdropClick"
    >
      <img
        v-if="currentSrc"
        :src="currentSrc"
        alt="Card preview"
        @click.stop
      />
      <div class="lightbox-hint">Tap outside to close</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted } from 'vue'

const isOpen = ref(false)
const isClosing = ref(false)
const currentSrc = ref('')

function openLightbox(src: string) {
  currentSrc.value = src
  isOpen.value = true
  isClosing.value = false
}

function closeLightbox() {
  if (!isOpen.value) return
  isClosing.value = true
  setTimeout(() => {
    isOpen.value = false
    isClosing.value = false
    currentSrc.value = ''
  }, 200)
}

function onBackdropClick() {
  closeLightbox()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeLightbox()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})

provide('openLightbox', openLightbox)
</script>
