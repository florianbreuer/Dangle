# Dangle — TODOs

## v2: Custom infix renderer

**What:** Write a `treeToInfix(node: MathNode): string` function that outputs kid-friendly notation.

**Why:** `math.js`'s built-in `node.toString()` uses `*` instead of `×`, may insert/drop parentheses based on its own precedence rules, and isn't designed for pedagogical display. For v2, where the infix form is a primary teaching mechanism (kids should connect the tree to standard notation), controlled output matters.

**Pros:** Full control over notation. Can later add color-coding (highlight the subexpression that just changed), bold brackets, or display `2 × (3 + 4)` as `2 × [ 3 + 4 ]` to match the tree visual.

**Cons:** ~50 lines of code; needs tests for all node types (+, -, *, /, parentheses); must handle operator precedence rules for correct bracketing.

**Context:** Not blocking for MVP — kids understand `*`. Becomes important for v2 when variables are introduced (`3x` not `3 * x`) and when the infix form needs to stay synchronized with algebraic manipulation steps.

**Depends on:** v2 scope milestone (variables + distributive law).

---

## v3: Split treeOps.ts into treeOps + rules

**What:** When `treeOps.ts` exceeds ~400 LOC (after v2 rule registry additions it will be ~340 LOC), split into `treeOps.ts` (layout, traversal, parse, infix) and `rules.ts` (Rule interface, EVALUATE/COMBINE/DISTRIBUTE rules, getApplicableRule, findAllApplicableNodes).

**Why:** The file will be doing two distinct jobs — pure tree operations (layout, traversal) and algebraic rule logic. Splitting keeps each file focused and makes it easy to add new rules without touching layout code.

**Pros:** Better navigability, natural seam for future rules, smaller test files.

**Cons:** Adds one import in App.tsx and TreeView.tsx. Minor.

**Context:** v2 adds the Rule interface and 3 rule objects. Threshold for splitting is ~400 LOC or when a 4th rule is added (factoring, etc.).

**Effort:** S (human: 1 hour / CC: ~5 min) | **Priority:** P3 | **Depends on:** v2 implementation

---

## v3: Factoring rule (`ab + ac = a(b+c)`)

**What:** The inverse of the distributive law. Recognize a common factor in a sum and factor it out. `3x + 6 = 3(x + 2)`. New `FACTOR_RULE` object in the rule registry.

**Why:** Lets kids run puzzles in both directions — expand then factor, or factor then expand. Creates the first closed loop: distribute → evaluate → factor → back to start. Deepens structural understanding.

**Pros:** Architecturally clean (just a new Rule object), pedagogically powerful (inverse of distribute), enables new puzzle types.

**Cons:** Pattern-matching is harder than distribute — need to find GCD of coefficients and identify the common factor. Edge cases: `x + 2x` (factor out x), `6x + 4` (factor out 2).

**Context:** Add after distributive law is shipped and validated in kids test. The rule registry pattern introduced in v2 is designed to accommodate this.

**Effort:** M (human: 1 day / CC: ~30 min) | **Priority:** P2 | **Depends on:** v2 distributive law

---

## v3: localStorage persistence

**What:** Persist `completedPuzzles` (Set of puzzle indices) and `bestStepCount` per puzzle to `localStorage`. On load, restore completed state. Show step counter during each puzzle ("Step 3 of ?").

**Why:** After the kids test with v2, if they want to continue where they left off across sessions, nothing currently persists. Also enables star-rating (1-3 stars based on steps vs. optimal).

**Pros:** Turns a single-session prototype into something kids can return to. Enables per-puzzle improvement tracking.

**Cons:** Need to define "optimal" step count per puzzle (hand-specified in puzzles.ts). No backend — localStorage only, so no sync across devices.

**Context:** Originally v2 handoff item 5. Deferred in v2 CEO review because it doesn't affect the hypothesis test. Implement after v2 is tested.

**Effort:** M (human: 3 hours / CC: ~15 min) | **Priority:** P2 | **Depends on:** v2 puzzle set finalization

---

