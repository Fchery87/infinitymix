// src/lib/design-tokens.ts
/**
 * Design Tokens for InfinityMix
 * Single source of truth for colors, spacing, typography, and animation
 */

export const colors = {
  primary: {
    DEFAULT: 'hsl(24 95% 53%)',
    foreground: 'hsl(144.9 80.4% 10%)',
    50: 'hsl(24 100% 97%)',
    100: 'hsl(24 100% 93%)',
    200: 'hsl(24 100% 85%)',
    300: 'hsl(24 100% 75%)',
    400: 'hsl(24 95% 65%)',
    500: 'hsl(24 95% 53%)',
    600: 'hsl(24 90% 45%)',
    700: 'hsl(24 85% 38%)',
    800: 'hsl(24 80% 30%)',
    900: 'hsl(24 75% 22%)',
  },
  background: 'hsl(240 10% 3.9%)',
  foreground: 'hsl(0 0% 98%)',
  card: 'hsl(240 10% 6%)',
  'card-foreground': 'hsl(0 0% 98%)',
  muted: 'hsl(240 4% 16%)',
  'muted-foreground': 'hsl(240 5% 75%)',
  border: 'hsl(240 4% 16%)',
  input: 'hsl(240 4% 16%)',
  ring: 'hsl(24 95% 53%)',
  destructive: {
    DEFAULT: 'hsl(0 63% 31%)',
    foreground: 'hsl(0 0% 98%)',
  },
  success: {
    DEFAULT: 'hsl(142 76% 36%)',
    foreground: 'hsl(0 0% 98%)',
  },
  warning: {
    DEFAULT: 'hsl(38 92% 50%)',
    foreground: 'hsl(0 0% 98%)',
  },
  info: {
    DEFAULT: 'hsl(217 91% 60%)',
    foreground: 'hsl(0 0% 98%)',
  },
} as const;

export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

export const typography = {
  fontFamily: {
    sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace'],
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    '5xl': ['3rem', { lineHeight: '1' }],
    '6xl': ['3.75rem', { lineHeight: '1' }],
  },
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
} as const;

export const animation = {
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
    slower: '500ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.375rem',
  DEFAULT: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  '2xl': '2rem',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  glow: '0 0 20px hsl(24 95% 53% / 0.5)',
  'glow-lg': '0 0 40px hsl(24 95% 53% / 0.6)',
} as const;

export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;
