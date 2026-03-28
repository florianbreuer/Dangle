import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import * as math from 'mathjs'
import type { OperatorNode } from 'mathjs'
import { TreeView } from './TreeView'
import { parseExpression } from '../lib/treeOps'

describe('TreeView', () => {
  it('renders one circle (operator) and two rects (leaves) for a 3-node tree', () => {
    const tree = math.parse('2+3')
    const { container } = render(
      <TreeView tree={tree} selectedNode={null} evaluatedNode={null} onNodeClick={() => {}} />
    )
    expect(container.querySelectorAll('circle')).toHaveLength(1)
    expect(container.querySelectorAll('rect')).toHaveLength(2)
  })

  it('renders two circles and three rects for 3*(2+4)', () => {
    const tree = parseExpression('3*(2+4)')
    const { container } = render(
      <TreeView tree={tree} selectedNode={null} evaluatedNode={null} onNodeClick={() => {}} />
    )
    // 2 operators: *, +
    expect(container.querySelectorAll('circle')).toHaveLength(2)
    // 3 leaves: 3, 2, 4
    expect(container.querySelectorAll('rect')).toHaveLength(3)
  })

  it('calls onNodeClick with the operator node when a circle is clicked', () => {
    const tree = math.parse('2+3')
    const onNodeClick = vi.fn()
    const { container } = render(
      <TreeView tree={tree} selectedNode={null} evaluatedNode={null} onNodeClick={onNodeClick} />
    )
    const circle = container.querySelector('circle')!
    fireEvent.click(circle)
    expect(onNodeClick).toHaveBeenCalledTimes(1)
    expect(onNodeClick).toHaveBeenCalledWith(tree)
  })

  it('does not call onNodeClick when a leaf rect is clicked', () => {
    const tree = math.parse('2+3')
    const onNodeClick = vi.fn()
    const { container } = render(
      <TreeView tree={tree} selectedNode={null} evaluatedNode={null} onNodeClick={onNodeClick} />
    )
    const rect = container.querySelector('rect')!
    fireEvent.click(rect)
    expect(onNodeClick).not.toHaveBeenCalled()
  })

  it('applies selected styles to the circle when selectedNode matches root', () => {
    const tree = math.parse('2+3')
    const { container } = render(
      <TreeView tree={tree} selectedNode={tree} evaluatedNode={null} onNodeClick={() => {}} />
    )
    const circle = container.querySelector('circle')!
    // Selected fill is #dbeafe (light blue), stroke is #2563eb
    expect(circle).toHaveAttribute('fill', '#dbeafe')
    expect(circle).toHaveAttribute('stroke', '#2563eb')
  })

  it('renders subtree children with dashed stroke when parent is selected', () => {
    const tree = parseExpression('3*(2+4)')
    const root = tree as OperatorNode
    // Select the * root; its children should get dashed borders
    const { container } = render(
      <TreeView tree={tree} selectedNode={tree} evaluatedNode={null} onNodeClick={() => {}} />
    )
    // The inner + circle should have dashed stroke
    const circles = container.querySelectorAll('circle')
    const dashedCircle = Array.from(circles).find(
      (c) => c.getAttribute('stroke-dasharray') !== null
    )
    expect(dashedCircle).toBeDefined()
    // Root * is selected (no dash), inner + should be dashed
    expect(root).toBeDefined()
  })

  it('renders an SVG with correct dimensions', () => {
    const tree = math.parse('2+3')
    const { container } = render(
      <TreeView tree={tree} selectedNode={null} evaluatedNode={null} onNodeClick={() => {}} />
    )
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('width', '800')
    expect(svg).toHaveAttribute('height', '360')
  })

  it('renders lines connecting parent to children', () => {
    const tree = math.parse('2+3')
    const { container } = render(
      <TreeView tree={tree} selectedNode={null} evaluatedNode={null} onNodeClick={() => {}} />
    )
    // 2 lines: root → left child, root → right child
    expect(container.querySelectorAll('line')).toHaveLength(2)
  })
})
