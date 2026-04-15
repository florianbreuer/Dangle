import { useState, useEffect, useCallback, useRef } from 'react'
import type { GameNode, GameOperator, ExpressionLeaf, ColoredSegment } from './lib/treeOps'
import { TreeView } from './components/TreeView'
import {
  parseExpression,
  mathToGameTree,
  treeToColoredInfix,
} from './lib/treeOps'
import {
  getAllApplicableRules,
  findAnyApplicableNode,
  findAllApplicableNodes,
  cloneGameNode,
  canUnpack,
  unpackLeaf,
  canonicalEqual,
  ALL_RULE_NAMES,
} from './lib/rules'
import type { Rule } from './lib/rules'
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
  const fullText = segments.map((s) => s.text).join('')

  if (highlightValue) {
    const idx = fullText.indexOf(highlightValue)
    if (idx !== -1) {
      return (
        <p style={{ fontSize: 24, fontFamily: 'system-ui, sans-serif', color: '#111', margin: 0, textAlign: 'center', letterSpacing: '0.02em' }}>
          {renderSegmentsWithHighlight(segments, highlightValue)}
        </p>
      )
    }
  }

  return (
    <p style={{ fontSize: 24, fontFamily: 'system-ui, sans-serif', color: '#111', margin: 0, textAlign: 'center', letterSpacing: '0.02em' }}>
      {segments.map((seg, i) => (
        <span key={i} style={{ background: seg.color ?? undefined, padding: seg.color ? '2px 1px' : undefined, borderRadius: seg.color ? 3 : undefined }}>
          {seg.text}
        </span>
      ))}
    </p>
  )
}

function renderSegmentsWithHighlight(segments: ColoredSegment[], highlight: string): React.ReactNode[] {
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
      nodes.push(
        <span key={i} style={{ background: seg.color ?? undefined, padding: seg.color ? '2px 1px' : undefined, borderRadius: seg.color ? 3 : undefined }}>
          {seg.text}
        </span>
      )
    } else {
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
        <mark key={`${i}-hl`} style={{ background: '#fef08a', padding: '0 2px', borderRadius: 2, transition: 'background 0.5s' }}>
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
// Tooltip popup
// ---------------------------------------------------------------------------
interface TooltipState {
  x: number
  y: number
  rules: { rule: Rule; label: string }[]
  unpack?: ExpressionLeaf
}

function RuleTooltip({
  tooltip,
  onApplyRule,
  onUnpack,
  onDismiss,
}: {
  tooltip: TooltipState
  onApplyRule: (rule: Rule) => void
  onUnpack: () => void
  onDismiss: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onDismiss])

  // Viewport clamp
  let left = tooltip.x - 125
  const top = tooltip.y + 28
  if (left < 8) left = 8
  if (left + 250 > window.innerWidth - 8) left = window.innerWidth - 258

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'absolute',
        left,
        top,
        zIndex: 100,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        maxWidth: 250,
        minWidth: 160,
        overflow: 'hidden',
      }}
    >
      {/* Arrow */}
      <div style={{
        position: 'absolute',
        top: -7,
        left: '50%',
        marginLeft: -7,
        width: 0,
        height: 0,
        borderLeft: '7px solid transparent',
        borderRight: '7px solid transparent',
        borderBottom: '7px solid #fff',
        filter: 'drop-shadow(0 -1px 0 #e5e7eb)',
      }} />
      {tooltip.rules.map(({ rule, label }, i) => (
        <button
          key={rule.name}
          role="menuitem"
          onClick={() => onApplyRule(rule)}
          style={{
            display: 'block',
            width: '100%',
            padding: '10px 14px',
            fontSize: 13,
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 400,
            color: '#374151',
            background: '#fff',
            border: 'none',
            borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
            cursor: 'pointer',
            textAlign: 'left',
            minHeight: 44,
            lineHeight: '1.4',
          }}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = '#f9fafb' }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = '#fff' }}
        >
          {label}
        </button>
      ))}
      {tooltip.unpack && (
        <button
          role="menuitem"
          onClick={onUnpack}
          style={{
            display: 'block',
            width: '100%',
            padding: '10px 14px',
            fontSize: 13,
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 400,
            color: '#374151',
            background: '#fff',
            border: 'none',
            borderTop: '1px solid #f3f4f6',
            cursor: 'pointer',
            textAlign: 'left',
            minHeight: 44,
          }}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = '#f9fafb' }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = '#fff' }}
        >
          Unpack: expand {tooltip.unpack.expression}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------
