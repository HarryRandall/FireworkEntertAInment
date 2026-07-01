/** Design-token constants - CSS variable references + the static palette used by Three.js / non-CSS surfaces. */
export const cssTokens = {
  color: {
    bgDefault: 'var(--background)',
    bgMuted: 'var(--muted)',
    bgSubtle: 'var(--muted)',
    bgEmphasis: 'var(--accent)',
    bgInverted: 'var(--foreground)',

    borderSubtle: 'var(--border)',
    borderDefault: 'var(--border)',
    borderEmphasis: 'var(--ring)',

    contentEmphasis: 'var(--foreground)',
    contentDefault: 'var(--foreground)',
    contentSubtle: 'var(--muted-foreground)',
    contentMuted: 'var(--muted-foreground)',
    contentInverted: 'var(--background)',

    accent: 'var(--primary)',
    accentHover: 'var(--primary)',
    accentSubtle: 'var(--accent)',
    accentEmphasis: 'var(--accent-foreground)',
    onAccent: 'var(--primary-foreground)',

    success: 'var(--color-status-success)',
    danger: 'var(--color-status-danger)',
    warning: 'var(--color-status-warning)',
    info: 'var(--color-status-info)',
  },
  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  shadow: {
    card: 'var(--shadow-card)',
    cardHover: 'var(--shadow-card-hover)',
    modal: 'var(--shadow-modal)',
  },
} as const;

/**
 * Static colour palette used by Three.js / SVG art that doesn't theme-switch.
 * These are deliberately kept as a vivid set independent of the app's neutral
 * UI palette.
 */
export const staticShowCrafterPalette = {
  night: '#05070D',
  surfaceDeep: '#0B1020',
  gridMajor: '#40516F',
  gridMinor: '#22304A',
  onSurface: '#F5F7FA',
  primary: '#00E5FF',
  secondary: '#3B82F6',
  tertiary: '#8B5CF6',
  magenta: '#FF3DF2',
  highlight: '#FFD166',
  success: '#00FF9C',

  bgDefault: '#ffffff',
  bgMuted: '#fafafa',
  borderSubtle: '#e5e5e5',
  contentEmphasis: '#171717',
  contentDefault: '#404040',
  contentSubtle: '#737373',
  accent: '#525252',
} as const;
