# Dangle — TODOs

## v2: Custom infix renderer

**What:** Write a `treeToInfix(node: MathNode): string` function that outputs kid-friendly notation.

**Why:** `math.js`'s built-in `node.toString()` uses `*` instead of `×`, may insert/drop parentheses based on its own precedence rules, and isn't designed for pedagogical display. For v2, where the infix form is a primary teaching mechanism (kids should connect the tree to standard notation), controlled output matters.

**Pros:** Full control over notation. Can later add color-coding (highlight the subexpression that just changed), bold brackets, or display `2 × (3 + 4)` as `2 × [ 3 + 4 ]` to match the tree visual.

**Cons:** ~50 lines of code; needs tests for all node types (+, -, *, /, parentheses); must handle operator precedence rules for correct bracketing.

**Context:** Not blocking for MVP — kids understand `*`. Becomes important for v2 when variables are introduced (`3x` not `3 * x`) and when the infix form needs to stay synchronized with algebraic manipulation steps.

**Depends on:** v2 scope milestone (variables + distributive law).

---

## v2: Keyboard accessibility

**What:** Make the tree navigable by keyboard. Tab to cycle through operator nodes, Enter to select, Enter again to Apply.

**Why:** SVG elements are not focusable by default. `<circle>` and `<rect>` need explicit `tabIndex={0}` and `onKeyDown` handlers. Without this, the app is mouse-only — not great for users who can't use a pointer, and a barrier for any future classroom deployment.

**Cons:** Requires focus management when tree redraws (the focused node disappears after Apply — need to move focus to the result node or the next available operator). Non-trivial without a focus trap library.

**Depends on:** v2 scope milestone (design system + polish pass).

---
