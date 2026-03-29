# Dangle — v2 Handoff

This document is for the next AI session continuing work on Dangle. Read this first.

---

## What is Dangle?

An educational web app that teaches kids order of operations by letting them manually
evaluate algebraic expression trees. The tree is rendered as SVG. Kids click operator
nodes to evaluate them step by step, left to right in any valid order. The constraint
is structural: you can only evaluate a node whose children are both numbers.

Live URL: https://florianbreuer.github.io/Dangle/
Repo: https://github.com/florianbreuer/Dangle
Branch: `main` deploys automatically to GitHub Pages via `.github/workflows/deploy.yml`.
Stack: React 18 + TypeScript + Vite + math.js. No routing, no backend, no auth.

---

## v1 State (what's shipped)

- 5 arithmetic puzzles in pedagogical order
- SVG binary tree renderer with click-to-select operators
- Evaluable-or-not guard ("Simplify the parts inside the brackets first.")
- Green flash on result node + yellow highlight on changed infix token
- Completion screen after all 5 puzzles ("You did it!" + Play again)
- 51 passing tests (Vitest + @testing-library/react)

---

## File Map

```
src/
  App.tsx            — root component, all state, puzzle flow, completion screen
  App.test.tsx       — 15 integration tests (full puzzle flows end-to-end)
  puzzles.ts         — PUZZLES array (expression string + lesson label)
  main.tsx           — ReactDOM.createRoot mount, nothing interesting
  setupTests.ts      — imports @testing-library/jest-dom

  lib/
    treeOps.ts       — ALL core logic (no React)
    treeOps.test.ts  — 28 unit tests

  components/
    TreeView.tsx     — SVG renderer, layout, selection/subtree highlighting
    TreeView.test.tsx — 8 component tests
```

### Key functions in `treeOps.ts`

| Function | What it does |
|----------|-------------|
| `parseExpression(expr)` | `math.parse` + `unwrapParens` — always use this, never raw `math.parse` |
| `unwrapParens(node)` | Strips `ParenthesisNode` wrappers math.js inserts around `(...)` |
| `canEvaluate(node)` | True if node is an OperatorNode with two ConstantNode children |
| `evaluateArithmetic(node)` | Computes the numeric result of a single op; returns NaN for `/0` |
| `applyNode(tree, target)` | Immutable replace: returns `{ newTree, resultNode }` |
| `layoutTree(node)` | Recursive binary layout, spread=200 halving per level |
| `getSubtreeNodes(node)` | Returns Set of all nodes in subtree (for dashed highlight) |
| `treeToInfix(node)` | `node.toString()` with `*` → `×` substitution |

### Critical implementation details

**ParenthesisNode**: math.js wraps `(2+4)` in a `ParenthesisNode { content: OperatorNode }`.
`unwrapParens` must be called at parse time or `canEvaluate` will never return true for
inner nodes. Never store a ParenthesisNode in state.

**Reference identity**: `selectedNode` is a direct reference to an AST node. Node
identity is checked with `===`. After `applyNode`, the old reference is stale — always
reset `setSelectedNode(null)` immediately after every transform.

**SVG dimensions**: `SVG_WIDTH=800, SVG_HEIGHT=420, OFFSET_X=400, OFFSET_Y=60`.
Height was bumped from 360 to 420 to prevent bottom-leaf clipping on 4-level trees.
If puzzles go deeper than 4 levels, increase `SVG_HEIGHT` further.

**`applyNode` return signature**: returns `{ newTree, resultNode }`, not just the tree.
`resultNode` is the newly inserted `ConstantNode` — held in state briefly as
`evaluatedNode` to render the green flash in TreeView.

---

## v2 — What to Build Next

These come from TODOS.md and QA findings. Roughly in priority order.

### 1. Custom infix renderer (TODOS.md)

Replace `treeToInfix`'s regex hack with a real recursive renderer.

