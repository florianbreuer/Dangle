export interface Puzzle {
  expression: string
  lesson: string
}

/**
 * 5 hardcrafted puzzles in order of increasing complexity.
 * Each teaches one structural insight about expression trees.
 * All use clean arithmetic (no non-integer division).
 */
export const PUZZLES: Puzzle[] = [
  {
    expression: '2 + 3',
    lesson: 'Interface intro — one operator, one click',
  },
  {
    expression: '3 * (2 + 4)',
    lesson: 'Inner node must go first — order of operations made structural',
  },
  {
    expression: '(1 + 2) * (3 + 4)',
    lesson: 'Two subtrees, either can go first',
  },
  {
    expression: '(2 + 3) * 4 - 1',
    lesson: 'Three operations, one forced sequence',
  },
  {
    expression: '(2 + 3) * (4 - 1)',
    lesson: 'Symmetric tree — both branches must resolve before root',
  },
]
