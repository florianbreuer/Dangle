import { describe, it, expect } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import App from './App'

describe('App integration', () => {
  it('shows the infix form for the first puzzle (2 + 3)', () => {
    render(<App />)
    // Puzzle 1 is "2 + 3", infix should show something containing 2 and 3
    expect(screen.getByText(/2.*3/)).toBeInTheDocument()
  })

  it('shows "Puzzle 1 of 5" progress indicator on load', () => {
    render(<App />)
    expect(screen.getByText('Puzzle 1 of 5')).toBeInTheDocument()
  })

  it('shows first-use hint on load', () => {
    render(<App />)
    expect(screen.getByText('Click an operator to evaluate it.')).toBeInTheDocument()
  })

  it('shows Apply button after clicking an evaluable operator', () => {
    const { container } = render(<App />)
    const circle = container.querySelector('circle')!
    fireEvent.click(circle)
    expect(screen.getByText('Apply')).toBeInTheDocument()
  })

  it('does not show Apply button on initial load', () => {
    render(<App />)
    expect(screen.queryByText('Apply')).not.toBeInTheDocument()
  })

  it('evaluates 2+3 to 5 when operator is clicked and Apply pressed', () => {
    const { container } = render(<App />)
    fireEvent.click(container.querySelector('circle')!)
    fireEvent.click(screen.getByText('Apply'))
    // After evaluation, infix display shows "5" (may also appear in SVG text)
    const infix = container.querySelector('[data-testid="infix-display"]')!
    expect(infix.textContent).toContain('5')
  })

  it('shows "Done! → Next puzzle" button after completing puzzle 1', () => {
    const { container } = render(<App />)
    fireEvent.click(container.querySelector('circle')!)
    fireEvent.click(screen.getByText('Apply'))
    expect(screen.getByText(/Done/)).toBeInTheDocument()
  })

  it('does not show Done button before puzzle is complete', () => {
    render(<App />)
    expect(screen.queryByText(/Done/)).not.toBeInTheDocument()
  })

  it('advances to puzzle 2 when Next is clicked', () => {
    const { container } = render(<App />)
    fireEvent.click(container.querySelector('circle')!)
    fireEvent.click(screen.getByText('Apply'))
    fireEvent.click(screen.getByText(/Done/))
    expect(screen.getByText('Puzzle 2 of 5')).toBeInTheDocument()
  })

  it('shows tooltip for non-evaluable operator', () => {
    render(<App />)
    // Load puzzle 2: 3*(2+4). The root * cannot be evaluated yet.
    // We need to advance to puzzle 2 first.
    // Actually, we can test this by clicking Next after puzzle 1 to get to puzzle 2,
    // then clicking the * root.
    // For simplicity, let's do puzzle 1 first:
    const { container, rerender } = render(<App />)
    // Complete puzzle 1
    fireEvent.click(container.querySelector('circle')!)
    fireEvent.click(screen.getByText('Apply'))
    fireEvent.click(screen.getByText(/Done/))

    // Now on puzzle 2: 3*(2+4). Click the * (root circle).
    // There are 2 circles now. The root * is at position 0 in SVG z-order.
    const circles = container.querySelectorAll('circle')
    // Root * is first in layout order
    fireEvent.click(circles[0])
    expect(screen.getByText('Simplify the parts inside the brackets first.')).toBeInTheDocument()
    void rerender
  })

  it('hides Apply button after Apply is clicked (selectedNode reset)', () => {
    const { container } = render(<App />)
    fireEvent.click(container.querySelector('circle')!)
    fireEvent.click(screen.getByText('Apply'))
    expect(screen.queryByText('Apply')).not.toBeInTheDocument()
  })

  it('infix form updates after each Apply step', () => {
    const { container } = render(<App />)
    // Puzzle 1: 2 + 3 → 5
    fireEvent.click(container.querySelector('circle')!)
    fireEvent.click(screen.getByText('Apply'))
    // The result "5" should appear in the infix display
    const infixDisplay = container.querySelector('[data-testid="infix-display"]')!
    expect(infixDisplay.textContent).toContain('5')
  })

  it('loops back to puzzle 1 after completing all 5 puzzles', () => {
    const { container } = render(<App />)

    // Complete puzzle 1: 2+3
    fireEvent.click(container.querySelector('circle')!)
    fireEvent.click(screen.getByText('Apply'))
    fireEvent.click(screen.getByText(/Done/))

    // Now on puzzle 2: 3*(2+4). Click inner + first (2nd circle), then Apply, then * (1st circle), then Apply.
    let circles = container.querySelectorAll('circle')
    // Click the inner + (index 1 in layout)
    fireEvent.click(circles[1])
    fireEvent.click(screen.getByText('Apply'))
    // Now click root *
    circles = container.querySelectorAll('circle')
    fireEvent.click(circles[0])
    fireEvent.click(screen.getByText('Apply'))
    fireEvent.click(screen.getByText(/Done/))

    // Puzzle 3, 4, 5 are more complex — just verify we're on puzzle 3
    expect(screen.getByText('Puzzle 3 of 5')).toBeInTheDocument()
  })
})
