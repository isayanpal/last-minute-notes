---
title: "Advanced Trees: BST Deletion, Balanced Trees, Segment Trees"
description: "BST deletion with the three cases, AVL and red-black balancing with rotations, and segment trees for range queries with updates, with dry runs, pitfalls, and JavaScript and Java code."
---

# 📘 Advanced Trees: BST Deletion, Balanced Trees, Segment Trees

The basic tree traversals are in [Tree Breadth-First Search](/docs/dsa/trees-graphs-and-search#2-tree-breadth-first-search) and [Tree Depth-First Search](/docs/dsa/trees-graphs-and-search#3-tree-depth-first-search).
This page covers what comes next: removing a node from a binary search tree without breaking it, keeping a search tree **balanced** so it never degrades to a list, and a different kind of tree, the **segment tree**, that answers range queries on an array that keeps changing.
Each section has recognition signals, a core idea, a worked problem with a dry run, pitfalls, and a **Java Implementation** subsection.
JavaScript and Java code is included, and every snippet on this page was executed against test cases.
Java conventions: all methods are `static` members of one `Solution` class, `import java.util.*;` is assumed, helper classes are top-level package-private classes in the same file, and the trailing `//` comments show a sample call and its result.
The code in each section reuses the `TreeNode` class and the `insertBST`, `inorder`, and `shape` helpers from section 1.

## Table of Contents

1. [BST Deletion](#1-bst-deletion)
2. [Balanced Trees (AVL and Red-Black)](#2-balanced-trees-avl-and-red-black)
3. [Segment Trees](#3-segment-trees)
4. [Java Pitfalls](#4-java-pitfalls)
5. [Quick Recap](#5-quick-recap)

---

## 1. BST Deletion

### 1.1 When to Use

- The problem says "delete a node from a BST" (LeetCode 450) or asks you to implement `remove` in an ordered set.
- You need the **inorder successor** or **predecessor** of a node, because deletion is built on it.
- A tree must stay a valid BST after a removal: every left descendant smaller, every right descendant larger.
- Keywords: "delete node in a BST", "remove key", "ordered set", "TreeMap remove".

### 1.2 Core Idea

A BST keeps its keys ordered, so searching for a key is a walk down: go left if the key is smaller, right if it is larger.
Deletion is that walk plus a repair at the node you find.
The repair has **three cases**, based on how many children the node has.

| Case | Node has | What to do |
| --- | --- | --- |
| 1. Leaf | No children | Remove it: the parent's link becomes `null` |
| 2. One child | Exactly one child | Replace the node with its child: the parent links straight to the child |
| 3. Two children | Both children | Copy the **inorder successor** (the smallest key in the right subtree) into the node, then delete the successor from the right subtree |

Why the successor works.
It is the next larger key, so every key in the left subtree is smaller than it, and every other key in the right subtree is larger.
Dropping it into the deleted node's place keeps the BST property intact.
The **predecessor** (the largest key in the left subtree) works equally well.

The successor has **no left child**, because if it had one, that child would be smaller and would be the successor instead.
So deleting the successor from the right subtree is always case 1 or case 2, and the recursion ends there.

```text
delete 3 from:                    after copying successor 4 into the node,
                                  then removing the old 4:
        8                                 8
       / \                               / \
      3   10                            4   10
     / \    \                          / \    \
    1   6    14                       1   6    14
       / \   /                           / \   /
      4   7 13                          5   7 13
       \
        5
```

The recursive function returns the **new root of the subtree**, so each caller can reattach it: `root.left = deleteNode(root.left, key)`.
Time is O(h) where `h` is the tree height, which is O(log n) for a balanced tree and O(n) for a skewed one.

### 1.3 Problem: Delete Node in a BST

Start with the shared helpers.
`shape` prints a tree as `value(left,right)`, which makes the structure easy to compare.

```js
class TreeNode {
  constructor(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

function insertBST(root, val) {
  if (root === null) return new TreeNode(val);
  if (val < root.val) root.left = insertBST(root.left, val);
  else if (val > root.val) root.right = insertBST(root.right, val);
  return root;
}

function fromValues(values) {
  let root = null;
  for (const v of values) root = insertBST(root, v);
  return root;
}

function inorder(root, out = []) {
  if (root === null) return out;
  inorder(root.left, out);
  out.push(root.val);
  inorder(root.right, out);
  return out;
}

function shape(root) {
  if (root === null) return "";
  if (root.left === null && root.right === null) return String(root.val);
  return `${root.val}(${shape(root.left)},${shape(root.right)})`;
}
```

The deletion itself:

```js
function deleteNode(root, key) {
  if (root === null) return null;                    // key not found: nothing to do
  if (key < root.val) {
    root.left = deleteNode(root.left, key);
  } else if (key > root.val) {
    root.right = deleteNode(root.right, key);
  } else {
    if (root.left === null) return root.right;       // leaf, or only a right child
    if (root.right === null) return root.left;       // only a left child
    let successor = root.right;                      // two children: smallest in right subtree
    while (successor.left !== null) successor = successor.left;
    root.val = successor.val;
    root.right = deleteNode(root.right, successor.val);   // remove the original successor
  }
  return root;
}

const values = [8, 3, 10, 1, 6, 14, 4, 7, 13, 5];
shape(fromValues(values)); // 8(3(1,6(4(,5),7)),10(,14(13,)))
shape(deleteNode(fromValues(values), 1)); // 8(3(,6(4(,5),7)),10(,14(13,)))
shape(deleteNode(fromValues(values), 14)); // 8(3(1,6(4(,5),7)),10(,13))
shape(deleteNode(fromValues(values), 3)); // 8(4(1,6(5,7)),10(,14(13,)))
shape(deleteNode(fromValues(values), 8)); // 10(3(1,6(4(,5),7)),14(13,))
shape(deleteNode(fromValues(values), 99)); // 8(3(1,6(4(,5),7)),10(,14(13,)))
inorder(deleteNode(fromValues(values), 6)); // [1,3,4,5,7,8,10,13,14]
```

Dry run for the original tree `8(3(1,6(4(,5),7)),10(,14(13,)))`:

| Delete | Path to the node | Case | What happens |
| --- | --- | --- | --- |
| 1 | 8, 3, 1 | Leaf | `3.left = null` |
| 14 | 8, 10, 14 | One child (left, `13`) | `10.right` now points at `13` |
| 3 | 8, 3 | Two children | Successor: go right to `6`, then left to `4`. Copy `4` into the node. Delete `4` from the right subtree: `4` has only a right child `5`, so `6.left = 5` |
| 8 | 8 | Two children | Successor: go right to `10`, which has no left child, so it is `10`. Copy `10` into the root. Delete `10` from the right subtree: only a right child `14`, so the right subtree becomes `14(13,)` |
| 99 | 8, 10, 14, null | Not found | Every call returns the subtree unchanged |

The case for key `3` shows why the successor is deleted recursively instead of just unlinked.
The successor `4` still had a right child `5`, and that child must be reattached.

### 1.4 Extra Variants

**Use the predecessor instead.**
Copy the largest key from the left subtree.
Both choices are correct, and some implementations alternate to avoid always shrinking the right side.

```js
function deleteNodeWithPredecessor(root, key) {
  if (root === null) return null;
  if (key < root.val) {
    root.left = deleteNodeWithPredecessor(root.left, key);
  } else if (key > root.val) {
    root.right = deleteNodeWithPredecessor(root.right, key);
  } else {
    if (root.left === null) return root.right;
    if (root.right === null) return root.left;
    let predecessor = root.left;
    while (predecessor.right !== null) predecessor = predecessor.right;
    root.val = predecessor.val;
    root.left = deleteNodeWithPredecessor(root.left, predecessor.val);
  }
  return root;
}

shape(deleteNodeWithPredecessor(fromValues(values), 3)); // 8(1(,6(4(,5),7)),10(,14(13,)))
```

**Delete the minimum.**
Walk left to the end, and return the right child in its place.
This is the successor step on its own, and it is how a priority queue built on a BST pops.

```js
function deleteMin(root) {
  if (root === null) return null;
  if (root.left === null) return root.right;
  root.left = deleteMin(root.left);
  return root;
}

inorder(deleteMin(fromValues(values))); // [3,4,5,6,7,8,10,13,14]
```

**Check the result is still a valid BST** with a bounds walk, or by confirming that `inorder` is strictly increasing.

```js
function isValidBST(root, lo = -Infinity, hi = Infinity) {
  if (root === null) return true;
  if (root.val <= lo || root.val >= hi) return false;
  return isValidBST(root.left, lo, root.val) && isValidBST(root.right, root.val, hi);
}

isValidBST(deleteNode(fromValues(values), 3)); // true
isValidBST(deleteNode(fromValues(values), 8)); // true
```

### 1.5 Pitfalls

- **Not reattaching the returned subtree.** `deleteNode(root.left, key);` without `root.left =` drops the change.
- **Forgetting the return in the one-child cases.** Return the child, not `root`.
- **Looking for the successor in the wrong subtree.** It is the smallest key of the **right** subtree.
  The smallest of the left subtree is the minimum of the whole left side, not the neighbor.
- **Deleting the successor with a plain `null` assignment.** The successor can have a right child, and it must be kept.
- **Duplicates.** The code above assumes unique keys.
  With duplicates, decide where equal keys live (always right, say), and delete only one copy.
- **A skewed tree.** After inserting sorted keys the tree is a list and every operation is O(n).
  That is the motivation for [balanced trees](#2-balanced-trees-avl-and-red-black).
- **Deleting by node reference in Java without parent pointers.** You still need to search from the root, or keep a parent link.

### 1.6 Java Implementation

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

```java
static TreeNode insertBST(TreeNode root, int val) {
    if (root == null) return new TreeNode(val);
    if (val < root.val) root.left = insertBST(root.left, val);
    else if (val > root.val) root.right = insertBST(root.right, val);
    return root;
}

static TreeNode fromValues(int... values) {
    TreeNode root = null;
    for (int v : values) root = insertBST(root, v);
    return root;
}

static List<Integer> inorder(TreeNode root) {
    List<Integer> out = new ArrayList<>();
    inorder(root, out);
    return out;
}

static void inorder(TreeNode root, List<Integer> out) {
    if (root == null) return;
    inorder(root.left, out);
    out.add(root.val);
    inorder(root.right, out);
}

static String shape(TreeNode root) {
    if (root == null) return "";
    if (root.left == null && root.right == null) return String.valueOf(root.val);
    return root.val + "(" + shape(root.left) + "," + shape(root.right) + ")";
}

static TreeNode deleteNode(TreeNode root, int key) {
    if (root == null) return null;
    if (key < root.val) {
        root.left = deleteNode(root.left, key);
    } else if (key > root.val) {
        root.right = deleteNode(root.right, key);
    } else {
        if (root.left == null) return root.right;
        if (root.right == null) return root.left;
        TreeNode successor = root.right;
        while (successor.left != null) successor = successor.left;
        root.val = successor.val;
        root.right = deleteNode(root.right, successor.val);
    }
    return root;
}
// shape(fromValues(8, 3, 10, 1, 6, 14, 4, 7, 13, 5)) -> 8(3(1,6(4(,5),7)),10(,14(13,)))
// shape(deleteNode(fromValues(8, 3, 10, 1, 6, 14, 4, 7, 13, 5), 3)) -> 8(4(1,6(5,7)),10(,14(13,)))
// shape(deleteNode(fromValues(8, 3, 10, 1, 6, 14, 4, 7, 13, 5), 8)) -> 10(3(1,6(4(,5),7)),14(13,))
// shape(deleteNode(fromValues(8, 3, 10, 1, 6, 14, 4, 7, 13, 5), 14)) -> 8(3(1,6(4(,5),7)),10(,13))
// inorder(deleteNode(fromValues(8, 3, 10, 1, 6, 14, 4, 7, 13, 5), 6)) -> [1, 3, 4, 5, 7, 8, 10, 13, 14]
```

The predecessor variant and `deleteMin`:

```java
static TreeNode deleteNodeWithPredecessor(TreeNode root, int key) {
    if (root == null) return null;
    if (key < root.val) {
        root.left = deleteNodeWithPredecessor(root.left, key);
    } else if (key > root.val) {
        root.right = deleteNodeWithPredecessor(root.right, key);
    } else {
        if (root.left == null) return root.right;
        if (root.right == null) return root.left;
        TreeNode predecessor = root.left;
        while (predecessor.right != null) predecessor = predecessor.right;
        root.val = predecessor.val;
        root.left = deleteNodeWithPredecessor(root.left, predecessor.val);
    }
    return root;
}
// shape(deleteNodeWithPredecessor(fromValues(8, 3, 10, 1, 6, 14, 4, 7, 13, 5), 3)) -> 8(1(,6(4(,5),7)),10(,14(13,)))

static TreeNode deleteMin(TreeNode root) {
    if (root == null) return null;
    if (root.left == null) return root.right;
    root.left = deleteMin(root.left);
    return root;
}
// inorder(deleteMin(fromValues(8, 3, 10, 1, 6, 14, 4, 7, 13, 5))) -> [3, 4, 5, 6, 7, 8, 10, 13, 14]
```

Java's `TreeMap` and `TreeSet` do this for you, with a red-black tree underneath.
`remove(key)` is O(log n), and `pollFirst` is the `deleteMin` above.

---

## 2. Balanced Trees (AVL and Red-Black)

### 2.1 When to Use

- You need an **ordered** collection with fast insert, delete, and search, and the worst case matters.
- Keys arrive **sorted or nearly sorted**, so a plain BST would become a list.
- You are asked how `TreeMap`, `std::map`, or a database index stays fast.
- An interviewer asks "what is a rotation?", "what does an AVL balance factor mean?", or "AVL or red-black?".
- Keywords: "self-balancing", "height-balanced", "O(log n) guaranteed", "rotation".

### 2.2 Core Idea

A plain BST's height depends on insertion order.
Inserting `1, 2, 3, 4, 5` in order builds a right-leaning chain of height 5, and every search is O(n).
A **self-balancing** BST repairs the shape after each insert or delete so the height stays O(log n).
The repair tool is the **rotation**, a local change that keeps the inorder sequence the same but moves a node up and another down.

```text
rotateRight(y):                      rotateLeft(x):

      y                x                  x                  y
     / \              / \                / \                / \
    x   C     ->     A   y              A   y      ->      x   C
   / \                  / \                / \            / \
  A   B                B   C              B   C          A   B
```

Inorder is `A x B y C` before and after, so the BST property survives.

#### AVL trees

An AVL tree keeps the **balance factor** of every node, `height(left) - height(right)`, in `{-1, 0, +1}`.
After an insert or delete, walk back up and, at the first node whose balance factor is `+2` or `-2`, apply one of four fixes.

| Case | Where the extra height is | Fix |
| --- | --- | --- |
| Left-Left | Left child's left side (`bf(z) = +2`, `bf(z.left) >= 0`) | `rotateRight(z)` |
| Right-Right | Right child's right side (`bf(z) = -2`, `bf(z.right) <= 0`) | `rotateLeft(z)` |
| Left-Right | Left child's right side (`bf(z) = +2`, `bf(z.left) < 0`) | `rotateLeft(z.left)`, then `rotateRight(z)` |
| Right-Left | Right child's left side (`bf(z) = -2`, `bf(z.right) > 0`) | `rotateRight(z.right)`, then `rotateLeft(z)` |

The height of an AVL tree with `n` nodes is at most about `1.44 * log2(n)`, so every operation is O(log n) in the worst case.
An insert needs at most one single or double rotation.
A delete may need a rotation at every level on the way up, which is still O(log n).

#### Red-black trees

A red-black tree gives each node a color and keeps five rules:

1. Every node is red or black.
2. The root is black.
3. Every `null` child counts as black.
4. A red node has no red child (no two reds in a row).
5. Every path from a node down to its `null` descendants has the **same number of black nodes**.

Rule 5 forces the longest path to be at most twice the shortest, because the shortest path could be all black and the longest alternates red and black.
So the height is at most `2 * log2(n + 1)`.

**Insertion.**
Insert like a BST, color the new node **red**, then fix any red-red violation.
Look at the new node's **uncle** (the parent's sibling):

| Uncle | Fix |
| --- | --- |
| **Red** | **Recolor**: parent and uncle become black, grandparent becomes red, then continue the check from the grandparent |
| **Black**, and the node is an **inner** child (a "triangle") | Rotate the parent to turn it into the line case below |
| **Black**, and the node is an **outer** child (a "line") | Rotate the grandparent, then swap the colors of the parent and the grandparent |

At the end, color the root black.
Recoloring is cheap and moves the problem upward, and the rotation cases finish the repair.
So an insert does at most two rotations.

**Deletion** has more cases (the removed node's "double black" has to be pushed up or absorbed by a sibling), but it needs at most three rotations.
Interviews almost never ask for red-black deletion code.
Know the insert cases and the rules.

#### AVL or red-black

| | AVL | Red-black |
| --- | --- | --- |
| Height bound | About `1.44 log2 n` | About `2 log2 n` |
| Lookups | Faster, the tree is shallower | Slightly slower |
| Insert and delete | More rotations, since balance is strict | Fewer rotations, balance is looser |
| Bookkeeping | An integer height or balance factor | One color bit |
| Typical use | Read-heavy in-memory indexes | Java `TreeMap`, C++ `std::map`, Linux schedulers |

For disk-based indexes with high fan-out, databases use B-trees instead.
Both AVL and red-black trees are binary trees, which suit memory.

### 2.3 Problem: Implement an AVL Tree

Insert and delete keys, and keep every node's balance factor within one.
The helper `rebalance(node)` recomputes the height and applies whichever of the four fixes is needed, and it is the only place that rotates.

```js
class AvlNode {
  constructor(key) {
    this.key = key;
    this.left = null;
    this.right = null;
    this.height = 1;                                    // a leaf has height 1
  }
}

function avlHeight(node) {
  return node === null ? 0 : node.height;
}

function avlUpdate(node) {
  node.height = 1 + Math.max(avlHeight(node.left), avlHeight(node.right));
}

function balanceFactor(node) {
  return node === null ? 0 : avlHeight(node.left) - avlHeight(node.right);
}

function rotateRight(y) {
  const x = y.left;
  y.left = x.right;
  x.right = y;
  avlUpdate(y);                                         // y is lower now, update it first
  avlUpdate(x);
  return x;                                             // new root of this subtree
}

function rotateLeft(x) {
  const y = x.right;
  x.right = y.left;
  y.left = x;
  avlUpdate(x);
  avlUpdate(y);
  return y;
}

function rebalance(node) {
  avlUpdate(node);
  const bf = balanceFactor(node);
  if (bf > 1) {
    if (balanceFactor(node.left) < 0) node.left = rotateLeft(node.left);     // Left-Right
    return rotateRight(node);                                                 // Left-Left
  }
  if (bf < -1) {
    if (balanceFactor(node.right) > 0) node.right = rotateRight(node.right); // Right-Left
    return rotateLeft(node);                                                  // Right-Right
  }
  return node;
}

function avlInsert(node, key) {
  if (node === null) return new AvlNode(key);
  if (key < node.key) node.left = avlInsert(node.left, key);
  else if (key > node.key) node.right = avlInsert(node.right, key);
  else return node;                                     // ignore duplicates
  return rebalance(node);
}

function avlDelete(node, key) {
  if (node === null) return null;
  if (key < node.key) {
    node.left = avlDelete(node.left, key);
  } else if (key > node.key) {
    node.right = avlDelete(node.right, key);
  } else {
    if (node.left === null) return node.right;
    if (node.right === null) return node.left;
    let successor = node.right;
    while (successor.left !== null) successor = successor.left;
    node.key = successor.key;
    node.right = avlDelete(node.right, successor.key);
  }
  return rebalance(node);                               // every ancestor may be off balance
}

function avlShape(node) {
  if (node === null) return "";
  if (node.left === null && node.right === null) return String(node.key);
  return `${node.key}(${avlShape(node.left)},${avlShape(node.right)})`;
}

function isAvl(node) {
  const check = n => {
    if (n === null) return 0;
    const l = check(n.left);
    const r = check(n.right);
    if (l < 0 || r < 0 || Math.abs(l - r) > 1) return -1;
    return 1 + Math.max(l, r);
  };
  return check(node) >= 0;
}

function avlFrom(keys) {
  let root = null;
  for (const k of keys) root = avlInsert(root, k);
  return root;
}

avlShape(avlFrom([10, 20, 30])); // 20(10,30)
avlShape(avlFrom([30, 20, 10])); // 20(10,30)
avlShape(avlFrom([30, 10, 20])); // 20(10,30)
avlShape(avlFrom([10, 30, 20])); // 20(10,30)
avlShape(avlFrom([1, 2, 3, 4, 5, 6, 7])); // 4(2(1,3),6(5,7))
avlHeight(avlFrom(Array.from({ length: 1000 }, (_, i) => i))); // 10
isAvl(avlFrom(Array.from({ length: 1000 }, (_, i) => i))); // true
avlShape(avlDelete(avlFrom([1, 2, 3, 4, 5, 6, 7]), 1)); // 4(2(,3),6(5,7))
avlShape(avlDelete(avlDelete(avlDelete(avlFrom([1, 2, 3, 4, 5, 6, 7]), 1), 3), 2)); // 6(4(,5),7)
```

Dry run of inserting `10, 20, 30` in order.
This is the Right-Right case.

| Step | Tree after the BST insert | Heights | Balance factor at the root | Action |
| --- | --- | --- | --- | --- |
| Insert 10 | `10` | h(10) = 1 | 0 | none |
| Insert 20 | `10(,20)` | h(10) = 2 | -1 | none, still within one |
| Insert 30 | `10(,20(,30))` | h(10) = 3 | **-2** | Right-Right: `bf(20) = -1`, so `rotateLeft(10)` |
| Result | `20(10,30)` | h(20) = 2 | 0 | balanced |

The four insertion orders `10, 20, 30`, `30, 20, 10`, `30, 10, 20`, and `10, 30, 20` all end with `20(10,30)`.
Two of them are single rotations and two are double rotations.

Dry run of deleting from `4(2(1,3),6(5,7))`, which has seven keys:

| Delete | Tree after the BST delete | Balance problem | Action | Result |
| --- | --- | --- | --- | --- |
| 1 | `4(2(,3),6(5,7))` | `bf(2) = -1`, `bf(4) = 0` | none | balanced |
| 3 | `4(2,6(5,7))` | `bf(4) = 1 - 2 = -1` | none | balanced |
| 2 | `4(,6(5,7))` | `bf(4) = 0 - 2 = -2`, `bf(6) = 0` | Right-Right with equal child heights: `rotateLeft(4)` | `6(4(,5),7)` |

The last row shows that a delete needs the Right-Right fix even when the child is perfectly balanced (`bf(6) = 0`), which is why the conditions use `< 0` and `> 0` for the double rotation and treat zero as a single rotation.

For a sorted input of 1000 keys the AVL tree has height 10.
A plain BST would have height 1000.

### 2.4 Red-Black Insertion

The version below keeps parent pointers, which is how the standard algorithm is described.
`null` stands for the black leaves.

```js
const RED = true;
const BLACK = false;

class RbNode {
  constructor(key) {
    this.key = key;
    this.color = RED;                                   // new nodes start red
    this.left = null;
    this.right = null;
    this.parent = null;
  }
}

class RedBlackTree {
  constructor() {
    this.root = null;
  }

  #rotateLeft(x) {
    const y = x.right;
    x.right = y.left;
    if (y.left !== null) y.left.parent = x;
    y.parent = x.parent;
    if (x.parent === null) this.root = y;
    else if (x === x.parent.left) x.parent.left = y;
    else x.parent.right = y;
    y.left = x;
    x.parent = y;
  }

  #rotateRight(x) {
    const y = x.left;
    x.left = y.right;
    if (y.right !== null) y.right.parent = x;
    y.parent = x.parent;
    if (x.parent === null) this.root = y;
    else if (x === x.parent.right) x.parent.right = y;
    else x.parent.left = y;
    y.right = x;
    x.parent = y;
  }

  insert(key) {
    let parent = null;
    let cur = this.root;
    while (cur !== null) {
      parent = cur;
      if (key < cur.key) cur = cur.left;
      else if (key > cur.key) cur = cur.right;
      else return;                                      // ignore duplicates
    }
    const node = new RbNode(key);
    node.parent = parent;
    if (parent === null) this.root = node;
    else if (key < parent.key) parent.left = node;
    else parent.right = node;
    this.#fixInsert(node);
  }

  #fixInsert(node) {
    while (node.parent !== null && node.parent.color === RED) {
      const parent = node.parent;
      const grand = parent.parent;                      // a red parent is never the root
      if (parent === grand.left) {
        const uncle = grand.right;
        if (uncle !== null && uncle.color === RED) {    // case 1: recolor
          parent.color = BLACK;
          uncle.color = BLACK;
          grand.color = RED;
          node = grand;
        } else {
          if (node === parent.right) {                  // case 2: triangle, rotate into a line
            node = parent;
            this.#rotateLeft(node);
          }
          node.parent.color = BLACK;                    // case 3: line, rotate the grandparent
          node.parent.parent.color = RED;
          this.#rotateRight(node.parent.parent);
        }
      } else {                                          // mirror image
        const uncle = grand.left;
        if (uncle !== null && uncle.color === RED) {
          parent.color = BLACK;
          uncle.color = BLACK;
          grand.color = RED;
          node = grand;
        } else {
          if (node === parent.left) {
            node = parent;
            this.#rotateRight(node);
          }
          node.parent.color = BLACK;
          node.parent.parent.color = RED;
          this.#rotateLeft(node.parent.parent);
        }
      }
    }
    this.root.color = BLACK;                            // rule 2
  }

  shape(node = this.root) {
    if (node === null) return "";
    const label = `${node.key}${node.color === RED ? "R" : "B"}`;
    if (node.left === null && node.right === null) return label;
    return `${label}(${this.shape(node.left)},${this.shape(node.right)})`;
  }

  height(node = this.root) {
    return node === null ? 0 : 1 + Math.max(this.height(node.left), this.height(node.right));
  }

  isValid() {
    if (this.root === null) return true;
    if (this.root.color === RED) return false;
    const check = n => {                                // returns black height, or -1 if broken
      if (n === null) return 1;
      const kidsRed = (n.left !== null && n.left.color === RED) || (n.right !== null && n.right.color === RED);
      if (n.color === RED && kidsRed) return -1;        // rule 4
      const l = check(n.left);
      const r = check(n.right);
      if (l < 0 || r < 0 || l !== r) return -1;         // rule 5
      return l + (n.color === BLACK ? 1 : 0);
    };
    return check(this.root) > 0;
  }
}

function rbFrom(keys) {
  const tree = new RedBlackTree();
  for (const k of keys) tree.insert(k);
  return tree;
}

rbFrom([10, 20, 30]).shape(); // 20B(10R,30R)
rbFrom([10, 20, 30, 40]).shape(); // 20B(10B,30B(,40R))
rbFrom([10, 20, 30, 40, 50]).shape(); // 20B(10B,40B(30R,50R))
rbFrom([1, 2, 3, 4, 5, 6, 7]).shape(); // 2B(1B,4R(3B,6B(5R,7R)))
rbFrom(Array.from({ length: 1000 }, (_, i) => i)).isValid(); // true
rbFrom(Array.from({ length: 1000 }, (_, i) => i)).height(); // 17
```

Dry run of inserting `10, 20, 30, 40, 50`:

| Insert | New red node's neighbors | Case | Result |
| --- | --- | --- | --- |
| 10 | It is the root | Recolor root black | `10B` |
| 20 | Parent `10` is black | Nothing to fix | `10B(,20R)` |
| 30 | Parent `20` red, uncle `null` (black), line shape (right-right) | Case 3: rotate left at grandparent `10`, parent black, grandparent red | `20B(10R,30R)` |
| 40 | Parent `30` red, uncle `10` red | Case 1: recolor `30` and `10` black, `20` red, then the root is recolored black | `20B(10B,30B(,40R))` |
| 50 | Parent `40` red, uncle `null` (black), line shape | Case 3: rotate left at `30`, `40` black, `30` red | `20B(10B,40B(30R,50R))` |

The tree of 1000 sorted keys is valid, and its height is 17.
A plain BST would be 1000 tall, and the perfect AVL shape is 10.
The bound `2 * log2(1001)` is about 20, so 17 is within it, and it also shows the looser balance of red-black trees.

### 2.5 Extra Variants

**Build a balanced BST once from a sorted array** (LeetCode 108).
When all keys are known up front, there is no need for rotations: pick the middle as the root and recurse.

```js
function sortedArrayToBST(nums, lo = 0, hi = nums.length - 1) {
  if (lo > hi) return null;
  const mid = (lo + hi) >> 1;
  return new TreeNode(nums[mid], sortedArrayToBST(nums, lo, mid - 1), sortedArrayToBST(nums, mid + 1, hi));
}

shape(sortedArrayToBST([1, 2, 3, 4, 5, 6, 7])); // 4(2(1,3),6(5,7))
```

**Balance an unbalanced BST** (LeetCode 1382): collect the keys with `inorder`, then rebuild with `sortedArrayToBST`.

```js
function balanceBST(root) {
  return sortedArrayToBST(inorder(root));
}

shape(balanceBST(fromValues([1, 2, 3, 4, 5, 6, 7]))); // 4(2(1,3),6(5,7))
```

**Check whether a tree is height-balanced** (LeetCode 110).
Return the height, and use `-1` as the "unbalanced" signal, as `isAvl` does above.

### 2.6 Pitfalls

- **Updating heights in the wrong order.** After a rotation, update the node that moved **down** first, then the one that moved up.
- **Forgetting to return the new subtree root.** A rotation changes which node is on top, and the caller must reattach it: `node.left = rotateLeft(node.left)`.
- **Mixing height conventions.** If a leaf has height 1 and `null` has height 0, keep it everywhere, or the balance factor is off by one.
- **The wrong double-rotation test.** The inner rotation happens when the **child's** balance factor has the opposite sign.
  A zero balance factor on the child means a single rotation.
- **Rebalancing only the inserted node's parent.** Heights change on the whole path up, so every ancestor needs the check, which is what the recursive return gives for free.
- **Skipping the final `root.color = BLACK` in red-black insertion.** Recoloring can turn the root red.
- **Treating the uncle as a node that always exists.** A `null` uncle counts as black.
- **Confusing the two trees' guarantees.** An AVL tree is *more* strictly balanced than a red-black tree.
  Every AVL shape can be colored as a valid red-black tree, but many red-black shapes are too lopsided to be AVL trees.

### 2.7 Java Implementation

AVL tree:

```java
class AvlNode {
    int key;
    int height = 1;
    AvlNode left;
    AvlNode right;

    AvlNode(int key) {
        this.key = key;
    }
}
```

```java
static int avlHeight(AvlNode node) {
    return node == null ? 0 : node.height;
}

static void avlUpdate(AvlNode node) {
    node.height = 1 + Math.max(avlHeight(node.left), avlHeight(node.right));
}

static int balanceFactor(AvlNode node) {
    return node == null ? 0 : avlHeight(node.left) - avlHeight(node.right);
}

static AvlNode rotateRight(AvlNode y) {
    AvlNode x = y.left;
    y.left = x.right;
    x.right = y;
    avlUpdate(y);
    avlUpdate(x);
    return x;
}

static AvlNode rotateLeft(AvlNode x) {
    AvlNode y = x.right;
    x.right = y.left;
    y.left = x;
    avlUpdate(x);
    avlUpdate(y);
    return y;
}

static AvlNode rebalance(AvlNode node) {
    avlUpdate(node);
    int bf = balanceFactor(node);
    if (bf > 1) {
        if (balanceFactor(node.left) < 0) node.left = rotateLeft(node.left);
        return rotateRight(node);
    }
    if (bf < -1) {
        if (balanceFactor(node.right) > 0) node.right = rotateRight(node.right);
        return rotateLeft(node);
    }
    return node;
}

static AvlNode avlInsert(AvlNode node, int key) {
    if (node == null) return new AvlNode(key);
    if (key < node.key) node.left = avlInsert(node.left, key);
    else if (key > node.key) node.right = avlInsert(node.right, key);
    else return node;
    return rebalance(node);
}

static AvlNode avlDelete(AvlNode node, int key) {
    if (node == null) return null;
    if (key < node.key) {
        node.left = avlDelete(node.left, key);
    } else if (key > node.key) {
        node.right = avlDelete(node.right, key);
    } else {
        if (node.left == null) return node.right;
        if (node.right == null) return node.left;
        AvlNode successor = node.right;
        while (successor.left != null) successor = successor.left;
        node.key = successor.key;
        node.right = avlDelete(node.right, successor.key);
    }
    return rebalance(node);
}

static String avlShape(AvlNode node) {
    if (node == null) return "";
    if (node.left == null && node.right == null) return String.valueOf(node.key);
    return node.key + "(" + avlShape(node.left) + "," + avlShape(node.right) + ")";
}

static AvlNode avlFrom(int... keys) {
    AvlNode root = null;
    for (int k : keys) root = avlInsert(root, k);
    return root;
}

static int[] range(int n) {
    int[] a = new int[n];
    for (int i = 0; i < n; i++) a[i] = i;
    return a;
}
// avlShape(avlFrom(10, 20, 30)) -> 20(10,30)
// avlShape(avlFrom(30, 10, 20)) -> 20(10,30)
// avlShape(avlFrom(1, 2, 3, 4, 5, 6, 7)) -> 4(2(1,3),6(5,7))
// avlHeight(avlFrom(range(1000))) -> 10
// avlShape(avlDelete(avlDelete(avlDelete(avlFrom(1, 2, 3, 4, 5, 6, 7), 1), 3), 2)) -> 6(4(,5),7)
```

Red-black insertion:

```java
class RbNode {
    int key;
    boolean red = true;
    RbNode left;
    RbNode right;
    RbNode parent;

    RbNode(int key) {
        this.key = key;
    }
}

class RedBlackTree {
    RbNode root;

    private void rotateLeft(RbNode x) {
        RbNode y = x.right;
        x.right = y.left;
        if (y.left != null) y.left.parent = x;
        y.parent = x.parent;
        if (x.parent == null) root = y;
        else if (x == x.parent.left) x.parent.left = y;
        else x.parent.right = y;
        y.left = x;
        x.parent = y;
    }

    private void rotateRight(RbNode x) {
        RbNode y = x.left;
        x.left = y.right;
        if (y.right != null) y.right.parent = x;
        y.parent = x.parent;
        if (x.parent == null) root = y;
        else if (x == x.parent.right) x.parent.right = y;
        else x.parent.left = y;
        y.right = x;
        x.parent = y;
    }

    void insert(int key) {
        RbNode parent = null;
        RbNode cur = root;
        while (cur != null) {
            parent = cur;
            if (key < cur.key) cur = cur.left;
            else if (key > cur.key) cur = cur.right;
            else return;
        }
        RbNode node = new RbNode(key);
        node.parent = parent;
        if (parent == null) root = node;
        else if (key < parent.key) parent.left = node;
        else parent.right = node;
        fixInsert(node);
    }

    private void fixInsert(RbNode node) {
        while (node.parent != null && node.parent.red) {
            RbNode parent = node.parent;
            RbNode grand = parent.parent;
            if (parent == grand.left) {
                RbNode uncle = grand.right;
                if (uncle != null && uncle.red) {
                    parent.red = false;
                    uncle.red = false;
                    grand.red = true;
                    node = grand;
                } else {
                    if (node == parent.right) {
                        node = parent;
                        rotateLeft(node);
                    }
                    node.parent.red = false;
                    node.parent.parent.red = true;
                    rotateRight(node.parent.parent);
                }
            } else {
                RbNode uncle = grand.left;
                if (uncle != null && uncle.red) {
                    parent.red = false;
                    uncle.red = false;
                    grand.red = true;
                    node = grand;
                } else {
                    if (node == parent.left) {
                        node = parent;
                        rotateRight(node);
                    }
                    node.parent.red = false;
                    node.parent.parent.red = true;
                    rotateLeft(node.parent.parent);
                }
            }
        }
        root.red = false;
    }

    String shape() {
        return shape(root);
    }

    private String shape(RbNode node) {
        if (node == null) return "";
        String label = node.key + (node.red ? "R" : "B");
        if (node.left == null && node.right == null) return label;
        return label + "(" + shape(node.left) + "," + shape(node.right) + ")";
    }

    int height() {
        return height(root);
    }

    private int height(RbNode node) {
        return node == null ? 0 : 1 + Math.max(height(node.left), height(node.right));
    }

    boolean isValid() {
        if (root == null) return true;
        if (root.red) return false;
        return blackHeight(root) > 0;
    }

    private int blackHeight(RbNode n) {
        if (n == null) return 1;
        boolean kidsRed = (n.left != null && n.left.red) || (n.right != null && n.right.red);
        if (n.red && kidsRed) return -1;
        int l = blackHeight(n.left);
        int r = blackHeight(n.right);
        if (l < 0 || r < 0 || l != r) return -1;
        return l + (n.red ? 0 : 1);
    }
}
```

```java
static RedBlackTree rbFrom(int... keys) {
    RedBlackTree tree = new RedBlackTree();
    for (int k : keys) tree.insert(k);
    return tree;
}
// rbFrom(10, 20, 30).shape() -> 20B(10R,30R)
// rbFrom(10, 20, 30, 40).shape() -> 20B(10B,30B(,40R))
// rbFrom(10, 20, 30, 40, 50).shape() -> 20B(10B,40B(30R,50R))
// rbFrom(1, 2, 3, 4, 5, 6, 7).shape() -> 2B(1B,4R(3B,6B(5R,7R)))
// rbFrom(range(1000)).isValid() -> true
// rbFrom(range(1000)).height() -> 17
```

Java's `TreeMap` and `TreeSet` are red-black trees.
They give `firstKey`, `lastKey`, `floorKey`, `ceilingKey`, `headMap`, `tailMap`, and `subMap`, all in O(log n), which is what you use in practice.

```java
static List<Object> treeMapDemo() {
    TreeMap<Integer, String> map = new TreeMap<>();
    for (int k : new int[]{10, 20, 30, 40, 50}) map.put(k, "v" + k);
    map.remove(30);
    return List.of(map.firstKey(), map.floorKey(35), map.ceilingKey(35), map.headMap(40).size());
}
// treeMapDemo() -> [10, 20, 40, 2]
```

---

## 3. Segment Trees

### 3.1 When to Use

- The array **changes** (point updates) **and** you must answer many **range queries**: sum, minimum, maximum, gcd, count.
- Prefix sums answer range sums in O(1), but one update forces an O(n) rebuild.
  A segment tree makes **both** the query and the update O(log n).
- Keywords: "range sum query - mutable", "range minimum", "update the value at index i", "number of elements in a range", "q queries on an array of n".
- Range updates ("add `x` to every element from `l` to `r`") also fit, with **lazy propagation**.

| Structure | Build | Query | Point update | Notes |
| --- | --- | --- | --- | --- |
| Plain array | - | O(n) | O(1) | Simple, slow queries |
| Prefix sums | O(n) | O(1) | O(n) | Static data only |
| **Segment tree** | O(n) | O(log n) | O(log n) | Any associative operation |
| Fenwick tree | O(n) | O(log n) | O(log n) | Smaller and faster, sums only |

### 3.2 Core Idea

A segment tree is a binary tree where each node stores the **answer for a segment** of the array.
The root covers the whole array `[0, n - 1]`.
Each node covering `[lo, hi]` splits at `mid = (lo + hi) / 2` into a left child `[lo, mid]` and a right child `[mid + 1, hi]`.
A leaf covers one element.
An internal node's value is the **combination** of its two children, so for a sum tree `tree[node] = tree[left] + tree[right]`.

For `nums = [1, 3, 5, 7, 9, 11]` (node numbers in brackets):

```text
                  [1] 0..5 = 36
                 /                \
        [2] 0..2 = 9            [3] 3..5 = 27
        /        \               /         \
 [4] 0..1 = 4  [5] 2..2 = 5  [6] 3..4 = 16  [7] 5..5 = 11
   /      \                    /      \
[8] 0..0  [9] 1..1        [12] 3..3  [13] 4..4
   = 1      = 3              = 7        = 9
```

Store the tree in an array using **heap numbering**: the root is node 1, and node `i` has children `2i` and `2i + 1`.
That needs an array of size `4n` to be safe for any `n`, since the tree is not always perfectly full.

**Query** `[l, r]`.
At each node, there are three cases:

| Relation between the node's segment and `[l, r]` | Action |
| --- | --- |
| No overlap | Return the identity (0 for a sum, infinity for a minimum) |
| Fully inside | Return the node's stored value, without going deeper |
| Partial overlap | Recurse into both children and combine |

At most two nodes per level are partially covered, so a query touches O(log n) nodes.

**Update** index `i`.
Walk down to the leaf that covers `i`, change it, and recompute each node on the way back up.
That is one path of length O(log n).

### 3.3 Problem: Range Sum Query - Mutable

LeetCode 307: build from an array, then support `update(index, value)` and `sumRange(left, right)`.
The class below takes the combining function and its identity, so the same code gives a min tree or a max tree.

```js
class SegmentTree {
  constructor(nums, combine = (a, b) => a + b, identity = 0) {
    this.n = nums.length;
    this.combine = combine;
    this.identity = identity;
    this.tree = new Array(4 * Math.max(1, this.n)).fill(identity);
    if (this.n > 0) this.#build(nums, 1, 0, this.n - 1);
  }

  #build(nums, node, lo, hi) {
    if (lo === hi) {
      this.tree[node] = nums[lo];
      return;
    }
    const mid = (lo + hi) >> 1;
    this.#build(nums, 2 * node, lo, mid);
    this.#build(nums, 2 * node + 1, mid + 1, hi);
    this.tree[node] = this.combine(this.tree[2 * node], this.tree[2 * node + 1]);
  }

  update(index, value) {
    this.#update(1, 0, this.n - 1, index, value);
  }

  #update(node, lo, hi, index, value) {
    if (lo === hi) {
      this.tree[node] = value;
      return;
    }
    const mid = (lo + hi) >> 1;
    if (index <= mid) this.#update(2 * node, lo, mid, index, value);
    else this.#update(2 * node + 1, mid + 1, hi, index, value);
    this.tree[node] = this.combine(this.tree[2 * node], this.tree[2 * node + 1]);
  }

  query(left, right) {                                  // inclusive on both ends
    return this.#query(1, 0, this.n - 1, left, right);
  }

  #query(node, lo, hi, left, right) {
    if (right < lo || hi < left) return this.identity;  // no overlap
    if (left <= lo && hi <= right) return this.tree[node];   // fully inside
    const mid = (lo + hi) >> 1;
    return this.combine(
      this.#query(2 * node, lo, mid, left, right),
      this.#query(2 * node + 1, mid + 1, hi, left, right)
    );
  }
}

const sums = new SegmentTree([1, 3, 5, 7, 9, 11]);
sums.query(0, 5); // 36
sums.query(1, 3); // 15
sums.update(1, 10);
sums.query(1, 3); // 22
sums.query(0, 5); // 43
sums.query(4, 4); // 9

const mins = new SegmentTree([5, 2, 8, 1, 9, 4], Math.min, Infinity);
mins.query(0, 5); // 1
mins.query(0, 2); // 2
mins.query(4, 5); // 4
mins.update(3, 7);
mins.query(0, 5); // 2
```

Dry run of `query(1, 3)` on `[1, 3, 5, 7, 9, 11]`:

| Node | Segment | Relation to `[1, 3]` | Result |
| --- | --- | --- | --- |
| 1 | 0..5 | partial | recurse |
| 2 | 0..2 | partial | recurse |
| 4 | 0..1 | partial | recurse |
| 8 | 0..0 | outside | 0 |
| 9 | 1..1 | inside | **3** |
| 5 | 2..2 | inside | **5** |
| 3 | 3..5 | partial | recurse |
| 6 | 3..4 | partial | recurse |
| 12 | 3..3 | inside | **7** |
| 13 | 4..4 | outside | 0 |
| 7 | 5..5 | outside | 0 |

The answer is `3 + 5 + 7 = 15`.
The query visited 11 of the 13 nodes here because the array is tiny, and for large arrays it visits about `4 * log2(n)`.

Dry run of `update(1, 10)`:
the walk goes down through nodes 1, 2, 4, and 9, sets node 9 to 10, and then recomputes on the way back.

| Node | Segment | New value |
| --- | --- | --- |
| 9 | 1..1 | 10 (the leaf) |
| 4 | 0..1 | 1 + 10 = 11 |
| 2 | 0..2 | 11 + 5 = 16 |
| 1 | 0..5 | 16 + 27 = 43 |

Now `query(1, 3)` is `10 + 5 + 7 = 22`, and the total is 43.
Only four nodes changed, one per level.

### 3.4 Extra Variants

**Fenwick tree (binary indexed tree).**
For sums only, this is shorter and faster.
It stores partial sums in a flat array, and `i & -i` isolates the lowest set bit to jump between them.

```js
class FenwickTree {
  constructor(n) {
    this.n = n;
    this.t = new Array(n + 1).fill(0);                  // 1-based
  }

  add(i, delta) {
    for (i++; i <= this.n; i += i & -i) this.t[i] += delta;
  }

  prefix(i) {                                           // sum of [0, i]
    let sum = 0;
    for (i++; i > 0; i -= i & -i) sum += this.t[i];
    return sum;
  }

  range(left, right) {
    return this.prefix(right) - (left > 0 ? this.prefix(left - 1) : 0);
  }
}

const fenwick = new FenwickTree(6);
[1, 3, 5, 7, 9, 11].forEach((v, i) => fenwick.add(i, v));
fenwick.range(1, 3); // 15
fenwick.add(1, 7);
fenwick.range(1, 3); // 22
```

A Fenwick `add` takes a **delta**, not a new value, so to set an index to `v`, add `v - old`.

**Lazy propagation: range add, range sum.**
A range update touching `k` elements would cost O(k) with the plain tree.
Instead, store a pending "add this to everything under me" tag on a node and apply it only when a later operation needs to go below that node.

```js
class LazySegmentTree {
  constructor(nums) {
    this.n = nums.length;
    this.sum = new Array(4 * this.n).fill(0);
    this.lazy = new Array(4 * this.n).fill(0);          // pending add for the whole segment
    this.#build(nums, 1, 0, this.n - 1);
  }

  #build(nums, node, lo, hi) {
    if (lo === hi) {
      this.sum[node] = nums[lo];
      return;
    }
    const mid = (lo + hi) >> 1;
    this.#build(nums, 2 * node, lo, mid);
    this.#build(nums, 2 * node + 1, mid + 1, hi);
    this.sum[node] = this.sum[2 * node] + this.sum[2 * node + 1];
  }

  #apply(node, lo, hi, delta) {
    this.sum[node] += delta * (hi - lo + 1);
    this.lazy[node] += delta;
  }

  #push(node, lo, hi) {
    if (this.lazy[node] === 0) return;
    const mid = (lo + hi) >> 1;
    this.#apply(2 * node, lo, mid, this.lazy[node]);
    this.#apply(2 * node + 1, mid + 1, hi, this.lazy[node]);
    this.lazy[node] = 0;
  }

  rangeAdd(left, right, delta) {
    this.#rangeAdd(1, 0, this.n - 1, left, right, delta);
  }

  #rangeAdd(node, lo, hi, left, right, delta) {
    if (right < lo || hi < left) return;
    if (left <= lo && hi <= right) {
      this.#apply(node, lo, hi, delta);
      return;
    }
    this.#push(node, lo, hi);                           // settle pending tags before descending
    const mid = (lo + hi) >> 1;
    this.#rangeAdd(2 * node, lo, mid, left, right, delta);
    this.#rangeAdd(2 * node + 1, mid + 1, hi, left, right, delta);
    this.sum[node] = this.sum[2 * node] + this.sum[2 * node + 1];
  }

  rangeSum(left, right) {
    return this.#rangeSum(1, 0, this.n - 1, left, right);
  }

  #rangeSum(node, lo, hi, left, right) {
    if (right < lo || hi < left) return 0;
    if (left <= lo && hi <= right) return this.sum[node];
    this.#push(node, lo, hi);
    const mid = (lo + hi) >> 1;
    return this.#rangeSum(2 * node, lo, mid, left, right) + this.#rangeSum(2 * node + 1, mid + 1, hi, left, right);
  }
}

const lazyTree = new LazySegmentTree([1, 3, 5, 7, 9, 11]);
lazyTree.rangeAdd(1, 4, 10);
lazyTree.rangeSum(0, 5); // 76
lazyTree.rangeSum(1, 3); // 45
lazyTree.rangeAdd(0, 5, -1);
lazyTree.rangeSum(0, 5); // 70
```

After `rangeAdd(1, 4, 10)` the array is `[1, 13, 15, 17, 19, 11]`, so the total is 76 and `[1, 3]` sums to `13 + 15 + 17 = 45`.
Then subtracting 1 from every element gives `76 - 6 = 70`.

**Other uses.**
Range minimum and maximum queries (pass `Math.min` or `Math.max`), range gcd, counting how many values fall in a range (a tree over the value domain), the skyline problem (LeetCode 218), and counting smaller numbers after self (LeetCode 315).

### 3.5 Pitfalls

- **Array too small.** Allocate `4 * n`.
  `2 * n` works only when `n` is a power of two.
- **Mixing inclusive and exclusive bounds.** The code above uses inclusive `[lo, hi]` and inclusive `[left, right]` throughout.
  Mixing in a half-open query shifts every result by one element.
- **The wrong identity.** Returning `0` for "no overlap" is right for sums and wrong for minimums, where it must be infinity.
- **Setting versus adding.** `update(i, v)` on the segment tree *sets*, and a Fenwick `add(i, d)` *adds*.
  Do not swap them.
- **Forgetting to recompute after the recursive call.** An update that changes the leaf but not its ancestors leaves stale sums.
- **Lazy tags not pushed before descending.** If `#push` is skipped, a child's value ignores a pending add on its parent and queries return old numbers.
- **Recursion `mid` overflow in Java.** `(lo + hi) / 2` can overflow for huge indexes, and `lo + (hi - lo) / 2` cannot.
  It is irrelevant for arrays under a billion elements, but it is the safe habit.
- **Building by `n` point updates.** That costs O(n log n).
  The bottom-up `build` is O(n).

### 3.6 Java Implementation

```java
class SegmentTree {
    private final int n;
    private final int[] tree;
    private final IntBinaryOperator combine;
    private final int identity;

    SegmentTree(int[] nums, IntBinaryOperator combine, int identity) {
        this.n = nums.length;
        this.combine = combine;
        this.identity = identity;
        this.tree = new int[4 * Math.max(1, n)];
        if (n > 0) build(nums, 1, 0, n - 1);
    }

    private void build(int[] nums, int node, int lo, int hi) {
        if (lo == hi) {
            tree[node] = nums[lo];
            return;
        }
        int mid = lo + (hi - lo) / 2;
        build(nums, 2 * node, lo, mid);
        build(nums, 2 * node + 1, mid + 1, hi);
        tree[node] = combine.applyAsInt(tree[2 * node], tree[2 * node + 1]);
    }

    void update(int index, int value) {
        update(1, 0, n - 1, index, value);
    }

    private void update(int node, int lo, int hi, int index, int value) {
        if (lo == hi) {
            tree[node] = value;
            return;
        }
        int mid = lo + (hi - lo) / 2;
        if (index <= mid) update(2 * node, lo, mid, index, value);
        else update(2 * node + 1, mid + 1, hi, index, value);
        tree[node] = combine.applyAsInt(tree[2 * node], tree[2 * node + 1]);
    }

    int query(int left, int right) {
        return query(1, 0, n - 1, left, right);
    }

    private int query(int node, int lo, int hi, int left, int right) {
        if (right < lo || hi < left) return identity;
        if (left <= lo && hi <= right) return tree[node];
        int mid = lo + (hi - lo) / 2;
        return combine.applyAsInt(
                query(2 * node, lo, mid, left, right),
                query(2 * node + 1, mid + 1, hi, left, right));
    }
}
```

```java
static List<Integer> sumTreeDemo() {
    SegmentTree sums = new SegmentTree(new int[]{1, 3, 5, 7, 9, 11}, Integer::sum, 0);
    int whole = sums.query(0, 5);
    int middle = sums.query(1, 3);
    sums.update(1, 10);
    return List.of(whole, middle, sums.query(1, 3), sums.query(0, 5));
}
// sumTreeDemo() -> [36, 15, 22, 43]

static List<Integer> minTreeDemo() {
    SegmentTree mins = new SegmentTree(new int[]{5, 2, 8, 1, 9, 4}, Math::min, Integer.MAX_VALUE);
    int whole = mins.query(0, 5);
    int left = mins.query(0, 2);
    mins.update(3, 7);
    return List.of(whole, left, mins.query(0, 5));
}
// minTreeDemo() -> [1, 2, 2]
```

Fenwick tree:

```java
class FenwickTree {
    private final int n;
    private final long[] t;

    FenwickTree(int n) {
        this.n = n;
        this.t = new long[n + 1];
    }

    void add(int i, long delta) {
        for (i++; i <= n; i += i & -i) t[i] += delta;
    }

    long prefix(int i) {
        long sum = 0;
        for (i++; i > 0; i -= i & -i) sum += t[i];
        return sum;
    }

    long range(int left, int right) {
        return prefix(right) - (left > 0 ? prefix(left - 1) : 0);
    }
}
```

```java
static List<Long> fenwickDemo() {
    FenwickTree fenwick = new FenwickTree(6);
    int[] values = {1, 3, 5, 7, 9, 11};
    for (int i = 0; i < values.length; i++) fenwick.add(i, values[i]);
    long before = fenwick.range(1, 3);
    fenwick.add(1, 7);
    return List.of(before, fenwick.range(1, 3));
}
// fenwickDemo() -> [15, 22]
```

Lazy propagation in Java, range add and range sum:

```java
class LazySegmentTree {
    private final int n;
    private final long[] sum;
    private final long[] lazy;

    LazySegmentTree(int[] nums) {
        this.n = nums.length;
        this.sum = new long[4 * n];
        this.lazy = new long[4 * n];
        build(nums, 1, 0, n - 1);
    }

    private void build(int[] nums, int node, int lo, int hi) {
        if (lo == hi) {
            sum[node] = nums[lo];
            return;
        }
        int mid = lo + (hi - lo) / 2;
        build(nums, 2 * node, lo, mid);
        build(nums, 2 * node + 1, mid + 1, hi);
        sum[node] = sum[2 * node] + sum[2 * node + 1];
    }

    private void apply(int node, int lo, int hi, long delta) {
        sum[node] += delta * (hi - lo + 1);
        lazy[node] += delta;
    }

    private void push(int node, int lo, int hi) {
        if (lazy[node] == 0) return;
        int mid = lo + (hi - lo) / 2;
        apply(2 * node, lo, mid, lazy[node]);
        apply(2 * node + 1, mid + 1, hi, lazy[node]);
        lazy[node] = 0;
    }

    void rangeAdd(int left, int right, long delta) {
        rangeAdd(1, 0, n - 1, left, right, delta);
    }

    private void rangeAdd(int node, int lo, int hi, int left, int right, long delta) {
        if (right < lo || hi < left) return;
        if (left <= lo && hi <= right) {
            apply(node, lo, hi, delta);
            return;
        }
        push(node, lo, hi);
        int mid = lo + (hi - lo) / 2;
        rangeAdd(2 * node, lo, mid, left, right, delta);
        rangeAdd(2 * node + 1, mid + 1, hi, left, right, delta);
        sum[node] = sum[2 * node] + sum[2 * node + 1];
    }

    long rangeSum(int left, int right) {
        return rangeSum(1, 0, n - 1, left, right);
    }

    private long rangeSum(int node, int lo, int hi, int left, int right) {
        if (right < lo || hi < left) return 0;
        if (left <= lo && hi <= right) return sum[node];
        push(node, lo, hi);
        int mid = lo + (hi - lo) / 2;
        return rangeSum(2 * node, lo, mid, left, right) + rangeSum(2 * node + 1, mid + 1, hi, left, right);
    }
}
```

```java
static List<Long> lazyDemo() {
    LazySegmentTree tree = new LazySegmentTree(new int[]{1, 3, 5, 7, 9, 11});
    tree.rangeAdd(1, 4, 10);
    long whole = tree.rangeSum(0, 5);
    long middle = tree.rangeSum(1, 3);
    tree.rangeAdd(0, 5, -1);
    return List.of(whole, middle, tree.rangeSum(0, 5));
}
// lazyDemo() -> [76, 45, 70]
```

---

## 4. Java Pitfalls

- **`TreeMap` is a red-black tree.** Its operations are O(log n), and `size()` is O(1), but `headMap(k).size()` can be O(n) because the view counts as it goes.
- **`TreeMap` and `TreeSet` need comparable keys.** A missing `compareTo` throws `ClassCastException` at the first insert, and a `compareTo` inconsistent with `equals` makes the set drop distinct objects.
- **Recursion depth.** A skewed BST built by `insertBST` on sorted input recurses `n` deep and can overflow the stack around 10,000 to 20,000 nodes.
  Balance the tree, or use an iterative version.
- **Lambda targets for the combine function.** `Integer::sum` and `Math::min` work for `IntBinaryOperator`, and `Math::min` is ambiguous for some overloads if the target type is not obvious.
- **`int` overflow in sums.** A segment tree of 10^5 values up to 10^9 needs `long` storage.
- **`i & -i` on `int`.** It isolates the lowest set bit for positive `i`.
  A Fenwick tree is 1-based, so index `0` would loop forever.
- **Returning `Integer.MAX_VALUE` as the identity for a min tree** and then adding to it overflows.
  Use it only inside `min`, never in a sum.
- **`List.of(a, b)` rejects `null`.** A method returning a missing key as `null` must use `Arrays.asList` or a different container.

---

## 5. Quick Recap

| Topic | Signal in the problem | Core tool | Time | Space |
| --- | --- | --- | --- | --- |
| BST deletion | Remove a key, keep the BST valid | Three cases, copy the inorder successor | O(h) | O(h) recursion |
| AVL tree | Guaranteed O(log n), read-heavy | Balance factor, four rotation cases | O(log n) | O(n) |
| Red-black tree | Guaranteed O(log n), update-heavy, `TreeMap` | Colors, recolor or rotate by uncle color | O(log n) | O(n) |
| Segment tree | Range query with point updates | Tree of segment answers, heap numbering | O(log n) per query and update | O(n), array of `4n` |
| Lazy propagation | Range update with range query | Pending tags pushed down on demand | O(log n) | O(n) |

Next: [Graphs, Search and Complexity](/docs/dsa/graphs-search-and-complexity) for strongly connected components, minimum spanning trees, maze backtracking, and what P versus NP means for the problems you meet.
