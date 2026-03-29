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
    expect(screen.getByText('Click an operator to evaluate it.')).toBeInTheDocument()
  })

  it('shows lesson text for puzzle 1', () => {
    render(<App />)
    expect(screen.getByText(/Interface intro/)).toBeInTheDocument()
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
    expect(screen.getByText(/Puzzle 2 of/)).toBeInTheDocument()
  })

  it('shows tooltip for non-applicable operator', () => {
    const { container } = render(<App />)
    // Complete puzzles 1-3 to get to puzzle 4: (2+3)*4-1
    // Puzzle 1: 2+3
    fireEvent.click(container.querySelector('circle')!)
    fireEvent.click(screen.getByText('Apply'))
    fireEvent.click(screen.getByText(/Done/))
    // Puzzle 2: 3*(2+4) — inner + first, then root *
    let circles = container.querySelectorAll('circle')
    fireEvent.click(circles[1]) // inner +
    fireEvent.click(screen.getByText('Apply'))
    circles = container.querySelectorAll('circle')
    fireEvent.click(circles[0]) // root *
    fireEvent.click(screen.getByText('Apply'))
    fireEvent.click(screen.getByText(/Done/))
    // Puzzle 3: (1+2)*(3+4) — left + first, right +, then *
    circles = container.querySelectorAll('circle')
    fireEvent.click(circles[1])
    fireEvent.click(screen.getByText('Apply'))
    circles = container.querySelectorAll('circle')
    fireEvent.click(circles[1])
    fireEvent.click(screen.getByText('Apply'))
    circles = container.querySelectorAll('circle')
    fireEvent.click(circles[0])
    fireEvent.click(screen.getByText('Apply'))
    fireEvent.click(screen.getByText(/Done/))
    // Now on puzzle 4: (2+3)*4-1. Click the root - (first circle in layout).
    // The root - has left=* (operator) and right=Leaf(1). No rule applies.
    circles = container.querySelectorAll('circle')
    fireEvent.click(circles[0]) // root -
    expect(screen.getByText('No rule applies here yet.')).toBeInTheDocument()
  })

  it('hides Apply button after Apply is clicked', () => {
    const { container } = render(<App />)
    fireEvent.click(container.querySelector('circle')!)
    fireEvent.click(screen.getByText('Apply'))
    expect(screen.queryByText('Apply')).not.toBeInTheDocument()
  })

  it('shows Hint button on load', () => {
    render(<App />)
    expect(screen.getByText('Hint')).toBeInTheDocument()
  })

  it('shows rule label when operator is selected', () => {
    const { container } = render(<App />)
    fireEvent.click(container.querySelector('circle')!)
    expect(screen.getByText(/Order of Operations/)).toBeInTheDocument()
  })

  it('completes a variable puzzle: 2*x → 2x', () => {
    const { container } = render(<App />)

    // Complete puzzles 1-5 (arithmetic)
    for (let p = 0; p < 5; p++) {
      // Solve each arithmetic puzzle by clicking evaluable operators
      let done = false
      let safety = 0
      while (!done && safety < 20) {
        const circles = container.querySelectorAll('circle')
        if (circles.length === 0) {
          done = true
          break
        }
        // Try clicking each circle until one gets an Apply
        let applied = false
        for (const circle of circles) {
          fireEvent.click(circle)
          const applyBtn = screen.queryByText('Apply')
          if (applyBtn) {
            fireEvent.click(applyBtn)
            applied = true
            break
          }
        }
        if (!applied) done = true
        safety++
      }
      const nextBtn = screen.queryByText(/Done/)
      if (nextBtn) fireEvent.click(nextBtn)
    }

    // Now on puzzle 6: 2 * x. Should have one circle (*)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(1)
    fireEvent.click(circles[0])
    expect(screen.getByText(/Simplify/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Apply'))
    // Should now be done with a "2x" leaf
    expect(screen.getByText(/Done/)).toBeInTheDocument()
  })
})
