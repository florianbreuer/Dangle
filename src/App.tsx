import { useState, useEffect, useCallback } from 'react'
import type { GameNode, GameOperator, ColoredSegment } from './lib/treeOps'
import { TreeView } from './components/TreeView'
import {
  parseExpression,
  mathToGameTree,
  treeToColoredInfix,
  getApplicableRule,
  findAnyApplicableNode,
  findAllApplicableNodes,
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
// Color-coded infix display
// ---------------------------------------------------------------------------
function ColoredInfixDisplay({
  segments,
  highlightValue,
}: {
  segments: ColoredSegment[]
  highlightValue: string | null
}) {
  // If there's a highlight (recently evaluated value), find and mark it
  const fullText = segments.map((s) => s.text).join('')

  if (highlightValue) {
    const idx = fullText.indexOf(highlightValue)
    if (idx !== -1) {
      // Render with yellow highlight on the matching portion
      return (
        <p
          style={{
            fontSize: 24,
            fontFamily: 'system-ui, sans-serif',
            color: '#111',
            margin: 0,
            textAlign: 'center',
            letterSpacing: '0.02em',
          }}
        >
          {renderSegmentsWithHighlight(segments, highlightValue)}
        </p>
      )
    }
  }

  return (
    <p
      style={{
        fontSize: 24,
        fontFamily: 'system-ui, sans-serif',
        color: '#111',
        margin: 0,
        textAlign: 'center',
        letterSpacing: '0.02em',
      }}
    >
      {segments.map((seg, i) => (
        <span
          key={i}
          style={{
            background: seg.color ?? undefined,
            padding: seg.color ? '2px 1px' : undefined,
            borderRadius: seg.color ? 3 : undefined,
          }}
        >
          {seg.text}
        </span>
      ))}
    </p>
  )
}

function renderSegmentsWithHighlight(
  segments: ColoredSegment[],
  highlight: string
): React.ReactNode[] {
  // Flatten segments to find highlight position
  const nodes: React.ReactNode[] = []
  let charIndex = 0
  const fullText = segments.map((s) => s.text).join('')
  const hlStart = fullText.indexOf(highlight)
  const hlEnd = hlStart + highlight.length

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const segStart = charIndex
    const segEnd = charIndex + seg.text.length

    if (segEnd <= hlStart || segStart >= hlEnd) {
      // No overlap with highlight
      nodes.push(
        <span
          key={i}
          style={{
            background: seg.color ?? undefined,
            padding: seg.color ? '2px 1px' : undefined,
            borderRadius: seg.color ? 3 : undefined,
          }}
        >
          {seg.text}
        </span>
      )
    } else {
      // Partial or full overlap with highlight
      const overlapStart = Math.max(segStart, hlStart) - segStart
      const overlapEnd = Math.min(segEnd, hlEnd) - segStart

      if (overlapStart > 0) {
        nodes.push(
          <span key={`${i}-pre`} style={{ background: seg.color ?? undefined, padding: seg.color ? '2px 1px' : undefined, borderRadius: seg.color ? 3 : undefined }}>
            {seg.text.slice(0, overlapStart)}
          </span>
        )
      }
      nodes.push(
        <mark
          key={`${i}-hl`}
          style={{
            background: '#fef08a',
            padding: '0 2px',
            borderRadius: 2,
            transition: 'background 0.5s',
          }}
        >
          {seg.text.slice(overlapStart, overlapEnd)}
        </mark>
      )
      if (overlapEnd < seg.text.length) {
        nodes.push(
          <span key={`${i}-post`} style={{ background: seg.color ?? undefined, padding: seg.color ? '2px 1px' : undefined, borderRadius: seg.color ? 3 : undefined }}>
            {seg.text.slice(overlapEnd)}
          </span>
        )
      }
    }
    charIndex += seg.text.length
  }
  return nodes
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
function buildTree(puzzleIndex: number): GameNode {
  const puzzle = PUZZLES[puzzleIndex]
  const ast = parseExpression(puzzle.expression)
  return mathToGameTree(ast, puzzle.atoms)
}

export default function App() {
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const [tree, setTree] = useState<GameNode>(() => buildTree(0))
  const [selectedNode, setSelectedNode] = useState<GameNode | null>(null)
  const [tooltipMsg, setTooltipMsg] = useState<string | null>(null)
  const [hintVisible, setHintVisible] = useState(true)
  const [hintOpacity, setHintOpacity] = useState(1)
  const [highlightValue, setHighlightValue] = useState<string | null>(null)
  const [completedPuzzles, setCompletedPuzzles] = useState<Set<number>>(new Set())
  const [evaluatedNode, setEvaluatedNode] = useState<GameNode | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const [hintNodes, setHintNodes] = useState<Set<GameNode>>(new Set())

  const isDone = findAnyApplicableNode(tree) === null
  const segments = treeToColoredInfix(tree)
  const rule = selectedNode?.type === 'operator' ? getApplicableRule(selectedNode) : null
  const evaluateLabel = rule ? rule.label(selectedNode as GameOperator) : null

  function handleNodeClick(node: GameNode) {
    if (node.type === 'leaf') return
    setTooltipMsg(null)
    setHintNodes(new Set())

    const applicable = getApplicableRule(node)
    if (!applicable) {
      setTooltipMsg('No rule applies here yet.')
      setSelectedNode(null)
      return
    }

    setSelectedNode(node)
  }

  function handleApply() {
    if (!selectedNode || selectedNode.type !== 'operator' || !rule) return

    const { newTree, resultNode } = rule.apply(tree, selectedNode as GameOperator)
    const resultExpr = resultNode.type === 'leaf' ? resultNode.expression : null

    setTree(newTree)
    setSelectedNode(null)
    setEvaluatedNode(resultNode)
    setHighlightValue(resultExpr)
    setTooltipMsg(null)
    setHintNodes(new Set())

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
    const updated = new Set(completedPuzzles).add(puzzleIndex)
    setCompletedPuzzles(updated)
    if (puzzleIndex === PUZZLES.length - 1) {
      setShowComplete(true)
      return
    }
    const nextIndex = puzzleIndex + 1
    setPuzzleIndex(nextIndex)
    setTree(buildTree(nextIndex))
    setSelectedNode(null)
    setTooltipMsg(null)
    setHighlightValue(null)
    setHintNodes(new Set())
  }

  function handlePlayAgain() {
    setPuzzleIndex(0)
    setTree(buildTree(0))
    setSelectedNode(null)
    setTooltipMsg(null)
    setHighlightValue(null)
    setCompletedPuzzles(new Set())
    setEvaluatedNode(null)
    setShowComplete(false)
    setHintVisible(true)
    setHintOpacity(1)
    setHintNodes(new Set())
  }

  const handleHint = useCallback(() => {
    const applicable = findAllApplicableNodes(tree)
    const nodeSet = new Set<GameNode>(applicable)
    setHintNodes(nodeSet)
    // Flash for 400ms then clear
    setTimeout(() => setHintNodes(new Set()), 400)
  }, [tree])

  // Clear tooltip when clicking elsewhere
  useEffect(() => {
    if (tooltipMsg) {
      const timer = setTimeout(() => setTooltipMsg(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [tooltipMsg])

  if (showComplete) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f9fafb',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>
          You did it!
        </h1>
        <p style={{ fontSize: 18, color: '#6b7280', margin: '0 0 32px', textAlign: 'center' }}>
          All {PUZZLES.length} puzzles solved. You're an algebra whiz!
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
          {Array.from({ length: PUZZLES.length }, (_, i) => (
            <div
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#2563eb',
                border: '1.5px solid #2563eb',
              }}
            />
          ))}
        </div>
        <button
          onClick={handlePlayAgain}
          style={{
            padding: '10px 28px',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            ;(e.target as HTMLButtonElement).style.background = '#1d4ed8'
          }}
          onMouseLeave={(e) => {
            ;(e.target as HTMLButtonElement).style.background = '#2563eb'
          }}
        >
          Play again
        </button>
      </div>
    )
  }

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
      {/* Header: progress + hint */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <ProgressDots
          current={puzzleIndex}
          total={PUZZLES.length}
          completed={completedPuzzles}
        />
        {!isDone && (
          <button
            onClick={handleHint}
            style={{
              padding: '4px 14px',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'system-ui, sans-serif',
              background: '#e5e7eb',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 12,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              ;(e.target as HTMLButtonElement).style.background = '#d1d5db'
            }}
            onMouseLeave={(e) => {
              ;(e.target as HTMLButtonElement).style.background = '#e5e7eb'
            }}
          >
            Hint
          </button>
        )}
      </div>

      {/* Lesson text */}
      <p
        style={{
          fontSize: 14,
          color: '#6b7280',
          margin: '4px 0 8px',
        }}
      >
        {PUZZLES[puzzleIndex].lesson}
      </p>

      {/* First-use hint */}
      {hintVisible && puzzleIndex === 0 && (
        <p
          style={{
            fontSize: 13,
            color: '#9ca3af',
            margin: '0 0 4px',
            opacity: hintOpacity,
            transition: 'opacity 0.3s',
            pointerEvents: 'none',
          }}
        >
          Click an operator to evaluate it.
        </p>
      )}

      {/* Color-coded infix (ABOVE tree per design review) */}
      <div
        data-testid="infix-display"
        style={{
          marginBottom: 8,
          padding: '10px 24px',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          minWidth: 200,
          textAlign: 'center',
        }}
      >
        <ColoredInfixDisplay segments={segments} highlightValue={highlightValue} />
      </div>

      {/* Tree */}
      <div style={{ width: '100%', maxWidth: 800 }}>
        <TreeView
          tree={tree}
          selectedNode={selectedNode}
          evaluatedNode={evaluatedNode}
          hintNodes={hintNodes}
          onNodeClick={handleNodeClick}
        />
      </div>

      {/* Rule label + Apply button */}
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
        {selectedNode && rule && (
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
    </div>
  )
}
