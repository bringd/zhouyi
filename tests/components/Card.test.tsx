import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '@/components/ui/Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies rice background and bronze border', () => {
    render(<Card data-testid="card">x</Card>)
    const card = screen.getByTestId('card')
    expect(card.className).toContain('bg-rice')
    expect(card.className).toContain('border-june-bronze')
  })

  it('renders header and footer', () => {
    render(
      <Card header={<h3>Title</h3>} footer={<p>Footer</p>}>
        Body
      </Card>
    )
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Footer')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('applies interactive hover classes when interactive=true', () => {
    render(<Card data-testid="card" interactive>x</Card>)
    const card = screen.getByTestId('card')
    expect(card.className).toContain('hover:-translate-y-1')
  })
})
