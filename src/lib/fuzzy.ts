export interface FuzzyResult {
  match: boolean
  score: number
  indices: number[]
}

export interface HighlightSegment {
  text: string
  highlighted: boolean
}

export function fuzzyMatch(query: string, text: string): FuzzyResult {
  if (!query) return { match: true, score: 0, indices: [] }
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  const tLen = t.length
  const qLen = q.length
  if (qLen > tLen) return { match: false, score: 0, indices: [] }

  // Quick exact substring check (highest score path)
  const subIdx = t.indexOf(q)
  if (subIdx >= 0) {
    const indices: number[] = []
    for (let i = subIdx; i < subIdx + qLen; i++) indices.push(i)
    let score = 100 + qLen * 10
    if (subIdx === 0) score += 50
    else if (/[\s\-_.]/.test(t[subIdx - 1])) score += 30
    return { match: true, score, indices }
  }

  // Character-by-character fuzzy match
  let qi = 0
  let score = 0
  let consecutive = 0
  const indices: number[] = []

  for (let ti = 0; ti < tLen && qi < qLen; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti)
      if (indices.length > 1 && indices[indices.length - 2] === ti - 1) {
        consecutive++
        score += consecutive * 5
      } else {
        consecutive = 0
      }
      if (ti === 0 || /[\s\-_.]/.test(t[ti - 1])) score += 15
      score += 5
      qi++
    }
  }

  if (qi !== qLen) return { match: false, score: 0, indices: [] }
  return { match: true, score, indices }
}

export interface FuzzyFilterResult<T> {
  item: T
  score: number
  indices: number[]
}

export function fuzzyFilter<T>(
  query: string,
  items: T[],
  getText: (item: T) => string
): FuzzyFilterResult<T>[] {
  if (!query || !query.trim())
    return items.map((item) => ({ item, score: 0, indices: [] }))
  const results: FuzzyFilterResult<T>[] = []
  for (const item of items) {
    const text = getText(item)
    const { match, score, indices } = fuzzyMatch(query, text)
    if (match) results.push({ item, score, indices })
  }
  results.sort((a, b) => b.score - a.score)
  return results
}

export function getHighlightSegments(
  text: string,
  indices: number[]
): HighlightSegment[] {
  if (!indices || indices.length === 0)
    return [{ text, highlighted: false }]
  const segments: HighlightSegment[] = []
  const idxSet = new Set(indices)
  let i = 0
  while (i < text.length) {
    if (idxSet.has(i)) {
      let end = i
      while (end < text.length && idxSet.has(end)) end++
      segments.push({ text: text.slice(i, end), highlighted: true })
      i = end
    } else {
      let end = i
      while (end < text.length && !idxSet.has(end)) end++
      segments.push({ text: text.slice(i, end), highlighted: false })
      i = end
    }
  }
  return segments
}
