import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 矿物质色
        'june-red':    'var(--color-june-red)',
        'june-gold':   'var(--color-june-gold)',
        'june-bronze': 'var(--color-june-bronze)',
        'june-jade':   'var(--color-june-jade)',
        'june-clay':   'var(--color-june-clay)',
        // 墨色与纸色
        'ink':         'var(--color-ink)',
        'ink-light':   'var(--color-ink-light)',
        'rice':        'var(--color-rice)',
        'rice-dark':   'var(--color-rice-dark)',
        'shadow':      'var(--color-shadow)',
        // 语义色
        'text-primary':   'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted':     'var(--color-text-muted)',
        'bg-page':        'var(--color-bg-page)',
        'bg-card':        'var(--color-bg-card)',
        'border-ink':     'var(--color-border)',
        'accent':         'var(--color-accent)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body:    ['var(--font-body)'],
        num:     ['var(--font-num)'],
        // 楷体 — 引文/爻辞原文用,fallback 到全局 body 字体
        kaiti:   ["'KaiTi'", "'STKaiti'", 'var(--font-body)', 'serif'],
      },
      fontSize: {
        'display-lg': ['3.5rem', { lineHeight: '1.2' }],
        'display-md': ['2.5rem', { lineHeight: '1.25' }],
        'h1':         ['2rem',   { lineHeight: '1.3' }],
        'h2':         ['1.5rem', { lineHeight: '1.35' }],
        'h3':         ['1.25rem',{ lineHeight: '1.4' }],
        'body':       ['1rem',   { lineHeight: '1.6' }],
        'small':      ['0.875rem', { lineHeight: '1.6' }],
        'caption':    ['0.75rem',  { lineHeight: '1.5' }],
      },
      spacing: {
        '1':  '0.25rem',
        '2':  '0.5rem',
        '3':  '0.75rem',
        '4':  '1rem',
        '6':  '1.5rem',
        '8':  '2rem',
        '12': '3rem',
        '16': '4rem',
        '24': '6rem',
      },
      borderRadius: {
        'sm':   '2px',
        'md':   '4px',
        'lg':   '8px',
        'pill': '999px',
      },
      transitionDuration: {
        '4500': '4500ms',  // for breath animation cycle
      },
      keyframes: {
        'breath': {
          '0%, 100%': { boxShadow: '0 4px 20px rgba(74, 55, 28, 0.2)' },
          '50%':      { boxShadow: '0 6px 32px rgba(212, 175, 55, 0.5)' },
        },
      },
      animation: {
        'breath': 'breath 4.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
