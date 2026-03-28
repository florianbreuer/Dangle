import * as math from 'mathjs'
import type { MathNode, OperatorNode, ConstantNode } from 'mathjs'

export type { MathNode }

/**
 * Recursively unwraps ParenthesisNode wrappers that math.js inserts
 * around parenthesized subexpressions. Must be called at parse time.
 * e.g. math.parse("3*(2+4)") → OperatorNode('*', [3, ParenthesisNode(OperatorNode('+', [2, 4]))])
 * After unwrap: OperatorNode('*', [3, OperatorNode('+', [2, 4])])
 */
export function unwrapParens(node: MathNode): MathNode {
  return node.transform((n) => {
    if (n.type === 'ParenthesisNode') {
      // ParenthesisNode has a .content property holding the inner node
      return unwrapParens((n as unknown as { content: MathNode }).content)
    }
    return n
  })
}

/**
 * Returns true if the node is an operator whose immediate children are
 * all ConstantNodes — meaning it's ready to evaluate.
 * Returns false for leaf nodes (ConstantNode) and operators with
 * non-constant children.
 */
export function canEvaluate(node: MathNode): boolean {
  if (node.type !== 'OperatorNode') return false
  const op = node as OperatorNode
  return op.args.every((arg) => arg.type === 'ConstantNode')
}

/**
 * Evaluates a single arithmetic operation where both children are
 * ConstantNodes. Returns NaN for division by zero (sentinel, not crash).
 * Caller must check canEvaluate before calling.
 */
export function evaluateArithmetic(node: OperatorNode): number {
  const [left, right] = node.args as ConstantNode[]
  const a = left.value as number
  const b = right.value as number
  switch (node.op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '*':
      return a * b
    case '/':
      if (b === 0) return NaN
      return a / b
    default:
      return NaN
  }
}

export interface LayoutNode {
  node: MathNode
  x: number
  y: number
}

/**
 * Recursively computes x/y positions for every node in a binary tree.
 * Spread starts at 200px and halves at each level — produces non-overlapping
 * trees for up to depth 4 without any external layout library.
 *
 * Returns an array of { node, x, y } where node is the original AST reference
 * (reference equality is used for click-to-select and edge drawing).
 */
export function layoutTree(
  node: MathNode,
  x = 0,
  y = 0,
  spread = 200
): LayoutNode[] {
  const result: LayoutNode[] = [{ node, x, y }]
  if (node.type === 'OperatorNode') {
    const op = node as OperatorNode
    const [left, right] = op.args
    result.push(...layoutTree(left, x - spread, y + 100, spread / 2))
    result.push(...layoutTree(right, x + spread, y + 100, spread / 2))
  }
  return result
}

/**
 * Applies the chosen operator node, replacing it with its numeric result.
 * Returns { newTree, resultNode } — both the updated tree and a reference to
 * the newly inserted ConstantNode, so callers can briefly highlight it.
 * Caller must reset selectedNode to null after calling — the old reference
 * is stale after transform.
 */
export function applyNode(
  tree: MathNode,
  target: MathNode
): { newTree: MathNode; resultNode: MathNode } {
  const op = target as OperatorNode
  const result = evaluateArithmetic(op)
  const resultNode = new math.ConstantNode(result)
  const newTree = tree.transform((n) => {
    if (n === target) return resultNode
    return n
  })
  return { newTree, resultNode }
}

/**
 * Returns all nodes in the subtree rooted at node, including node itself.
 * Used to visually mark the subtree of the selected operator.
 */
export function getSubtreeNodes(node: MathNode): Set<MathNode> {
  const nodes = new Set<MathNode>()
  nodes.add(node)
  if (node.type === 'OperatorNode') {
    const op = node as OperatorNode
    op.args.forEach((child) => {
      getSubtreeNodes(child).forEach((n) => nodes.add(n))
    })
  }
  return nodes
}

/**
 * Parses an expression string, unwraps all ParenthesisNodes, and returns
 * the canonical AST for use as React state.
 */
export function parseExpression(expr: string): MathNode {
  return unwrapParens(math.parse(expr))
}

/**
 * Returns a kid-friendly infix string from the tree.
 * Replaces * with × for display. Uses math.js toString() as the base.
 */
export function treeToInfix(node: MathNode): string {
  return node.toString().replace(/\s*\*\s*/g, ' × ')
}
