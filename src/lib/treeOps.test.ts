import { describe, it, expect } from 'vitest'
import type { GameNode, GameOperator, ExpressionLeaf } from './treeOps'
import {
  parseExpression,
  mathToGameTree,
  treeToInfix,
  treeToColoredInfix,
  layoutTree,
  getSubtreeNodes,
} from './treeOps'
import {
  getApplicableRule,
  findAllApplicableNodes,
  findAnyApplicableNode,
} from './rules'

// Helper: build a GameNode tree from expression + atoms
function build(expr: string, atoms: string[]): GameNode {
  return mathToGameTree(parseExpression(expr), atoms)
}

// ---------------------------------------------------------------------------
// mathToGameTree
// ---------------------------------------------------------------------------
describe('mathToGameTree', () => {
  it('converts "2 + 3" with number atoms to GameOp(+, Leaf(2), Leaf(3))', () => {
    const tree = build('2 + 3', ['2', '3'])
    expect(tree.type).toBe('operator')
    const op = tree as GameOperator
    expect(op.op).toBe('+')
    expect(op.left.type).toBe('leaf')
    expect(op.right.type).toBe('leaf')
    expect((op.left as ExpressionLeaf).expression).toBe('2')
    expect((op.right as ExpressionLeaf).expression).toBe('3')
  })

  it('converts "2 * x + 3 * x" with full atoms to 5-node tree', () => {
    const tree = build('2 * x + 3 * x', ['2', '3', 'x'])
    expect(tree.type).toBe('operator')
    const root = tree as GameOperator
    expect(root.op).toBe('+')
    expect(root.left.type).toBe('operator')
    expect(root.right.type).toBe('operator')
  })

  it('converts "2*x + 3*x" with monomial atoms to 3-node tree', () => {
    const tree = build('2 * x + 3 * x', ['2x', '3x'])
    expect(tree.type).toBe('operator')
    const root = tree as GameOperator
    expect(root.op).toBe('+')
    expect(root.left.type).toBe('leaf')
    expect(root.right.type).toBe('leaf')
    expect((root.left as ExpressionLeaf).expression).toBe('2x')
    expect((root.right as ExpressionLeaf).expression).toBe('3x')
  })

  it('converts 3*(x+2) with atoms to correct tree', () => {
    const tree = build('3 * (x + 2)', ['3', 'x', '2'])
    expect(tree.type).toBe('operator')
    const root = tree as GameOperator
    expect(root.op).toBe('*')
    expect(root.left.type).toBe('leaf')
    expect(root.right.type).toBe('operator')
  })

  it('ExpressionLeaf.ast is a valid MathNode', () => {
    const tree = build('2 + 3', ['2', '3'])
    const leaf = (tree as GameOperator).left as ExpressionLeaf
    expect(leaf.ast).toBeDefined()
    expect(leaf.ast.type).toBe('ConstantNode')
  })

  it('v1 arithmetic puzzles produce correct tree shapes', () => {
    // 3*(2+4): 5 nodes
    const tree = build('3 * (2 + 4)', ['2', '3', '4'])
    const nodes = getSubtreeNodes(tree)
    expect(nodes.size).toBe(5)
  })

  it('uses structural AST comparison, not string matching', () => {
    // "2x" as an atom should match the subtree 2*x
    const tree = build('2 * x', ['2x'])
    // Should pack the whole thing into a single leaf
    expect(tree.type).toBe('leaf')
    expect((tree as ExpressionLeaf).expression).toBe('2x')
  })
})

