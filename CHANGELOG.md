# Changelog

All notable changes to Dangle will be documented here.

## [0.1.0.0] - 2026-03-28

### Added

- Expression tree renderer: algebraic expressions parsed via math.js and displayed as SVG binary trees — operator nodes as gray circles, number nodes as white rectangles
- Interactive evaluation loop: click any evaluable operator node (one whose children are both numbers), click Apply, watch the subtree collapse to its result
- Pedagogical tooltip: clicking a non-evaluable operator shows "Simplify the parts inside the brackets first" rather than an error
- Green flash on evaluated result node (200ms) and yellow highlight on the changed subexpression in the infix form below
- Five hardcrafted arithmetic puzzles in pedagogical order: `2+3`, `3*(2+4)`, `(1+2)*(3+4)`, `(2+3)*4-1`, `(2+3)*(4-1)`
- Progress indicator: five dots showing which puzzles are complete
- First-use hint that fades after first Apply interaction
- Full test suite: 49 tests across unit (treeOps), component (TreeView), and integration (App) layers
- GitHub Pages deployment config (`base: '/dangle/'` in vite.config.ts)
