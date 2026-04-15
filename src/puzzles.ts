export interface Puzzle {
  expression: string
  atoms: string[]
  lesson: string
  puzzleType?: 'simplify' | 'transform'
  target?: string
  enabledRules?: string[]
}

/**
 * v3 puzzles: 18 original + 18 new = 36 puzzles.
 * Parse depth is per-puzzle via the `atoms` field.
 * enabledRules defaults exclude COMMUTE/ASSOCIATE (prevent infinite loops).
 * Transformation puzzles use canonical isDone (unaffected by structural rules).
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

  // ── Group 6: Commutative warm-up (3 puzzles) ──
  {
    expression: '3 + 5',
    atoms: ['3', '5'],
    lesson: 'Swap the order — addition works both ways',
    puzzleType: 'transform',
    target: '5 + 3',
    enabledRules: ['Commute'],
  },
  {
    expression: '2 * x',
    atoms: ['2', 'x'],
    lesson: 'Swap the order — multiplication works both ways too',
    puzzleType: 'transform',
    target: 'x × 2',
    enabledRules: ['Commute'],
  },
  {
    expression: '4 * x + 3',
    atoms: ['3', '4x'],
    lesson: 'Commute to rearrange a sum',
    puzzleType: 'transform',
    target: '3 + 4x',
    enabledRules: ['Commute'],
  },

  // ── Group 7: Associative regrouping (3 puzzles) ──
  {
    expression: '(2 + 3) + 4',
    atoms: ['2', '3', '4'],
    lesson: 'Regroup: move the brackets to the other side',
    puzzleType: 'transform',
    target: '2 + (3 + 4)',
    enabledRules: ['Associate Left', 'Associate Right', 'Order of Operations'],
  },
  {
    expression: '2 + (3 + 5)',
    atoms: ['2', '3', '5'],
    lesson: 'Regroup the other way, then evaluate',
    enabledRules: ['Associate Left', 'Associate Right', 'Order of Operations'],
  },
  {
    expression: '(2 * 3) * 4',
    atoms: ['2', '3', '4'],
    lesson: 'Regrouping works for multiplication too',
    puzzleType: 'transform',
    target: '2 × (3 × 4)',
    enabledRules: ['Associate Left', 'Associate Right', 'Order of Operations'],
  },

  // ── Group 8: Factoring (4 puzzles) ──
  {
    expression: '6 * x + 12',
    atoms: ['6x', '12'],
    lesson: 'Factor out the common number — what do 6 and 12 share?',
  },
  {
    expression: '4 * x + 8',
    atoms: ['4x', '8'],
    lesson: 'Factor: pull out 4 from both terms',
  },
  {
    expression: '9 * x + 3',
    atoms: ['9x', '3'],
    lesson: 'Factor: what number divides both 9 and 3?',
  },
  {
    expression: '10 * x + 15',
    atoms: ['10x', '15'],
    lesson: 'Factor: find the greatest common factor of 10 and 15',
  },

  // ── Group 9: Right distributive + mixed chains (3 puzzles) ──
  {
    expression: '(x + 2) * 3',
    atoms: ['x', '2', '3'],
    lesson: 'Distribute from the right — same idea, other direction',
  },
  {
    expression: '(x + 1) * 4',
    atoms: ['x', '1', '4'],
    lesson: 'Right distribute: multiply each term by 4',
  },
  {
    expression: '(x + 3) * 2 + x',
    atoms: ['x', '3', '2', 'x'],
    lesson: 'Distribute, simplify, then collect like terms',
  },

  // ── Group 10: Transformation puzzles (3 puzzles) ──
  {
    expression: '3 * (x + 2)',
    atoms: ['3', 'x', '2'],
    lesson: 'Transform: expand the brackets to reach the target',
    puzzleType: 'transform',
    target: '3x + 6',
  },
  {
    expression: '2 * (x + 4)',
    atoms: ['2', 'x', '4'],
    lesson: 'Transform: distribute and simplify to match the target',
    puzzleType: 'transform',
    target: '2x + 8',
  },
  {
    expression: '5 * (x + 1)',
    atoms: ['5', 'x', '1'],
    lesson: 'Transform: expand 5(x+1) step by step',
    puzzleType: 'transform',
    target: '5x + 5',
  },

  // ── Group 11: Advanced multi-rule chains (3 puzzles) ──
  {
    expression: '3 * (x + 2) + 4 * x',
    atoms: ['3', 'x', '2', '4x'],
    lesson: 'Full chain: distribute, simplify, evaluate, then collect like terms',
  },
  {
    expression: '2 * (x + 3) + 2 * x',
    atoms: ['2', 'x', '3', '2x'],
    lesson: 'Distribute, simplify, then combine the x terms',
  },
  {
    expression: '4 * (x + 2) + 3 * (x + 1)',
    atoms: ['4', '3', 'x', '2', 'x', '1'],
    lesson: 'Two distributions, then simplify and collect — the full workflow!',
  },
]
