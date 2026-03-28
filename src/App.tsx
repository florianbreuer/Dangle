import { useState, useEffect } from 'react'
import type { MathNode, OperatorNode, ConstantNode } from 'mathjs'
import { TreeView } from './components/TreeView'
import {
  parseExpression,
  canEvaluate,
  evaluateArithmetic,
  applyNode,
  treeToInfix,
} from './lib/treeOps'
import { PUZZLES } from './puzzles'

// ---------------------------------------------------------------------------
// Progress dots
// ---------------------------------------------------------------------------
function ProgressDots({
  current,
  total,
  completed,
}: {
  current: number
  total: number
  completed: Set<number>
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: completed.has(i) ? '#2563eb' : i === current ? '#93c5fd' : '#e2e8f0',
            border: `1.5px solid ${completed.has(i) ? '#2563eb' : i === current ? '#60a5fa' : '#cbd5e1'}`,
            transition: 'background 0.2s',
          }}
        />
      ))}
      <span style={{ fontSize: 14, color: '#6b7280', marginLeft: 4 }}>
        Puzzle {current + 1} of {total}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Infix display with optional yellow flash on the changed token
// ---------------------------------------------------------------------------
function InfixDisplay({
  infix,
  highlight,
}: {
  infix: string
  highlight: string | null
}) {
  if (!highlight) {
    return (
      <p
        style={{
          fontSize: 22,
          fontFamily: 'system-ui, sans-serif',
          color: '#111',
          margin: 0,
          textAlign: 'center',
          letterSpacing: '0.02em',
        }}
      >
        {infix}
      </p>
    )
  }

  const idx = infix.indexOf(highlight)
  if (idx === -1) {
    return (
      <p
        style={{
          fontSize: 22,
          fontFamily: 'system-ui, sans-serif',
          color: '#111',
          margin: 0,
          textAlign: 'center',
        }}
      >
        {infix}
      </p>
    )
  }

  return (
    <p
      style={{
        fontSize: 22,
        fontFamily: 'system-ui, sans-serif',
        color: '#111',
        margin: 0,
        textAlign: 'center',
        letterSpacing: '0.02em',
      }}
    >
      {infix.slice(0, idx)}
      <mark
        style={{
          background: '#fef08a',
          padding: '0 2px',
          borderRadius: 2,
          transition: 'background 0.5s',
        }}
      >
        {infix.slice(idx, idx + highlight.length)}
      </mark>
      {infix.slice(idx + highlight.length)}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export default function App() {
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const [tree, setTree] = useState<MathNode>(() =>
    parseExpression(PUZZLES[0].expression)
  )
  const [selectedNode, setSelectedNode] = useState<MathNode | null>(null)
  const [tooltipMsg, setTooltipMsg] = useState<string | null>(null)
  const [hintVisible, setHintVisible] = useState(true)
  const [hintOpacity, setHintOpacity] = useState(1)
  const [highlightValue, setHighlightValue] = useState<string | null>(null)
  const [completedPuzzles, setCompletedPuzzles] = useState<Set<number>>(new Set())
  const [evaluatedNode, setEvaluatedNode] = useState<MathNode | null>(null)

  const isDone = tree.type === 'ConstantNode'
  const infix = treeToInfix(tree)

  const evaluateLabel =
    selectedNode && canEvaluate(selectedNode)
      ? (() => {
          const op = selectedNode as OperatorNode
          const [left, right] = op.args as ConstantNode[]
          const opSymbol = op.op === '*' ? '×' : op.op
          return `Evaluate: ${left.value} ${opSymbol} ${right.value}`
        })()
      : null

  function handleNodeClick(node: MathNode) {
    if (node.type === 'ConstantNode') return

    setTooltipMsg(null)

    if (!canEvaluate(node)) {
      setTooltipMsg('Simplify the parts inside the brackets first.')
      setSelectedNode(null)
      return
    }

    setSelectedNode(node)
  }

  function handleApply() {
    if (!selectedNode || !canEvaluate(selectedNode)) return

    const result = evaluateArithmetic(selectedNode as OperatorNode)
    const resultStr = result.toString()
    const { newTree, resultNode } = applyNode(tree, selectedNode)

    setTree(newTree)
    setSelectedNode(null)
    setEvaluatedNode(resultNode)
    setHighlightValue(resultStr)
    setTooltipMsg(null)

    if (hintVisible) {
      setHintOpacity(0)
      setTimeout(() => setHintVisible(false), 300)
    }

    setTimeout(() => {
      setHighlightValue(null)
      setEvaluatedNode(null)
    }, 600)
  }

  function handleNext() {
    const nextIndex = (puzzleIndex + 1) % PUZZLES.length
    setCompletedPuzzles((prev) => new Set(prev).add(puzzleIndex))
    setPuzzleIndex(nextIndex)
    setTree(parseExpression(PUZZLES[nextIndex].expression))
    setSelectedNode(null)
    setTooltipMsg(null)
    setHighlightValue(null)
  }

  // Clear tooltip when clicking elsewhere
  useEffect(() => {
    if (tooltipMsg) {
      const timer = setTimeout(() => setTooltipMsg(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [tooltipMsg])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <ProgressDots
          current={puzzleIndex}
          total={PUZZLES.length}
          completed={completedPuzzles}
        />
      </div>

      {/* First-use hint */}
      {hintVisible && (
        <p
          style={{
            fontSize: 14,
            color: '#9ca3af',
            margin: '8px 0 0',
            opacity: hintOpacity,
            transition: 'opacity 0.3s',
            pointerEvents: 'none',
          }}
        >
          Click an operator to evaluate it.
        </p>
      )}

      {/* Tree */}
      <div style={{ marginTop: 16, width: '100%', maxWidth: 800 }}>
        <TreeView
          tree={tree}
          selectedNode={selectedNode}
          evaluatedNode={evaluatedNode}
          onNodeClick={handleNodeClick}
        />
      </div>

      {/* Evaluate label + Apply button */}
      <div
        style={{
          minHeight: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          marginTop: 4,
        }}
      >
        {evaluateLabel && (
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            {evaluateLabel}
          </p>
        )}
        {tooltipMsg && !evaluateLabel && (
          <p
            style={{
              fontSize: 14,
              color: '#6b7280',
              margin: 0,
              fontStyle: 'italic',
            }}
          >
            {tooltipMsg}
          </p>
        )}
        {selectedNode && canEvaluate(selectedNode) && (
          <button
            onClick={handleApply}
            style={{
              padding: '6px 20px',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: 'system-ui, sans-serif',
              background: '#e5e7eb',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              ;(e.target as HTMLButtonElement).style.background = '#d1d5db'
            }}
            onMouseLeave={(e) => {
              ;(e.target as HTMLButtonElement).style.background = '#e5e7eb'
            }}
          >
            Apply
          </button>
        )}
        {isDone && (
          <button
            onClick={handleNext}
            style={{
              padding: '8px 24px',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'system-ui, sans-serif',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              ;(e.target as HTMLButtonElement).style.background = '#1d4ed8'
            }}
            onMouseLeave={(e) => {
              ;(e.target as HTMLButtonElement).style.background = '#2563eb'
            }}
          >
            Done! → Next puzzle
          </button>
        )}
      </div>

      {/* Infix form */}
      <div
        data-testid="infix-display"
        style={{
          marginTop: 12,
          padding: '12px 24px',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          minWidth: 200,
          textAlign: 'center',
        }}
      >
        <InfixDisplay infix={infix} highlight={highlightValue} />
      </div>
    </div>
  )
}