**Why it matters**: math.js `toString()` uses `*` not `×`, adds/drops parens based on
its own precedence rules (not ours), and can't be color-coded. For v2 pedagogy (kids
connecting tree structure to written notation) we need full control.

**Spec**:
- Recurse the AST, build the string ourselves
- Operator precedence table: `*` and `/` bind tighter than `+` and `-`
- Add parens around a subexpression only when its operator has lower precedence than
  its parent's — same rule mathematicians use
- Replace `*` with `×` and `-` with `−` (minus sign, not hyphen) in output
- This is ~50 lines of code and ~15 new unit tests in `treeOps.test.ts`

**Later extension**: color-code the infix by subtree — each bracket group gets a
matching color that corresponds to its circle/rect in the tree.

### 2. Variables + algebraic simplification

This is the main v2 feature — move from arithmetic to algebra.

**Concept**: introduce puzzles like `2x + 3x`. The tree has `SymbolNode` leaves (`x`).
Kids evaluate `2x + 3x = 5x` using the distributive law (a rule button, not free-form).

**math.js support**: `math.parse('2*x + 3*x')` gives an AST with `SymbolNode`.
`math.evaluate('2*x + 3*x', { x: 5 })` works for numeric checks.

**What this requires**:
- New node type handling in `TreeView.tsx` — render `SymbolNode` as a different shape
  (oval? diamond?) so kids see variables are different from numbers
- New `canSimplify` rule in `treeOps.ts` for like-term collection (separate from
  `canEvaluate` which stays pure arithmetic)
- New puzzle set in `puzzles.ts`
- Update the infix renderer to output `2x` not `2 × x`

### 3. Keyboard accessibility (TODOS.md)

Make the tree navigable without a mouse.

- Add `tabIndex={0}` to each operator `<g>` in TreeView
- Add `onKeyDown` handler: `Enter` = select/apply, `Tab` = next operator
- After Apply, move focus to the result node (or next available operator)
- Test with `userEvent.tab()` and `userEvent.keyboard('{Enter}')` from
  `@testing-library/user-event`

### 4. Hint system v2

Currently there's one static hint ("Click an operator to evaluate it.") that fades
after first use. For v2 with more complex puzzles, kids will need contextual guidance.

**Ideas**:
- "Hint" button that highlights the next valid move (the evaluable nodes)
- Step counter ("3 steps left") so kids know how close they are
- Difficulty indicator per puzzle

### 5. Score / progress persistence

Right now completing all 5 puzzles just shows a congratulations screen and resets.
Nothing persists across sessions.

- `localStorage` for `completedPuzzles` and best-step-count per puzzle
- Star rating (1-3 stars) based on how many steps it took vs. optimal
- "Puzzle select" screen so kids can replay specific puzzles

---

## Commands

```bash
npm run dev        # local dev server at localhost:5173
npm test           # run all 51 tests (Vitest)
npm run build      # TypeScript compile + Vite bundle to dist/
```

Push to `main` auto-deploys to GitHub Pages (takes ~2 min).

---

## Deployment

- GitHub Actions: `.github/workflows/deploy.yml` — runs on push to `main`
- Pipeline: `npm ci` → `npm test` → `npm run build` → GitHub Pages deploy
- `vite.config.ts` has `base: '/Dangle/'` — capital D must match repo name exactly
- If deploy fails, check Settings → Environments → github-pages → deployment branch rules

---

## What to avoid

- Never call `math.parse()` directly — always use `parseExpression()` to get
  ParenthesisNodes unwrapped before storing in state
- Never mutate AST nodes — `applyNode` uses `node.transform()` for immutable replace
- Never use `node.toString()` directly for display — use `treeToInfix()` (and when
  v2 custom renderer is built, replace that function body)
- `SVG_HEIGHT` is in `TreeView.tsx` — if adding deeper trees, bump it
- Tests use `container.querySelectorAll('circle')` with index assumptions about layout
  order — when adding new puzzles, check that existing test circle indices still hold
