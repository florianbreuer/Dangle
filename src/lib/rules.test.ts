import { describe, it, expect } from 'vitest'
import type { GameNode, GameOperator, ExpressionLeaf } from './treeOps'
import { parseExpression, mathToGameTree, treeToInfix } from './treeOps'
import {
  getApplicableRule,
  getAllApplicableRules,
  findAllApplicableNodes,
  findAnyApplicableNode,
  canonicalize,
  canonicalEqual,
  treesEqual,
  canUnpack,
  unpackLeaf,
  cloneGameNode,
  extractCoefficient,
  isNumericLeaf,
} from './rules'

function build(expr: string, atoms: string[]): GameNode {
  return mathToGameTree(parseExpression(expr), atoms)
}

// ---------------------------------------------------------------------------
// RIGHT_DISTRIBUTE rule
// ---------------------------------------------------------------------------
describe('RIGHT_DISTRIBUTE rule', () => {
  it('distributes (x+2)*3 into +(x*3, 2*3)', () => {
    const tree = build('(x + 2) * 3', ['x', '2', '3']) as GameOperator
    const rules = getAllApplicableRules(tree)
    const dist = rules.find(r => r.name === 'Distribute (right)')
    expect(dist).toBeDefined()
    const { newTree } = dist!.apply(tree, tree)
    const root = newTree as GameOperator
    expect(root.op).toBe('+')
    expect((root.left as GameOperator).op).toBe('*')
    expect((root.right as GameOperator).op).toBe('*')
  })

  it('does not apply when left is a leaf', () => {
    const tree = build('3 * (x + 2)', ['3', 'x', '2']) as GameOperator
    const rules = getAllApplicableRules(tree)
    const dist = rules.find(r => r.name === 'Distribute (right)')
    expect(dist).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// COMMUTE rule
// ---------------------------------------------------------------------------
describe('COMMUTE rule', () => {
  it('swaps 3 + 5 to 5 + 3', () => {
    const tree = build('3 + 5', ['3', '5']) as GameOperator
    const rules = getAllApplicableRules(tree, ['Commute', 'Order of Operations'])
    const commute = rules.find(r => r.name === 'Commute')
    expect(commute).toBeDefined()
    const { newTree } = commute!.apply(tree, tree)
    const root = newTree as GameOperator
    expect((root.left as ExpressionLeaf).expression).toBe('5')
    expect((root.right as ExpressionLeaf).expression).toBe('3')
  })

  it('swaps 2 * x to x * 2', () => {
    const tree = build('2 * x', ['2', 'x']) as GameOperator
    const rules = getAllApplicableRules(tree, ['Commute', 'Simplify'])
    const commute = rules.find(r => r.name === 'Commute')
    expect(commute).toBeDefined()
    const { newTree } = commute!.apply(tree, tree)
    const root = newTree as GameOperator
    expect((root.left as ExpressionLeaf).expression).toBe('x')
    expect((root.right as ExpressionLeaf).expression).toBe('2')
  })

  it('does not apply to subtraction', () => {
    const tree = build('5 - 3', ['5', '3']) as GameOperator
    const rules = getAllApplicableRules(tree, ['Commute'])
    expect(rules).toHaveLength(0)
  })

  it('is excluded by default enabledRules', () => {
    const tree = build('3 + 5', ['3', '5']) as GameOperator
    const rules = getAllApplicableRules(tree)
    const commute = rules.find(r => r.name === 'Commute')
    expect(commute).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// ASSOCIATE rules
// ---------------------------------------------------------------------------
describe('ASSOCIATE rules', () => {
  it('ASSOCIATE_LEFT: (2+3)+4 → 2+(3+4)', () => {
    const tree = build('(2 + 3) + 4', ['2', '3', '4']) as GameOperator
    const rules = getAllApplicableRules(tree, ['Associate Left', 'Order of Operations'])
    const assocL = rules.find(r => r.name === 'Associate Left')
    expect(assocL).toBeDefined()
    const { newTree } = assocL!.apply(tree, tree)
    const root = newTree as GameOperator
    expect(root.op).toBe('+')
    expect(root.left.type).toBe('leaf')
    expect((root.left as ExpressionLeaf).expression).toBe('2')
    expect(root.right.type).toBe('operator')
    expect((root.right as GameOperator).op).toBe('+')
  })

  it('ASSOCIATE_RIGHT: 2+(3+4) → (2+3)+4', () => {
    const tree = build('2 + (3 + 4)', ['2', '3', '4']) as GameOperator
    const rules = getAllApplicableRules(tree, ['Associate Right', 'Order of Operations'])
    const assocR = rules.find(r => r.name === 'Associate Right')
    expect(assocR).toBeDefined()
    const { newTree } = assocR!.apply(tree, tree)
    const root = newTree as GameOperator
    expect(root.op).toBe('+')
    expect(root.left.type).toBe('operator')
    expect(root.right.type).toBe('leaf')
    expect((root.right as ExpressionLeaf).expression).toBe('4')
  })

  it('does not apply to mixed operators: (2+3)*4', () => {
    const tree = build('(2 + 3) * 4', ['2', '3', '4']) as GameOperator
    const rules = getAllApplicableRules(tree, ['Associate Left'])
    expect(rules).toHaveLength(0)
  })

  it('associates are excluded by default', () => {
    const tree = build('(2 + 3) + 4', ['2', '3', '4']) as GameOperator
    const rules = getAllApplicableRules(tree)
    const assoc = rules.find(r => r.name === 'Associate Left')
    expect(assoc).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// FACTOR rule
// ---------------------------------------------------------------------------
describe('FACTOR rule', () => {
  it('factors 6x + 12 into 6*(x + 2)', () => {
    const tree = build('6 * x + 12', ['6x', '12']) as GameOperator
    const rule = getApplicableRule(tree)
    expect(rule).not.toBeNull()
    expect(rule!.name).toBe('Factor')
    const { newTree } = rule!.apply(tree, tree)
    const root = newTree as GameOperator
    expect(root.op).toBe('*')
    expect((root.left as ExpressionLeaf).expression).toBe('6')
    expect(root.right.type).toBe('operator')
    expect((root.right as GameOperator).op).toBe('+')
  })

  it('factors 4x + 8 pulling out 4', () => {
    const tree = build('4 * x + 8', ['4x', '8']) as GameOperator
    const rule = getApplicableRule(tree)
    expect(rule!.name).toBe('Factor')
    const { newTree } = rule!.apply(tree, tree)
    const root = newTree as GameOperator
    expect((root.left as ExpressionLeaf).expression).toBe('4')
  })

  it('does not factor when GCD is 1', () => {
    const tree: GameOperator = {
      type: 'operator',
      op: '+',
      left: { type: 'leaf', expression: '3x', ast: parseExpression('3*x') },
      right: { type: 'leaf', expression: '7', ast: parseExpression('7') },
    }
    const rule = getApplicableRule(tree)
    // GCD(3,7) = 1, so FACTOR should not apply
    expect(rule === null || rule.name !== 'Factor').toBe(true)
  })

  it('prefers COMBINE over FACTOR for like terms (6x + 4x)', () => {
    const tree: GameOperator = {
      type: 'operator',
      op: '+',
      left: { type: 'leaf', expression: '6x', ast: parseExpression('6*x') },
      right: { type: 'leaf', expression: '4x', ast: parseExpression('4*x') },
    }
    const rule = getApplicableRule(tree)
    expect(rule).not.toBeNull()
    expect(rule!.name).toBe('Collect Like Terms')
  })

  it('label shows the GCD', () => {
    const tree = build('6 * x + 12', ['6x', '12']) as GameOperator
    const rule = getApplicableRule(tree)!
    expect(rule.label(tree)).toContain('6')
  })
})

// ---------------------------------------------------------------------------
// enabledRules filtering
// ---------------------------------------------------------------------------
describe('enabledRules filtering', () => {
  it('findAllApplicableNodes respects enabledRules', () => {
    // (2+3)+4 with only Associate Left enabled
    const tree = build('(2 + 3) + 4', ['2', '3', '4'])
    const all = findAllApplicableNodes(tree, ['Associate Left'])
    // Only root should match (inner 2+3 has no Associate Left since left isn't an operator with same op)
    expect(all.length).toBe(1)
  })

  it('findAnyApplicableNode respects enabledRules', () => {
    const tree = build('3 + 5', ['3', '5'])
    // With only Commute enabled, should find root
    expect(findAnyApplicableNode(tree, ['Commute'])).not.toBeNull()
    // With nothing enabled, should find nothing
    expect(findAnyApplicableNode(tree, [])).toBeNull()
  })

  it('findAnyApplicableNode returns null when only structural rules are enabled on terminal tree', () => {
    const leaf: ExpressionLeaf = {
      type: 'leaf',
      expression: '5x',
      ast: parseExpression('5*x'),
    }
    expect(findAnyApplicableNode(leaf, ['Commute'])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Canonicalize + canonical equality
// ---------------------------------------------------------------------------
describe('canonicalize', () => {
  it('sorts commutative children: 5+3 → 3+5 (constants by value)', () => {
    const tree = build('5 + 3', ['5', '3'])
    const canon = canonicalize(tree)
    expect(canon.type).toBe('operator')
    const root = canon as GameOperator
    expect((root.left as ExpressionLeaf).expression).toBe('3')
    expect((root.right as ExpressionLeaf).expression).toBe('5')
  })

  it('does not swap non-commutative: 5-3 stays 5-3', () => {
    const tree = build('5 - 3', ['5', '3'])
    const canon = canonicalize(tree)
    const root = canon as GameOperator
    expect((root.left as ExpressionLeaf).expression).toBe('5')
    expect((root.right as ExpressionLeaf).expression).toBe('3')
  })

  it('canonicalizes bottom-up', () => {
    // (5+3)+(2+1) should canonicalize to (3+5)+(1+2), then swap outer: (1+2)+(3+5)
    const tree = build('(5 + 3) + (2 + 1)', ['1', '2', '3', '5'])
    const canon = canonicalize(tree) as GameOperator
    // Inner nodes should be sorted, outer should be sorted
    const left = canon.left as GameOperator
    const right = canon.right as GameOperator
    // The left subtree should have smaller sort key
    const leftInfix = treeToInfix(left)
    const rightInfix = treeToInfix(right)
    expect(leftInfix <= rightInfix).toBe(true)
  })

  it('treesEqual works for identical trees', () => {
    const tree = build('2 + 3', ['2', '3'])
    expect(treesEqual(tree, tree)).toBe(true)
  })

  it('treesEqual returns false for different trees', () => {
    const a = build('2 + 3', ['2', '3'])
    const b = build('3 + 2', ['3', '2'])
    expect(treesEqual(a, b)).toBe(false)
  })

  it('canonicalEqual returns true for commuted trees', () => {
    const a = build('2 + 3', ['2', '3'])
    const b = build('3 + 2', ['3', '2'])
    expect(canonicalEqual(a, b)).toBe(true)
  })

  it('canonicalEqual returns false for genuinely different trees', () => {
    const a = build('2 + 3', ['2', '3'])
    const b = build('2 + 4', ['2', '4'])
    expect(canonicalEqual(a, b)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// UNPACK
// ---------------------------------------------------------------------------
describe('UNPACK', () => {
  it('canUnpack returns true for packed monomial leaf', () => {
    const tree = build('2 * x', ['2x']) as ExpressionLeaf
    expect(canUnpack(tree)).toBe(true)
  })

  it('canUnpack returns false for simple constant leaf', () => {
    const tree = build('5', ['5']) as ExpressionLeaf
    expect(canUnpack(tree)).toBe(false)
  })

  it('canUnpack returns false for simple symbol leaf', () => {
    const tree = build('x', ['x']) as ExpressionLeaf
    expect(canUnpack(tree)).toBe(false)
  })

  it('unpackLeaf expands 2x into *(2, x)', () => {
    const tree = build('2 * x', ['2x']) as ExpressionLeaf
    const { resultNode } = unpackLeaf(tree, tree)
    expect(resultNode.type).toBe('operator')
    const op = resultNode as GameOperator
    expect(op.op).toBe('*')
    expect((op.left as ExpressionLeaf).expression).toBe('2')
    expect((op.right as ExpressionLeaf).expression).toBe('x')
  })

  it('unpackLeaf works on a nested tree', () => {
    // 2x + 3x: root is +, both children are packed leaves
    const tree = build('2 * x + 3 * x', ['2x', '3x'])
    const root = tree as GameOperator
    const leftLeaf = root.left as ExpressionLeaf
    expect(canUnpack(leftLeaf)).toBe(true)
    const { newTree } = unpackLeaf(tree, leftLeaf)
    const newRoot = newTree as GameOperator
    expect(newRoot.left.type).toBe('operator')
    expect((newRoot.left as GameOperator).op).toBe('*')
  })
})

// ---------------------------------------------------------------------------
// cloneGameNode
// ---------------------------------------------------------------------------
describe('cloneGameNode', () => {
  it('produces a deep copy of a leaf', () => {
    const leaf: ExpressionLeaf = { type: 'leaf', expression: '5', ast: parseExpression('5') }
    const clone = cloneGameNode(leaf)
    expect(clone).not.toBe(leaf)
    expect((clone as ExpressionLeaf).expression).toBe('5')
  })

  it('produces a deep copy of a tree', () => {
    const tree = build('2 + 3', ['2', '3'])
    const clone = cloneGameNode(tree)
    expect(clone).not.toBe(tree)
    expect(clone.type).toBe('operator')
    expect((clone as GameOperator).left).not.toBe((tree as GameOperator).left)
  })
})

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------
describe('extractCoefficient', () => {
  it('extracts from bare variable x → coeff=1, var=x', () => {
    const leaf: ExpressionLeaf = { type: 'leaf', expression: 'x', ast: parseExpression('x') }
    const result = extractCoefficient(leaf)
    expect(result).toEqual({ coeff: 1, variable: 'x' })
  })

  it('extracts from 3x → coeff=3, var=x', () => {
    const leaf: ExpressionLeaf = { type: 'leaf', expression: '3x', ast: parseExpression('3*x') }
    const result = extractCoefficient(leaf)
    expect(result).toEqual({ coeff: 3, variable: 'x' })
  })

  it('returns null for pure constant', () => {
    const leaf: ExpressionLeaf = { type: 'leaf', expression: '5', ast: parseExpression('5') }
    expect(extractCoefficient(leaf)).toBeNull()
  })
})

describe('isNumericLeaf', () => {
  it('returns true for constant', () => {
    const leaf: ExpressionLeaf = { type: 'leaf', expression: '5', ast: parseExpression('5') }
    expect(isNumericLeaf(leaf)).toBe(true)
  })

  it('returns false for variable', () => {
    const leaf: ExpressionLeaf = { type: 'leaf', expression: 'x', ast: parseExpression('x') }
    expect(isNumericLeaf(leaf)).toBe(false)
  })
})
