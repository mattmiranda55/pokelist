export const API_BASE = 'https://api.pokemontcg.io/v2'
export const PAGE_SIZE = 250
export const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours in ms
export const GRADING_COMPANIES = ['PSA', 'CGC', 'TAG']
export const GRADES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

export function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}
