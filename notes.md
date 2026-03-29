## Things I noticed / Ideas ##

Currently the game is not very compelling: the player just clicks randomly on nodes, or learns 
to click the lowest nodes, without needing to understand anything. There isn't any challenge 
or sense of acomplishment. This will change has we introduce more puzzles and more mechanics.

### Deployment ###
- Currently, the app lives in Github pages, deployed from `main` branch. 
  There's a workflow that deploys `main` to pages every time `main` is updated.
  It would be useful if we could have an additional workflow to deploy whatever
  our current experimental branch is, without merging to `main`.
  
### Features ###  
- The puzzles should be arranged in **levels**, with the player being able to navigate to
  different levels. Some nice completion display every time a level is completed.
- Besides levels, there should also be a **sandbox mode**, where one can try out all of the 
  functionality. This would be particularly good for debugging and ideation.
- Clicking on a node currently displays the possible action(s), but that's at the bottom 
  of the screen, so the player has to move the mouse down and up again every time. 
  The available action(s) should rather show up in a tooltip menu.
- New node type: **equal sign** (maybe rendered as a stylised balancing scale?), 
  to allow solving equations. Need new node functionality, such as adding a subtree to 
  both sides of the equality (really above the root!), or moving a subtree across 
  (inverting the operation linking this subtree to the root).
- New actions:
  - right distributive law (currently only the left is implemented)
  - commutative law
  - associative law (but what does the user click on for that...?)
  - unpack a leaf that contains a non-atomic expression, e.g. [3x] -> (*, 3, x). One level
    or completely.
    This is the opposite of the current "order of operations" (which we may want to rename 
	"combine" or something).
  - create a new subtree (needed for solving equations)
  - manual changes to a tree, such as dragging and dropping a subtree 
    (e.g. for solving equations or performing distributive law manually as part of a puzzle)
  - Plugging values into variables
- New puzzle types. We'll need a more flexble way to record the puzzles. 
  - Solve an equation
  - type infix corresponding to displayed tree
  - create tree corresponding to displayed infix
  - transform the given expression into a new one (e.g. for factorisation). 
    Solving an equation is really an instance of this.
  - Perform some law, e.g. distributive law, manually to test this ability.
- For some of these puzzle modes we'll need to display a target expression separately, which
  doesn't change with node operations.
- Ultimately, we'll want a puzzle editor utility, but for now manually changing a 
  `puzzles.ts` file should be good enough.
  
### Longer Term ###  
- Would be nice if mathematical text was rendered better, with something looking like LaTeX
- 24-game 
- tree rendered with spring physics