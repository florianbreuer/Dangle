/**
 * Dangle v2 — Core game tree logic
 *
 * Data flow:
 *   puzzles.ts { expression, atoms, lesson }
 *     → math.parse(expression) → MathNode AST
 *     → mathToGameTree(ast, atoms) → GameNode tree
 *     → App.tsx state: { tree: GameNode, selectedNode, evaluatedNode }
 *
 *   User click → getApplicableRule(node) → Rule | null
 *     → rule.apply(tree, node) → { newTree, resultNode }
 *     → findAnyApplicableNode(newTree) === null → puzzle complete
 */

import * as math from 'mathjs'
import type { MathNode, OperatorNode, ConstantNode, SymbolNode } from 'mathjs'

// ─── GameNode types ───────────────────────────────────────────────

export interface ExpressionLeaf {
  type: 'leaf'
  expression: string
  ast: MathNode
}

export interface GameOperator {
  type: 'operator'
  op: '+' | '-' | '*' | '/'
  left: GameNode
  right: GameNode
}

export type GameNode = ExpressionLeaf | GameOperator

// ─── Parsing helpers ──────────────────────────────────────────────

function unwrapParens(node: MathNode): MathNode {
  return node.transform((n) => {
    if (n.type === 'ParenthesisNode') {
      return unwrapParens((n as unknown as { content: MathNode }).content)
    }
    return n
  })
}

export function parseExpression(expr: string): MathNode {
  return unwrapParens(math.parse(expr))
}

// ─── mathToGameTree ───────────────────────────────────────────────

/** Check structural AST equality (ignoring whitespace in source) */
function astStructureEqual(a: MathNode, b: MathNode): boolean {
  if (a.type !== b.type) return false

  if (a.type === 'ConstantNode') {
    return (a as ConstantNode).value === (b as ConstantNode).value
  }
  if (a.type === 'SymbolNode') {
    return (a as SymbolNode).name === (b as SymbolNode).name
  }
  if (a.type === 'OperatorNode') {
    const aOp = a as OperatorNode
    const bOp = b as OperatorNode
    if (aOp.op !== bOp.op) return false
    if (aOp.args.length !== bOp.args.length) return false
    return aOp.args.every((arg, i) => astStructureEqual(arg, bOp.args[i]))
  }
  return false
}

/** Convert a math.js AST to a GameNode tree, packing subtrees that match atoms */
export function mathToGameTree(ast: MathNode, atoms: string[]): GameNode {
  const parsedAtoms = atoms.map((a) => ({
    text: a,
    ast: unwrapParens(math.parse(a)),
  }))

  function convert(node: MathNode): GameNode {
    // Check if this subtree matches any atom
    for (const atom of parsedAtoms) {
      if (astStructureEqual(node, atom.ast)) {
        return {
          type: 'leaf',
          expression: atom.text,
          ast: node,
        }
      }
    }

    // If it's an operator, recurse
    if (node.type === 'OperatorNode') {
      const op = node as OperatorNode
      if (op.args.length === 2) {
        return {
          type: 'operator',
          op: op.op as GameOperator['op'],
          left: convert(op.args[0]),
          right: convert(op.args[1]),
        }
      }
    }

    // Fallback: wrap as a leaf (handles ConstantNode, SymbolNode, etc.)
    const expr =
      node.type === 'ConstantNode'
        ? String((node as ConstantNode).value)
        : node.type === 'SymbolNode'
          ? (node as SymbolNode).name
          : node.toString()
    return { type: 'leaf', expression: expr, ast: node }
  }

  const result = convert(ast)

  // Dev-time assertion: warn if no atoms matched (puzzle authoring error)
  if (parsedAtoms.length > 0) {
    let hasLeaf = false
    function checkLeaves(n: GameNode) {
      if (n.type === 'leaf') { hasLeaf = true; return }
      checkLeaves(n.left)
      checkLeaves(n.right)
    }
    checkLeaves(result)
    if (!hasLeaf) {
      console.error(
        `[Dangle] mathToGameTree: no atoms matched for expression. Atoms: ${JSON.stringify(atoms)}`
      )
    }
  }

  return result
}

// ─── Infix rendering ──────────────────────────────────────────────

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }

/** Returns kid-friendly infix string from a GameNode tree */
export function treeToInfix(node: GameNode, parentPrec = 0): string {
  if (node.type === 'leaf') return node.expression

  const prec = PRECEDENCE[node.op] ?? 0
  const opSymbol = node.op === '*' ? '×' : node.op === '-' ? '−' : node.op
  const left = treeToInfix(node.left, prec)
  const right = treeToInfix(node.right, prec)
  const expr = `${left} ${opSymbol} ${right}`

  return prec < parentPrec ? `(${expr})` : expr
}

export interface ColoredSegment {
  text: string
  color: string | null
}

const DEPTH_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6']
const DEPTH_TINTS = ['#dbeafe', '#fef3c7', '#d1fae5', '#ede9fe']

export function getDepthColor(depth: number): string {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length]
}

export function getDepthTint(depth: number): string {
  return DEPTH_TINTS[depth % DEPTH_TINTS.length]
}

/** Returns colored segments for the infix display */
export function treeToColoredInfix(
  node: GameNode,
  depth = 0,
  parentPrec = 0
): ColoredSegment[] {
  if (node.type === 'leaf') {
    return [{ text: node.expression, color: null }]
  }

  const prec = PRECEDENCE[node.op] ?? 0
  const opSymbol = node.op === '*' ? '×' : node.op === '-' ? '−' : node.op
  const color = getDepthTint(depth)

  const leftSegs = treeToColoredInfix(node.left, depth + 1, prec)
  const rightSegs = treeToColoredInfix(node.right, depth + 1, prec)

  const segments: ColoredSegment[] = [
    ...leftSegs.map((s) => ({ ...s, color: s.color ?? color })),
    { text: ` ${opSymbol} `, color },
    ...rightSegs.map((s) => ({ ...s, color: s.color ?? color })),
  ]

  if (prec < parentPrec) {
    segments.unshift({ text: '(', color })
    segments.push({ text: ')', color })
  }

  return segments
}

