import { describe, it, expect } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import App from './App'

describe('App integration', () => {
  it('shows the infix form for the first puzzle (2 + 3)', () => {
    const { container } = render(<App />)
    const infix = container.querySelector('[data-testid="infix-display"]')!
    expect(infix.textContent).toContain('2')
    expect(infix.textContent).toContain('3')
  })

  it('shows progress indicator with correct total on load', () => {
    render(<App />)
    expect(screen.getByText(/Puzzle 1 of \d+/)).toBeInTheDocument()
  })

  it('shows first-use hint on load', () => {
    render(<App />)
    expect(screen.getByText('Click an operator to see what you can do.')).toBeInTheDocument()
  })

  it('shows lesson text for puzzle 1', () => {
    render(<App />)
    expect(screen.getByText(/Interface intro/)).toBeInTheDocument()
  })

  it('shows tooltip with rule after clicking an evaluable operator', () => {
    const { container } = render(<App />)
    const circle = container.querySelector('circle')!
    fireEvent.click(circle)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByText(/Order of Operations/)).toBeInTheDocument()
  })

  it('does not show tooltip on initial load', () => {
    render(<App />)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('evaluates 2+3 to 5 when operator is clicked and rule applied', () => {
    const { container } = render(<App />)
    fireEvent.click(container.querySelector('circle')!)
    fireEvent.click(screen.getByText(/Order of Operations/))
    const infix = container.querySelector('[data-testid="infix-display"]')!
    expect(infix.textContent).toContain('5')
  })

  it('shows "Done! → Next puzzle" button after completing puzzle 1', () => {
    const { container } = render(<App />)
    fireEvent.click(container.querySelector('circle')!)
    fireEvent.click(screen.getByText(/Order of Operations/))
    expect(screen.getByText(/Done/)).toBeInTheDocument()
  })

  it('does not show Done button before puzzle is complete', () => {
    render(<App />)
    expect(screen.queryByText(/Done/)).not.toBeInTheDocument()
  })

  it('advances to puzzle 2 when Next is clicked', () => {
    const { container } = render(<App />)
    fireEvent.click(container.querySelector('circle')!)
    fireEvent.click(screen.getByText(/Order of Operations/))
    fireEvent.click(screen.getByText(/Done/))
    expect(screen.getByText(/Puzzle 2 of/)).toBeInTheDocument()
  })

  it('shows Hint button on load', () => {
    render(<App />)
    expect(screen.getByText('Hint')).toBeInTheDocument()
  })

  it('shows Undo button on load', () => {
    render(<App />)
    expect(screen.getByLabelText('Undo last step')).toBeInTheDocument()
  })

  it('undo restores previous tree state', () => {
    const { container } = render(<App />)
    // Apply rule to evaluate 2+3
    fireEvent.click(container.querySelector('circle')!)
    fireEvent.click(screen.getByText(/Order of Operations/))
    const infix = container.querySelector('[data-testid="infix-display"]')!
    expect(infix.textContent).toContain('5')

    // Undo
    fireEvent.click(screen.getByLabelText('Undo last step'))
    expect(infix.textContent).toContain('2')
    expect(infix.textContent).toContain('3')
  })

  it('shows Puzzles and Sandbox tabs', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Puzzles' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Sandbox' })).toBeInTheDocument()
  })

  it('switches to sandbox mode when Sandbox tab is clicked', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Sandbox' }))
    // Sandbox shows an input field
    expect(screen.getByPlaceholderText(/Type an expression/)).toBeInTheDocument()
  })

  it('hides tooltip when clicking outside', () => {
    const { container } = render(<App />)
    fireEvent.click(container.querySelector('circle')!)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Click outside (on the document body)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
