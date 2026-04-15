/**
 * Dangle v3 — Algebraic rule registry
 *
 * Rule interface, all rules (EVALUATE, SIMPLIFY_TERM, COMBINE, DISTRIBUTE,
 * RIGHT_DISTRIBUTE, COMMUTE, ASSOCIATE_LEFT, ASSOCIATE_RIGHT, FACTOR),
 * dispatch functions, and tree helpers.
 */

import * as math from 'mathjs'
import type { MathNode, OperatorNode, ConstantNode, SymbolNode } from 'mathjs'
import type { GameNode, GameOperator, ExpressionLeaf } from './treeOps'
import { treeToInfix } from './treeOps'

// ─── Tree helpers ────────────────────────────────────────────────

/** Immutable replace: find target node in tree by reference, replace with replacement */
export function replaceNode(tree: GameNode, target: GameNode, replacement: GameNode): GameNode {
  if (tree === target) return replacement
  if (tree.type === 'leaf') return tree
  return {
    type: 'operator',
    op: tree.op,
    left: replaceNode(tree.left, target, replacement),
    right: replaceNode(tree.right, target, replacement),
  }
}

export function cloneGameNode(node: GameNode): GameNode {
  if (node.type === 'leaf') {
    return { type: 'leaf', expression: node.expression, ast: node.ast }
  }
  return {
    type: 'operator',
    op: node.op,
    left: cloneGameNode(node.left),
    right: cloneGameNode(node.right),
  }
}

function evalArithmetic(op: string, a: number, b: number): number {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/': return b === 0 ? NaN : a / b
    default: return NaN
  }
}

// ─── Coefficient extraction ───────────────────────────────────────

interface CoefficientResult {
  coeff: number
  variable: string
}

/** Extract coefficient and variable from an ExpressionLeaf's AST.
 *  Returns null if the leaf is purely numeric or unrecognizable. */
export function extractCoefficient(leaf: ExpressionLeaf): CoefficientResult | null {
  const ast = leaf.ast

  // Bare variable: "x" → coeff=1, var=x
  if (ast.type === 'SymbolNode') {
    return { coeff: 1, variable: (ast as SymbolNode).name }
  }

  // Product: "5 * x" → coeff=5, var=x
  if (ast.type === 'OperatorNode') {
    const op = ast as OperatorNode
    if (op.op === '*' && op.args.length === 2) {
      const [left, right] = op.args
      if (left.type === 'ConstantNode' && right.type === 'SymbolNode') {
        return {
          coeff: (left as ConstantNode).value as number,
          variable: (right as SymbolNode).name,
        }
      }
      if (left.type === 'SymbolNode' && right.type === 'ConstantNode') {
        return {
          coeff: (right as ConstantNode).value as number,
          variable: (left as SymbolNode).name,
        }
      }
    }
  }

  // Purely numeric or unrecognized
  return null
}

/** Check if an ExpressionLeaf contains a purely numeric expression */
export function isNumericLeaf(leaf: ExpressionLeaf): boolean {
  return leaf.ast.type === 'ConstantNode'
}

/** Extract the numeric coefficient from a leaf for FACTOR rule.
 *  Handles both pure constants (6 → coeff=6, remainder=null)
 *  and variable terms (3x → coeff=3, remainder=SymbolNode(x)). */
interface TermCoefficient {
  coeff: number
  remainder: MathNode | null
}

function getTermCoefficient(leaf: ExpressionLeaf): TermCoefficient | null {
  const ast = leaf.ast

  // Pure constant: 6 → coeff=6, no remainder
  if (ast.type === 'ConstantNode') {
    return { coeff: (ast as ConstantNode).value as number, remainder: null }
  }

  // Bare variable: x → coeff=1, remainder=x
  if (ast.type === 'SymbolNode') {
    return { coeff: 1, remainder: ast }
  }

  // Product: 3*x → coeff=3, remainder=x
  if (ast.type === 'OperatorNode') {
    const op = ast as OperatorNode
    if (op.op === '*' && op.args.length === 2) {
      const [left, right] = op.args
      if (left.type === 'ConstantNode') {
        return { coeff: (left as ConstantNode).value as number, remainder: right }
      }
      if (right.type === 'ConstantNode') {
        return { coeff: (right as ConstantNode).value as number, remainder: left }
      }
    }
  }

  return null
}

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a
}