function TabBar({ mode, onSwitch }: { mode: 'puzzles' | 'sandbox'; onSwitch: (m: 'puzzles' | 'sandbox') => void }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #e5e7eb', width: '100%', maxWidth: 800 }}>
      {(['puzzles', 'sandbox'] as const).map(tab => (
        <button
          key={tab}
          role="tab"
          aria-selected={mode === tab}
          onClick={() => onSwitch(tab)}
          style={{
            flex: 1,
            padding: '10px 0',
            fontSize: 15,
            fontFamily: 'system-ui, sans-serif',
            fontWeight: mode === tab ? 600 : 400,
            color: mode === tab ? '#111' : '#6b7280',
            background: 'none',
            border: 'none',
            borderBottom: mode === tab ? '2px solid #2563eb' : '2px solid transparent',
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          {tab === 'puzzles' ? 'Puzzles' : 'Sandbox'}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
function buildTree(puzzleIndex: number): GameNode {
  const puzzle = PUZZLES[puzzleIndex]
  const ast = parseExpression(puzzle.expression)
  return mathToGameTree(ast, puzzle.atoms)
}

/** Build a target tree from a target expression string */
function buildTargetTree(targetExpr: string): GameNode {
  const ast = parseExpression(targetExpr)
  // For target, we parse fully (each token is an atom)
  function convert(node: import('mathjs').MathNode): GameNode {
    if (node.type === 'OperatorNode') {
      const op = node as import('mathjs').OperatorNode
      if (op.args.length === 2) {
        return {
          type: 'operator',
          op: op.op as GameOperator['op'],
          left: convert(op.args[0]),
          right: convert(op.args[1]),
        }
      }
    }
    if (node.type === 'ConstantNode') {
      return { type: 'leaf', expression: String((node as import('mathjs').ConstantNode).value), ast: node }
    }
    if (node.type === 'SymbolNode') {
      return { type: 'leaf', expression: (node as import('mathjs').SymbolNode).name, ast: node }
    }
    return { type: 'leaf', expression: node.toString(), ast: node }
  }
  return convert(ast)
}

const UNDO_CAP = 50
const SANDBOX_DEFAULT = '2(x + 3)'

export default function App() {
  const [mode, setMode] = useState<'puzzles' | 'sandbox'>('puzzles')

  // Puzzle state
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const [tree, setTree] = useState<GameNode>(() => buildTree(0))
  const [selectedNode, setSelectedNode] = useState<GameNode | null>(null)
  const [hintVisible, setHintVisible] = useState(true)
  const [hintOpacity, setHintOpacity] = useState(1)
  const [highlightValue, setHighlightValue] = useState<string | null>(null)
  const [completedPuzzles, setCompletedPuzzles] = useState<Set<number>>(new Set())
  const [evaluatedNode, setEvaluatedNode] = useState<GameNode | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const [hintNodes, setHintNodes] = useState<Set<GameNode>>(new Set())
  const [undoStack, setUndoStack] = useState<GameNode[]>([])
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // Sandbox state
  const [sandboxExpr, setSandboxExpr] = useState(SANDBOX_DEFAULT)
  const [sandboxTree, setSandboxTree] = useState<GameNode | null>(() => {
    try {
      const ast = parseExpression(SANDBOX_DEFAULT)
      return mathToGameTree(ast, [])
    } catch { return null }
  })
  const [sandboxError, setSandboxError] = useState<string | null>(null)
  const [sandboxUndoStack, setSandboxUndoStack] = useState<GameNode[]>([])

  const svgRef = useRef<SVGSVGElement>(null)

  const currentPuzzle = PUZZLES[puzzleIndex]
  const activeTree = mode === 'puzzles' ? tree : sandboxTree
  // enabledRules for current context
  const enabledRules = mode === 'sandbox'
    ? ALL_RULE_NAMES // all rules in sandbox
    : currentPuzzle.enabledRules

  // isDone logic
  const puzzleType = currentPuzzle.puzzleType ?? 'simplify'
  let isDone = false
  if (mode === 'puzzles' && activeTree) {
    if (puzzleType === 'transform' && currentPuzzle.target) {
      const targetTree = buildTargetTree(currentPuzzle.target)
      isDone = canonicalEqual(activeTree, targetTree)
    } else {
      isDone = findAnyApplicableNode(activeTree, enabledRules) === null
    }
  }

  const segments = activeTree ? treeToColoredInfix(activeTree) : []

  // Sandbox expression input handler
  function handleSandboxInput(expr: string) {
    setSandboxExpr(expr)
    if (!expr.trim()) {
      setSandboxTree(null)
      setSandboxError(null)
      return
    }
    try {
      const ast = parseExpression(expr)
      const newTree = mathToGameTree(ast, [])
      setSandboxTree(newTree)
      setSandboxError(null)
      setSandboxUndoStack([])
      setTooltip(null)
      setSelectedNode(null)
    } catch {
      setSandboxError("Couldn't parse that expression. Try something like 2x + 3")
      setSandboxTree(null)
    }
  }

  // Get tooltip position from SVG node coordinates
  function getTooltipPosition(_node: GameNode): { x: number; y: number } {
    if (!svgRef.current) return { x: 0, y: 0 }
    const svg = svgRef.current
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }

    // Find the node's layout position by looking at data attributes
    const elements = svg.querySelectorAll('[data-node-x]')
    for (const el of elements) {
      // Check if this element's click handler corresponds to our node
      // We use the layout coordinates stored as data attributes
      const nx = Number(el.getAttribute('data-node-x'))
      const ny = Number(el.getAttribute('data-node-y'))

      // Convert SVG coordinates to screen coordinates
      const point = svg.createSVGPoint()
      point.x = nx
      point.y = ny
      const screenPoint = point.matrixTransform(ctm)

      // Check if this is roughly the right node by walking the layout
      // We match by finding the element that was clicked
      const nodeEl = el as Element
      if (nodeEl.contains(document.activeElement) || nodeEl === document.activeElement) {
        return { x: screenPoint.x, y: screenPoint.y + window.scrollY }
      }
    }

    // Fallback: use the clicked element's position
    const rect = svg.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + window.scrollY }
  }

  function handleNodeClick(node: GameNode, event?: React.MouseEvent) {
    setHintNodes(new Set())

    if (node.type === 'leaf') {
      // In sandbox mode, check for UNPACK
      if (mode === 'sandbox' && canUnpack(node as ExpressionLeaf)) {
        const pos = event
          ? { x: event.clientX, y: event.clientY + window.scrollY }
          : getTooltipPosition(node)
        setSelectedNode(node)
        setTooltip({
          x: pos.x,
          y: pos.y,
          rules: [],
          unpack: node as ExpressionLeaf,
        })
        return
      }
      setTooltip(null)
      setSelectedNode(null)
      return
    }

    const applicable = getAllApplicableRules(node as GameOperator, enabledRules)
    if (applicable.length === 0) {
      setTooltip(null)
      setSelectedNode(null)
      return
    }

    const pos = event
      ? { x: event.clientX, y: event.clientY + window.scrollY }
      : getTooltipPosition(node)

    setSelectedNode(node)
    setTooltip({
      x: pos.x,
      y: pos.y,
      rules: applicable.map(rule => ({
        rule,
        label: rule.label(node as GameOperator),
      })),
    })
  }

  function pushUndo(currentTree: GameNode) {
    if (mode === 'puzzles') {
      setUndoStack(prev => {
        const stack = [...prev, cloneGameNode(currentTree)]
        return stack.length > UNDO_CAP ? stack.slice(stack.length - UNDO_CAP) : stack
      })
    } else {
      setSandboxUndoStack(prev => {
        const stack = [...prev, cloneGameNode(currentTree)]
        return stack.length > UNDO_CAP ? stack.slice(stack.length - UNDO_CAP) : stack
      })
    }
  }

  function handleApplyRule(rule: Rule) {
    if (!selectedNode || !activeTree) return

    pushUndo(activeTree)

    const { newTree, resultNode } = rule.apply(activeTree, selectedNode as GameOperator)
    const resultExpr = resultNode.type === 'leaf' ? (resultNode as ExpressionLeaf).expression : null

    if (mode === 'puzzles') {
      setTree(newTree)
    } else {
      setSandboxTree(newTree)
    }
    setSelectedNode(null)
    setEvaluatedNode(resultNode)
    setHighlightValue(resultExpr)
    setTooltip(null)
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

  function handleUnpack() {
    if (!tooltip?.unpack || !activeTree) return

    pushUndo(activeTree)

    const { newTree, resultNode } = unpackLeaf(activeTree, tooltip.unpack)
    if (mode === 'puzzles') {
      setTree(newTree)
    } else {
      setSandboxTree(newTree)
    }
    setSelectedNode(null)
    setEvaluatedNode(resultNode)
    setTooltip(null)

    setTimeout(() => {
      setEvaluatedNode(null)
    }, 600)
  }

  function handleUndo() {
    if (mode === 'puzzles') {
      if (undoStack.length === 0) return
      const prev = undoStack[undoStack.length - 1]
      setUndoStack(s => s.slice(0, -1))
      setTree(prev)
    } else {
      if (sandboxUndoStack.length === 0) return
      const prev = sandboxUndoStack[sandboxUndoStack.length - 1]
      setSandboxUndoStack(s => s.slice(0, -1))
      setSandboxTree(prev)
    }
    setSelectedNode(null)
    setTooltip(null)
    setEvaluatedNode(null)
    setHighlightValue(null)
    setHintNodes(new Set())
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
    setHighlightValue(null)
    setHintNodes(new Set())
    setUndoStack([])
    setTooltip(null)
  }

  function handleSkip() {
    if (puzzleIndex === PUZZLES.length - 1) {
      setShowComplete(true)
      return
    }
    const nextIndex = puzzleIndex + 1
    setPuzzleIndex(nextIndex)
    setTree(buildTree(nextIndex))
    setSelectedNode(null)
    setHighlightValue(null)
    setHintNodes(new Set())
    setUndoStack([])
    setTooltip(null)
    setEvaluatedNode(null)
  }

  function handlePlayAgain() {
    setPuzzleIndex(0)
    setTree(buildTree(0))
    setSelectedNode(null)
    setHighlightValue(null)
    setCompletedPuzzles(new Set())
    setEvaluatedNode(null)
    setShowComplete(false)
    setHintVisible(true)
    setHintOpacity(1)
    setHintNodes(new Set())
    setUndoStack([])
    setTooltip(null)
  }

  const handleHint = useCallback(() => {
    if (!activeTree) return
    const applicable = findAllApplicableNodes(activeTree, enabledRules)
    const nodeSet = new Set<GameNode>(applicable)
    setHintNodes(nodeSet)
    setTimeout(() => setHintNodes(new Set()), 400)
  }, [activeTree, enabledRules])

  // Dismiss tooltip on outside click is handled inside RuleTooltip

  if (showComplete && mode === 'puzzles') {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>You did it!</h1>
        <p style={{ fontSize: 18, color: '#6b7280', margin: '0 0 32px', textAlign: 'center' }}>
          All {PUZZLES.length} puzzles solved. You're an algebra whiz!
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
          {Array.from({ length: PUZZLES.length }, (_, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: '#2563eb', border: '1.5px solid #2563eb' }} />
          ))}
        </div>
        <button
          onClick={handlePlayAgain}
          style={{ padding: '10px 28px', fontSize: 16, fontWeight: 600, fontFamily: 'system-ui, sans-serif', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = '#1d4ed8' }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = '#2563eb' }}
        >
          Play again
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', fontFamily: 'system-ui, sans-serif', position: 'relative' }}>
      {/* Tab bar */}
      <TabBar mode={mode} onSwitch={(m) => {
        setMode(m)
        setSelectedNode(null)
        setTooltip(null)
        setHintNodes(new Set())
        setEvaluatedNode(null)
        setHighlightValue(null)
      }} />

      {mode === 'puzzles' ? (
        <>
          {/* Header: progress + undo + hint */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
            <ProgressDots current={puzzleIndex} total={PUZZLES.length} completed={completedPuzzles} />
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              aria-label="Undo last step"
              aria-disabled={undoStack.length === 0}
              style={{
                padding: '4px 14px',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'system-ui, sans-serif',
                background: '#e5e7eb',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 12,
                cursor: undoStack.length > 0 ? 'pointer' : 'default',
                opacity: undoStack.length > 0 ? 1 : 0.4,
              }}
              onMouseEnter={(e) => { if (undoStack.length > 0) (e.target as HTMLButtonElement).style.background = '#d1d5db' }}
              onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = '#e5e7eb' }}
            >
              ↩ Undo
            </button>
            {!isDone && (
              <button
                onClick={handleHint}
                style={{ padding: '4px 14px', fontSize: 13, fontWeight: 500, fontFamily: 'system-ui, sans-serif', background: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db', borderRadius: 12, cursor: 'pointer' }}
                onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = '#d1d5db' }}
                onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = '#e5e7eb' }}
              >
                Hint
              </button>
            )}
          </div>

          {/* Lesson text */}
          <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 8px' }}>
            {currentPuzzle.lesson}
          </p>

          {/* First-use hint */}
          {hintVisible && puzzleIndex === 0 && (
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 4px', opacity: hintOpacity, transition: 'opacity 0.3s', pointerEvents: 'none' }}>
              Click an operator to see what you can do.
            </p>
          )}

          {/* Transform target */}
          {puzzleType === 'transform' && currentPuzzle.target && (
            <p style={{
              fontSize: 16,
              fontWeight: 500,
              color: isDone ? '#16a34a' : '#6b7280',
              margin: '0 0 8px',
              transition: 'color 0.3s',
            }}>
              {isDone ? '✓ ' : ''}Target: {currentPuzzle.target.replace(/\*/g, '×')}
            </p>
          )}

          {/* Infix display */}
          <div data-testid="infix-display" style={{ marginBottom: 8, padding: '10px 24px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, minWidth: 200, textAlign: 'center' }}>
            <ColoredInfixDisplay segments={segments} highlightValue={highlightValue} />
          </div>

          {/* Tree */}
          <div style={{ width: '100%', maxWidth: 800, position: 'relative' }}>
            <TreeView
              tree={tree}
              selectedNode={selectedNode}
              evaluatedNode={evaluatedNode}
              hintNodes={hintNodes}
              onNodeClick={(node, e) => handleNodeClick(node, e as React.MouseEvent)}
              svgRef={svgRef as React.RefObject<SVGSVGElement>}
            />
          </div>

          {/* Tooltip */}
          {tooltip && (
            <RuleTooltip
              tooltip={tooltip}
              onApplyRule={handleApplyRule}
              onUnpack={handleUnpack}
              onDismiss={() => { setTooltip(null); setSelectedNode(null) }}
            />
          )}

          {/* Done / Next / Skip */}
          <div style={{ minHeight: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 4 }}>
            {isDone ? (
              <button
                onClick={handleNext}
                style={{ padding: '8px 24px', fontSize: 15, fontWeight: 600, fontFamily: 'system-ui, sans-serif', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = '#1d4ed8' }}
                onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = '#2563eb' }}
              >
                Done! → Next puzzle
              </button>
            ) : (
              <button
                onClick={handleSkip}
                style={{ padding: '4px 14px', fontSize: 12, fontWeight: 400, fontFamily: 'system-ui, sans-serif', background: 'none', color: '#9ca3af', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
                onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.color = '#6b7280' }}
                onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.color = '#9ca3af' }}
              >
                Skip this puzzle
              </button>
            )}
          </div>
        </>
      ) : (
        /* Sandbox mode */
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, width: '100%', maxWidth: 800 }}>
            <input
              type="text"
              inputMode="text"
              value={sandboxExpr}
              onChange={(e) => handleSandboxInput(e.target.value)}
              placeholder="Type an expression... e.g. 3(x+2)"
              style={{
                flex: 1,
                padding: '8px 14px',
                fontSize: 15,
                fontFamily: 'system-ui, sans-serif',
                border: `1px solid ${sandboxError ? '#ef4444' : '#d1d5db'}`,
                borderRadius: 8,
                outline: 'none',
              }}
              onFocus={(e) => { if (!sandboxError) e.target.style.borderColor = '#2563eb' }}
              onBlur={(e) => { if (!sandboxError) e.target.style.borderColor = '#d1d5db' }}
            />
            <button
              onClick={handleUndo}
              disabled={sandboxUndoStack.length === 0}
              aria-label="Undo last step"
              aria-disabled={sandboxUndoStack.length === 0}
              style={{
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'system-ui, sans-serif',
                background: '#e5e7eb',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 12,
                cursor: sandboxUndoStack.length > 0 ? 'pointer' : 'default',
                opacity: sandboxUndoStack.length > 0 ? 1 : 0.4,
              }}
              onMouseEnter={(e) => { if (sandboxUndoStack.length > 0) (e.target as HTMLButtonElement).style.background = '#d1d5db' }}
              onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = '#e5e7eb' }}
            >
              ↩ Undo
            </button>
          </div>

          {sandboxError && (
            <p style={{ fontSize: 13, color: '#ef4444', margin: '0 0 8px' }}>{sandboxError}</p>
          )}

          {sandboxTree ? (
            <>
              <div data-testid="infix-display" style={{ marginBottom: 8, padding: '10px 24px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, minWidth: 200, textAlign: 'center' }}>
                <ColoredInfixDisplay segments={segments} highlightValue={highlightValue} />
              </div>

              <div style={{ width: '100%', maxWidth: 800, position: 'relative' }}>
                <TreeView
                  tree={sandboxTree}
                  selectedNode={selectedNode}
                  evaluatedNode={evaluatedNode}
                  hintNodes={hintNodes}
                  onNodeClick={(node, e) => handleNodeClick(node, e as React.MouseEvent)}
                  svgRef={svgRef as React.RefObject<SVGSVGElement>}
                />
              </div>

              {tooltip && (
                <RuleTooltip
                  tooltip={tooltip}
                  onApplyRule={handleApplyRule}
                  onUnpack={handleUnpack}
                  onDismiss={() => { setTooltip(null); setSelectedNode(null) }}
                />
              )}
            </>
          ) : !sandboxError && (
            <p style={{ fontSize: 16, color: '#9ca3af', margin: '60px 0', textAlign: 'center' }}>
              Enter an expression to build a tree
            </p>
          )}
        </>
      )}
    </div>
  )
}