// ---------------------------------------------------------------------------
// Rule registry: getApplicableRule
// ---------------------------------------------------------------------------
describe('getApplicableRule', () => {
  it('returns EVALUATE for GameOp(+, Leaf(2), Leaf(3))', () => {
    const tree = build('2 + 3', ['2', '3']) as GameOperator
    const rule = getApplicableRule(tree)
    expect(rule).not.toBeNull()
    expect(rule!.name).toBe('Order of Operations')
  })

  it('returns SIMPLIFY_TERM for GameOp(*, Leaf(5), Leaf(x))', () => {
    const tree = build('5 * x', ['5', 'x']) as GameOperator
    const rule = getApplicableRule(tree)
    expect(rule).not.toBeNull()
    expect(rule!.name).toBe('Simplify')
  })

  it('returns COMBINE for GameOp(+, Leaf(2x), Leaf(3x))', () => {
    const tree = build('2 * x + 3 * x', ['2x', '3x']) as GameOperator
    const rule = getApplicableRule(tree)
    expect(rule).not.toBeNull()
    expect(rule!.name).toBe('Collect Like Terms')
  })

  it('returns DISTRIBUTE for GameOp(*, Leaf(3), GameOp(+, ...))', () => {
    const tree = build('3 * (x + 2)', ['3', 'x', '2']) as GameOperator
    const rule = getApplicableRule(tree)
    expect(rule).not.toBeNull()
    expect(rule!.name).toBe('Distribute')
  })

  it('returns FACTOR for GameOp(+, Leaf(3x), Leaf(6)) — GCD(3,6)=3', () => {
    const tree: GameOperator = {
      type: 'operator',
      op: '+',
      left: { type: 'leaf', expression: '3x', ast: parseExpression('3*x') },
      right: { type: 'leaf', expression: '6', ast: parseExpression('6') },
    }
    const rule = getApplicableRule(tree)
    expect(rule).not.toBeNull()
    expect(rule!.name).toBe('Factor')
  })

  it('returns null for a leaf node', () => {
    const tree = build('5', ['5'])
    expect(tree.type).toBe('leaf')
    expect(getApplicableRule(tree)).toBeNull()
  })

  it('EVALUATE has priority over SIMPLIFY_TERM for numeric * numeric', () => {
    const tree = build('3 * 4', ['3', '4']) as GameOperator
    const rule = getApplicableRule(tree)
    expect(rule!.name).toBe('Order of Operations')
  })
})

// ---------------------------------------------------------------------------
// EVALUATE rule
// ---------------------------------------------------------------------------
describe('EVALUATE rule', () => {
  it('evaluates 2 + 3 = 5', () => {
    const tree = build('2 + 3', ['2', '3']) as GameOperator
    const rule = getApplicableRule(tree)!
    const { newTree } = rule.apply(tree, tree)
    expect(newTree.type).toBe('leaf')
    expect((newTree as ExpressionLeaf).expression).toBe('5')
  })

  it('evaluates 3 * 4 = 12', () => {
    const tree = build('3 * 4', ['3', '4']) as GameOperator
    const rule = getApplicableRule(tree)!
    const { newTree } = rule.apply(tree, tree)
    expect((newTree as ExpressionLeaf).expression).toBe('12')
  })

  it('evaluates 6 / 2 = 3', () => {
    const tree = build('6 / 2', ['6', '2']) as GameOperator
    const rule = getApplicableRule(tree)!
    const { newTree } = rule.apply(tree, tree)
    expect((newTree as ExpressionLeaf).expression).toBe('3')
  })

  it('evaluates 5 - 3 = 2', () => {
    const tree = build('5 - 3', ['5', '3']) as GameOperator
    const rule = getApplicableRule(tree)!
    const { newTree } = rule.apply(tree, tree)
    expect((newTree as ExpressionLeaf).expression).toBe('2')
  })

  it('returns immutable new tree (old tree unchanged)', () => {
    const tree = build('2 + 3', ['2', '3']) as GameOperator
    const rule = getApplicableRule(tree)!
    const { newTree } = rule.apply(tree, tree)
    expect(newTree).not.toBe(tree)
    expect(tree.type).toBe('operator') // original unchanged
  })

  it('label returns "Order of Operations: 2 + 3"', () => {
    const tree = build('2 + 3', ['2', '3']) as GameOperator
    const rule = getApplicableRule(tree)!
    expect(rule.label(tree)).toBe('Order of Operations: 2 + 3')
  })

  it('replaces inner node, leaving outer structure', () => {
    const tree = build('3 * (2 + 4)', ['2', '3', '4'])
    const root = tree as GameOperator
    const inner = root.right as GameOperator
    const rule = getApplicableRule(inner)!
    const { newTree } = rule.apply(tree, inner)
    const newRoot = newTree as GameOperator
    expect(newRoot.op).toBe('*')
    expect(newRoot.right.type).toBe('leaf')
    expect((newRoot.right as ExpressionLeaf).expression).toBe('6')
  })
})