// ─── Rule registry ────────────────────────────────────────────────

export interface Rule {
  name: string
  canApply(node: GameOperator): boolean
  apply(tree: GameNode, node: GameOperator): { newTree: GameNode; resultNode: GameNode }
  label(node: GameOperator): string
}

// ─── EVALUATE ─────────────────────────────────────────────────────

const EVALUATE_RULE: Rule = {
  name: 'Order of Operations',
  canApply(node) {
    return (
      node.left.type === 'leaf' &&
      node.right.type === 'leaf' &&
      isNumericLeaf(node.left) &&
      isNumericLeaf(node.right)
    )
  },
  apply(tree, node) {
    const a = (node.left as ExpressionLeaf).ast as ConstantNode
    const b = (node.right as ExpressionLeaf).ast as ConstantNode
    const result = evalArithmetic(node.op, a.value as number, b.value as number)
    const resultNode: ExpressionLeaf = {
      type: 'leaf',
      expression: String(result),
      ast: new math.ConstantNode(result),
    }
    return { newTree: replaceNode(tree, node, resultNode), resultNode }
  },
  label(node) {
    const opSymbol = node.op === '*' ? '×' : node.op
    return `Order of Operations: ${(node.left as ExpressionLeaf).expression} ${opSymbol} ${(node.right as ExpressionLeaf).expression}`
  },
}

// ─── SIMPLIFY_TERM ────────────────────────────────────────────────

function unwrapParens(node: MathNode): MathNode {
  return node.transform((n) => {
    if (n.type === 'ParenthesisNode') {
      return unwrapParens((n as unknown as { content: MathNode }).content)
    }
    return n
  })
}

const SIMPLIFY_TERM_RULE: Rule = {
  name: 'Simplify',
  canApply(node) {
    if (node.op !== '*') return false
    if (node.left.type !== 'leaf' || node.right.type !== 'leaf') return false
    const leftNum = isNumericLeaf(node.left)
    const rightNum = isNumericLeaf(node.right)
    if (leftNum && rightNum) return false
    const leftCoeff = !leftNum ? extractCoefficient(node.left) : null
    const rightCoeff = !rightNum ? extractCoefficient(node.right) : null
    return (leftNum && rightCoeff !== null) ||
           (rightNum && leftCoeff !== null) ||
           (leftNum && node.right.ast.type === 'SymbolNode') ||
           (rightNum && node.left.ast.type === 'SymbolNode')
  },
  apply(tree, node) {
    const left = node.left as ExpressionLeaf
    const right = node.right as ExpressionLeaf
    const leftNum = isNumericLeaf(left)

    let coeff: number
    let variable: string

    if (leftNum) {
      coeff = (left.ast as ConstantNode).value as number
      const extracted = extractCoefficient(right)
      if (extracted) {
        coeff *= extracted.coeff
        variable = extracted.variable
      } else {
        variable = (right.ast as SymbolNode).name
      }
    } else {
      coeff = (right.ast as ConstantNode).value as number
      const extracted = extractCoefficient(left)
      if (extracted) {
        coeff *= extracted.coeff
        variable = extracted.variable
      } else {
        variable = (left.ast as SymbolNode).name
      }
    }

    const expression = coeff === 1 ? variable : `${coeff}${variable}`
    const ast = coeff === 1
      ? math.parse(variable)
      : unwrapParens(math.parse(`${coeff} * ${variable}`))

    const resultNode: ExpressionLeaf = { type: 'leaf', expression, ast }
    return { newTree: replaceNode(tree, node, resultNode), resultNode }
  },
  label(node) {
    return `Simplify: ${(node.left as ExpressionLeaf).expression} × ${(node.right as ExpressionLeaf).expression}`
  },
}