// ─── Coefficient extraction ───────────────────────────────────────

interface CoefficientResult {
  coeff: number
  variable: string
}

/** Extract coefficient and variable from an ExpressionLeaf's AST.
 *  Returns null if the leaf is purely numeric or unrecognizable. */
function extractCoefficient(leaf: ExpressionLeaf): CoefficientResult | null {
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

  // Purely numeric
  if (ast.type === 'ConstantNode') return null

  // Unrecognized pattern — defensive return
  return null
}

/** Check if an ExpressionLeaf contains a purely numeric expression */
function isNumericLeaf(leaf: ExpressionLeaf): boolean {
  return leaf.ast.type === 'ConstantNode'
}

// ─── Rule registry ────────────────────────────────────────────────

export interface Rule {
  name: string
  canApply(node: GameOperator): boolean
  apply(tree: GameNode, node: GameOperator): { newTree: GameNode; resultNode: GameNode }
  label(node: GameOperator): string
}

/** Immutable replace: find target node in tree by reference, replace with replacement */
function replaceNode(tree: GameNode, target: GameNode, replacement: GameNode): GameNode {
  if (tree === target) return replacement
  if (tree.type === 'leaf') return tree
  return {
    type: 'operator',
    op: tree.op,
    left: replaceNode(tree.left, target, replacement),
    right: replaceNode(tree.right, target, replacement),
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

const SIMPLIFY_TERM_RULE: Rule = {
  name: 'Simplify',
  canApply(node) {
    if (node.op !== '*') return false
    if (node.left.type !== 'leaf' || node.right.type !== 'leaf') return false
    const leftNum = isNumericLeaf(node.left)
    const rightNum = isNumericLeaf(node.right)
    if (leftNum && rightNum) return false // Both numeric → EVALUATE handles it
    // One numeric, one variable (or monomial)
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

const COMBINE_RULE: Rule = {
  name: 'Collect Like Terms',
  canApply(node) {
    if (node.op !== '+') return false
    if (node.left.type !== 'leaf' || node.right.type !== 'leaf') return false
    const leftCoeff = extractCoefficient(node.left)
    const rightCoeff = extractCoefficient(node.right)
    if (!leftCoeff || !rightCoeff) return false
    if (leftCoeff.variable !== rightCoeff.variable) return false
    // Reject negative results
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

const DISTRIBUTE_RULE: Rule = {
  name: 'Distribute',
  canApply(node) {
    if (node.op !== '*') return false
    if (node.right.type !== 'operator') return false
    const rightOp = node.right as GameOperator
    if (rightOp.op !== '+' && rightOp.op !== '-') return false
    // Dev-time warning for reverse ordering: (b+c)*a instead of a*(b+c)
    if (node.left.type === 'operator') {
      const leftOp = (node.left as GameOperator).op
      if (leftOp === '+' || leftOp === '-') {
        console.warn('[Dangle] Distribute: left child is a sum/difference. Author puzzles as a*(b+c) not (b+c)*a.')
      }
    }
    return true
  },
  apply(tree, node) {
    const a = node.left
    const rightOp = node.right as GameOperator
    const b = rightOp.left
    const c = rightOp.right

    // Deep clone a for the second product to avoid reference sharing
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

function cloneGameNode(node: GameNode): GameNode {
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

const RULES: Rule[] = [EVALUATE_RULE, SIMPLIFY_TERM_RULE, COMBINE_RULE, DISTRIBUTE_RULE]

export function getApplicableRule(node: GameNode): Rule | null {
  if (node.type !== 'operator') return null
  for (const rule of RULES) {
    if (rule.canApply(node)) return rule
  }
  return null
}

export function findAllApplicableNodes(tree: GameNode): GameOperator[] {
  const results: GameOperator[] = []
  function walk(node: GameNode) {
    if (node.type === 'operator') {
      if (getApplicableRule(node) !== null) results.push(node)
      walk(node.left)
      walk(node.right)
    }
  }
  walk(tree)
  return results
}

export function findAnyApplicableNode(tree: GameNode): GameOperator | null {
  if (tree.type === 'operator') {
    if (getApplicableRule(tree) !== null) return tree
    return findAnyApplicableNode(tree.left) ?? findAnyApplicableNode(tree.right)
  }
  return null
}

// ─── Layout ───────────────────────────────────────────────────────

export interface LayoutNode {
  node: GameNode
  x: number
  y: number
  depth: number
}

export function layoutTree(
  node: GameNode,
  x = 0,
  y = 0,
  spread = 200,
  depth = 0
): LayoutNode[] {
  const result: LayoutNode[] = [{ node, x, y, depth }]
  if (node.type === 'operator') {
    const nextSpread = Math.max(spread / 2, 60)
    result.push(...layoutTree(node.left, x - spread, y + 100, nextSpread, depth + 1))
    result.push(...layoutTree(node.right, x + spread, y + 100, nextSpread, depth + 1))
  }
  return result
}

// ─── Subtree helpers ──────────────────────────────────────────────

export function getSubtreeNodes(node: GameNode): Set<GameNode> {
  const nodes = new Set<GameNode>()
  nodes.add(node)
  if (node.type === 'operator') {
    getSubtreeNodes(node.left).forEach((n) => nodes.add(n))
    getSubtreeNodes(node.right).forEach((n) => nodes.add(n))
  }
  return nodes
}
