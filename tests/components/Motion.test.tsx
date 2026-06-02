import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BreathEffect, FlipEntry, PageTransition } from '@/components/motion'

describe('BreathEffect', () => {
  it('renders children', () => {
    render(<BreathEffect data-testid="breath"><span>content</span></BreathEffect>)
    expect(screen.getByText('content')).toBeInTheDocument()
  })
})

describe('FlipEntry', () => {
  it('renders children', () => {
    render(<FlipEntry data-testid="flip"><span>flipped</span></FlipEntry>)
    expect(screen.getByText('flipped')).toBeInTheDocument()
  })
})

describe('PageTransition', () => {
  it('renders children', () => {
    render(<PageTransition data-testid="page"><span>page</span></PageTransition>)
    expect(screen.getByText('page')).toBeInTheDocument()
  })
})
