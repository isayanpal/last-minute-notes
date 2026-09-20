---
title: "Patterns: Trees, Heaps, Search and Graphs"
description: "Tree BFS and DFS, two heaps, subsets and backtracking, modified binary search, top K, K-way merge, and topological sort with templates, dry runs, variants, and Java implementations."
---

# 📘 Patterns: Trees, Heaps, Search and Graphs

This page covers patterns 7 to 14 from the [dsa-patterns](https://github.com/isayanpal/dsa-patterns) repository.
It continues from [Arrays, Strings and Linked Lists](/docs/dsa/arrays-and-linked-lists), and reuses `ListNode`, `fromArray`, and `toArray` from that page.
JavaScript and Java code is included, and every snippet on this page was executed against test cases.
Every pattern section ends with a **Java Implementation** subsection.
Java conventions: all methods are `static` members of one `Solution` class, `import java.util.*;` is assumed, helper classes such as `ListNode` and `TreeNode` are top-level package-private classes in the same file, and the trailing `//` comments show a sample call and its result.
Every Java snippet was compiled with JDK 17 and run against test cases.
Java snippets on this page reuse `ListNode`, `fromArray`, `toList`, and `swap` from the Java helpers on the arrays page.

## Table of Contents

1. [Shared Helpers: TreeNode and Heap](#1-shared-helpers-treenode-and-heap)
2. [Tree Breadth-First Search](#2-tree-breadth-first-search)
3. [Tree Depth-First Search](#3-tree-depth-first-search)
4. [Two Heaps](#4-two-heaps)
5. [Subsets and Backtracking](#5-subsets-and-backtracking)
6. [Modified Binary Search](#6-modified-binary-search)
7. [Top K Elements](#7-top-k-elements)
8. [K-way Merge](#8-k-way-merge)
9. [Topological Sort](#9-topological-sort)
10. [Java Pitfalls](#10-java-pitfalls)
11. [Quick Recap](#11-quick-recap)

---

## 1. Shared Helpers: TreeNode and Heap

### 1.1 TreeNode and a Builder

`buildTree` takes the level-order array format used by LeetCode, where `null` marks a missing child.

```js
class TreeNode {
  constructor(val = 0, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

function buildTree(values) {
  if (values.length === 0 || values[0] === null) return null;
  const root = new TreeNode(values[0]);
  const queue = [root];
  let i = 1;
  for (let head = 0; head < queue.length && i < values.length; head++) {
    const node = queue[head];
    if (i < values.length && values[i] !== null) {
      node.left = new TreeNode(values[i]);
      queue.push(node.left);
    }
    i++;
    if (i < values.length && values[i] !== null) {
      node.right = new TreeNode(values[i]);
      queue.push(node.right);
    }
    i++;
  }
  return root;
}
```

### 1.2 A Heap for JavaScript

JavaScript has no built-in priority queue, and interviewers know it.
Be ready to write one, or say clearly that you would import one and explain its API.
This generic binary heap treats `compare(a, b) < 0` as "a comes out first".

```js
class Heap {
  #data = [];
  #compare;

  constructor(compare = (a, b) => a - b) {
    this.#compare = compare;                 // default: min-heap of numbers
  }

  get size() {
    return this.#data.length;
  }

  peek() {
    return this.#data[0];
  }

  push(value) {
    this.#data.push(value);
    this.#siftUp(this.#data.length - 1);
  }

  pop() {
    const data = this.#data;
    if (data.length === 0) return undefined;
    const top = data[0];
    const last = data.pop();
    if (data.length > 0) {
      data[0] = last;
      this.#siftDown(0);
    }
    return top;
  }

  #siftUp(i) {
    const data = this.#data;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.#compare(data[i], data[parent]) >= 0) break;
      [data[i], data[parent]] = [data[parent], data[i]];
      i = parent;
    }
  }

  #siftDown(i) {
    const data = this.#data;
    const n = data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = left + 1;
      if (left < n && this.#compare(data[left], data[smallest]) < 0) smallest = left;
      if (right < n && this.#compare(data[right], data[smallest]) < 0) smallest = right;
      if (smallest === i) break;
      [data[i], data[smallest]] = [data[smallest], data[i]];
      i = smallest;
    }
  }
}

const minHeap = new Heap();                       // smallest first
const maxHeap = new Heap((a, b) => b - a);        // largest first
const byDistance = new Heap((a, b) => a.dist - b.dist);
```

| Operation | Cost |
| --- | --- |
| `push` | O(log n) |
| `pop` | O(log n) |
| `peek` | O(1) |
| Build from n items by pushing one by one | O(n log n) |

### 1.3 Java Implementation

```java
class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;

    TreeNode(int val) {
        this.val = val;
    }
}
```

`buildTree` accepts the LeetCode level-order format.
It takes `Integer[]` (a boxed array) because `null` marks a missing child.

```java
static TreeNode buildTree(Integer... values) {
    if (values.length == 0 || values[0] == null) return null;
    TreeNode root = new TreeNode(values[0]);
    Queue<TreeNode> queue = new ArrayDeque<>();
    queue.add(root);
    int i = 1;
    while (!queue.isEmpty() && i < values.length) {
        TreeNode node = queue.poll();
        if (i < values.length && values[i] != null) {
            node.left = new TreeNode(values[i]);
            queue.add(node.left);
        }
        i++;
        if (i < values.length && values[i] != null) {
            node.right = new TreeNode(values[i]);
            queue.add(node.right);
        }
        i++;
    }
    return root;
}
// buildTree(3, 9, 20, null, null, 15, 7)
```

Which collection to reach for:

| Need | Use | Notes |
| --- | --- | --- |
| Queue (BFS) | `ArrayDeque<T>` | Faster than `LinkedList`, and O(1) at both ends. Does **not** allow `null` elements. |
| Stack | `ArrayDeque<T>` with `push` / `pop` / `peek` | Avoid the legacy `Stack` class, which is synchronized and slow. |
| Min-heap | `new PriorityQueue<>()` | Natural ordering, smallest first. |
| Max-heap | `new PriorityQueue<>(Collections.reverseOrder())` | Or a comparator. |
| Heap of arrays or records | `new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]))` | Never write `a[0] - b[0]`. |
| Ordered map | `TreeMap<K, V>` | Gives `floorKey`, `ceilingKey`, `firstKey`. |

| `PriorityQueue` method | Cost | Note |
| --- | --- | --- |
| `add` / `offer` | O(log n) | |
| `poll` | O(log n) | Returns `null` when empty |
| `peek` | O(1) | Returns `null` when empty |
| `remove(Object)` | O(n) | Linear scan, do not use in hot loops |
| Iteration | - | **Not sorted**, it is heap order |

---

## 2. Tree Breadth-First Search

### 2.1 When to Use

- Level order traversal, or anything phrased as "by level", "row", "depth k".
- Shortest path in an **unweighted** graph or grid.
- Right or left side view, zigzag, connect same-level nodes, minimum depth.

### 2.2 Core Idea

Use a queue.
Process **one full level at a time**: the queue length at the start of a level is the number of nodes in that level.
Children are appended for the next level.

Two implementation styles:

| Style | Notes |
| --- | --- |
| Queue with `shift()` | Easy to read. `Array.shift` is O(n) on large arrays, so a 10^5 node tree can go quadratic. |
| Current level array replaced by next level | No `shift`, O(1) per node, and the level boundary is explicit. Used below. |

### 2.3 Problem: Level Order Traversal

```js
function levelOrder(root) {
  if (!root) return [];
  const result = [];
  let level = [root];
  while (level.length > 0) {
    result.push(level.map((node) => node.val));
    const next = [];
    for (const node of level) {
      if (node.left) next.push(node.left);
      if (node.right) next.push(node.right);
    }
    level = next;
  }
  return result;
}

levelOrder(buildTree([3, 9, 20, null, null, 15, 7])); // [[3], [9, 20], [15, 7]]
```

```text
        3            level 0: [3]
       / \
      9   20         level 1: [9, 20]
         /  \
        15   7       level 2: [15, 7]
```

Complexity: O(n) time. Space is O(w) where `w` is the maximum width of the tree, which is up to n/2 for a complete tree.

### 2.4 Problem: Right Side View

What would you see standing on the right of the tree?
It is the **last node of every level**.

```js
function rightSideView(root) {
  if (!root) return [];
  const view = [];
  let level = [root];
  while (level.length > 0) {
    view.push(level[level.length - 1].val);
    const next = [];
    for (const node of level) {
      if (node.left) next.push(node.left);
      if (node.right) next.push(node.right);
    }
    level = next;
  }
  return view;
}

rightSideView(buildTree([1, 2, 3, null, 5, null, 4])); // [1, 3, 4]
```

The left view is the first node of each level.
A DFS alternative visits the right child first and records the first node seen at each depth.

### 2.5 Extra Variants

**Zigzag level order.**
Reverse alternate levels when collecting values.

```js
function zigzagLevelOrder(root) {
  if (!root) return [];
  const result = [];
  let level = [root];
  let leftToRight = true;
  while (level.length > 0) {
    const values = level.map((n) => n.val);
    result.push(leftToRight ? values : values.reverse());
    leftToRight = !leftToRight;
    const next = [];
    for (const node of level) {
      if (node.left) next.push(node.left);
      if (node.right) next.push(node.right);
    }
    level = next;
  }
  return result;
}
```

**Minimum depth.**
BFS can stop at the **first leaf** it sees, which beats DFS on skewed trees.

```js
function minDepth(root) {
  if (!root) return 0;
  let depth = 1;
  let level = [root];
  while (level.length > 0) {
    const next = [];
    for (const node of level) {
      if (!node.left && !node.right) return depth;
      if (node.left) next.push(node.left);
      if (node.right) next.push(node.right);
    }
    level = next;
    depth++;
  }
  return depth;
}
```

**Multi-source BFS on a grid (rotting oranges).**
Start the queue with **all** rotten oranges at once.
Each BFS layer is one minute.
Multi-source BFS is the trick behind "distance to nearest X" problems, and it beats running BFS from every cell.

```js
function orangesRotting(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  let fresh = 0;
  let queue = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 2) queue.push([r, c]);
      else if (grid[r][c] === 1) fresh++;
    }
  }
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let minutes = 0;
  while (queue.length > 0 && fresh > 0) {
    const next = [];
    for (const [r, c] of queue) {
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === 1) {
          grid[nr][nc] = 2;
          fresh--;
          next.push([nr, nc]);
        }
      }
    }
    queue = next;
    minutes++;
  }
  return fresh === 0 ? minutes : -1;
}

orangesRotting([[2, 1, 1], [1, 1, 0], [0, 1, 1]]); // 4
```

### 2.6 Pitfalls

- Reading `queue.length` inside the level loop while also pushing to the same queue. Capture the level size first, or use the two-array style.
- Using BFS for **weighted** shortest paths. That needs Dijkstra.
- Marking a grid cell visited **when popped** instead of when pushed, which lets the same cell enter the queue many times.

### 2.7 Java Implementation

#### Level Order Traversal

The standard Java shape captures `queue.size()` at the start of each level.

```java
static List<List<Integer>> levelOrder(TreeNode root) {
    List<List<Integer>> result = new ArrayList<>();
    if (root == null) return result;
    Queue<TreeNode> queue = new ArrayDeque<>();
    queue.add(root);
    while (!queue.isEmpty()) {
        int size = queue.size();
        List<Integer> level = new ArrayList<>(size);
        for (int i = 0; i < size; i++) {
            TreeNode node = queue.poll();
            level.add(node.val);
            if (node.left != null) queue.add(node.left);
            if (node.right != null) queue.add(node.right);
        }
        result.add(level);
    }
    return result;
}
// levelOrder(buildTree(3, 9, 20, null, null, 15, 7)) -> [[3], [9, 20], [15, 7]]
```

Unlike JavaScript's `Array.shift()`, `ArrayDeque.poll()` is O(1), so the queue-based version is the right one here.

#### Right Side View

```java
static List<Integer> rightSideView(TreeNode root) {
    List<Integer> view = new ArrayList<>();
    if (root == null) return view;
    Queue<TreeNode> queue = new ArrayDeque<>();
    queue.add(root);
    while (!queue.isEmpty()) {
        int size = queue.size();
        for (int i = 0; i < size; i++) {
            TreeNode node = queue.poll();
            if (i == size - 1) view.add(node.val);
            if (node.left != null) queue.add(node.left);
            if (node.right != null) queue.add(node.right);
        }
    }
    return view;
}
// rightSideView(buildTree(1, 2, 3, null, 5, null, 4)) -> [1, 3, 4]
```

#### Extra Variants

**Zigzag level order.**
`Collections.reverse` reverses a list in place.

```java
static List<List<Integer>> zigzagLevelOrder(TreeNode root) {
    List<List<Integer>> result = new ArrayList<>();
    if (root == null) return result;
    Queue<TreeNode> queue = new ArrayDeque<>();
    queue.add(root);
    boolean leftToRight = true;
    while (!queue.isEmpty()) {
        int size = queue.size();
        List<Integer> level = new ArrayList<>(size);
        for (int i = 0; i < size; i++) {
            TreeNode node = queue.poll();
            level.add(node.val);
            if (node.left != null) queue.add(node.left);
            if (node.right != null) queue.add(node.right);
        }
        if (!leftToRight) Collections.reverse(level);
        result.add(level);
        leftToRight = !leftToRight;
    }
    return result;
}
```

**Minimum depth.**

```java
static int minDepth(TreeNode root) {
    if (root == null) return 0;
    Queue<TreeNode> queue = new ArrayDeque<>();
    queue.add(root);
    int depth = 1;
    while (!queue.isEmpty()) {
        int size = queue.size();
        for (int i = 0; i < size; i++) {
            TreeNode node = queue.poll();
            if (node.left == null && node.right == null) return depth;
            if (node.left != null) queue.add(node.left);
            if (node.right != null) queue.add(node.right);
        }
        depth++;
    }
    return depth;
}
```

**Multi-source BFS on a grid (rotting oranges).**
Store a cell as an `int[]{row, col}`, or encode it as `row * cols + col` in an `int` queue to avoid allocating arrays.

```java
static int orangesRotting(int[][] grid) {
    int rows = grid.length;
    int cols = grid[0].length;
    Queue<int[]> queue = new ArrayDeque<>();
    int fresh = 0;
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) {
            if (grid[r][c] == 2) queue.add(new int[]{r, c});
            else if (grid[r][c] == 1) fresh++;
        }
    }
    int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
    int minutes = 0;
    while (!queue.isEmpty() && fresh > 0) {
        int size = queue.size();
        for (int i = 0; i < size; i++) {
            int[] cell = queue.poll();
            for (int[] d : dirs) {
                int nr = cell[0] + d[0];
                int nc = cell[1] + d[1];
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] == 1) {
                    grid[nr][nc] = 2;
                    fresh--;
                    queue.add(new int[]{nr, nc});
                }
            }
        }
        minutes++;
    }
    return fresh == 0 ? minutes : -1;
}
// orangesRotting(new int[][]{{2, 1, 1}, {1, 1, 0}, {0, 1, 1}}) -> 4
```

---

## 3. Tree Depth-First Search

### 3.1 When to Use

- Path problems: root to leaf sums, all paths, max path.
- Subtree properties: height, diameter, balanced, symmetric, validity.
- Any exhaustive traversal, including graph components (flood fill, number of islands).

### 3.2 Three Orders

| Order | Visit sequence | Use it for |
| --- | --- | --- |
| Preorder | node, left, right | Copying a tree, serializing, passing information **down** |
| Inorder | left, node, right | Sorted order in a BST |
| Postorder | left, right, node | Deleting, height, anything that needs children results **first** (bubbling **up**) |

### 3.3 The Mental Model: Down, Up, or Global

Every tree DFS answers three questions:

1. What information do I pass **down** as parameters? (remaining sum, lower and upper bounds, current path)
2. What do I **return up** to my parent? (height, best downward gain, boolean)
3. Is the real answer different from what I return? If so, keep it in a **global** variable updated at each node (diameter, max path sum).

Max path sum is the standard example of question 3: the value returned to the parent is a one-sided path, but the answer may bend through the current node using both sides.

### 3.4 Problem: Inorder Traversal

```js
function inorder(root) {
  const result = [];
  (function visit(node) {
    if (!node) return;
    visit(node.left);
    result.push(node.val);
    visit(node.right);
  })(root);
  return result;
}

inorder(buildTree([1, null, 2, 3])); // [1, 3, 2]
```

Iterative version using an explicit stack (worth knowing because recursion depth can overflow on a 10^5 node skewed tree):

```js
function inorderIterative(root) {
  const result = [];
  const stack = [];
  let curr = root;
  while (curr || stack.length > 0) {
    while (curr) {
      stack.push(curr);
      curr = curr.left;
    }
    curr = stack.pop();
    result.push(curr.val);
    curr = curr.right;
  }
  return result;
}
```

On a BST, inorder returns the values in **ascending order**.
That is the reason "kth smallest in a BST" and "validate BST" have inorder solutions.

### 3.5 Problem: Binary Tree Maximum Path Sum

A path can start and end at any node and moves only along parent-child edges.
Return the largest path sum.

At each node:

- `left` and `right` are the best downward gains from the children, clamped at 0 so we never take a negative branch.
- The best path **through** this node is `node.val + left + right`. Update the global answer with it.
- Return `node.val + max(left, right)` to the parent, because a path going up can only continue into one child.

```js
function maxPathSum(root) {
  let best = -Infinity;
  function gain(node) {
    if (!node) return 0;
    const left = Math.max(0, gain(node.left));
    const right = Math.max(0, gain(node.right));
    best = Math.max(best, node.val + left + right);
    return node.val + Math.max(left, right);
  }
  gain(root);
  return best;
}

maxPathSum(buildTree([-10, 9, 20, null, null, 15, 7])); // 42  (15 + 20 + 7)
maxPathSum(buildTree([-3]));                            // -3  (why best starts at -Infinity)
```

Initialising `best` to `0` is a classic bug: an all-negative tree would wrongly return `0`.

Complexity: O(n) time, O(h) stack space where `h` is the tree height.

### 3.6 Extra Variants

**Maximum depth**, the smallest possible postorder example:

```js
function maxDepth(root) {
  return root ? 1 + Math.max(maxDepth(root.left), maxDepth(root.right)) : 0;
}
```

**All root-to-leaf paths with a target sum.**
Push before recursing, pop after. This is backtracking on a tree.
Copy the path with `[...path]` when saving, otherwise every saved result points to the same mutated array.

```js
function pathSum(root, target) {
  const result = [];
  const path = [];
  (function dfs(node, remaining) {
    if (!node) return;
    path.push(node.val);
    if (!node.left && !node.right && remaining === node.val) result.push([...path]);
    dfs(node.left, remaining - node.val);
    dfs(node.right, remaining - node.val);
    path.pop();
  })(root, target);
  return result;
}

pathSum(buildTree([5, 4, 8, 11, null, 13, 4, 7, 2, null, null, 5, 1]), 22);
// [[5, 4, 11, 2], [5, 8, 4, 5]]
```

**Diameter of a binary tree** (longest path in edges).
Same shape as max path sum: return height, track the bend in a global.

```js
function diameterOfBinaryTree(root) {
  let best = 0;
  (function height(node) {
    if (!node) return 0;
    const l = height(node.left);
    const r = height(node.right);
    best = Math.max(best, l + r);
    return 1 + Math.max(l, r);
  })(root);
  return best;
}
```

**Lowest common ancestor.**
If the current node is `p` or `q`, return it.
If both subtrees return something, the current node is the split point and therefore the LCA.
Otherwise pass up whichever side found something.

```js
function lowestCommonAncestor(root, p, q) {
  if (!root || root === p || root === q) return root;
  const left = lowestCommonAncestor(root.left, p, q);
  const right = lowestCommonAncestor(root.right, p, q);
  if (left && right) return root;
  return left ?? right;
}
```

**Validate a BST.**
Checking only `node.left.val < node.val < node.right.val` is wrong, because a deep descendant can violate an ancestor.
Pass **bounds down**.

```js
function isValidBST(node, lo = -Infinity, hi = Infinity) {
  if (!node) return true;
  if (node.val <= lo || node.val >= hi) return false;
  return isValidBST(node.left, lo, node.val) && isValidBST(node.right, node.val, hi);
}

isValidBST(buildTree([5, 1, 4, null, null, 3, 6])); // false
```

**Number of islands** applies DFS to a grid: flood-fill each land cell to water so it is counted once.

```js
function numIslands(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const sink = (r, c) => {
    if (r < 0 || c < 0 || r >= rows || c >= cols || grid[r][c] !== "1") return;
    grid[r][c] = "0";
    sink(r + 1, c);
    sink(r - 1, c);
    sink(r, c + 1);
    sink(r, c - 1);
  };
  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === "1") {
        count++;
        sink(r, c);
      }
    }
  }
  return count;
}
```

### 3.7 BFS or DFS?

| Question | Prefer |
| --- | --- |
| Shortest path, fewest steps, levels | BFS |
| Explore everything, paths, subtree aggregates | DFS |
| Very deep or skewed tree (recursion limit) | BFS or iterative DFS |
| Very wide tree (memory) | DFS, since BFS holds a whole level |

### 3.8 Pitfalls

- Not handling the empty tree (`root === null`).
- Confusing a **leaf** (no children) with a null node. `hasPathSum` on `[1, 2]` with target 1 is false, because node 1 is not a leaf.
- Using a global counter without resetting it between test cases.
- Forgetting the pop in path backtracking, or pushing a reference to the working array instead of a copy.

### 3.9 Java Implementation

#### Inorder Traversal

```java
static List<Integer> inorder(TreeNode root) {
    List<Integer> result = new ArrayList<>();
    inorderVisit(root, result);
    return result;
}

static void inorderVisit(TreeNode node, List<Integer> out) {
    if (node == null) return;
    inorderVisit(node.left, out);
    out.add(node.val);
    inorderVisit(node.right, out);
}
// inorder(buildTree(1, null, 2, 3)) -> [1, 3, 2]
```

Iterative version with an explicit stack.
The JVM default thread stack overflows around 10,000 to 20,000 frames, so a degenerate 10^5 node tree needs this form.

```java
static List<Integer> inorderIterative(TreeNode root) {
    List<Integer> result = new ArrayList<>();
    Deque<TreeNode> stack = new ArrayDeque<>();
    TreeNode curr = root;
    while (curr != null || !stack.isEmpty()) {
        while (curr != null) {
            stack.push(curr);
            curr = curr.left;
        }
        curr = stack.pop();
        result.add(curr.val);
        curr = curr.right;
    }
    return result;
}
```

#### Binary Tree Maximum Path Sum

Java has no closures over mutable locals, so the global answer lives in a one element array (or a field).
Here a small private holder keeps the method re-entrant and thread-safe.

```java
static int maxPathSum(TreeNode root) {
    int[] best = {Integer.MIN_VALUE};
    gain(root, best);
    return best[0];
}

static int gain(TreeNode node, int[] best) {
    if (node == null) return 0;
    int left = Math.max(0, gain(node.left, best));
    int right = Math.max(0, gain(node.right, best));
    best[0] = Math.max(best[0], node.val + left + right);
    return node.val + Math.max(left, right);
}
// maxPathSum(buildTree(-10, 9, 20, null, null, 15, 7)) -> 42
// maxPathSum(buildTree(-3))                            -> -3
```

Initialise with `Integer.MIN_VALUE`, not `0`, so an all-negative tree returns its largest node.

#### Extra Variants

**Maximum depth.**

```java
static int maxDepth(TreeNode root) {
    return root == null ? 0 : 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}
```

**All root-to-leaf paths with a target sum.**
`new ArrayList<>(path)` copies the working list.

```java
static List<List<Integer>> pathSum(TreeNode root, int target) {
    List<List<Integer>> result = new ArrayList<>();
    pathSumDfs(root, target, new ArrayList<>(), result);
    return result;
}

static void pathSumDfs(TreeNode node, int remaining, List<Integer> path, List<List<Integer>> result) {
    if (node == null) return;
    path.add(node.val);
    if (node.left == null && node.right == null && remaining == node.val) {
        result.add(new ArrayList<>(path));
    }
    pathSumDfs(node.left, remaining - node.val, path, result);
    pathSumDfs(node.right, remaining - node.val, path, result);
    path.remove(path.size() - 1);              // index form, path is a List<Integer>, this removes the LAST index
}
```

`path.remove(path.size() - 1)` passes an `int`, so it removes by **index**.
That is what we want here, but it is the same overload that surprises people when they want to remove a value.

**Diameter of a binary tree.**

```java
static int diameterOfBinaryTree(TreeNode root) {
    int[] best = {0};
    height(root, best);
    return best[0];
}

static int height(TreeNode node, int[] best) {
    if (node == null) return 0;
    int l = height(node.left, best);
    int r = height(node.right, best);
    best[0] = Math.max(best[0], l + r);
    return 1 + Math.max(l, r);
}
```

**Lowest common ancestor.**

```java
static TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
    if (root == null || root == p || root == q) return root;
    TreeNode left = lowestCommonAncestor(root.left, p, q);
    TreeNode right = lowestCommonAncestor(root.right, p, q);
    if (left != null && right != null) return root;
    return left != null ? left : right;
}
```

**Validate a BST.**
Use `long` bounds so a node holding `Integer.MIN_VALUE` or `Integer.MAX_VALUE` is handled.
This is a real interview trap.

```java
static boolean isValidBST(TreeNode root) {
    return isValidBST(root, Long.MIN_VALUE, Long.MAX_VALUE);
}

static boolean isValidBST(TreeNode node, long lo, long hi) {
    if (node == null) return true;
    if (node.val <= lo || node.val >= hi) return false;
    return isValidBST(node.left, lo, node.val) && isValidBST(node.right, node.val, hi);
}
// isValidBST(buildTree(5, 1, 4, null, null, 3, 6)) -> false
```

**Number of islands.**

```java
static int numIslands(char[][] grid) {
    int count = 0;
    for (int r = 0; r < grid.length; r++) {
        for (int c = 0; c < grid[0].length; c++) {
            if (grid[r][c] == '1') {
                count++;
                sink(grid, r, c);
            }
        }
    }
    return count;
}

static void sink(char[][] grid, int r, int c) {
    if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length || grid[r][c] != '1') return;
    grid[r][c] = '0';
    sink(grid, r + 1, c);
    sink(grid, r - 1, c);
    sink(grid, r, c + 1);
    sink(grid, r, c - 1);
}
```

---

## 4. Two Heaps

### 4.1 When to Use

- You need the **median** or a middle value from a stream or window.
- You must repeatedly pick "the best of the small group" and "the best of the big group".
- Two related priorities interact, for example "cheapest affordable project" then "most profitable".

### 4.2 Core Idea

Split the data into two halves:

- `small`: a **max-heap** of the smaller half, so its top is the largest of the small numbers.
- `large`: a **min-heap** of the larger half, so its top is the smallest of the large numbers.

The median lives at the two tops.
Invariant: every value in `small` is at most every value in `large`, and `small.size` is either equal to `large.size` or exactly one bigger.

### 4.3 Problem: Find Median from a Data Stream

```js
class MedianFinder {
  constructor() {
    this.small = new Heap((a, b) => b - a);   // max-heap
    this.large = new Heap();                  // min-heap
  }

  addNum(num) {
    this.small.push(num);
    this.large.push(this.small.pop());        // ensures the ordering invariant
    if (this.large.size > this.small.size) {  // ensures the size invariant
      this.small.push(this.large.pop());
    }
  }

  findMedian() {
    if (this.small.size > this.large.size) return this.small.peek();
    return (this.small.peek() + this.large.peek()) / 2;
  }
}

const mf = new MedianFinder();
mf.addNum(1);
mf.addNum(2);
mf.findMedian(); // 1.5
mf.addNum(3);
mf.findMedian(); // 2
```

The "push into small, move the top to large" step is a neat way to keep the ordering invariant without comparing to the current tops.

Dry run for the stream `5, 15, 1, 3`:

| add | small (max-heap) | large (min-heap) | median |
| --- | --- | --- | --- |
| 5 | [5] | [] | 5 |
| 15 | [5] | [15] | 10 |
| 1 | [5, 1] | [15] | 5 |
| 3 | [3, 1] | [5, 15] | 4 |

Complexity: `addNum` is O(log n), `findMedian` is O(1).

Follow-ups worth preparing:

- If all numbers are in `0..100`, use a counting array and get O(1) add and O(100) median.
- If 99 percent of numbers are in `0..100`, keep counts for that range and two variables for outliers.
- **Sliding window median** needs deletions from the middle of a heap. Use **lazy deletion**: record removed values in a map and discard them when they reach the top.

### 4.4 Problem: IPO (Maximize Capital)

You have `w` capital and can start at most `k` projects.
Each project needs a minimum capital and gives a profit.
Pick projects to maximize final capital.

Use one heap ordered by capital needed (what can I afford next?) and one ordered by profit (which affordable project pays the most?).

```js
function findMaximizedCapital(k, w, profits, capital) {
  const byCapital = new Heap((a, b) => a[0] - b[0]);
  const byProfit = new Heap((a, b) => b - a);
  profits.forEach((p, i) => byCapital.push([capital[i], p]));
  for (let i = 0; i < k; i++) {
    while (byCapital.size > 0 && byCapital.peek()[0] <= w) {
      byProfit.push(byCapital.pop()[1]);
    }
    if (byProfit.size === 0) break;
    w += byProfit.pop();
  }
  return w;
}

findMaximizedCapital(2, 0, [1, 2, 3], [0, 1, 1]); // 4
```

### 4.5 Pitfalls

- Getting the heap direction backwards. The half holding **smaller** numbers is a **max**-heap.
- Returning an integer division for the even case. `(a + b) / 2` in JavaScript is already a float, but in other languages it truncates.
- Rebalancing only after some inserts. Always restore both invariants at the end of `addNum`.

### 4.6 Java Implementation

#### Find Median from a Data Stream

```java
class MedianFinder {
    private final PriorityQueue<Integer> small = new PriorityQueue<>(Collections.reverseOrder()); // max-heap
    private final PriorityQueue<Integer> large = new PriorityQueue<>();                           // min-heap

    void addNum(int num) {
        small.add(num);
        large.add(small.poll());
        if (large.size() > small.size()) {
            small.add(large.poll());
        }
    }

    double findMedian() {
        if (small.size() > large.size()) return small.peek();
        return ((double) small.peek() + large.peek()) / 2.0;
    }
}
// MedianFinder mf = new MedianFinder();
// mf.addNum(1); mf.addNum(2); mf.findMedian() -> 1.5
// mf.addNum(3); mf.findMedian() -> 2.0
```

Two Java specifics:

- Use `Collections.reverseOrder()` for a max-heap. The lambda `(a, b) -> b - a` overflows for extreme values.
- Cast to `double` **before** adding, `(small.peek() + large.peek()) / 2.0` can overflow `int` first.

#### IPO (Maximize Capital)

```java
static int findMaximizedCapital(int k, int w, int[] profits, int[] capital) {
    PriorityQueue<int[]> byCapital = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));
    PriorityQueue<Integer> byProfit = new PriorityQueue<>(Collections.reverseOrder());
    for (int i = 0; i < profits.length; i++) byCapital.add(new int[]{capital[i], profits[i]});
    for (int i = 0; i < k; i++) {
        while (!byCapital.isEmpty() && byCapital.peek()[0] <= w) {
            byProfit.add(byCapital.poll()[1]);
        }
        if (byProfit.isEmpty()) break;
        w += byProfit.poll();
    }
    return w;
}
// findMaximizedCapital(2, 0, new int[]{1, 2, 3}, new int[]{0, 1, 1}) -> 4
```

---

## 5. Subsets and Backtracking

### 5.1 When to Use

- "All subsets", "all combinations", "all permutations", "all arrangements".
- The output is **exponential**, so n is small (usually at most 20).
- Keywords: power set, combination sum, letter case permutations, generate parentheses.

### 5.2 Two Approaches

| Approach | Idea | Best for |
| --- | --- | --- |
| Iterative (BFS style) | Start with `[[]]`. For each element, copy every existing subset and append the element. | Subsets, with or without duplicates |
| Backtracking (DFS style) | Choose, explore, un-choose. | Permutations, combinations with constraints, pruning |

### 5.3 Problem: Subsets

```js
function subsets(nums) {
  const result = [[]];
  for (const n of nums) {
    const size = result.length;
    for (let i = 0; i < size; i++) result.push([...result[i], n]);
  }
  return result;
}

subsets([1, 2, 3]);
// [[], [1], [2], [1, 2], [3], [1, 3], [2, 3], [1, 2, 3]]
```

Each element doubles the number of subsets, so there are `2^n` subsets and the work is O(n * 2^n) because each subset is copied.

Dry run:

| Element | Subsets so far |
| --- | --- |
| start | [] |
| 1 | [], [1] |
| 2 | [], [1], [2], [1, 2] |
| 3 | the four above plus [3], [1, 3], [2, 3], [1, 2, 3] |

Bitmask alternative: for `mask` in `0 .. (1 << n) - 1`, bit `i` set means include `nums[i]`.
It is compact and handy when `n <= 20`, but harder to adapt when there are constraints.

### 5.4 Problem: Subsets With Duplicates

`[1, 2, 2]` must not produce `[2]` twice.

Sort so duplicates are adjacent.
When the current number equals the previous one, only extend the subsets **added in the previous round**, not all of them.

```js
function subsetsWithDup(nums) {
  nums.sort((a, b) => a - b);
  const result = [[]];
  let start = 0;                                       // where the previous round's new subsets begin
  for (let i = 0; i < nums.length; i++) {
    const begin = i > 0 && nums[i] === nums[i - 1] ? start : 0;
    const end = result.length;
    for (let j = begin; j < end; j++) result.push([...result[j], nums[i]]);
    start = end;
  }
  return result;
}

subsetsWithDup([1, 2, 2]);
// [[], [1], [2], [1, 2], [2, 2], [1, 2, 2]]
```

### 5.5 The Backtracking Template

```text
function backtrack(state):
    if state is a complete answer:
        record a COPY of it
        return
    for each choice available from here:
        if choice is invalid or pruned: continue
        apply choice
        backtrack(new state)
        undo choice
```

**Permutations** (order matters, use a `used` array):

```js
function permute(nums) {
  const result = [];
  const used = new Array(nums.length).fill(false);
  const path = [];
  (function dfs() {
    if (path.length === nums.length) {
      result.push([...path]);
      return;
    }
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      path.push(nums[i]);
      dfs();
      path.pop();
      used[i] = false;
    }
  })();
  return result;
}

permute([1, 2, 3]).length; // 6
```

**Combination sum** (numbers may be reused, order does not matter).
Passing `start` forward stops `[2, 3]` and `[3, 2]` both appearing.
Passing `i` (not `i + 1`) allows reusing the same number.

```js
function combinationSum(candidates, target) {
  const result = [];
  const path = [];
  (function dfs(start, remaining) {
    if (remaining === 0) {
      result.push([...path]);
      return;
    }
    for (let i = start; i < candidates.length; i++) {
      if (candidates[i] > remaining) continue;
      path.push(candidates[i]);
      dfs(i, remaining - candidates[i]);
      path.pop();
    }
  })(0, target);
  return result;
}

combinationSum([2, 3, 6, 7], 7); // [[2, 2, 3], [7]]
```

**Dedupe rule for backtracking with duplicates:** sort first, then inside the loop skip with `if (i > start && nums[i] === nums[i - 1]) continue`.
It means "do not pick the same value twice at the same tree level", while still allowing it at different depths.

**Generate parentheses** is a good pruning example: add `(` while `open < n`, add `)` while `close < open`.

### 5.6 Growth Rates to Quote

| Problem | Output size | Practical n |
| --- | --- | --- |
| Subsets | 2^n | up to about 20 |
| Permutations | n! | up to about 9 or 10 |
| Combinations C(n, k) | n! / (k! (n - k)!) | depends on k |

### 5.7 Pitfalls

- Pushing `path` instead of `[...path]`. Every result then aliases one array that ends up empty.
- Duplicate handling without sorting first.
- Not undoing state, especially `used` flags and shared arrays.
- Reporting the time complexity as O(2^n) when copying makes it O(n * 2^n).

### 5.8 Java Implementation

#### Subsets

```java
static List<List<Integer>> subsets(int[] nums) {
    List<List<Integer>> result = new ArrayList<>();
    result.add(new ArrayList<>());
    for (int n : nums) {
        int size = result.size();
        for (int i = 0; i < size; i++) {
            List<Integer> copy = new ArrayList<>(result.get(i));
            copy.add(n);
            result.add(copy);
        }
    }
    return result;
}
// subsets(new int[]{1, 2, 3}) -> [[], [1], [2], [1, 2], [3], [1, 3], [2, 3], [1, 2, 3]]
```

Bitmask version, handy for `n <= 20`:

```java
static List<List<Integer>> subsetsBitmask(int[] nums) {
    int n = nums.length;
    List<List<Integer>> result = new ArrayList<>();
    for (int mask = 0; mask < (1 << n); mask++) {
        List<Integer> subset = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            if ((mask & (1 << i)) != 0) subset.add(nums[i]);
        }
        result.add(subset);
    }
    return result;
}
```

#### Subsets With Duplicates

```java
static List<List<Integer>> subsetsWithDup(int[] nums) {
    Arrays.sort(nums);
    List<List<Integer>> result = new ArrayList<>();
    result.add(new ArrayList<>());
    int start = 0;
    for (int i = 0; i < nums.length; i++) {
        int begin = (i > 0 && nums[i] == nums[i - 1]) ? start : 0;
        int end = result.size();
        for (int j = begin; j < end; j++) {
            List<Integer> copy = new ArrayList<>(result.get(j));
            copy.add(nums[i]);
            result.add(copy);
        }
        start = end;
    }
    return result;
}
// subsetsWithDup(new int[]{1, 2, 2}) -> [[], [1], [2], [1, 2], [2, 2], [1, 2, 2]]
```

#### Backtracking Templates

**Permutations.**

```java
static List<List<Integer>> permute(int[] nums) {
    List<List<Integer>> result = new ArrayList<>();
    permuteDfs(nums, new boolean[nums.length], new ArrayList<>(), result);
    return result;
}

static void permuteDfs(int[] nums, boolean[] used, List<Integer> path, List<List<Integer>> result) {
    if (path.size() == nums.length) {
        result.add(new ArrayList<>(path));
        return;
    }
    for (int i = 0; i < nums.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        path.add(nums[i]);
        permuteDfs(nums, used, path, result);
        path.remove(path.size() - 1);
        used[i] = false;
    }
}
// permute(new int[]{1, 2, 3}).size() -> 6
```

**Combination sum.**

```java
static List<List<Integer>> combinationSum(int[] candidates, int target) {
    List<List<Integer>> result = new ArrayList<>();
    combinationDfs(candidates, 0, target, new ArrayList<>(), result);
    return result;
}

static void combinationDfs(int[] candidates, int start, int remaining, List<Integer> path, List<List<Integer>> result) {
    if (remaining == 0) {
        result.add(new ArrayList<>(path));
        return;
    }
    for (int i = start; i < candidates.length; i++) {
        if (candidates[i] > remaining) continue;
        path.add(candidates[i]);
        combinationDfs(candidates, i, remaining - candidates[i], path, result);
        path.remove(path.size() - 1);
    }
}
// combinationSum(new int[]{2, 3, 6, 7}, 7) -> [[2, 2, 3], [7]]
```

**Generate parentheses**, a pruning example (add `(` while `open < n`, add `)` while `close < open`):

```java
static List<String> generateParentheses(int n) {
    List<String> result = new ArrayList<>();
    buildParens(n, 0, 0, new StringBuilder(), result);
    return result;
}

static void buildParens(int n, int open, int close, StringBuilder sb, List<String> result) {
    if (sb.length() == 2 * n) {
        result.add(sb.toString());
        return;
    }
    if (open < n) {
        sb.append('(');
        buildParens(n, open + 1, close, sb, result);
        sb.deleteCharAt(sb.length() - 1);
    }
    if (close < open) {
        sb.append(')');
        buildParens(n, open, close + 1, sb, result);
        sb.deleteCharAt(sb.length() - 1);
    }
}
// generateParentheses(3) -> ["((()))", "(()())", "(())()", "()(())", "()()()"]
```

`StringBuilder` with `append` and `deleteCharAt` is the Java equivalent of push and pop on a path.

---

## 6. Modified Binary Search

### 6.1 When to Use

- The data is sorted, **rotated**, bitonic, or otherwise monotonic.
- The problem says O(log n).
- Or there is **no array at all**: you are searching an answer space for the smallest value that satisfies a monotonic check (binary search on the answer).

### 6.2 The One Template Worth Memorizing

Most bugs come from mixing `<` and `<=` and `mid + 1` versus `mid`.
Pick one template and stick with it.
This one finds the **first index where a monotonic predicate becomes true** in the half-open range `[lo, hi)`:

```js
function firstTrue(lo, hi, isTrue) {
  // predicate shape over [lo, hi): false, false, ..., true, true
  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (isTrue(mid)) hi = mid;     // mid could be the answer, keep it
    else lo = mid + 1;             // mid is too small, discard it
  }
  return lo;                        // equals hi if no index satisfies the predicate
}
```

Everything else is a choice of predicate:

```js
const lowerBound = (nums, target) => firstTrue(0, nums.length, (i) => nums[i] >= target);
const upperBound = (nums, target) => firstTrue(0, nums.length, (i) => nums[i] > target);

lowerBound([1, 2, 2, 2, 3], 2); // 1  (first 2)
upperBound([1, 2, 2, 2, 3], 2); // 4  (first index after the last 2)
```

First and last position of a target is `lowerBound` and `upperBound - 1`.
Insert position is `lowerBound`.

`lo + ((hi - lo) >> 1)` instead of `(lo + hi) / 2` avoids integer overflow in Java, C++, and Go.
JavaScript numbers are doubles so it does not overflow, but the habit is free.

### 6.3 Problem: Search in a Rotated Sorted Array

`[4, 5, 6, 7, 0, 1, 2]` is a sorted array rotated at some pivot.
The key fact: at every step, **at least one half is sorted**.
Find which half is sorted, then check whether the target lies inside it.

```js
function searchRotated(nums, target) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo <= hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (nums[mid] === target) return mid;
    if (nums[lo] <= nums[mid]) {                       // left half [lo, mid] is sorted
      if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
      else lo = mid + 1;
    } else {                                           // right half [mid, hi] is sorted
      if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  return -1;
}

searchRotated([4, 5, 6, 7, 0, 1, 2], 0); // 4
searchRotated([4, 5, 6, 7, 0, 1, 2], 3); // -1
```

Dry run for target `0`:

| lo | hi | mid | nums[mid] | sorted half | decision |
| --- | --- | --- | --- | --- | --- |
| 0 | 6 | 3 | 7 | left (4..7) | 0 not in [4, 7), lo = 4 |
| 4 | 6 | 5 | 1 | left (0..1) | 0 in [0, 1), hi = 4 |
| 4 | 4 | 4 | 0 | - | found, return 4 |

The `<=` in `nums[lo] <= nums[mid]` matters when `lo === mid` (two elements left).

With **duplicates**, `nums[lo] === nums[mid] === nums[hi]` hides which half is sorted.
The fix is to shrink both ends (`lo++`, `hi--`), which makes the worst case O(n).
Say this out loud, because it is the standard follow-up.

### 6.4 Problem: Minimum in a Rotated Sorted Array

Compare `mid` with the **right end**, not the left end.
If `nums[mid] > nums[hi]`, the minimum must be to the right of `mid`.
Otherwise `mid` could be the minimum, so keep it.

```js
function findMin(nums) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (nums[mid] > nums[hi]) lo = mid + 1;
    else hi = mid;
  }
  return nums[lo];
}

findMin([3, 4, 5, 1, 2]);       // 1
findMin([4, 5, 6, 7, 0, 1, 2]); // 0
```

Why compare with `hi` and not `lo`: comparing to `lo` is ambiguous when the array is not rotated at all, but comparing to `hi` always tells you which side the drop is on.

The array with duplicates version adds `else if (nums[mid] === nums[hi]) hi--;`.
The index of the minimum is also the **number of rotations**.

### 6.5 Extra Variants: Binary Search on the Answer

When the question is "smallest X such that something is feasible" and feasibility is monotonic in X, binary search X.
You never build an array, you just write `isFeasible(x)`.

**Koko eating bananas.**
Find the smallest speed `k` that finishes all piles within `h` hours.

```js
function minEatingSpeed(piles, h) {
  const hoursAt = (k) => piles.reduce((sum, p) => sum + Math.ceil(p / k), 0);
  return firstTrue(1, Math.max(...piles) + 1, (k) => hoursAt(k) <= h);
}

minEatingSpeed([3, 6, 7, 11], 8); // 4
```

Other problems with the same shape: capacity to ship packages within D days, split array largest sum, minimum days to make bouquets, magnetic force between balls, aggressive cows.

**Peak element.**
An element bigger than both neighbours.
If `nums[mid] < nums[mid + 1]`, a peak exists on the right, otherwise on the left including `mid`.

```js
function findPeakElement(nums) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (nums[mid] < nums[mid + 1]) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

findPeakElement([1, 2, 1, 3, 5, 6, 4]); // 5
```

**Search in a bitonic array**: find the peak first, then binary search each side with the right direction.
**Integer square root**: `firstTrue(0, x + 1, (m) => m * m > x) - 1`.

### 6.6 Pitfalls

- Infinite loops from `lo = mid` with `lo < hi`, because when `hi = lo + 1` the mid equals `lo`. Use `lo = mid + 1`.
- Mixing closed range `[lo, hi]` with `while (lo < hi)` and `hi = mid - 1`. Stay inside one template.
- Feasibility checks that are **not** monotonic. If bigger X can be infeasible after a smaller X was feasible, binary search does not apply.
- Forgetting that the search range for answer-space problems must include the answer (upper bound is exclusive in the template above).

### 6.7 Java Implementation

#### The Reusable Template

Java has `IntPredicate` in `java.util.function`, which makes the "first true" template generic.

```java
static int firstTrue(int lo, int hi, java.util.function.IntPredicate isTrue) {
    while (lo < hi) {
        int mid = lo + ((hi - lo) >>> 1);
        if (isTrue.test(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}

static int lowerBound(int[] nums, int target) {
    return firstTrue(0, nums.length, i -> nums[i] >= target);
}

static int upperBound(int[] nums, int target) {
    return firstTrue(0, nums.length, i -> nums[i] > target);
}
// lowerBound(new int[]{1, 2, 2, 2, 3}, 2) -> 1
// upperBound(new int[]{1, 2, 2, 2, 3}, 2) -> 4
```

`(hi - lo) >>> 1` is the unsigned shift.
It, or `(lo + hi) >>> 1`, is what the JDK itself uses in `Arrays.binarySearch`, and `(lo + hi) / 2` **does** overflow in Java for arrays with more than a billion elements.

The JDK also provides `Arrays.binarySearch(int[], key)`, but with duplicates it returns **any** matching index, and a negative insertion-point encoding `-(insertionPoint) - 1` when absent.
Write your own bounds for interviews.

#### Search in a Rotated Sorted Array

```java
static int searchRotated(int[] nums, int target) {
    int lo = 0;
    int hi = nums.length - 1;
    while (lo <= hi) {
        int mid = lo + ((hi - lo) >>> 1);
        if (nums[mid] == target) return mid;
        if (nums[lo] <= nums[mid]) {
            if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
            else lo = mid + 1;
        } else {
            if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
            else hi = mid - 1;
        }
    }
    return -1;
}
// searchRotated(new int[]{4, 5, 6, 7, 0, 1, 2}, 0) -> 4
```

#### Minimum in a Rotated Sorted Array

```java
static int findMin(int[] nums) {
    int lo = 0;
    int hi = nums.length - 1;
    while (lo < hi) {
        int mid = lo + ((hi - lo) >>> 1);
        if (nums[mid] > nums[hi]) lo = mid + 1;
        else hi = mid;
    }
    return nums[lo];
}
// findMin(new int[]{4, 5, 6, 7, 0, 1, 2}) -> 0
```

#### Binary Search on the Answer

**Koko eating bananas.**
The hour count can exceed `int` when `k` is small and piles are large, so accumulate in a `long`.

```java
static int minEatingSpeed(int[] piles, int h) {
    int maxPile = 0;
    for (int p : piles) maxPile = Math.max(maxPile, p);
    return firstTrue(1, maxPile + 1, k -> hoursAt(piles, k) <= h);
}

static long hoursAt(int[] piles, int k) {
    long hours = 0;
    for (int p : piles) hours += (p + k - 1) / k;      // integer ceiling division
    return hours;
}
// minEatingSpeed(new int[]{3, 6, 7, 11}, 8) -> 4
```

`(p + k - 1) / k` is the integer ceiling divide.
`Math.ceil(p / k)` is a bug in Java, because `p / k` is already an integer division that truncates before `ceil` sees it.

**Peak element.**

```java
static int findPeakElement(int[] nums) {
    int lo = 0;
    int hi = nums.length - 1;
    while (lo < hi) {
        int mid = lo + ((hi - lo) >>> 1);
        if (nums[mid] < nums[mid + 1]) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
// findPeakElement(new int[]{1, 2, 1, 3, 5, 6, 4}) -> 5
```

---

## 7. Top K Elements

### 7.1 When to Use

- "K largest", "K smallest", "K most frequent", "K closest", "kth largest".
- n is large and k is small, so a full sort is wasteful.

### 7.2 Core Idea: a Size-K Heap of the Opposite Kind

To keep the **K largest**, use a **min-heap** of size K.
Its top is the smallest of the K largest, so it is the element to evict when something bigger arrives.
The heap never grows past K, so each operation is O(log K).

| Goal | Heap kind | Evict when size exceeds K |
| --- | --- | --- |
| K largest | min-heap | pop the min |
| K smallest | max-heap | pop the max |
| Kth largest | min-heap of size K | the top is the answer |

### 7.3 Problem: Kth Largest Element

```js
function findKthLargest(nums, k) {
  const heap = new Heap();                             // min-heap
  for (const n of nums) {
    heap.push(n);
    if (heap.size > k) heap.pop();
  }
  return heap.peek();
}

findKthLargest([3, 2, 1, 5, 6, 4], 2); // 5
```

Complexity: O(n log k) time, O(k) space.

Compare the options:

| Approach | Time | Space | Notes |
| --- | --- | --- | --- |
| Sort descending, take index k - 1 | O(n log n) | O(1) to O(n) | Simplest |
| Size-K heap | O(n log k) | O(k) | Works on streams |
| Quickselect | O(n) average, O(n²) worst | O(1) | Mutates the array, not for streams |

Quickselect with a random pivot:

```js
function quickselectKthLargest(nums, k) {
  const target = nums.length - k;                      // index in ascending order
  let lo = 0;
  let hi = nums.length - 1;
  while (lo <= hi) {
    const p = partition(nums, lo, hi);
    if (p === target) return nums[p];
    if (p < target) lo = p + 1;
    else hi = p - 1;
  }
  return undefined;
}

function partition(nums, lo, hi) {
  const r = lo + Math.floor(Math.random() * (hi - lo + 1));
  [nums[r], nums[hi]] = [nums[hi], nums[r]];
  const pivot = nums[hi];
  let store = lo;
  for (let i = lo; i < hi; i++) {
    if (nums[i] < pivot) {
      [nums[i], nums[store]] = [nums[store], nums[i]];
      store++;
    }
  }
  [nums[store], nums[hi]] = [nums[hi], nums[store]];
  return store;
}
```

Many duplicates degrade this partition toward O(n²).
A three-way partition fixes it.

### 7.4 Problem: Top K Frequent Elements

Count frequencies, then keep the K highest counts in a min-heap ordered by count.

```js
function topKFrequent(nums, k) {
  const freq = new Map();
  for (const n of nums) freq.set(n, (freq.get(n) ?? 0) + 1);

  const heap = new Heap((a, b) => a[1] - b[1]);        // ordered by count
  for (const entry of freq) {
    heap.push(entry);
    if (heap.size > k) heap.pop();
  }
  const result = [];
  while (heap.size > 0) result.push(heap.pop()[0]);
  return result.reverse();                              // most frequent first
}

topKFrequent([1, 1, 1, 2, 2, 3], 2); // [1, 2]
```

O(n) alternative with **bucket sort**: frequency is at most `n`, so index buckets by frequency and read them from the highest bucket down.

```js
function topKFrequentBucket(nums, k) {
  const freq = new Map();
  for (const n of nums) freq.set(n, (freq.get(n) ?? 0) + 1);
  const buckets = Array.from({ length: nums.length + 1 }, () => []);
  for (const [n, f] of freq) buckets[f].push(n);
  const result = [];
  for (let f = buckets.length - 1; f > 0 && result.length < k; f--) {
    result.push(...buckets[f]);
  }
  return result.slice(0, k);
}
```

### 7.5 Extra Variants

**K closest points to the origin.**
Keep a **max**-heap of size K ordered by squared distance (no square root needed).

```js
function kClosest(points, k) {
  const heap = new Heap((a, b) => b.dist - a.dist);    // max-heap by distance
  for (const [x, y] of points) {
    heap.push({ dist: x * x + y * y, point: [x, y] });
    if (heap.size > k) heap.pop();
  }
  const result = [];
  while (heap.size > 0) result.push(heap.pop().point);
  return result;
}

kClosest([[1, 3], [-2, 2]], 1); // [[-2, 2]]
```

**Sort characters by frequency**, **reorganize string**, and **task scheduler** all use a max-heap on counts.
**Kth largest in a stream** keeps the size-K min-heap alive and calls `add(val)`.

### 7.6 Pitfalls

- Using a max-heap for K largest. It works but needs O(n) space and does not bound the heap at K.
- Sorting strings or numbers with the default comparator.
- Returning heap order instead of the requested order. A heap is not sorted.
- Ties: ask whether ties in frequency or distance need a specific order.

### 7.7 Java Implementation

#### Kth Largest Element

```java
static int findKthLargest(int[] nums, int k) {
    PriorityQueue<Integer> heap = new PriorityQueue<>();     // min-heap
    for (int n : nums) {
        heap.add(n);
        if (heap.size() > k) heap.poll();
    }
    return heap.peek();
}
// findKthLargest(new int[]{3, 2, 1, 5, 6, 4}, 2) -> 5
```

Quickselect with a random pivot:

```java
static int quickselectKthLargest(int[] nums, int k) {
    int target = nums.length - k;
    int lo = 0;
    int hi = nums.length - 1;
    java.util.Random random = new java.util.Random();
    while (lo <= hi) {
        int p = partition(nums, lo, hi, random);
        if (p == target) return nums[p];
        if (p < target) lo = p + 1;
        else hi = p - 1;
    }
    throw new IllegalArgumentException("k out of range");
}

static int partition(int[] nums, int lo, int hi, java.util.Random random) {
    swap(nums, lo + random.nextInt(hi - lo + 1), hi);
    int pivot = nums[hi];
    int store = lo;
    for (int i = lo; i < hi; i++) {
        if (nums[i] < pivot) swap(nums, i, store++);
    }
    swap(nums, store, hi);
    return store;
}
```

#### Top K Frequent Elements

```java
static int[] topKFrequent(int[] nums, int k) {
    Map<Integer, Integer> freq = new HashMap<>();
    for (int n : nums) freq.merge(n, 1, Integer::sum);

    PriorityQueue<Map.Entry<Integer, Integer>> heap =
            new PriorityQueue<>((a, b) -> Integer.compare(a.getValue(), b.getValue()));
    for (Map.Entry<Integer, Integer> entry : freq.entrySet()) {
        heap.add(entry);
        if (heap.size() > k) heap.poll();
    }
    int[] result = new int[heap.size()];
    for (int i = result.length - 1; i >= 0; i--) result[i] = heap.poll().getKey();
    return result;
}
// topKFrequent(new int[]{1, 1, 1, 2, 2, 3}, 2) -> [1, 2]
```

Bucket sort in O(n):

```java
static int[] topKFrequentBucket(int[] nums, int k) {
    Map<Integer, Integer> freq = new HashMap<>();
    for (int n : nums) freq.merge(n, 1, Integer::sum);
    List<Integer>[] buckets = new List[nums.length + 1];
    for (Map.Entry<Integer, Integer> e : freq.entrySet()) {
        int f = e.getValue();
        if (buckets[f] == null) buckets[f] = new ArrayList<>();
        buckets[f].add(e.getKey());
    }
    int[] result = new int[k];
    int idx = 0;
    for (int f = buckets.length - 1; f > 0 && idx < k; f--) {
        if (buckets[f] == null) continue;
        for (int n : buckets[f]) {
            if (idx == k) break;
            result[idx++] = n;
        }
    }
    return result;
}
```

Generic array creation (`new List<Integer>[n]`) is illegal, so `new List[n]` produces an unchecked-cast warning.
Add `@SuppressWarnings("unchecked")` in real code.

#### K Closest Points to the Origin

```java
static int[][] kClosest(int[][] points, int k) {
    PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> Long.compare(dist(b), dist(a)));   // max-heap
    for (int[] p : points) {
        heap.add(p);
        if (heap.size() > k) heap.poll();
    }
    return heap.toArray(new int[0][]);
}

static long dist(int[] p) {
    return (long) p[0] * p[0] + (long) p[1] * p[1];
}
// kClosest(new int[][]{{1, 3}, {-2, 2}}, 1) -> [[-2, 2]]
```

Cast to `long` **before** multiplying, otherwise `p[0] * p[0]` overflows `int` first.

---

## 8. K-way Merge

### 8.1 When to Use

- You have **K sorted** lists, arrays, or streams and need one merged ordering, or the kth element, or a range across all of them.
- Merging lists that are too big for memory (external sort).

### 8.2 Core Idea

Put the **current head** of every list into a min-heap.
Pop the smallest, output it, and push the next element from the same list.
The heap always holds at most K items.

```text
lists:  [1, 4, 5]    [1, 3, 4]    [2, 6]

heap:   {1a, 1b, 2}  -> pop 1a, push 4a  -> {1b, 2, 4a} -> pop 1b ...
```

Complexity for N total elements: O(N log K) time, O(K) heap space.

### 8.3 Problem: Merge K Sorted Lists

```js
function mergeKLists(lists) {
  const heap = new Heap((a, b) => a.val - b.val);
  for (const node of lists) if (node) heap.push(node);

  const dummy = new ListNode();
  let tail = dummy;
  while (heap.size > 0) {
    const node = heap.pop();
    tail.next = node;
    tail = node;
    if (node.next) heap.push(node.next);
  }
  return dummy.next;
}

toArray(mergeKLists([fromArray([1, 4, 5]), fromArray([1, 3, 4]), fromArray([2, 6])]));
// [1, 1, 2, 3, 4, 4, 5, 6]
```

**Divide and conquer** alternative with the same O(N log K) time and no heap:
merge lists in pairs, halving the count each round.

```js
function mergeTwoLists(a, b) {
  const dummy = new ListNode();
  let tail = dummy;
  while (a && b) {
    if (a.val <= b.val) {
      tail.next = a;
      a = a.next;
    } else {
      tail.next = b;
      b = b.next;
    }
    tail = tail.next;
  }
  tail.next = a ?? b;
  return dummy.next;
}

function mergeKListsDivide(lists) {
  if (lists.length === 0) return null;
  while (lists.length > 1) {
    const merged = [];
    for (let i = 0; i < lists.length; i += 2) {
      merged.push(mergeTwoLists(lists[i], lists[i + 1] ?? null));
    }
    lists = merged;
  }
  return lists[0];
}
```

Merging the lists one after another instead (fold left) is O(N * K), which is the answer to avoid.

### 8.4 Problem: Kth Smallest Element in a Sorted Matrix

Each row is sorted and each column is sorted.
Treat each row as one sorted list and run K-way merge, stopping after `k` pops.
Only the first `min(n, k)` rows can matter.

```js
function kthSmallest(matrix, k) {
  const n = matrix.length;
  const heap = new Heap((a, b) => a[0] - b[0]);        // [value, row, col]
  for (let r = 0; r < Math.min(n, k); r++) heap.push([matrix[r][0], r, 0]);

  let value = 0;
  for (let i = 0; i < k; i++) {
    const [v, r, c] = heap.pop();
    value = v;
    if (c + 1 < n) heap.push([matrix[r][c + 1], r, c + 1]);
  }
  return value;
}

kthSmallest([[1, 5, 9], [10, 11, 13], [12, 13, 15]], 8); // 13
```

O(k log min(n, k)) time.
A binary search on the value range (section 6.5) gets O(n log(max - min)) and is the follow-up answer.

### 8.5 Extra Variants

**Smallest range covering elements from K lists.**
Keep one element from each list in the heap and track the current **max**.
The window `[heap.min, max]` always covers every list.
Advance the list that provided the min, and stop when any list runs out.

```js
function smallestRange(nums) {
  const heap = new Heap((a, b) => a[0] - b[0]);        // [value, listIndex, elementIndex]
  let max = -Infinity;
  nums.forEach((list, i) => {
    heap.push([list[0], i, 0]);
    max = Math.max(max, list[0]);
  });
  let range = [heap.peek()[0], max];
  while (true) {
    const [value, i, j] = heap.pop();
    if (max - value < range[1] - range[0]) range = [value, max];
    if (j + 1 === nums[i].length) break;
    const next = nums[i][j + 1];
    heap.push([next, i, j + 1]);
    max = Math.max(max, next);
  }
  return range;
}

smallestRange([[4, 10, 15, 24, 26], [0, 9, 12, 20], [5, 18, 22, 30]]); // [20, 24]
```

**Merge two sorted arrays in place** when the first has trailing space: fill from the **back** so no unread value is overwritten.

```js
function mergeSorted(a, m, b, n) {
  let i = m - 1;
  let j = n - 1;
  let write = m + n - 1;
  while (j >= 0) {
    a[write--] = i >= 0 && a[i] > b[j] ? a[i--] : b[j--];
  }
}
```

**Find K pairs with the smallest sums** from two sorted arrays: each `nums1[i]` starts a list of sums `nums1[i] + nums2[*]`, then K-way merge.
**Merge sorted intervals from multiple sources** is K-way merge on the start time, followed by the merge intervals pass.

### 8.6 Pitfalls

- Pushing the entire input into the heap instead of one head per list, which defeats the point.
- Losing which list an element came from. Store `[value, listIndex, elementIndex]`.
- Empty lists in the input. Guard before pushing the first element.
- Comparing tuples with a numeric subtraction on the wrong field.

### 8.7 Java Implementation

#### Merge K Sorted Lists

```java
static ListNode mergeKLists(ListNode[] lists) {
    PriorityQueue<ListNode> heap = new PriorityQueue<>((a, b) -> Integer.compare(a.val, b.val));
    for (ListNode node : lists) if (node != null) heap.add(node);

    ListNode dummy = new ListNode(0);
    ListNode tail = dummy;
    while (!heap.isEmpty()) {
        ListNode node = heap.poll();
        tail.next = node;
        tail = node;
        if (node.next != null) heap.add(node.next);
    }
    return dummy.next;
}
// toList(mergeKLists(new ListNode[]{fromArray(1, 4, 5), fromArray(1, 3, 4), fromArray(2, 6)}))
//   -> [1, 1, 2, 3, 4, 4, 5, 6]
```

Divide and conquer without a heap:

```java
static ListNode mergeTwoLists(ListNode a, ListNode b) {
    ListNode dummy = new ListNode(0);
    ListNode tail = dummy;
    while (a != null && b != null) {
        if (a.val <= b.val) {
            tail.next = a;
            a = a.next;
        } else {
            tail.next = b;
            b = b.next;
        }
        tail = tail.next;
    }
    tail.next = a != null ? a : b;
    return dummy.next;
}

static ListNode mergeKListsDivide(ListNode[] lists) {
    if (lists.length == 0) return null;
    int n = lists.length;
    while (n > 1) {
        int half = (n + 1) / 2;
        for (int i = 0; i < n / 2; i++) {
            lists[i] = mergeTwoLists(lists[i], lists[n - 1 - i]);
        }
        n = half;
    }
    return lists[0];
}
```

#### Kth Smallest in a Sorted Matrix

```java
static int kthSmallest(int[][] matrix, int k) {
    int n = matrix.length;
    PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));   // {value, row, col}
    for (int r = 0; r < Math.min(n, k); r++) heap.add(new int[]{matrix[r][0], r, 0});

    int value = 0;
    for (int i = 0; i < k; i++) {
        int[] top = heap.poll();
        value = top[0];
        int r = top[1];
        int c = top[2];
        if (c + 1 < n) heap.add(new int[]{matrix[r][c + 1], r, c + 1});
    }
    return value;
}
// kthSmallest(new int[][]{{1, 5, 9}, {10, 11, 13}, {12, 13, 15}}, 8) -> 13
```

#### Smallest Range Covering Elements from K Lists

```java
static int[] smallestRange(List<List<Integer>> nums) {
    PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));  // {value, list, index}
    int max = Integer.MIN_VALUE;
    for (int i = 0; i < nums.size(); i++) {
        int first = nums.get(i).get(0);
        heap.add(new int[]{first, i, 0});
        max = Math.max(max, first);
    }
    int[] range = {heap.peek()[0], max};
    while (true) {
        int[] top = heap.poll();
        int value = top[0];
        int list = top[1];
        int idx = top[2];
        if (max - value < range[1] - range[0]) range = new int[]{value, max};
        if (idx + 1 == nums.get(list).size()) break;
        int next = nums.get(list).get(idx + 1);
        heap.add(new int[]{next, list, idx + 1});
        max = Math.max(max, next);
    }
    return range;
}
// smallestRange(List.of(List.of(4, 10, 15, 24, 26), List.of(0, 9, 12, 20), List.of(5, 18, 22, 30)))
//   -> [20, 24]
```

`max - value` can overflow when the range spans most of the `int` domain, cast to `long` for adversarial inputs.

**Merge two sorted arrays in place** (fill from the back):

```java
static void mergeSorted(int[] a, int m, int[] b, int n) {
    int i = m - 1;
    int j = n - 1;
    int write = m + n - 1;
    while (j >= 0) {
        a[write--] = (i >= 0 && a[i] > b[j]) ? a[i--] : b[j--];
    }
}
```

---

## 9. Topological Sort

### 9.1 When to Use

- A **directed acyclic graph** of dependencies: prerequisites, build order, task scheduling.
- Keywords: order, before, after, prerequisite, dependency, "can all be finished".
- Detecting whether a directed graph contains a cycle.

A valid ordering exists **if and only if the graph has no cycle**.

### 9.2 Core Idea (Kahn's Algorithm)

1. Build an adjacency list and count each node's **in-degree** (how many prerequisites it still waits on).
2. Put every node with in-degree 0 in a queue. These can start now.
3. Pop a node, add it to the order, and decrement the in-degree of everything that depends on it. Anything reaching 0 joins the queue.
4. If the order contains fewer than all nodes, there is a cycle.

### 9.3 Problem: Course Schedule

`prerequisites[i] = [course, pre]` means you must take `pre` before `course`.

```js
function findOrder(numCourses, prerequisites) {
  const graph = Array.from({ length: numCourses }, () => []);
  const indegree = new Array(numCourses).fill(0);
  for (const [course, pre] of prerequisites) {
    graph[pre].push(course);
    indegree[course]++;
  }

  const queue = [];
  for (let i = 0; i < numCourses; i++) if (indegree[i] === 0) queue.push(i);

  const order = [];
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    order.push(node);
    for (const next of graph[node]) {
      if (--indegree[next] === 0) queue.push(next);
    }
  }
  return order.length === numCourses ? order : [];
}

function canFinish(numCourses, prerequisites) {
  return findOrder(numCourses, prerequisites).length === numCourses;
}

findOrder(4, [[1, 0], [2, 0], [3, 1], [3, 2]]); // [0, 1, 2, 3]
canFinish(2, [[1, 0], [0, 1]]);                 // false
```

Dry run for `4` courses with edges `0 -> 1, 0 -> 2, 1 -> 3, 2 -> 3`:

| Step | Queue | Order | In-degrees [0, 1, 2, 3] |
| --- | --- | --- | --- |
| init | [0] | [] | [0, 1, 1, 2] |
| pop 0 | [1, 2] | [0] | [0, 0, 0, 2] |
| pop 1 | [2] | [0, 1] | [0, 0, 0, 1] |
| pop 2 | [3] | [0, 1, 2] | [0, 0, 0, 0] |
| pop 3 | [] | [0, 1, 2, 3] | done |

Complexity: O(V + E) time and space.

The answer is usually **not unique**.
Any order that respects every edge is valid, so ask whether the interviewer needs a particular one (for example lexicographically smallest, which needs a min-heap instead of a queue).

### 9.4 DFS Alternative: Three-Color Cycle Detection

Mark each node as unvisited (0), in the current DFS path (1), or finished (2).
Reaching a node that is currently in the path (1) means a cycle.
The topological order is the **reverse of finish order**.

```js
function canFinishDFS(numCourses, prerequisites) {
  const graph = Array.from({ length: numCourses }, () => []);
  for (const [course, pre] of prerequisites) graph[pre].push(course);

  const state = new Array(numCourses).fill(0);
  const hasCycle = (node) => {
    if (state[node] === 1) return true;
    if (state[node] === 2) return false;
    state[node] = 1;
    for (const next of graph[node]) if (hasCycle(next)) return true;
    state[node] = 2;
    return false;
  };

  for (let i = 0; i < numCourses; i++) if (hasCycle(i)) return false;
  return true;
}
```

Kahn's is iterative (no recursion limit) and produces the order directly, so it is the default choice.
DFS needs the extra reversal step but is handy when the graph is already being walked.

### 9.5 Extra Variants

**Alien dictionary.**
Given words sorted in an unknown alphabet, derive a letter order.
Compare **adjacent** words: the first differing character gives one edge `a -> b`.
Two edge cases interviewers love:

- If a longer word comes before its own prefix (`"abc"` before `"ab"`), the input is invalid, return `""`.
- Characters that appear in no edge must still appear in the output.

```js
function alienOrder(words) {
  const graph = new Map();
  for (const w of words) for (const c of w) if (!graph.has(c)) graph.set(c, new Set());
  const indegree = new Map([...graph.keys()].map((c) => [c, 0]));

  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i];
    const b = words[i + 1];
    if (a.length > b.length && a.startsWith(b)) return "";
    for (let j = 0; j < Math.min(a.length, b.length); j++) {
      if (a[j] !== b[j]) {
        if (!graph.get(a[j]).has(b[j])) {
          graph.get(a[j]).add(b[j]);
          indegree.set(b[j], indegree.get(b[j]) + 1);
        }
        break;                                          // only the first difference carries information
      }
    }
  }

  const queue = [...indegree].filter(([, d]) => d === 0).map(([c]) => c);
  let order = "";
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head];
    order += c;
    for (const next of graph.get(c)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  return order.length === graph.size ? order : "";
}

alienOrder(["wrt", "wrf", "er", "ett", "rftt"]); // "wertf"
```

**Minimum time to finish all courses** (or parallel courses): count the number of BFS **layers** in Kahn's algorithm.
For weighted durations, keep the longest finish time per node: `finish[next] = max(finish[next], finish[node] + duration[next])`.

**Is the topological order unique?** It is unique only if the queue holds **at most one** node at every step.

**Task ordering and build systems** (npm, make, Gradle) are topological sorts with cycle errors reported as "circular dependency".

### 9.6 Pitfalls

- Reversing the edge direction. Decide once whether an edge means "must come before" and write it in a comment.
- Forgetting isolated nodes. They have in-degree 0 and must be in the order.
- Not checking `order.length === n`, which silently returns a partial order when there is a cycle.
- Duplicate edges inflating in-degree without matching decrements. Deduplicate (as the alien dictionary code does) or make sure both sides use the same count.

### 9.7 Java Implementation

#### Course Schedule (Kahn's Algorithm)

```java
static int[] findOrder(int numCourses, int[][] prerequisites) {
    List<List<Integer>> graph = new ArrayList<>();
    for (int i = 0; i < numCourses; i++) graph.add(new ArrayList<>());
    int[] indegree = new int[numCourses];
    for (int[] edge : prerequisites) {
        int course = edge[0];
        int pre = edge[1];
        graph.get(pre).add(course);
        indegree[course]++;
    }

    Queue<Integer> queue = new ArrayDeque<>();
    for (int i = 0; i < numCourses; i++) if (indegree[i] == 0) queue.add(i);

    int[] order = new int[numCourses];
    int count = 0;
    while (!queue.isEmpty()) {
        int node = queue.poll();
        order[count++] = node;
        for (int next : graph.get(node)) {
            if (--indegree[next] == 0) queue.add(next);
        }
    }
    return count == numCourses ? order : new int[0];
}

static boolean canFinish(int numCourses, int[][] prerequisites) {
    return findOrder(numCourses, prerequisites).length == numCourses;
}
// findOrder(4, new int[][]{{1, 0}, {2, 0}, {3, 1}, {3, 2}}) -> [0, 1, 2, 3]
// canFinish(2, new int[][]{{1, 0}, {0, 1}})                 -> false
```

#### DFS with Three States

```java
static boolean canFinishDfs(int numCourses, int[][] prerequisites) {
    List<List<Integer>> graph = new ArrayList<>();
    for (int i = 0; i < numCourses; i++) graph.add(new ArrayList<>());
    for (int[] edge : prerequisites) graph.get(edge[1]).add(edge[0]);

    int[] state = new int[numCourses];                 // 0 unvisited, 1 in current path, 2 done
    for (int i = 0; i < numCourses; i++) {
        if (hasCycle(graph, state, i)) return false;
    }
    return true;
}

static boolean hasCycle(List<List<Integer>> graph, int[] state, int node) {
    if (state[node] == 1) return true;
    if (state[node] == 2) return false;
    state[node] = 1;
    for (int next : graph.get(node)) {
        if (hasCycle(graph, state, next)) return true;
    }
    state[node] = 2;
    return false;
}
```

#### Alien Dictionary

```java
static String alienOrder(String[] words) {
    Map<Character, Set<Character>> graph = new HashMap<>();
    Map<Character, Integer> indegree = new HashMap<>();
    for (String w : words) {
        for (char c : w.toCharArray()) {
            graph.putIfAbsent(c, new HashSet<>());
            indegree.putIfAbsent(c, 0);
        }
    }

    for (int i = 0; i < words.length - 1; i++) {
        String a = words[i];
        String b = words[i + 1];
        if (a.length() > b.length() && a.startsWith(b)) return "";
        for (int j = 0; j < Math.min(a.length(), b.length()); j++) {
            char from = a.charAt(j);
            char to = b.charAt(j);
            if (from != to) {
                if (graph.get(from).add(to)) indegree.merge(to, 1, Integer::sum);
                break;
            }
        }
    }

    Queue<Character> queue = new ArrayDeque<>();
    for (Map.Entry<Character, Integer> e : indegree.entrySet()) {
        if (e.getValue() == 0) queue.add(e.getKey());
    }
    StringBuilder order = new StringBuilder();
    while (!queue.isEmpty()) {
        char c = queue.poll();
        order.append(c);
        for (char next : graph.get(c)) {
            if (indegree.merge(next, -1, Integer::sum) == 0) queue.add(next);
        }
    }
    return order.length() == graph.size() ? order.toString() : "";
}
// alienOrder(new String[]{"wrt", "wrf", "er", "ett", "rftt"}) -> "wertf"
```

`Set.add` returns `false` when the element already exists, which doubles as the duplicate-edge check.
`HashMap` iteration order is unspecified, so when several letters have in-degree 0 the returned order is one of several valid answers.
Use `LinkedHashMap` or `TreeMap` if you need a deterministic result.

---

## 10. Java Pitfalls

- **`PriorityQueue` iteration and `toString` are not sorted.** Only `poll` returns elements in order.
- **`PriorityQueue.remove(Object)` is O(n).** For lazy deletion, keep a `Map` of pending removals.
- **Comparator subtraction overflows.** Use `Integer.compare`, `Long.compare`, or `Comparator.comparingInt`.
- **`ArrayDeque` rejects `null`.** A tree traversal that enqueues `null` children must use `LinkedList` instead, or skip the nulls (the code above never enqueues them).
- **Do not use `Stack` or `Vector`.** They are synchronized legacy classes. `ArrayDeque` is the replacement.
- **Recursion depth.** Java's default stack handles around 10,000 to 20,000 frames. For deep trees or long chains, use an explicit `Deque` or run the code in a `Thread` with a larger stack size.
- **Generic array creation** is not allowed, `new List<Integer>[n]` does not compile. Use `List<List<Integer>>` or `new List[n]` with an unchecked warning.
- **`List.of` and `Arrays.asList` are fixed-size.** `List.of` is also immutable and rejects `null`. Wrap in `new ArrayList<>(...)` when you need to change it.
- **`Integer` cache and `==`.** Comparing boxed values from a `Map` with `==` fails for values above 127.
- **`Math.ceil(a / b)` with ints** is wrong because the division has already truncated. Use `(a + b - 1) / b` or `Math.ceil((double) a / b)`.
- **`char` in `Map<Character, ...>` autoboxes.** In a hot loop prefer an `int[128]` or `int[26]` counter.

---

## 11. Quick Recap

| Pattern | Signal in the problem | Core tool | Time | Space |
| --- | --- | --- | --- | --- |
| Tree BFS | Levels, shortest unweighted path | Queue, level-by-level loop | O(n) | O(width) |
| Tree DFS | Paths, subtree aggregates, all routes | Recursion or stack | O(n) | O(height) |
| Two heaps | Running median, two competing priorities | Max-heap plus min-heap | O(log n) per insert | O(n) |
| Subsets | All combinations, permutations, power set | Iterative copy or backtracking | O(n * 2^n) | O(n) |
| Modified binary search | Sorted, rotated, or monotonic answer space | `firstTrue` template | O(log n) | O(1) |
| Top K | K largest, smallest, frequent, closest | Size-K heap of the opposite kind | O(n log k) | O(k) |
| K-way merge | K sorted inputs | Min-heap with one head per list | O(N log K) | O(K) |
| Topological sort | Dependencies, ordering, cycle detection | In-degree plus queue | O(V + E) | O(V + E) |

Next: the [Pattern Playbook](/docs/dsa/pattern-playbook) shows how to pick a pattern quickly, gives a complexity cheat sheet, and covers extra patterns that are not in the original 14.