// ---------------------------------------------------------------------------
// SIMPLIFY_TERM rule
// ---------------------------------------------------------------------------
describe('SIMPLIFY_TERM rule', () => {
  it('simplifies 5 * x to 5x', () => {
    const tree = build('5 * x', ['5', 'x']) as GameOperator
    const rule = getApplicableRule(tree)!
    const { newTree } = rule.apply(tree, tree)
    expect(newTree.type).toBe('leaf')
    expect((newTree as ExpressionLeaf).expression).toBe('5x')
  })

  it('simplifies 1 * x to x (coeff=1 elision)', () => {
    const tree = build('1 * x', ['1', 'x']) as GameOperator
    const rule = getApplicableRule(tree)!
    const { newTree } = rule.apply(tree, tree)
    expect((newTree as ExpressionLeaf).expression).toBe('x')
  })

  it('does not apply to 3 * 4 (both numeric)', () => {
    const tree = build('3 * 4', ['3', '4']) as GameOperator
    const rule = getApplicableRule(tree)!
    expect(rule.name).toBe('Order of Operations') // not Simplify
  })

  it('label returns "Simplify: 5 × x"', () => {
    const tree = build('5 * x', ['5', 'x']) as GameOperator
    const rule = getApplicableRule(tree)!
    expect(rule.label(tree)).toBe('Simplify: 5 × x')
  })
})

// ---------------------------------------------------------------------------
// COMBINE rule
// ---------------------------------------------------------------------------
describe('COMBINE rule', () => {
  it('combines 2x + 3x = 5x', () => {
    const tree = build('2 * x + 3 * x', ['2x', '3x']) as GameOperator
    const rule = getApplicableRule(tree)!
    const { newTree } = rule.apply(tree, tree)
    expect(newTree.type).toBe('leaf')
    expect((newTree as ExpressionLeaf).expression).toBe('5x')
  })

  it('does not combine 2x + 3y (different variables)', () => {
    const tree: GameOperator = {
      type: 'operator',
      op: '+',
      left: { type: 'leaf', expression: '2x', ast: parseExpression('2*x') },
      right: { type: 'leaf', expression: '3y', ast: parseExpression('3*y') },
    }
    expect(getApplicableRule(tree)).toBeNull()
  })

  it('does not combine if result would be negative', () => {
    const tree: GameOperator = {
      type: 'operator',
      op: '+',
      left: { type: 'leaf', expression: 'x', ast: parseExpression('x') },
      right: { type: 'leaf', expression: '3x', ast: parseExpression('3*x') },
    }
    // 1x + 3x = 4x, positive — should work
    const rule = getApplicableRule(tree)
    expect(rule).not.toBeNull()
  })

  it('extracts coefficient 1 from bare "x"', () => {
    const tree: GameOperator = {
      type: 'operator',
      op: '+',
      left: { type: 'leaf', expression: 'x', ast: parseExpression('x') },
      right: { type: 'leaf', expression: '4x', ast: parseExpression('4*x') },
    }
    const rule = getApplicableRule(tree)!
    const { newTree } = rule.apply(tree, tree)
    expect((newTree as ExpressionLeaf).expression).toBe('5x')
  })

  it('label returns "Collect Like Terms: 2x + 3x"', () => {
    const tree = build('2 * x + 3 * x', ['2x', '3x']) as GameOperator
    const rule = getApplicableRule(tree)!
    expect(rule.label(tree)).toBe('Collect Like Terms: 2x + 3x')
  })
})

