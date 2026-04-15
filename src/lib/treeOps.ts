/**
 * Dangle v3 — Core game tree types and operations
 *
 * Data flow:
 *   puzzles.ts { expression, atoms, lesson }
 *     → math.parse(expression) → MathNode AST
 *     → mathToGameTree(ast, atoms) → GameNode tree
 *     → App.tsx state + rules.ts dispatch
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
    for (const atom of parsedAtoms) {
      if (astStructureEqual(node, atom.ast)) {
        return {
          type: 'leaf',
          expression: atom.text,
          ast: node,
        }
      }
    }

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

    const expr =
      node.type === 'ConstantNode'
        ? String((node as ConstantNode).value)
        : node.type === 'SymbolNode'
          ? (node as SymbolNode).name
          : node.toString()
    return { type: 'leaf', expression: expr, ast: node }
  }

  const result = convert(ast)

  // Dev-time assertion: warn if no atoms matched
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
