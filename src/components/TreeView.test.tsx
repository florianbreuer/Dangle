import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { TreeView } from './TreeView'
import { parseExpression, mathToGameTree } from '../lib/treeOps'
import type { GameOperator } from '../lib/treeOps'

function build(expr: string, atoms: string[]) {
  return mathToGameTree(parseExpression(expr), atoms)
}

describe('TreeView', () => {
  it('renders one circle (operator) and two rects (leaves) for a 3-node tree', () => {
    const tree = build('2 + 3', ['2', '3'])
    const { container } = render(
      <TreeView tree={tree} selectedNode={null} evaluatedNode={null} hintNodes={new Set()} onNodeClick={() => {}} />
    )
    expect(container.querySelectorAll('circle')).toHaveLength(1)
    expect(container.querySelectorAll('rect')).toHaveLength(2)
  })

  it('renders two circles and three rects for 3*(2+4)', () => {
    const tree = build('3 * (2 + 4)', ['2', '3', '4'])
    const { container } = render(
      <TreeView tree={tree} selectedNode={null} evaluatedNode={null} hintNodes={new Set()} onNodeClick={() => {}} />
    )
    expect(container.querySelectorAll('circle')).toHaveLength(2)
    expect(container.querySelectorAll('rect')).toHaveLength(3)
  })

  it('calls onNodeClick with the operator node and event when a circle is clicked', () => {
    const tree = build('2 + 3', ['2', '3'])
    const onNodeClick = vi.fn()
    const { container } = render(
      <TreeView tree={tree} selectedNode={null} evaluatedNode={null} hintNodes={new Set()} onNodeClick={onNodeClick} />
    )
    const circle = container.querySelector('circle')!
    fireEvent.click(circle)
    expect(onNodeClick).toHaveBeenCalledTimes(1)
    expect(onNodeClick.mock.calls[0][0]).toBe(tree) // node
    expect(onNodeClick.mock.calls[0][1]).toBeDefined() // event
  })

  it('calls onNodeClick when a leaf rect is clicked', () => {
    const tree = build('2 + 3', ['2', '3'])
    const onNodeClick = vi.fn()
    const { container } = render(
      <TreeView tree={tree} selectedNode={null} evaluatedNode={null} hintNodes={new Set()} onNodeClick={onNodeClick} />
    )
    const rect = container.querySelector('rect')!
    fireEvent.click(rect)
    expect(onNodeClick).toHaveBeenCalledTimes(1)
  })

  it('applies selected styles (neutral gray) when selectedNode matches root', () => {
    const tree = build('2 + 3', ['2', '3'])
    const { container } = render(
      <TreeView tree={tree} selectedNode={tree} evaluatedNode={null} hintNodes={new Set()} onNodeClick={() => {}} />
    )
    const circle = container.querySelector('circle')!
    expect(circle).toHaveAttribute('fill', '#e5e7eb')
    expect(circle).toHaveAttribute('stroke', '#374151')
  })

  it('renders subtree children with dashed stroke when parent is selected', () => {
    const tree = build('3 * (2 + 4)', ['2', '3', '4'])
    const { container } = render(
      <TreeView tree={tree} selectedNode={tree} evaluatedNode={null} hintNodes={new Set()} onNodeClick={() => {}} />
    )
    const circles = container.querySelectorAll('circle')
    const dashedCircle = Array.from(circles).find(
      (c) => c.getAttribute('stroke-dasharray') !== null
    )
    expect(dashedCircle).toBeDefined()
  })

  it('renders responsive SVG with viewBox', () => {
    const tree = build('2 + 3', ['2', '3'])
    const { container } = render(
      <TreeView tree={tree} selectedNode={null} evaluatedNode={null} hintNodes={new Set()} onNodeClick={() => {}} />
    )
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('width', '100%')
    expect(svg).toHaveAttribute('viewBox', '0 0 800 420')
  })

  it('renders lines connecting parent to children', () => {
    const tree = build('2 + 3', ['2', '3'])
    const { container } = render(
      <TreeView tree={tree} selectedNode={null} evaluatedNode={null} hintNodes={new Set()} onNodeClick={() => {}} />
    )
    expect(container.querySelectorAll('line')).toHaveLength(2)
  })

  it('renders variable leaf with amber fill', () => {
    const tree = build('2 * x', ['2', 'x'])
    const { container } = render(
      <TreeView tree={tree} selectedNode={null} evaluatedNode={null} hintNodes={new Set()} onNodeClick={() => {}} />
    )
    const rects = container.querySelectorAll('rect')
    const amberRect = Array.from(rects).find(
      (r) => r.getAttribute('fill') === '#fef3c7'
    )
    expect(amberRect).toBeDefined()
  })

  it('renders hint nodes with gold fill', () => {
    const tree = build('2 + 3', ['2', '3']) as GameOperator
    const hintNodes = new Set([tree as GameOperator])
    const { container } = render(
      <TreeView tree={tree} selectedNode={null} evaluatedNode={null} hintNodes={hintNodes} onNodeClick={() => {}} />
    )
    const circle = container.querySelector('circle')!
    expect(circle).toHaveAttribute('fill', '#fbbf24')
  })
})