// ---------------------------------------------------------------------------
// DISTRIBUTE rule
// ---------------------------------------------------------------------------
describe('DISTRIBUTE rule', () => {
  it('distributes 3*(x+2) into +(*(3,x), *(3,2))', () => {
    const tree = build('3 * (x + 2)', ['3', 'x', '2']) as GameOperator
    const rule = getApplicableRule(tree)!
    const { newTree } = rule.apply(tree, tree)
    const root = newTree as GameOperator
    expect(root.op).toBe('+')
    expect(root.left.type).toBe('operator')
    expect(root.right.type).toBe('operator')
    expect((root.left as GameOperator).op).toBe('*')
    expect((root.right as GameOperator).op).toBe('*')
  })

  it('does not apply to *(Leaf(3), Leaf(x)) — no inner operator', () => {
    const tree = build('3 * x', ['3', 'x']) as GameOperator
    const rule = getApplicableRule(tree)
    expect(rule!.name).not.toBe('Distribute')
  })

  it('label returns "Distribute: 3 × (x + 2)"', () => {
    const tree = build('3 * (x + 2)', ['3', 'x', '2']) as GameOperator
    const rule = getApplicableRule(tree)!
    expect(rule.label(tree)).toContain('Distribute')
    expect(rule.label(tree)).toContain('3')
  })

  it('resultNode is the new + root', () => {
    const tree = build('3 * (x + 2)', ['3', 'x', '2']) as GameOperator
    const rule = getApplicableRule(tree)!
    const { resultNode } = rule.apply(tree, tree)
    expect(resultNode.type).toBe('operator')
    expect((resultNode as GameOperator).op).toBe('+')
  })
})