// ─── COMBINE ──────────────────────────────────────────────────────

const COMBINE_RULE: Rule = {
  name: 'Collect Like Terms',
  canApply(node) {
    if (node.op !== '+') return false
    if (node.left.type !== 'leaf' || node.right.type !== 'leaf') return false
    const leftCoeff = extractCoefficient(node.left)
    const rightCoeff = extractCoefficient(node.right)
    if (!leftCoeff || !rightCoeff) return false
    if (leftCoeff.variable !== rightCoeff.variable) return false
    if (leftCoeff.coeff + rightCoeff.coeff < 0) return false
    return true
  },
  apply(tree, node) {
    const leftCoeff = extractCoefficient(node.left as ExpressionLeaf)!
    const rightCoeff = extractCoefficient(node.right as ExpressionLeaf)!
    const newCoeff = leftCoeff.coeff + rightCoeff.coeff
    const variable = leftCoeff.variable
    const expression = newCoeff === 1 ? variable : newCoeff === 0 ? '0' : `${newCoeff}${variable}`
    const ast = newCoeff === 0
      ? new math.ConstantNode(0)
      : newCoeff === 1
        ? math.parse(variable)
        : unwrapParens(math.parse(`${newCoeff} * ${variable}`))

    const resultNode: ExpressionLeaf = { type: 'leaf', expression, ast }
    return { newTree: replaceNode(tree, node, resultNode), resultNode }
  },
  label(node) {
    return `Collect Like Terms: ${(node.left as ExpressionLeaf).expression} + ${(node.right as ExpressionLeaf).expression}`
  },
}

// ─── DISTRIBUTE (left: a*(b+c)) ──────────────────────────────────

const DISTRIBUTE_RULE: Rule = {
  name: 'Distribute',
  canApply(node) {
    if (node.op !== '*') return false
    if (node.right.type !== 'operator') return false
    const rightOp = node.right as GameOperator
    if (rightOp.op !== '+' && rightOp.op !== '-') return false
    return true
  },
  apply(tree, node) {
    const a = node.left
    const rightOp = node.right as GameOperator
    const b = rightOp.left
    const c = rightOp.right
    const aClone = cloneGameNode(a)

    const expanded: GameOperator = {
      type: 'operator',
      op: rightOp.op,
      left: { type: 'operator', op: '*', left: a, right: b },
      right: { type: 'operator', op: '*', left: aClone, right: c },
    }
    return { newTree: replaceNode(tree, node, expanded), resultNode: expanded }
  },
  label(node) {
    const leftExpr = node.left.type === 'leaf' ? (node.left as ExpressionLeaf).expression : '...'
    const rightInfix = treeToInfix(node.right)
    return `Distribute: ${leftExpr} × (${rightInfix})`
  },
}

// ─── RIGHT DISTRIBUTE ((b+c)*a) ──────────────────────────────────

const RIGHT_DISTRIBUTE_RULE: Rule = {
  name: 'Distribute (right)',
  canApply(node) {
    if (node.op !== '*') return false
    if (node.left.type !== 'operator') return false
    const leftOp = node.left as GameOperator
    if (leftOp.op !== '+' && leftOp.op !== '-') return false
    return true
  },
  apply(tree, node) {
    const leftOp = node.left as GameOperator
    const b = leftOp.left
    const c = leftOp.right
    const a = node.right
    const aClone = cloneGameNode(a)

    const expanded: GameOperator = {
      type: 'operator',
      op: leftOp.op,
      left: { type: 'operator', op: '*', left: b, right: a },
      right: { type: 'operator', op: '*', left: c, right: aClone },
    }
    return { newTree: replaceNode(tree, node, expanded), resultNode: expanded }
  },
  label(node) {
    const leftInfix = treeToInfix(node.left)
    const rightExpr = node.right.type === 'leaf' ? (node.right as ExpressionLeaf).expression : '...'
    return `Distribute: (${leftInfix}) × ${rightExpr}`
  },
}

