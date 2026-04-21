<template>
  <div
    class="animate-card-in overflow-hidden rounded-[14px] border border-border bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg max-[500px]:rounded-[10px]"
    :style="{ '--i': Math.min(index, 30) }"
  >
    <div
      class="img-wrap relative flex aspect-[3/4.2] cursor-pointer items-center justify-center overflow-hidden bg-surface2 after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-b after:from-transparent after:via-transparent after:to-black/15"
      @click="onImageClick"
    >
      <img
        :alt="card.name"
        loading="lazy"
        :src="card.images?.small || ''"
        class="h-full w-full object-contain transition-opacity duration-300"
      />
    </div>
    <div class="flex flex-col gap-[0.12rem] px-2.5 pb-2 pt-2">
      <div class="truncate text-[0.8rem] font-semibold" :title="card.name">{{ card.name }}</div>
      <div class="truncate text-[0.68rem] text-text-muted" :title="metaText">{{ metaText }}</div>

      <!-- Price display -->
      <div
        v-if="showPricing"
        class="mt-0.5 text-[0.73rem] font-semibold tabular-nums"
        :class="marketPrice == null ? 'text-text-muted' : 'text-warning'"
      >
        <template v-if="marketPrice != null">
          {{ formattedPrice }}
          <span
            v-if="gradeInfo && gradeInfo.company && gradeInfo.grade"
            class="ml-0.5 inline-block rounded-[4px] border border-border bg-surface2 px-1 py-[0.1rem] text-[0.6rem] font-bold uppercase text-warning"
          >
            {{ gradeInfo.company }} {{ gradeInfo.grade }}
          </span>
          <span
            v-if="gradeInfo && gradeInfo.company && gradeInfo.grade"
            class="text-[0.63rem] font-normal text-text-muted"
            >(ungraded)</span
          >
          <span v-else class="text-[0.63rem] font-normal text-text-muted">{{ variantLabel }}</span>
        </template>
        <template v-else>No price data</template>
      </div>

      <!-- Sparkline -->
      <PriceSparkline v-if="showPricing" :values="sparklineValues" />

      <!-- Status badge for pokedex view -->
      <div v-if="showStatus" class="mt-0.5">
        <StatusBadge :status="owned ? 'have' : 'need'" />
      </div>

      <!-- Own row -->
      <div class="mt-0.5 flex min-h-[30px] items-center gap-1.5">
        <label class="flex min-h-[30px] flex-1 cursor-pointer select-none items-center gap-1.5">
          <input
            type="checkbox"
            :checked="owned"
            @change="onToggleOwned"
            class="peer h-5 w-5 flex-shrink-0 cursor-pointer accent-success"
          />
          <span class="text-[0.73rem] text-text-muted transition-colors duration-150 peer-checked:text-success">Owned</span>
        </label>
      </div>

      <!-- Grade row -->
      <div
        v-if="showGrading && owned"
        class="mt-0.5 flex flex-wrap items-center gap-1"
      >
        <span class="text-[0.66rem] text-text-muted">Graded:</span>
        <select
          :value="selectedCompany"
          @change="onCompanyChange"
          class="min-h-[28px] cursor-pointer rounded-md border border-border bg-surface2 px-1 py-0.5 text-[0.68rem] text-text focus:border-accent focus:outline-none"
        >
          <option value="">None</option>
          <option v-for="c in GRADING_COMPANIES" :key="c" :value="c">{{ c }}</option>
        </select>
        <select
          v-if="selectedCompany"
          :value="selectedGrade"
          @change="onGradeChange"
          class="min-h-[28px] cursor-pointer rounded-md border border-border bg-surface2 px-1 py-0.5 text-[0.68rem] text-text focus:border-accent focus:outline-none"
        >
          <option value="">--</option>
          <option v-for="g in GRADES" :key="g" :value="g">{{ g }}</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { inject } from 'vue'
import type { Card, GradeInfo } from '@/lib/types'
import { GRADING_COMPANIES, GRADES } from '@/lib/constants'
import { getBestMarketPrice, formatPrice } from '@/lib/prices'
import { useCollectionStore } from '@/stores/useCollectionStore'
import PriceSparkline from './PriceSparkline.vue'
import StatusBadge from './StatusBadge.vue'

const props = withDefaults(
  defineProps<{
    card: Card
    index: number
    showPricing?: boolean
    showGrading?: boolean
    showStatus?: boolean
  }>(),
  {
    showPricing: true,
    showGrading: true,
    showStatus: false,
  }
)

const emit = defineEmits<{
  'toggle-owned': []
}>()

const store = useCollectionStore()
const openLightbox = inject<(src: string) => void>('openLightbox')

const owned = computed(() => store.isOwned(props.card.id))

const gradeInfo = ref<GradeInfo | null>(store.getGradeInfo(props.card.id))
const selectedCompany = ref(gradeInfo.value?.company || '')
const selectedGrade = ref(gradeInfo.value?.grade || '')

const metaText = computed(() => {
  const sn = props.card.set?.name || 'Unknown Set'
  const num = props.card.number || '?'
  const tot = props.card.set?.printedTotal || props.card.set?.total || '?'
  const rar = props.card.rarity || 'Unknown'
  return `${sn} \u00B7 ${num}/${tot} \u00B7 ${rar}`
})

const marketData = computed(() => getBestMarketPrice(props.card))
const marketPrice = computed(() => marketData.value.price)
const formattedPrice = computed(() => formatPrice(marketData.value.price))

const variantLabel = computed(() => {
  const v = marketData.value.variant
  if (!v) return ''
  if (v === 'cardmarket') return 'Cardmarket'
  return v.replace(/([A-Z])/g, ' $1').trim()
})

const sparklineValues = computed(() => {
  const hist = store.getCardPriceHistory(props.card.id)
  return hist.map((h) => h.price)
})

if (marketPrice.value != null) {
  store.recordCardPrice(props.card.id, marketPrice.value)
}

function onImageClick() {
  if (openLightbox) {
    openLightbox(props.card.images?.large || props.card.images?.small || '')
  }
}

function onToggleOwned(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  store.setOwned(props.card.id, checked)
  if (!checked) {
    selectedCompany.value = ''
    selectedGrade.value = ''
    store.setGradeInfo(props.card.id, null)
    gradeInfo.value = null
  }
  emit('toggle-owned')
}

function onCompanyChange(e: Event) {
  selectedCompany.value = (e.target as HTMLSelectElement).value
  if (!selectedCompany.value) {
    selectedGrade.value = ''
    store.setGradeInfo(props.card.id, null)
    gradeInfo.value = null
  } else if (selectedGrade.value) {
    const info = { company: selectedCompany.value, grade: selectedGrade.value }
    store.setGradeInfo(props.card.id, info)
    gradeInfo.value = info
  }
}

function onGradeChange(e: Event) {
  selectedGrade.value = (e.target as HTMLSelectElement).value
  if (selectedCompany.value && selectedGrade.value) {
    const info = { company: selectedCompany.value, grade: selectedGrade.value }
    store.setGradeInfo(props.card.id, info)
    gradeInfo.value = info
  }
}
</script>