## v2: Dev-time assertion for atom mismatch in mathToGameTree

**What:** Add a console.error in `mathToGameTree` when no atoms from the puzzle definition matched any subtree in the parsed AST. Add a unit test for the mismatch case.

**Why:** If a puzzle author writes `atoms: ["2x", "3x"]` but the expression is `2 * x + 3 * x`, the atoms won't structurally match the AST subtrees (since `2x` parses as `OperatorNode(*, 2, x)` not a single token). The game silently builds the wrong tree at the wrong granularity. This is invisible and hard to debug.

**Pros:** Catches puzzle authoring errors immediately during development. Zero runtime cost in production (console.error only).

**Cons:** Minimal. ~10 lines of assertion code + 1 test.

**Context:** Surfaced in eng review failure mode analysis. The structural AST comparison for atom matching is correct, but there's no guard for when zero atoms match. Add assertion inside `mathToGameTree`: if the result tree contains zero ExpressionLeaf nodes, fire console.error with the expression and atoms list.

**Effort:** S (human: ~1 hour / CC: ~5 min) | **Priority:** P1 | **Depends on:** v2 mathToGameTree implementation

---

## v2: Defensive coefficient extraction for COMBINE rule

**What:** Make the coefficient extraction logic in COMBINE rule return `false` (no rule applies) instead of throwing when it encounters an unrecognized AST shape. Add tests for malformed inputs like multi-variable terms (`2xy`), nested expressions, or unexpected node types.

**Why:** The COMBINE rule extracts coefficients from ExpressionLeaf ASTs (e.g. `5x` → coeff=5, var=x). If the AST shape doesn't match expected patterns (`ConstantNode * SymbolNode` or bare `SymbolNode`), the extraction could throw or return NaN, causing a runtime crash instead of gracefully declining.

**Pros:** Prevents runtime crashes on edge cases. Makes it safe to add more complex leaf expressions in v3 without breaking COMBINE.

**Cons:** Minimal. ~15 lines of defensive checks + 3-4 tests.

**Context:** Surfaced in eng review failure mode analysis. v2 puzzles use simple patterns (x, 2x, 3x) but the extraction logic should be defensive for forward compatibility. The `canApply` function should catch extraction failure and return false.

**Effort:** S (human: ~1 hour / CC: ~5 min) | **Priority:** P1 | **Depends on:** v2 COMBINE rule implementation

---

## v3: DESIGN.md (design system documentation)

**What:** Create a `DESIGN.md` documenting Dangle's visual system: color palette (depth colors, selection, evaluation, variable amber), font choices (system-ui), spacing scale, component vocabulary (operator circles, leaf rectangles, infix card, progress dots), and interaction states (selected, evaluated, hint flash, subtree highlight).

**Why:** The app currently uses ~25 hardcoded hex colors in inline styles with no formal system. v2 adds 6 more colors. Without documentation, every new feature re-invents color choices and risks visual inconsistency.

**Pros:** Prevents drift as the app grows. Makes it easy for a new AI session (or human contributor) to match existing patterns. Low effort with CC.

**Cons:** Premature if v2 test shows the product doesn't have legs. The TODO has zero cost if never acted on.

**Context:** Surfaced in design review Pass 5. No DESIGN.md currently exists. Create this after v2 test validates the product direction.

**Effort:** S (human: ~2 hours / CC: ~10 min) | **Priority:** P3 | **Depends on:** v2 test results

---

## v2: Keyboard accessibility

**What:** Make the tree navigable by keyboard. Tab to cycle through operator nodes, Enter to select, Enter again to Apply.

**Why:** SVG elements are not focusable by default. `<circle>` and `<rect>` need explicit `tabIndex={0}` and `onKeyDown` handlers. Without this, the app is mouse-only — not great for users who can't use a pointer, and a barrier for any future classroom deployment.

**Cons:** Requires focus management when tree redraws (the focused node disappears after Apply — need to move focus to the result node or the next available operator). Non-trivial without a focus trap library.

**Depends on:** v2 scope milestone (design system + polish pass).

---