// ─── COMMUTE ──────────────────────────────────────────────────────

const COMMUTE_RULE: Rule = {
  name: 'Commute',
  canApply(node) {
    return node.op === '+' || node.op === '*'
  },
  apply(tree, node) {
    const swapped: GameOperator = {
      type: 'operator',
      op: node.op,
      left: node.right,
      right: node.left,
    }
    return { newTree: replaceNode(tree, node, swapped), resultNode: swapped }
  },
  label(node) {
    const leftInfix = node.left.type === 'leaf' ? (node.left as ExpressionLeaf).expression : treeToInfix(node.left)
    const rightInfix = node.right.type === 'leaf' ? (node.right as ExpressionLeaf).expression : treeToInfix(node.right)
    return `Commute: swap ${leftInfix} ↔ ${rightInfix}`
  },
}

// ─── ASSOCIATE LEFT: (a+b)+c → a+(b+c) ──────────────────────────

const ASSOCIATE_LEFT_RULE: Rule = {
  name: 'Associate Left',
  canApply(node) {
    if (node.op !== '+' && node.op !== '*') return false
    if (node.left.type !== 'operator') return false
    return (node.left as GameOperator).op === node.op
  },
  apply(tree, node) {
    // (a ○ b) ○ c → a ○ (b ○ c)
    const leftOp = node.left as GameOperator
    const a = leftOp.left
    const b = leftOp.right
    const c = node.right

    const newRight: GameOperator = {
      type: 'operator',
      op: node.op,
      left: b,
      right: c,
    }
    const result: GameOperator = {
      type: 'operator',
      op: node.op,
      left: a,
      right: newRight,
    }
    return { newTree: replaceNode(tree, node, result), resultNode: result }
  },
  label(_node) {
    return 'Associate Left: regroup →'
  },
}

// ─── ASSOCIATE RIGHT: a+(b+c) → (a+b)+c ─────────────────────────

const ASSOCIATE_RIGHT_RULE: Rule = {
  name: 'Associate Right',
  canApply(node) {
    if (node.op !== '+' && node.op !== '*') return false
    if (node.right.type !== 'operator') return false
    return (node.right as GameOperator).op === node.op
  },
  apply(tree, node) {
    // a ○ (b ○ c) → (a ○ b) ○ c
    const rightOp = node.right as GameOperator
    const a = node.left
    const b = rightOp.left
    const c = rightOp.right

    const newLeft: GameOperator = {
      type: 'operator',
      op: node.op,
      left: a,
      right: b,
    }
    const result: GameOperator = {
      type: 'operator',
      op: node.op,
      left: newLeft,
      right: c,
    }
    return { newTree: replaceNode(tree, node, result), resultNode: result }
  },
  label(_node) {
    return 'Associate Right: ← regroup'
  },
}

// ─── FACTOR ───────────────────────────────────────────────────────

