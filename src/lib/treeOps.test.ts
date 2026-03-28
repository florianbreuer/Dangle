import { describe, it, expect } from 'vitest'
import * as math from 'mathjs'
import type { OperatorNode } from 'mathjs'
import {
  unwrapParens,
  canEvaluate,
  evaluateArithmetic,
  layoutTree,
  applyNode,
  getSubtreeNodes,
  parseExpression,
} from './treeOps'

// ---------------------------------------------------------------------------
// unwrapParens
// ---------------------------------------------------------------------------
describe('unwrapParens', () => {
  it('unwraps a ParenthesisNode to its OperatorNode content', () => {
    // math.parse("(2+4)") returns a ParenthesisNode wrapping OperatorNode
    const node = math.parse('(2+4)')
    expect(node.type).toBe('ParenthesisNode')
    const unwrapped = unwrapParens(node)
    expect(unwrapped.type).toBe('OperatorNode')
  })

  it('leaves a non-parenthesised expression unchanged', () => {
    const node = math.parse('2+4')
    const unwrapped = unwrapParens(node)
    expect(unwrapped.type).toBe('OperatorNode')
  })

  it('unwraps nested parentheses in a complex expression', () => {
    // 3*(2+4) — the right child of * should be OperatorNode after unwrap
    const parsed = math.parse('3*(2+4)')
    const tree = unwrapParens(parsed)
    const root = tree as OperatorNode
    expect(root.type).toBe('OperatorNode')
    expect(root.op).toBe('*')
    // Right child must be OperatorNode, not ParenthesisNode
    expect(root.args[1].type).toBe('OperatorNode')
  })
})

