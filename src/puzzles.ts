export interface Puzzle {
  expression: string
  atoms: string[]
  lesson: string
}

/**
 * 18 puzzles in pedagogical order.
 * Parse depth is per-puzzle via the `atoms` field.
 */
export const PUZZLES: Puzzle[] = [
  // ── Group 1: Arithmetic warm-up (5 puzzles) ──
  {
    expression: '2 + 3',
    atoms: ['2', '3'],
    lesson: 'Interface intro — one operator, one click',
  },
  {
    expression: '3 * (2 + 4)',
    atoms: ['2', '3', '4'],
    lesson: 'Inner node must go first — order of operations made structural',
  },
  {
    expression: '(1 + 2) * (3 + 4)',
    atoms: ['1', '2', '3', '4'],
    lesson: 'Two subtrees, either can go first',
  },
  {
    expression: '(2 + 3) * 4 - 1',
    atoms: ['1', '2', '3', '4'],
    lesson: 'Three operations, one forced sequence',
  },
  {
    expression: '(2 + 3) * (4 - 1)',
    atoms: ['1', '2', '3', '4'],
    lesson: 'Symmetric tree — both branches must resolve before root',
  },

  // ── Group 2: Intro to variables (3 puzzles) ──
  {
    expression: '2 * x',
    atoms: ['2', 'x'],
    lesson: 'What is 2x? Multiply a number by a variable.',
  },
  {
    expression: '3 * x',
    atoms: ['3', 'x'],
    lesson: 'Same idea — 3 times x becomes 3x',
  },
  {
    expression: '(2 + 3) * x',
    atoms: ['2', '3', 'x'],
    lesson: 'Evaluate the numbers first, then simplify with x',
  },

  // ── Group 3: Mixed arithmetic + variables (3 puzzles) ──
  {
    expression: '(1 + 4) * x',
    atoms: ['1', '4', 'x'],
    lesson: 'Add first, then multiply — order of operations with variables',
  },
  {
    expression: '2 * (3 + x)',
    atoms: ['2', '3', 'x'],
    lesson: 'Distribute — multiply each part inside the brackets',
  },
  {
    expression: '(2 + 1) * (x + 3)',
    atoms: ['1', '2', '3', 'x'],
    lesson: 'Simplify one side, then distribute',
  },

  // ── Group 4: Like-terms with atomic monomials (3 puzzles) ──
  {
    expression: '2 * x + 3 * x',
    atoms: ['2x', '3x'],
    lesson: 'Collecting like terms: 2x + 3x = 5x',
  },
  {
    expression: 'x + 4 * x',
    atoms: ['x', '4x'],
    lesson: 'x is the same as 1x — collect the terms',
  },
  {
    expression: '3 * x + 2 * x',
    atoms: ['3x', '2x'],
    lesson: 'Like terms again — same variable, add the coefficients',
  },

  // ── Group 5: Distributive law (4 puzzles) ──
  {
    expression: '3 * (x + 2)',
    atoms: ['3', 'x', '2'],
    lesson: 'Distribute: 3 times each part inside the brackets',
  },
  {
    expression: '2 * (x + 5)',
    atoms: ['2', 'x', '5'],
    lesson: 'Distribute again — multiply both terms',
  },
  {
    expression: '4 * (x + 1)',
    atoms: ['4', 'x', '1'],
    lesson: 'Distribute, simplify, done!',
  },
  {
    expression: '5 * (x + 3)',
    atoms: ['5', 'x', '3'],
    lesson: 'Full workflow: distribute → simplify → evaluate',
  },
]
