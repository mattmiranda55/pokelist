export const colors = {
  bg: '#0b0f1f',
  bgGradientTop: '#0f1530',
  surface: '#151b30',
  surfaceElevated: '#1c2440',
  surfaceHover: '#222c4d',
  border: '#2a3454',
  borderStrong: '#3b4870',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  primary: '#ef4444',
  primaryGlow: 'rgba(239, 68, 68, 0.35)',
  primaryDeep: '#b91c1c',
  accent: '#fbbf24',
  accentGlow: 'rgba(251, 191, 36, 0.25)',
  cyan: '#22d3ee',
  success: '#10b981',
  danger: '#ef4444',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fontFamily = {
  mono: '"JetBrains Mono", "SF Mono", Menlo, monospace',
} as const;
