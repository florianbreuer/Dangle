import type { MathNode, OperatorNode, ConstantNode } from 'mathjs'
import { layoutTree, getSubtreeNodes } from '../lib/treeOps'

interface TreeViewProps {
  tree: MathNode
  selectedNode: MathNode | null
  evaluatedNode: MathNode | null
  onNodeClick: (node: MathNode) => void
}

const OFFSET_X = 400
const OFFSET_Y = 60
const SVG_WIDTH = 800
const SVG_HEIGHT = 360

export function TreeView({ tree, selectedNode, evaluatedNode, onNodeClick }: TreeViewProps) {
  const layoutNodes = layoutTree(tree)
  const subtreeNodes = selectedNode ? getSubtreeNodes(selectedNode) : new Set<MathNode>()

  return (
    <svg
      width={SVG_WIDTH}
      height={SVG_HEIGHT}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      style={{ display: 'block', margin: '0 auto' }}
      aria-label="Expression tree"
    >
      {/* Edges — drawn before nodes so nodes render on top */}
      {layoutNodes.map(({ node, x, y }) => {
        if (node.type !== 'OperatorNode') return null
        const op = node as OperatorNode
        return op.args.map((childArg) => {
          const childLayout = layoutNodes.find((ln) => ln.node === childArg)
          if (!childLayout) return null
          return (
            <line
              key={`edge-${x}-${y}-${childLayout.x}-${childLayout.y}`}
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
      {layoutNodes.map(({ node, x, y }) => {
        const cx = x + OFFSET_X
        const cy = y + OFFSET_Y
        const isSelected = node === selectedNode
        const isInSubtree = subtreeNodes.has(node) && node !== selectedNode

        if (node.type === 'OperatorNode') {
          const op = node as OperatorNode
          const label = op.op === '*' ? '×' : op.op
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
                fill={isSelected ? '#dbeafe' : '#e0e0e0'}
                stroke={isSelected ? '#2563eb' : isInSubtree ? '#94a3b8' : '#333'}
                strokeWidth={isSelected ? 2.5 : isInSubtree ? 1.5 : 1.5}
                strokeDasharray={isInSubtree ? '4 2' : undefined}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={16}
                fontFamily="system-ui, sans-serif"
                fontWeight="500"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {label}
              </text>
            </g>
          )
        }

        if (node.type === 'ConstantNode') {
          const val = String((node as ConstantNode).value)
          const isEvaluated = node === evaluatedNode
          return (
            <g
              key={`node-const-${x}-${y}`}
              style={{ cursor: 'default' }}
              aria-label={`Number ${val}`}
            >
              <rect
                x={cx - 20}
                y={cy - 15}
                width={40}
                height={30}
                fill={isEvaluated ? '#16a34a' : isInSubtree ? '#f0f9ff' : '#fff'}
                stroke={isEvaluated ? '#15803d' : isInSubtree ? '#94a3b8' : '#333'}
                strokeWidth={1.5}
                strokeDasharray={isInSubtree ? '4 2' : undefined}
                rx={3}
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
                {val}
              </text>
            </g>
          )
        }

        return null
      })}
    </svg>
  )
}