const FACTOR_RULE: Rule = {
  name: 'Factor',
  canApply(node) {
    if (node.op !== '+') return false
    if (node.left.type !== 'leaf' || node.right.type !== 'leaf') return false

    // Reject like-terms (same variable) — use COMBINE instead
    const leftCoeff = extractCoefficient(node.left as ExpressionLeaf)
    const rightCoeff = extractCoefficient(node.right as ExpressionLeaf)
    if (leftCoeff && rightCoeff && leftCoeff.variable === rightCoeff.variable) return false

    // Need at least one term with a variable and a common integer factor
    const leftTerm = getTermCoefficient(node.left as ExpressionLeaf)
    const rightTerm = getTermCoefficient(node.right as ExpressionLeaf)
    if (!leftTerm || !rightTerm) return false

    const g = gcd(leftTerm.coeff, rightTerm.coeff)
    if (g <= 1) return false

    return true
  },
  apply(tree, node) {
    const leftTerm = getTermCoefficient(node.left as ExpressionLeaf)!
    const rightTerm = getTermCoefficient(node.right as ExpressionLeaf)!
    const g = gcd(leftTerm.coeff, rightTerm.coeff)

    // Build the factored-out left and right terms
    function buildLeaf(coeff: number, remainder: MathNode | null): ExpressionLeaf {
      if (remainder === null) {
        // Pure constant: coeff/g
        const val = coeff / g
        return {
          type: 'leaf',
          expression: String(val),
          ast: new math.ConstantNode(val),
        }
      }
      const newCoeff = coeff / g
      if (newCoeff === 1) {
        // Just the variable
        const name = remainder.type === 'SymbolNode' ? (remainder as SymbolNode).name : remainder.toString()
        return {
          type: 'leaf',
          expression: name,
          ast: remainder,
        }
      }
      const name = remainder.type === 'SymbolNode' ? (remainder as SymbolNode).name : remainder.toString()
      return {
        type: 'leaf',
        expression: `${newCoeff}${name}`,
        ast: unwrapParens(math.parse(`${newCoeff} * ${name}`)),
      }
    }

    const innerLeft = buildLeaf(leftTerm.coeff, leftTerm.remainder)
    const innerRight = buildLeaf(rightTerm.coeff, rightTerm.remainder)

    const factorLeaf: ExpressionLeaf = {
      type: 'leaf',
      expression: String(g),
      ast: new math.ConstantNode(g),
    }

    const innerSum: GameOperator = {
      type: 'operator',
      op: '+',
      left: innerLeft,
      right: innerRight,
    }

    const result: GameOperator = {
      type: 'operator',
      op: '*',
      left: factorLeaf,
      right: innerSum,
    }

    return { newTree: replaceNode(tree, node, result), resultNode: result }
  },
  label(node) {
    const leftTerm = getTermCoefficient(node.left as ExpressionLeaf)
    const rightTerm = getTermCoefficient(node.right as ExpressionLeaf)
    if (leftTerm && rightTerm) {
      const g = gcd(leftTerm.coeff, rightTerm.coeff)
      return `Factor: pull out ${g}`
    }
    return 'Factor'
  },
}

// ─── RULES array (priority order) ────────────────────────────────

export const RULES: Rule[] = [
  EVALUATE_RULE,
  SIMPLIFY_TERM_RULE,
  COMBINE_RULE,
  DISTRIBUTE_RULE,
  RIGHT_DISTRIBUTE_RULE,
  COMMUTE_RULE,
  ASSOCIATE_LEFT_RULE,
  ASSOCIATE_RIGHT_RULE,
  FACTOR_RULE,
]

// Default rules for puzzles that don't specify enabledRules
// COMMUTE, ASSOCIATE, and FACTOR are excluded by default to prevent infinite loops
// (FACTOR + DISTRIBUTE create cycles: distribute then factor undoes the work)
const DEFAULT_ENABLED = RULES
  .filter(r => r !== COMMUTE_RULE && r !== ASSOCIATE_LEFT_RULE && r !== ASSOCIATE_RIGHT_RULE && r !== FACTOR_RULE)
  .map(r => r.name)

export const ALL_RULE_NAMES = RULES.map(r => r.name)

function filterRules(enabledRules?: string[]): Rule[] {
  if (!enabledRules) return RULES.filter(r => DEFAULT_ENABLED.includes(r.name))
  return RULES.filter(r => enabledRules.includes(r.name))
}

// ─── Dispatch functions ──────────────────────────────────────────

export function getAllApplicableRules(node: GameOperator, enabledRules?: string[]): Rule[] {
  const rules = filterRules(enabledRules)
  return rules.filter(r => r.canApply(node))
}

export function getApplicableRule(node: GameNode, enabledRules?: string[]): Rule | null {
  if (node.type !== 'operator') return null
  const rules = filterRules(enabledRules)
  for (const rule of rules) {
    if (rule.canApply(node)) return rule
  }
  return null
}

export function findAllApplicableNodes(tree: GameNode, enabledRules?: string[]): GameOperator[] {
  const results: GameOperator[] = []
  function walk(node: GameNode) {
    if (node.type === 'operator') {
      if (getApplicableRule(node, enabledRules) !== null) results.push(node)
      walk(node.left)
      walk(node.right)
    }
  }
  walk(tree)
  return results
}