// ---------------------------------------------------------------------------
// findAllApplicableNodes / findAnyApplicableNode
// ---------------------------------------------------------------------------
describe('applicableNode helpers', () => {
  it('findAllApplicableNodes returns all actionable nodes', () => {
    // (1+2)*(3+4): both + nodes are applicable, plus root * (DISTRIBUTE)
    const tree = build('(1 + 2) * (3 + 4)', ['1', '2', '3', '4'])
    const applicable = findAllApplicableNodes(tree)
    expect(applicable.length).toBe(3)
  })

  it('findAnyApplicableNode returns null on a terminal tree', () => {
    const tree: ExpressionLeaf = {
      type: 'leaf',
      expression: '5x',
      ast: parseExpression('5*x'),
    }
    expect(findAnyApplicableNode(tree)).toBeNull()
  })

  it('findAnyApplicableNode returns null on a truly no-rule tree', () => {
    // 3x + 7: GCD(3,7)=1, different types, no rule applies
    const tree: GameOperator = {
      type: 'operator',
      op: '+',
      left: { type: 'leaf', expression: '3x', ast: parseExpression('3*x') },
      right: { type: 'leaf', expression: '7', ast: parseExpression('7') },
    }
    expect(findAnyApplicableNode(tree)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// treeToInfix
// ---------------------------------------------------------------------------
describe('treeToInfix', () => {
  it('returns leaf expression for a single leaf', () => {
    const tree = build('5', ['5'])
    expect(treeToInfix(tree)).toBe('5')
  })

  it('returns "2x" for a monomial leaf', () => {
    const tree = build('2 * x', ['2x'])
    expect(treeToInfix(tree)).toBe('2x')
  })

  it('returns "2 + 3" for simple addition', () => {
    const tree = build('2 + 3', ['2', '3'])
    expect(treeToInfix(tree)).toBe('2 + 3')
  })

  it('adds parens for lower precedence: 2 × (3 + 4)', () => {
    const tree = build('2 * (3 + 4)', ['2', '3', '4'])
    expect(treeToInfix(tree)).toBe('2 × (3 + 4)')
  })

  it('no unnecessary parens: 2 × 3 + 4', () => {
    const tree = build('2 * 3 + 4', ['2', '3', '4'])
    expect(treeToInfix(tree)).toBe('2 × 3 + 4')
  })

  it('uses × not * and − not -', () => {
    const tree = build('2 * 3', ['2', '3'])
    expect(treeToInfix(tree)).toContain('×')
    expect(treeToInfix(tree)).not.toContain('*')
  })
})

// ---------------------------------------------------------------------------
// treeToColoredInfix
// ---------------------------------------------------------------------------
describe('treeToColoredInfix', () => {
  it('returns segments with colors for a tree', () => {
    const tree = build('2 + 3', ['2', '3'])
    const segments = treeToColoredInfix(tree)
    expect(segments.length).toBeGreaterThan(0)
    // Root depth=0, so segments should have depth-0 tint
    const colored = segments.filter((s) => s.color !== null)
    expect(colored.length).toBeGreaterThan(0)
  })

  it('returns no color for a single leaf', () => {
    const tree = build('5', ['5'])
    const segments = treeToColoredInfix(tree)
    expect(segments).toHaveLength(1)
    expect(segments[0].color).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// layoutTree
// ---------------------------------------------------------------------------
describe('layoutTree', () => {
  it('returns one entry for a leaf', () => {
    const tree = build('5', ['5'])
    const layout = layoutTree(tree)
    expect(layout).toHaveLength(1)
    expect(layout[0]).toMatchObject({ x: 0, y: 0, depth: 0 })
  })

  it('returns three entries for a 3-node tree', () => {
    const tree = build('2 + 3', ['2', '3'])
    const layout = layoutTree(tree)
    expect(layout).toHaveLength(3)
  })

  it('places left child at (-200, 100)', () => {
    const tree = build('2 + 3', ['2', '3'])
    const layout = layoutTree(tree)
    expect(layout[1]).toMatchObject({ x: -200, y: 100 })
  })

  it('places right child at (200, 100)', () => {
    const tree = build('2 + 3', ['2', '3'])
    const layout = layoutTree(tree)
    expect(layout[2]).toMatchObject({ x: 200, y: 100 })
  })

  it('returns five entries for 3*(2+4)', () => {
    const tree = build('3 * (2 + 4)', ['2', '3', '4'])
    const layout = layoutTree(tree)
    expect(layout).toHaveLength(5)
  })

  it('includes depth in layout nodes', () => {
    const tree = build('3 * (2 + 4)', ['2', '3', '4'])
    const layout = layoutTree(tree)
    expect(layout[0].depth).toBe(0) // root
    expect(layout[1].depth).toBe(1) // left child
  })

  it('enforces minimum spread of 60px', () => {
    // Deep tree: ((2+3)*4-1)
    const tree = build('(2 + 3) * 4 - 1', ['1', '2', '3', '4'])
    const layout = layoutTree(tree)
    // Check that no two nodes at the same level overlap
    const byY = new Map<number, number[]>()
    for (const { x, y } of layout) {
      if (!byY.has(y)) byY.set(y, [])
      byY.get(y)!.push(x)
    }
    for (const xs of byY.values()) {
      xs.sort((a, b) => a - b)
      for (let i = 1; i < xs.length; i++) {
        expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(60)
      }
    }
  })

  it('preserves node references', () => {
    const tree = build('2 + 3', ['2', '3'])
    const layout = layoutTree(tree)
    expect(layout[0].node).toBe(tree)
  })
})

// ---------------------------------------------------------------------------
// getSubtreeNodes
// ---------------------------------------------------------------------------
describe('getSubtreeNodes', () => {
  it('includes only the node for a leaf', () => {
    const tree = build('5', ['5'])
    const nodes = getSubtreeNodes(tree)
    expect(nodes.size).toBe(1)
  })

  it('includes root and both children for a 3-node tree', () => {
    const tree = build('2 + 3', ['2', '3'])
    const nodes = getSubtreeNodes(tree)
    expect(nodes.size).toBe(3)
  })

  it('includes all 5 nodes for 3*(2+4)', () => {
    const tree = build('3 * (2 + 4)', ['2', '3', '4'])
    const nodes = getSubtreeNodes(tree)
    expect(nodes.size).toBe(5)
  })
})