// ---------------------------------------------------------------------------
// canEvaluate
// ---------------------------------------------------------------------------
describe('canEvaluate', () => {
  it('returns true for + with two ConstantNode children', () => {
    const node = math.parse('2+4')
    expect(canEvaluate(node)).toBe(true)
  })

  it('returns true for * with two ConstantNode children', () => {
    const node = math.parse('3*4')
    expect(canEvaluate(node)).toBe(true)
  })

  it('returns false for root * when inner + not yet simplified', () => {
    const tree = parseExpression('3*(2+4)')
    // root is *, right child is + (OperatorNode, not ConstantNode)
    expect(canEvaluate(tree)).toBe(false)
  })

  it('returns false for a ConstantNode (leaf)', () => {
    const node = math.parse('5')
    expect(canEvaluate(node)).toBe(false)
  })

  it('returns true for inner + after outer tree is parsed', () => {
    const tree = parseExpression('3*(2+4)')
    const root = tree as OperatorNode
    const innerPlus = root.args[1] // the + node
    expect(canEvaluate(innerPlus)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// evaluateArithmetic
// ---------------------------------------------------------------------------
describe('evaluateArithmetic', () => {
  it('evaluates addition: 2 + 4 = 6', () => {
    const node = math.parse('2+4') as OperatorNode
    expect(evaluateArithmetic(node)).toBe(6)
  })

  it('evaluates subtraction: 5 - 3 = 2', () => {
    const node = math.parse('5-3') as OperatorNode
    expect(evaluateArithmetic(node)).toBe(2)
  })

  it('evaluates multiplication: 3 * 4 = 12', () => {
    const node = math.parse('3*4') as OperatorNode
    expect(evaluateArithmetic(node)).toBe(12)
  })

  it('evaluates division: 6 / 2 = 3', () => {
    const node = math.parse('6/2') as OperatorNode
    expect(evaluateArithmetic(node)).toBe(3)
  })

  it('handles subtraction producing negative: 3 - 7 = -4', () => {
    const node = math.parse('3-7') as OperatorNode
    expect(evaluateArithmetic(node)).toBe(-4)
  })

  it('returns NaN for division by zero (does not crash)', () => {
    const node = math.parse('5/0') as OperatorNode
    const result = evaluateArithmetic(node)
    expect(Number.isNaN(result)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// layoutTree
// ---------------------------------------------------------------------------
describe('layoutTree', () => {
  it('returns one entry for a ConstantNode (leaf)', () => {
    const node = math.parse('5')
    const layout = layoutTree(node)
    expect(layout).toHaveLength(1)
    expect(layout[0]).toMatchObject({ x: 0, y: 0 })
  })

  it('returns three entries for a 3-node tree (root + 2 leaves)', () => {
    const node = math.parse('2+3')
    const layout = layoutTree(node)
    expect(layout).toHaveLength(3)
  })

  it('places root at (0, 0) by default', () => {
    const node = math.parse('2+3')
    const layout = layoutTree(node)
    expect(layout[0]).toMatchObject({ x: 0, y: 0 })
  })

  it('places left child at (-200, 100) with default spread', () => {
    const node = math.parse('2+3')
    const layout = layoutTree(node)
    // left child is second entry
    expect(layout[1]).toMatchObject({ x: -200, y: 100 })
  })

  it('places right child at (200, 100) with default spread', () => {
    const node = math.parse('2+3')
    const layout = layoutTree(node)
    expect(layout[2]).toMatchObject({ x: 200, y: 100 })
  })

  it('returns five entries for 3*(2+4)', () => {
    const node = parseExpression('3*(2+4)')
    const layout = layoutTree(node)
    expect(layout).toHaveLength(5)
  })

  it('preserves node references (reference equality)', () => {
    const node = math.parse('2+3')
    const layout = layoutTree(node)
    expect(layout[0].node).toBe(node)
  })
})

// ---------------------------------------------------------------------------
// applyNode
// ---------------------------------------------------------------------------
describe('applyNode', () => {
  it('replaces the target node with its computed result', () => {
    const tree = math.parse('2+3')
    const { newTree } = applyNode(tree, tree) // apply the root itself
    expect(newTree.type).toBe('ConstantNode')
  })

  it('returns the resultNode as a ConstantNode reference', () => {
    const tree = math.parse('2+3')
    const { resultNode } = applyNode(tree, tree)
    expect(resultNode.type).toBe('ConstantNode')
  })

  it('replaces inner node, leaving outer structure intact', () => {
    const tree = parseExpression('3*(2+4)')
    const root = tree as OperatorNode
    const innerPlus = root.args[1] // the + node
    const { newTree } = applyNode(tree, innerPlus)
    // Root should still be *
    expect(newTree.type).toBe('OperatorNode')
    const newRoot = newTree as OperatorNode
    expect(newRoot.op).toBe('*')
    // Right child should now be ConstantNode(6)
    expect(newRoot.args[1].type).toBe('ConstantNode')
  })

  it('does not mutate the original tree (immutable transform)', () => {
    const tree = parseExpression('3*(2+4)')
    const root = tree as OperatorNode
    const innerPlus = root.args[1]
    applyNode(tree, innerPlus)
    // Original tree's inner + should still be OperatorNode
    expect(innerPlus.type).toBe('OperatorNode')
  })
})

// ---------------------------------------------------------------------------
// getSubtreeNodes
// ---------------------------------------------------------------------------
describe('getSubtreeNodes', () => {
  it('includes only the node itself for a ConstantNode', () => {
    const node = math.parse('5')
    const nodes = getSubtreeNodes(node)
    expect(nodes.size).toBe(1)
    expect(nodes.has(node)).toBe(true)
  })

  it('includes root and both children for a 3-node tree', () => {
    const tree = math.parse('2+3')
    const nodes = getSubtreeNodes(tree)
    expect(nodes.size).toBe(3)
    expect(nodes.has(tree)).toBe(true)
  })

  it('includes all 5 nodes for 3*(2+4)', () => {
    const tree = parseExpression('3*(2+4)')
    const nodes = getSubtreeNodes(tree)
    expect(nodes.size).toBe(5)
  })
})
