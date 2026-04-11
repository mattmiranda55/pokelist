<template>
  <div class="card-tile" :style="{ '--i': Math.min(index, 30) }">
    <div class="img-wrap" @click="onImageClick">
      <img
        :alt="card.name"
        loading="lazy"
        :src="card.images?.small || ''"
      />
    </div>
    <div class="card-info">
      <div class="card-name" :title="card.name">{{ card.name }}</div>
      <div class="card-meta" :title="metaText">{{ metaText }}</div>

      <!-- Price display -->
      <div v-if="showPricing" class="card-price" :style="priceStyle">
        <template v-if="marketPrice != null">
          {{ formattedPrice }}
          <span v-if="gradeInfo && gradeInfo.company && gradeInfo.grade" class="grade-badge">
            {{ gradeInfo.company }} {{ gradeInfo.grade }}
          </span>
          <span v-if="gradeInfo && gradeInfo.company && gradeInfo.grade" class="price-note">(ungraded)</span>
          <span v-else class="price-note">{{ variantLabel }}</span>
        </template>
        <template v-else>No price data</template>
      </div>

      <!-- Sparkline -->
      <PriceSparkline v-if="showPricing" :values="sparklineValues" />

      <!-- Status badge for pokedex view -->
      <div v-if="showStatus" style="margin-top: 0.15rem">
        <StatusBadge :status="owned ? 'have' : 'need'" />
      </div>

      <!-- Own row -->
      <div class="own-row">
        <label>
          <input
            type="checkbox"
            :checked="owned"
            @change="onToggleOwned"
          />
          <span class="own-label">Owned</span>
        </label>
      </div>

      <!-- Grade row -->
      <div v-if="showGrading" class="grade-row" :class="{ visible: owned }">
        <span class="grade-label">Graded:</span>
        <select :value="selectedCompany" @change="onCompanyChange">
          <option value="">None</option>
          <option v-for="c in GRADING_COMPANIES" :key="c" :value="c">{{ c }}</option>
        </select>
        <select
          :value="selectedGrade"
          @change="onGradeChange"
          :style="{ display: selectedCompany ? '' : 'none' }"
        >
          <option value="">--</option>
          <option v-for="g in GRADES" :key="g" :value="g">{{ g }}</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, inject, watch } from 'vue'
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

const priceStyle = computed(() => {
  if (marketPrice.value == null) return { color: 'var(--text-muted)' }
  return {}
})

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

// Record price on mount
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
