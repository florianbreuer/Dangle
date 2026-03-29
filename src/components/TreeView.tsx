import type { GameNode, ExpressionLeaf, GameOperator, LayoutNode } from '../lib/treeOps'
import { layoutTree, getSubtreeNodes, getDepthColor } from '../lib/treeOps'

interface TreeViewProps {
  tree: GameNode
  selectedNode: GameNode | null
  evaluatedNode: GameNode | null
  hintNodes: Set<GameNode>
  onNodeClick: (node: GameNode) => void
}

const OFFSET_X = 400
const OFFSET_Y = 60
const SVG_WIDTH = 800
const SVG_HEIGHT = 420

function leafWidth(expression: string): number {
  // Approximate: 9px per character at 16px font, plus 16px padding
  return Math.max(40, expression.length * 9 + 16)
}

function isNumericExpression(leaf: ExpressionLeaf): boolean {
  return leaf.ast.type === 'ConstantNode'
}

export function TreeView({
  tree,
  selectedNode,
  evaluatedNode,
  hintNodes,
  onNodeClick,
}: TreeViewProps) {
  const layoutNodes = layoutTree(tree)
  const subtreeNodes = selectedNode ? getSubtreeNodes(selectedNode) : new Set<GameNode>()

  return (
    <svg
      width="100%"
      height="auto"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      style={{ display: 'block', margin: '0 auto', maxWidth: SVG_WIDTH }}
      aria-label="Expression tree"
    >
      {/* Edges */}
      {layoutNodes.map(({ node, x, y }: LayoutNode) => {
        if (node.type !== 'operator') return null
        const op = node as GameOperator
        const children = [
          { child: op.left, key: 'L' },
          { child: op.right, key: 'R' },
        ]
        return children.map(({ child, key }) => {
          const childLayout = layoutNodes.find((ln: LayoutNode) => ln.node === child)
          if (!childLayout) return null
          return (
            <line
              key={`edge-${x}-${y}-${key}`}
              x1={x + OFFSET_X}
              y1={y + OFFSET_Y}
              x2={childLayout.x + OFFSET_X}
              y2={childLayout.y + OFFSET_Y}
              stroke="#999"
              strokeWidth={1.5}
            />
          )
        })
      })}

      {/* Nodes */}
      {layoutNodes.map(({ node, x, y, depth }: LayoutNode) => {
        const cx = x + OFFSET_X
        const cy = y + OFFSET_Y
        const isSelected = node === selectedNode
        const isInSubtree = subtreeNodes.has(node) && node !== selectedNode
        const isEvaluated = node === evaluatedNode
        const isHinted = hintNodes.has(node)
        const depthColor = getDepthColor(depth)

        if (node.type === 'operator') {
          const label = node.op === '*' ? '×' : node.op
          return (
            <g
              key={`node-op-${x}-${y}`}
              onClick={() => onNodeClick(node)}
              style={{ cursor: 'pointer' }}
              role="button"
              aria-label={`Operator ${label}`}
            >
              <circle
                cx={cx}
                cy={cy}
                r={20}
                fill={
                  isHinted
                    ? '#fbbf24'
                    : isEvaluated
                      ? '#16a34a'
                      : isSelected
                        ? '#e5e7eb'
                        : '#e0e0e0'
                }
                stroke={
                  isSelected
                    ? '#374151'
                    : isEvaluated
                      ? '#15803d'
                      : isInSubtree
                        ? depthColor
                        : '#333'
                }
                strokeWidth={isSelected ? 2.5 : 1.5}
                strokeDasharray={isInSubtree && !isSelected ? '4 2' : undefined}
                style={{
                  transition: 'fill 0.2s',
                }}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={16}
                fontFamily="system-ui, sans-serif"
                fontWeight="500"
                fill={isEvaluated ? '#fff' : '#111'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {label}
              </text>
            </g>
          )
        }

        // ExpressionLeaf
        const leaf = node as ExpressionLeaf
        const w = leafWidth(leaf.expression)
        const isVariable = !isNumericExpression(leaf)

        return (
          <g
            key={`node-leaf-${x}-${y}`}
            style={{ cursor: 'default' }}
            aria-label={`${isVariable ? 'Term' : 'Number'} ${leaf.expression}`}
          >
            <rect
              x={cx - w / 2}
              y={cy - 15}
              width={w}
              height={30}
              fill={
                isEvaluated
                  ? '#16a34a'
                  : isInSubtree
                    ? '#f0f9ff'
                    : isVariable
                      ? '#fef3c7'
                      : '#fff'
              }
              stroke={
                isEvaluated
                  ? '#15803d'
                  : isInSubtree
                    ? depthColor
                    : isVariable
                      ? '#d97706'
                      : '#333'
              }
              strokeWidth={1.5}
              strokeDasharray={isInSubtree ? '4 2' : undefined}
              rx={4}
              style={{ transition: 'fill 0.2s' }}
            />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={16}
              fontFamily="system-ui, sans-serif"
              fill={isEvaluated ? '#fff' : '#111'}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {leaf.expression}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
