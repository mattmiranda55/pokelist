<template>
  <div>
    <slot />
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[1000] flex cursor-pointer items-center justify-center"
      :class="isClosing ? 'animate-lb-out' : 'animate-lb-in'"
      :style="lightboxStyle"
      @click="onBackdropClick"
    >
      <img
        v-if="currentSrc"
        :src="currentSrc"
        alt="Card preview"
        class="max-h-[85vh] max-w-[90vw] cursor-default rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        :class="isClosing ? 'animate-lb-img-out' : 'animate-lb-img-in'"
        @click.stop
      />
      <div
        class="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[0.72rem] text-white/40"
        :style="hintStyle"
      >
        Tap outside to close
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted } from 'vue'

const isOpen = ref(false)
const isClosing = ref(false)
const currentSrc = ref('')

const lightboxStyle = {
  padding:
    'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
}

const hintStyle = {
  bottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
}

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