export function findAnyApplicableNode(tree: GameNode, enabledRules?: string[]): GameOperator | null {
  if (tree.type === 'operator') {
    if (getApplicableRule(tree, enabledRules) !== null) return tree
    return findAnyApplicableNode(tree.left, enabledRules) ?? findAnyApplicableNode(tree.right, enabledRules)
  }
  return null
}

// ─── UNPACK (special case, not in RULES array) ───────────────────

/** Check if a leaf can be unpacked (has an OperatorNode AST with 2 args) */
export function canUnpack(leaf: ExpressionLeaf): boolean {
  if (leaf.ast.type !== 'OperatorNode') return false
  const op = leaf.ast as OperatorNode
  return op.args.length === 2
}

/** Unpack a leaf one level deeper into an operator + 2 leaf children */
export function unpackLeaf(tree: GameNode, leaf: ExpressionLeaf): { newTree: GameNode; resultNode: GameNode } {
  const op = leaf.ast as OperatorNode
  const leftAst = op.args[0]
  const rightAst = op.args[1]

  function astToExpression(ast: MathNode): string {
    if (ast.type === 'ConstantNode') return String((ast as ConstantNode).value)
    if (ast.type === 'SymbolNode') return (ast as SymbolNode).name
    return ast.toString()
  }

  const leftLeaf: ExpressionLeaf = {
    type: 'leaf',
    expression: astToExpression(leftAst),
    ast: leftAst,
  }
  const rightLeaf: ExpressionLeaf = {
    type: 'leaf',
    expression: astToExpression(rightAst),
    ast: rightAst,
  }

  const result: GameOperator = {
    type: 'operator',
    op: op.op as GameOperator['op'],
    left: leftLeaf,
    right: rightLeaf,
  }

  return { newTree: replaceNode(tree, leaf, result), resultNode: result }
}

// ─── Canonicalize ─────────────────────────────────────────────────

/** Recursively canonicalize a tree for structural comparison.
 *  Bottom-up: canonicalize children first, then sort commutative children. */
export function canonicalize(node: GameNode): GameNode {
  if (node.type === 'leaf') return node

  // Canonicalize children first (bottom-up)
  const left = canonicalize(node.left)
  const right = canonicalize(node.right)

  // Only sort children of commutative operators
  if (node.op === '+' || node.op === '*') {
    const leftKey = canonicalSortKey(left)
    const rightKey = canonicalSortKey(right)
    if (leftKey > rightKey) {
      return { type: 'operator', op: node.op, left: right, right: left }
    }
  }

  return { type: 'operator', op: node.op, left, right }
}

/** Sort key for canonical ordering:
 *  Constants < variables (alpha) < expressions (by infix string)
 *  Leaves sort before operators. */
function canonicalSortKey(node: GameNode): string {
  if (node.type === 'leaf') {
    if (node.ast.type === 'ConstantNode') {
      // Constants sort first, padded for numeric ordering
      const val = (node.ast as ConstantNode).value as number
      return `0_${String(val).padStart(10, '0')}`
    }
    if (node.ast.type === 'SymbolNode') {
      return `1_${(node.ast as SymbolNode).name}`
    }
    return `2_${treeToInfix(node)}`
  }
  return `3_${treeToInfix(node)}`
}

/** Deep structural equality of two GameNode trees */
export function treesEqual(a: GameNode, b: GameNode): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'leaf' && b.type === 'leaf') {
    return a.expression === b.expression
  }
  if (a.type === 'operator' && b.type === 'operator') {
    if (a.op !== b.op) return false
    return treesEqual(a.left, b.left) && treesEqual(a.right, b.right)
  }
  return false
}

/** Check if two trees are equal after canonicalization */
export function canonicalEqual(a: GameNode, b: GameNode): boolean {
  return treesEqual(canonicalize(a), canonicalize(b))
}
