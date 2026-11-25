---
title: "Graphs, Search and Complexity"
description: "Strongly connected components with Kosaraju and Tarjan, Prim's minimum spanning tree, maze solving with backtracking, and P versus NP with dry runs, pitfalls, and JavaScript and Java code."
---

# 📘 Graphs, Search and Complexity

This page finishes the graph side of the course with three algorithms and one idea.
**Strongly connected components** split a directed graph into mutually reachable clusters.
**Prim's algorithm** grows a cheapest network that connects every node.
**Maze solving** shows backtracking on a grid, and the difference between finding *a* path and finding the *best* one.
**P versus NP** explains why some problems are solved with a clever algorithm and others only with search, approximation, or small inputs.
Each section has recognition signals, a core idea, a worked problem with a dry run, pitfalls, and a **Java Implementation** subsection.
JavaScript and Java code is included, and every snippet on this page was executed against test cases.
Java conventions: all methods are `static` members of one `Solution` class, `import java.util.*;` is assumed, helper classes are top-level package-private classes in the same file, and the trailing `//` comments show a sample call and its result.
The JavaScript in the Prim section reuses the `Heap` class from [Shared Helpers: TreeNode and Heap](/docs/dsa/trees-graphs-and-search#12-a-heap-for-javascript).
Earlier graph material: [Tree Depth-First Search](/docs/dsa/trees-graphs-and-search#3-tree-depth-first-search), [Topological Sort](/docs/dsa/trees-graphs-and-search#9-topological-sort), [Union-Find](/docs/dsa/pattern-playbook#63-union-find-disjoint-set-union), and [Dijkstra](/docs/dsa/pattern-playbook#66-dijkstra-weighted-shortest-path).

## Table of Contents

1. [Strongly Connected Components](#1-strongly-connected-components)
2. [Prim's Algorithm](#2-prims-algorithm)
3. [Solving a Maze (Backtracking)](#3-solving-a-maze-backtracking)
4. [P vs NP](#4-p-vs-np)
5. [Java Pitfalls](#5-java-pitfalls)
6. [Quick Recap](#6-quick-recap)

---

## 1. Strongly Connected Components

### 1.1 When to Use

- The graph is **directed**, and you need groups of nodes that can all reach each other.
- Keywords: "strongly connected", "mutually reachable", "cycles of dependencies", "can every node reach every other node?".
- You want to **shrink** a directed graph with cycles into a simpler graph without cycles (a DAG), so that topological sort or dynamic programming applies.
- Typical uses: circular dependencies between packages, deadlock groups, web page clusters, the first step of 2-SAT.

### 1.2 Core Idea

A **strongly connected component** (SCC) is a maximal set of nodes where every node can reach every other node by following edge directions.
Every node belongs to exactly one SCC, and a node with no cycle through it forms an SCC of its own.

```text
edges: 0->1  1->2  2->0   2->3   3->4  4->5  5->3   6->5  6->7  7->6

     {0,1,2}  ------>  {3,4,5}  <------  {6,7}
```

Contract each SCC into one node and the result is the **condensation graph**, which is always a **DAG**.
If two SCCs could reach each other, they would be a single SCC.

Two classic linear-time algorithms find the components in O(V + E).

#### Kosaraju's algorithm

1. Run a DFS over the graph and record each node when it **finishes** (all of its neighbors are done).
2. Build the **transpose** graph, the same graph with every edge reversed.
3. Process nodes in **decreasing finish time**.
   Each DFS started on the transpose graph from an unvisited node collects exactly one SCC.

Why it works.
The node that finishes last in step 1 sits in a **source** component of the condensation (no edges come in from other components).
In the transpose graph, that component has no edges *out*, so a DFS from it cannot leak into any other component.
Remove it, and repeat.

#### Tarjan's algorithm

One DFS, with a stack.
Give each node a discovery `index` and a `low` value, the smallest index reachable from its DFS subtree using at most one edge that goes back into the stack.

- When a neighbor `v` is unvisited, recurse, then `low[u] = min(low[u], low[v])`.
- When `v` is already **on the stack**, it is in the same SCC as the current search, so `low[u] = min(low[u], index[v])`.
- When `low[u] == index[u]`, `u` is the **root** of an SCC: pop the stack down to `u`, and that is the component.

A neighbor that is visited but **not on the stack** belongs to a component that was already finished, so it is ignored.

| | Kosaraju | Tarjan |
| --- | --- | --- |
| DFS passes | Two, plus a graph reversal | One |
| Extra memory | Reversed adjacency lists, finish order | `index`, `low`, `onStack`, a stack |
| Component order in the output | Sources of the condensation first | Sinks first (reverse topological order) |
| Easier to explain | Yes | Needs the `low` idea |

### 1.3 Problem: Find All Strongly Connected Components

Return the SCCs of a directed graph with `n` nodes and a list of edges.
The graph is the one drawn above: 8 nodes, with components `{0,1,2}`, `{3,4,5}`, and `{6,7}`.
Each component is sorted so the output is easy to read.

```js
function buildGraph(n, edges) {
  const graph = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) graph[u].push(v);
  return graph;
}

function kosaraju(n, edges) {
  const graph = buildGraph(n, edges);
  const reverse = buildGraph(n, edges.map(([u, v]) => [v, u]));

  const visited = new Array(n).fill(false);
  const order = [];                                     // nodes in order of finishing
  const dfs1 = u => {
    visited[u] = true;
    for (const v of graph[u]) if (!visited[v]) dfs1(v);
    order.push(u);                                      // u finishes here
  };
  for (let u = 0; u < n; u++) if (!visited[u]) dfs1(u);

  visited.fill(false);
  const components = [];
  const dfs2 = (u, component) => {
    visited[u] = true;
    component.push(u);
    for (const v of reverse[u]) if (!visited[v]) dfs2(v, component);
  };
  for (let i = n - 1; i >= 0; i--) {                    // decreasing finish time
    const u = order[i];
    if (!visited[u]) {
      const component = [];
      dfs2(u, component);
      components.push(component.sort((a, b) => a - b));
    }
  }
  return components;
}

const sccEdges = [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3], [6, 5], [6, 7], [7, 6]];
kosaraju(8, sccEdges); // [[6,7],[0,1,2],[3,4,5]]
kosaraju(3, [[0, 1], [1, 2]]); // [[0],[1],[2]]
kosaraju(3, [[0, 1], [1, 2], [2, 0]]); // [[0,1,2]]
kosaraju(0, []); // []
```

Dry run of the first pass (finish order) on the graph above:

| Step | Event | Finish order so far |
| --- | --- | --- |
| 1 | DFS from 0 goes 0, 1, 2, then 2 sees 0 (visited) and goes to 3, 4, 5 | - |
| 2 | 5 sees 3 (visited), so 5 finishes | `[5]` |
| 3 | 4, 3, 2, 1, 0 finish in turn | `[5, 4, 3, 2, 1, 0]` |
| 4 | DFS from 6: 6 sees 5 (visited), goes to 7, and 7 sees 6 (visited), so 7 finishes, then 6 | `[5, 4, 3, 2, 1, 0, 7, 6]` |

The second pass reads that list from the end: `6, 7, 0, 1, 2, 3, 4, 5`.

| Start node | Reversed-graph DFS reaches | Component |
| --- | --- | --- |
| 6 | 6 reaches 7 through the reversed edge of `7 -> 6`. The edge `6 -> 5` was reversed to `5 -> 6`, which starts at 5, so the DFS cannot step from 6 into 5 | `{6, 7}` |
| 7 | already visited | - |
| 0 | 0 reaches 2, then 1 | `{0, 1, 2}` |
| 1, 2 | already visited | - |
| 3 | 3 reaches 5 and 4 (2 is visited) | `{3, 4, 5}` |

The output is `[[6, 7], [0, 1, 2], [3, 4, 5]]`.
The sources of the condensation, `{6, 7}` and `{0, 1, 2}`, come first, and the sink `{3, 4, 5}` is last.

**Tarjan's version**, one pass:

```js
function tarjan(n, edges) {
  const graph = buildGraph(n, edges);
  const index = new Array(n).fill(-1);                  // discovery order, -1 = unvisited
  const low = new Array(n).fill(0);
  const onStack = new Array(n).fill(false);
  const stack = [];
  const components = [];
  let counter = 0;

  const dfs = u => {
    index[u] = low[u] = counter++;
    stack.push(u);
    onStack[u] = true;
    for (const v of graph[u]) {
      if (index[v] === -1) {
        dfs(v);
        low[u] = Math.min(low[u], low[v]);
      } else if (onStack[v]) {
        low[u] = Math.min(low[u], index[v]);            // back edge into the current search
      }                                                 // visited and off the stack: ignore
    }
    if (low[u] === index[u]) {                          // u is the root of a component
      const component = [];
      let w;
      do {
        w = stack.pop();
        onStack[w] = false;
        component.push(w);
      } while (w !== u);
      components.push(component.sort((a, b) => a - b));
    }
  };
  for (let u = 0; u < n; u++) if (index[u] === -1) dfs(u);
  return components;
}

tarjan(8, sccEdges); // [[3,4,5],[0,1,2],[6,7]]
tarjan(3, [[0, 1], [1, 2]]); // [[2],[1],[0]]
```

Dry run of Tarjan on the same graph:

| Event | Detail |
| --- | --- |
| Visit 0, 1, 2 | `index` 0, 1, 2. Stack `[0, 1, 2]` |
| Edge 2 -> 0 | 0 is on the stack, so `low[2] = 0` |
| Visit 3, 4, 5 | `index` 3, 4, 5. Stack `[0, 1, 2, 3, 4, 5]` |
| Edge 5 -> 3 | 3 is on the stack, so `low[5] = 3` |
| Return to 4 and 3 | `low[4] = 3`, `low[3] = 3` |
| Node 3 finishes | `low[3] == index[3]`, so 3 is a root. Pop `5, 4, 3` and report `{3, 4, 5}` |
| Return to 2, 1, 0 | `low[2] = low[1] = low[0] = 0` |
| Node 0 finishes | `low[0] == index[0]`. Pop `2, 1, 0` and report `{0, 1, 2}` |
| Visit 6 | `index` 6. Edge 6 -> 5: 5 is visited but off the stack, so ignore it |
| Visit 7 | `index` 7. Edge 7 -> 6: on the stack, so `low[7] = 6` |
| Node 6 finishes | `low[6] = 6` after returning from 7. Root. Pop `7, 6` and report `{6, 7}` |

The output order is sinks first: `{3,4,5}`, then `{0,1,2}`, then `{6,7}`.

Complexity for both: O(V + E) time and O(V + E) space.

### 1.4 Extra Variants

**Is the graph strongly connected?**
It is exactly when there is a single SCC.

```js
function isStronglyConnected(n, edges) {
  return n === 0 || kosaraju(n, edges).length === 1;
}

isStronglyConnected(3, [[0, 1], [1, 2], [2, 0]]); // true
isStronglyConnected(3, [[0, 1], [1, 2]]); // false
```

**Condensation graph.**
Label each node with its component id, then keep the edges that cross between different components.
The result is a DAG, so you can topologically sort it.

```js
function condensation(n, edges) {
  const components = tarjan(n, edges);
  const id = new Array(n).fill(-1);
  components.forEach((component, i) => component.forEach(u => { id[u] = i; }));
  const crossing = new Set();
  for (const [u, v] of edges) {
    if (id[u] !== id[v]) crossing.add(`${id[u]}->${id[v]}`);
  }
  return { components, edges: [...crossing] };
}

condensation(8, sccEdges); // { components: [[3,4,5],[0,1,2],[6,7]], edges: ["1->0","2->0"] }
```

Tarjan lists sinks first, so component `0` is `{3,4,5}`.
Both crossing edges, `{0,1,2} -> {3,4,5}` and `{6,7} -> {3,4,5}`, point **into** component 0, which confirms that component 0 is the sink.

**Critical connections (bridges)** in an **undirected** graph (LeetCode 1192) use the same `index` and `low` idea.
An edge `u - v` is a bridge when no node in the subtree of `v` can reach `u` or an ancestor of `u` through another edge, which is `low[v] > index[u]`.

```js
function criticalConnections(n, connections) {
  const graph = Array.from({ length: n }, () => []);
  for (const [u, v] of connections) {
    graph[u].push(v);
    graph[v].push(u);
  }
  const index = new Array(n).fill(-1);
  const low = new Array(n).fill(0);
  const bridges = [];
  let counter = 0;
  const dfs = (u, parent) => {
    index[u] = low[u] = counter++;
    for (const v of graph[u]) {
      if (v === parent) continue;
      if (index[v] === -1) {
        dfs(v, u);
        low[u] = Math.min(low[u], low[v]);
        if (low[v] > index[u]) bridges.push([u, v]);
      } else {
        low[u] = Math.min(low[u], index[v]);
      }
    }
  };
  dfs(0, -1);
  return bridges;
}

criticalConnections(4, [[0, 1], [1, 2], [2, 0], [1, 3]]); // [[1,3]]
```

**2-SAT.**
A boolean formula whose clauses each have two literals can be solved in linear time by building an implication graph and checking that no variable and its negation share an SCC.
It is a standard application of SCCs and it is the reason 2-SAT is in P while 3-SAT is not known to be (see [P vs NP](#4-p-vs-np)).

### 1.5 Pitfalls

- **Using undirected connectivity.** Union-Find and plain DFS on an undirected graph find **connected components**, which are weaker than strongly connected ones.
- **Forgetting the transpose.** Running the second pass on the original graph merges components that only connect one way.
- **Processing in increasing finish time.** The second pass must go in **decreasing** order, from the end of `order`.
- **Tarjan: using `low[v]` instead of `index[v]` for a stack back edge.** Both are common in the literature and both work, but mixing the update rule for tree edges and back edges inconsistently breaks the root test.
- **Tarjan: ignoring the `onStack` check.** A neighbor in an already finished component must not lower `low[u]`.
- **Recursion depth.** A path graph with 100,000 nodes overflows the default call stack in both JavaScript and Java.
  Convert the DFS to an explicit stack, or run it in a thread with a bigger stack.
- **Assuming the output order.** Kosaraju and Tarjan list components in different orders.
  If you need a specific order, sort afterwards.
- **Self-loops and parallel edges** are harmless here, but a single node with a self-loop is still a one-node component.

### 1.6 Java Implementation

```java
static List<List<Integer>> buildGraph(int n, int[][] edges, boolean reversed) {
    List<List<Integer>> graph = new ArrayList<>();
    for (int i = 0; i < n; i++) graph.add(new ArrayList<>());
    for (int[] e : edges) {
        if (reversed) graph.get(e[1]).add(e[0]);
        else graph.get(e[0]).add(e[1]);
    }
    return graph;
}

static void finishOrder(List<List<Integer>> graph, boolean[] visited, List<Integer> order, int u) {
    visited[u] = true;
    for (int v : graph.get(u)) {
        if (!visited[v]) finishOrder(graph, visited, order, v);
    }
    order.add(u);
}

static void collect(List<List<Integer>> reverse, boolean[] visited, List<Integer> component, int u) {
    visited[u] = true;
    component.add(u);
    for (int v : reverse.get(u)) {
        if (!visited[v]) collect(reverse, visited, component, v);
    }
}

static List<List<Integer>> kosaraju(int n, int[][] edges) {
    List<List<Integer>> graph = buildGraph(n, edges, false);
    List<List<Integer>> reverse = buildGraph(n, edges, true);
    boolean[] visited = new boolean[n];
    List<Integer> order = new ArrayList<>();
    for (int u = 0; u < n; u++) {
        if (!visited[u]) finishOrder(graph, visited, order, u);
    }
    Arrays.fill(visited, false);
    List<List<Integer>> components = new ArrayList<>();
    for (int i = n - 1; i >= 0; i--) {
        int u = order.get(i);
        if (!visited[u]) {
            List<Integer> component = new ArrayList<>();
            collect(reverse, visited, component, u);
            Collections.sort(component);
            components.add(component);
        }
    }
    return components;
}
// kosaraju(8, new int[][]{{0, 1}, {1, 2}, {2, 0}, {2, 3}, {3, 4}, {4, 5}, {5, 3}, {6, 5}, {6, 7}, {7, 6}}) -> [[6, 7], [0, 1, 2], [3, 4, 5]]
// kosaraju(3, new int[][]{{0, 1}, {1, 2}}) -> [[0], [1], [2]]
```

```java
class TarjanScc {
    private final List<List<Integer>> graph;
    private final int[] index;
    private final int[] low;
    private final boolean[] onStack;
    private final Deque<Integer> stack = new ArrayDeque<>();
    private final List<List<Integer>> components = new ArrayList<>();
    private int counter = 0;

    TarjanScc(int n, int[][] edges) {
        graph = new ArrayList<>();
        for (int i = 0; i < n; i++) graph.add(new ArrayList<>());
        for (int[] e : edges) graph.get(e[0]).add(e[1]);
        index = new int[n];
        low = new int[n];
        onStack = new boolean[n];
        Arrays.fill(index, -1);
    }

    List<List<Integer>> run() {
        for (int u = 0; u < index.length; u++) {
            if (index[u] == -1) dfs(u);
        }
        return components;
    }

    private void dfs(int u) {
        index[u] = low[u] = counter++;
        stack.push(u);
        onStack[u] = true;
        for (int v : graph.get(u)) {
            if (index[v] == -1) {
                dfs(v);
                low[u] = Math.min(low[u], low[v]);
            } else if (onStack[v]) {
                low[u] = Math.min(low[u], index[v]);
            }
        }
        if (low[u] == index[u]) {
            List<Integer> component = new ArrayList<>();
            int w;
            do {
                w = stack.pop();
                onStack[w] = false;
                component.add(w);
            } while (w != u);
            Collections.sort(component);
            components.add(component);
        }
    }
}
```

```java
static List<List<Integer>> tarjan(int n, int[][] edges) {
    return new TarjanScc(n, edges).run();
}
// tarjan(8, new int[][]{{0, 1}, {1, 2}, {2, 0}, {2, 3}, {3, 4}, {4, 5}, {5, 3}, {6, 5}, {6, 7}, {7, 6}}) -> [[3, 4, 5], [0, 1, 2], [6, 7]]

static boolean isStronglyConnected(int n, int[][] edges) {
    return n == 0 || kosaraju(n, edges).size() == 1;
}
// isStronglyConnected(3, new int[][]{{0, 1}, {1, 2}, {2, 0}}) -> true
// isStronglyConnected(3, new int[][]{{0, 1}, {1, 2}}) -> false
```

Bridges in an undirected graph:

```java
static List<List<Integer>> criticalConnections(int n, List<List<Integer>> connections) {
    List<List<Integer>> graph = new ArrayList<>();
    for (int i = 0; i < n; i++) graph.add(new ArrayList<>());
    for (List<Integer> c : connections) {
        graph.get(c.get(0)).add(c.get(1));
        graph.get(c.get(1)).add(c.get(0));
    }
    int[] index = new int[n];
    int[] low = new int[n];
    Arrays.fill(index, -1);
    List<List<Integer>> bridges = new ArrayList<>();
    bridgeDfs(graph, index, low, new int[]{0}, bridges, 0, -1);
    return bridges;
}

static void bridgeDfs(List<List<Integer>> graph, int[] index, int[] low, int[] counter,
                      List<List<Integer>> bridges, int u, int parent) {
    index[u] = low[u] = counter[0]++;
    for (int v : graph.get(u)) {
        if (v == parent) continue;
        if (index[v] == -1) {
            bridgeDfs(graph, index, low, counter, bridges, v, u);
            low[u] = Math.min(low[u], low[v]);
            if (low[v] > index[u]) bridges.add(List.of(u, v));
        } else {
            low[u] = Math.min(low[u], index[v]);
        }
    }
}
// criticalConnections(4, List.of(List.of(0, 1), List.of(1, 2), List.of(2, 0), List.of(1, 3))) -> [[1, 3]]
```

The one-element `int[] counter` is the Java way to share a mutable integer across recursive calls without a field.

---

## 2. Prim's Algorithm

### 2.1 When to Use

- You must connect **all** nodes of an **undirected, weighted** graph with the smallest total edge weight.
- Keywords: "minimum spanning tree", "connect all cities with the cheapest cables", "minimum cost to connect all points", "minimum cost to supply water".
- The graph is **dense** (many edges), where Prim fits better than Kruskal.
- You need the **MST edges**, not just the total.

### 2.2 Core Idea

A **spanning tree** of a connected graph with `V` nodes uses `V - 1` edges, connects every node, and has no cycle.
A **minimum spanning tree** (MST) is a spanning tree with the smallest possible total weight.

Prim's algorithm is **greedy**.
Start from any node and keep a growing tree.
At each step, pick the **cheapest edge that connects the tree to a node outside it**, and add that node.

Why the greedy choice is safe: this is the **cut property**.
For any split of the nodes into "inside the tree" and "outside", the lightest edge crossing the split belongs to some MST.
Prim's algorithm applies that fact `V - 1` times.

Implementation with a min-heap of candidate edges (the **lazy** version):

1. Push `(0, start)` into the heap.
2. Pop the cheapest `(weight, node)`.
   If `node` is already in the tree, skip it (a **stale** entry).
3. Otherwise add `node` to the tree, add `weight` to the total, and push every edge from `node` to a node not yet in the tree.
4. Stop when `V` nodes are in the tree.
   If the heap empties first, the graph is disconnected.

| Algorithm | Idea | Time | Best for |
| --- | --- | --- | --- |
| **Prim**, binary heap | Grow one tree outward | O(E log V) | Dense graphs, adjacency lists |
| **Prim**, array scan | Keep `minEdge[v]` and scan for the smallest | O(V^2) | Very dense graphs, complete graphs from coordinates |
| **Kruskal** | Sort all edges, add the cheapest that joins two trees, using [Union-Find](/docs/dsa/pattern-playbook#63-union-find-disjoint-set-union) | O(E log E) | Sparse graphs, edge lists |

**Prim versus Dijkstra.**
The code is nearly identical, and the one difference is the heap key.
Dijkstra pushes `distance so far + edge weight` (distance from the source).
Prim pushes **only the edge weight**.
Prim builds a cheapest *network*, and Dijkstra builds cheapest *routes from one node*.

### 2.3 Problem: Minimum Spanning Tree of a Weighted Graph

Take 5 nodes and these undirected edges (`u, v, weight`):
`0-1: 2`, `0-3: 6`, `1-2: 3`, `1-3: 8`, `1-4: 5`, `2-4: 7`, `3-4: 9`.
Return the MST total and its edges.

```js
function primMST(n, edges) {
  const graph = Array.from({ length: n }, () => []);
  for (const [u, v, w] of edges) {
    graph[u].push([v, w]);
    graph[v].push([u, w]);                              // undirected: both directions
  }
  const inTree = new Array(n).fill(false);
  const heap = new Heap((a, b) => a[0] - b[0]);         // [weight, node, parent]
  heap.push([0, 0, -1]);
  let total = 0;
  let count = 0;
  const chosen = [];
  while (heap.size > 0 && count < n) {
    const [w, u, parent] = heap.pop();
    if (inTree[u]) continue;                            // stale entry: u joined via a cheaper edge
    inTree[u] = true;
    count++;
    total += w;
    if (parent !== -1) chosen.push([parent, u, w]);
    for (const [v, wt] of graph[u]) {
      if (!inTree[v]) heap.push([wt, v, u]);
    }
  }
  return count === n ? { total, edges: chosen } : null; // null: the graph is disconnected
}

const mstEdges = [[0, 1, 2], [0, 3, 6], [1, 2, 3], [1, 3, 8], [1, 4, 5], [2, 4, 7], [3, 4, 9]];
primMST(5, mstEdges); // { total: 16, edges: [[0,1,2],[1,2,3],[1,4,5],[0,3,6]] }
primMST(3, [[0, 1, 4], [1, 2, 1], [0, 2, 3]]); // { total: 4, edges: [[0,2,3],[2,1,1]] }
primMST(4, [[0, 1, 1], [2, 3, 1]]); // null
primMST(1, []); // { total: 0, edges: [] }
```

Dry run starting from node 0.
The heap column shows the pending `(weight, node)` candidates after each step.

| Step | Pop | Action | Total | Heap after |
| --- | --- | --- | --- | --- |
| 1 | (0, node 0) | Add 0, push its edges | 0 | (2, 1) (6, 3) |
| 2 | (2, node 1, from 0) | Add 1, push 1-2, 1-3, 1-4 | 2 | (3, 2) (5, 4) (6, 3) (8, 3) |
| 3 | (3, node 2, from 1) | Add 2, push 2-4 | 5 | (5, 4) (6, 3) (7, 4) (8, 3) |
| 4 | (5, node 4, from 1) | Add 4, push 4-3 | 10 | (6, 3) (7, 4) (8, 3) (9, 3) |
| 5 | (6, node 3, from 0) | Add 3. All 5 nodes are in the tree | 16 | (7, 4) (8, 3) (9, 3) |

The leftover entries `(7, 4)`, `(8, 3)`, and `(9, 3)` are stale: nodes 4 and 3 are already in the tree, so those edges are not needed.
The MST is `0-1 (2)`, `1-2 (3)`, `1-4 (5)`, and `0-3 (6)` with total `16`.

Complexity: each edge is pushed at most twice, once from each end, so the heap holds O(E) entries.
Every push and pop costs O(log E), which gives O(E log V) time (since `log E <= 2 log V`) and O(E) space.

### 2.4 Extra Variants

**Min cost to connect all points** (LeetCode 1584).
Every pair of points is an edge, with the Manhattan distance as the weight.
With `n` points that is about `n^2 / 2` edges, so the array-scan Prim at O(n^2) beats building a heap.

```js
function minCostConnectPoints(points) {
  const n = points.length;
  const minEdge = new Array(n).fill(Infinity);           // cheapest known edge from the tree to node v
  const inTree = new Array(n).fill(false);
  minEdge[0] = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    let u = -1;
    for (let v = 0; v < n; v++) {
      if (!inTree[v] && (u === -1 || minEdge[v] < minEdge[u])) u = v;   // cheapest outside node
    }
    inTree[u] = true;
    total += minEdge[u];
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue;
      const dist = Math.abs(points[u][0] - points[v][0]) + Math.abs(points[u][1] - points[v][1]);
      minEdge[v] = Math.min(minEdge[v], dist);
    }
  }
  return total;
}

minCostConnectPoints([[0, 0], [2, 2], [3, 10], [5, 2], [7, 0]]); // 20
minCostConnectPoints([[3, 12], [-2, 5], [-4, 1]]); // 18
minCostConnectPoints([[0, 0]]); // 0
```

**Maximum spanning tree.**
Negate the weights, or flip the heap comparison, and run the same code.

**The MST is unique when all edge weights are distinct.**
With ties, several MSTs can exist, but they all have the same total.

**Second-best MST and bottleneck path.**
The MST also contains the path between any two nodes that minimizes the **largest** edge on the path.
A problem that asks for "the path whose heaviest edge is smallest" is an MST problem in disguise.

### 2.5 Pitfalls

- **Directed graphs.** Prim and Kruskal are for undirected graphs.
  A minimum spanning *arborescence* in a directed graph needs a different algorithm.
- **Forgetting to push both directions** when building the adjacency list.
- **Not skipping stale entries.** Without the `inTree` check at pop time, a node is counted twice and the total is too large.
- **Pushing the path length instead of the edge weight.** That turns Prim into Dijkstra and gives a shortest path tree, which is generally not minimum overall.
- **Disconnected graphs.** The loop ends with fewer than `V` nodes.
  Return `null` (or `-1`), or build a minimum spanning *forest* by restarting from each unvisited node.
- **Negative weights** are fine for MST, unlike for Dijkstra, because the cut property does not care about signs.
- **Heap entries as objects.** In Java use `int[]` with `Integer.compare`, never subtraction, to avoid overflow.

### 2.6 Java Implementation

```java
static int[] primMST(int n, int[][] edges) {
    List<List<int[]>> graph = new ArrayList<>();
    for (int i = 0; i < n; i++) graph.add(new ArrayList<>());
    for (int[] e : edges) {
        graph.get(e[0]).add(new int[]{e[1], e[2]});
        graph.get(e[1]).add(new int[]{e[0], e[2]});
    }
    boolean[] inTree = new boolean[n];
    PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));
    heap.add(new int[]{0, 0});                            // {weight, node}
    int total = 0;
    int count = 0;
    while (!heap.isEmpty() && count < n) {
        int[] top = heap.poll();
        int w = top[0];
        int u = top[1];
        if (inTree[u]) continue;
        inTree[u] = true;
        count++;
        total += w;
        for (int[] next : graph.get(u)) {
            if (!inTree[next[0]]) heap.add(new int[]{next[1], next[0]});
        }
    }
    return new int[]{count == n ? total : -1, count};
}
// primMST(5, new int[][]{{0, 1, 2}, {0, 3, 6}, {1, 2, 3}, {1, 3, 8}, {1, 4, 5}, {2, 4, 7}, {3, 4, 9}}) -> [16, 5]
// primMST(4, new int[][]{{0, 1, 1}, {2, 3, 1}}) -> [-1, 2]
```

The method returns `{total, nodesReached}` so a disconnected graph shows up as a total of `-1`.
To get the chosen edges, push `{weight, node, parent}` as in the JavaScript version.

```java
static int minCostConnectPoints(int[][] points) {
    int n = points.length;
    int[] minEdge = new int[n];
    Arrays.fill(minEdge, Integer.MAX_VALUE);
    boolean[] inTree = new boolean[n];
    minEdge[0] = 0;
    int total = 0;
    for (int i = 0; i < n; i++) {
        int u = -1;
        for (int v = 0; v < n; v++) {
            if (!inTree[v] && (u == -1 || minEdge[v] < minEdge[u])) u = v;
        }
        inTree[u] = true;
        total += minEdge[u];
        for (int v = 0; v < n; v++) {
            if (inTree[v]) continue;
            int dist = Math.abs(points[u][0] - points[v][0]) + Math.abs(points[u][1] - points[v][1]);
            minEdge[v] = Math.min(minEdge[v], dist);
        }
    }
    return total;
}
// minCostConnectPoints(new int[][]{{0, 0}, {2, 2}, {3, 10}, {5, 2}, {7, 0}}) -> 20
// minCostConnectPoints(new int[][]{{3, 12}, {-2, 5}, {-4, 1}}) -> 18
```

---

## 3. Solving a Maze (Backtracking)

### 3.1 When to Use

- The input is a **grid or graph of cells**, some blocked, and you must decide whether a route exists, find one, or list all of them.
- Keywords: "maze", "rat in a maze", "path from top-left to bottom-right", "word search", "can you reach the exit".
- You need a systematic way to **try a move, and undo it if it fails**.
- You are comparing three goals on the same grid: *is there a path*, *what is one path*, and *what is the shortest path*.

### 3.2 Core Idea

Backtracking explores choices depth first.
At each cell it tries every direction, and when a direction leads nowhere, it **undoes** the step and tries the next one.
The recipe has three parts, and it is the same one used in [Subsets and Backtracking](/docs/dsa/trees-graphs-and-search#5-subsets-and-backtracking):

```text
solve(cell):
    if cell is out of bounds, a wall, or already visited: return false     # prune
    mark cell visited, add it to the path                                  # choose
    if cell is the goal: return true
    for each direction:
        if solve(neighbor): return true                                    # explore
    remove cell from the path                                              # un-choose
    return false
```

Grid conventions used here: `0` is an open cell, `1` is a wall, the start is the top-left, and the exit is the bottom-right.
Directions are tried in the fixed order right, down, left, up.

**The important subtlety: when to clear the visited mark.**

| Goal | After a dead end | Why | Cost |
| --- | --- | --- | --- |
| **Is there a path / find one path** | **Keep** the cell marked as visited | A cell that failed once will fail again, so never re-explore it. This is ordinary graph DFS | O(rows * cols) |
| **Count or list all paths** | **Clear** the visited mark when leaving the cell | A cell may legitimately appear on a *different* path | Exponential in the worst case |
| **Shortest path** | Do not backtrack at all: use **BFS** | DFS's first path is not the shortest | O(rows * cols) |

Only the path list (the current route) is popped in the first row.
The visited array is left alone.

### 3.3 Problem: Find a Path Through a Maze

Take this 5 x 5 maze.
`S` is the start at the top-left, `E` is the exit at the bottom-right, and `#` is a wall.

```text
S . . . #
. . . # .
. # . # .
. . # . .
. . . . E
```

As a grid: `[[0,0,0,0,1],[0,0,0,1,0],[0,1,0,1,0],[0,0,1,0,0],[0,0,0,0,0]]`.

```js
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];       // right, down, left, up

function solveMaze(maze) {
  const rows = maze.length;
  const cols = maze[0].length;
  if (maze[0][0] === 1 || maze[rows - 1][cols - 1] === 1) return null;
  const visited = maze.map(row => row.map(() => false));
  const path = [];

  function dfs(r, c) {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return false;   // outside the grid
    if (maze[r][c] === 1 || visited[r][c]) return false;          // wall or seen
    visited[r][c] = true;                                         // stays true on dead ends
    path.push([r, c]);
    if (r === rows - 1 && c === cols - 1) return true;
    for (const [dr, dc] of DIRS) {
      if (dfs(r + dr, c + dc)) return true;
    }
    path.pop();                                                   // dead end: leave the route
    return false;
  }

  return dfs(0, 0) ? path : null;
}

const maze = [
  [0, 0, 0, 0, 1],
  [0, 0, 0, 1, 0],
  [0, 1, 0, 1, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0],
];
solveMaze(maze); // [[0,0],[0,1],[0,2],[1,2],[1,1],[1,0],[2,0],[3,0],[3,1],[4,1],[4,2],[4,3],[4,4]]
solveMaze([[0, 1], [1, 0]]); // null
solveMaze([[1, 0], [0, 0]]); // null
solveMaze([[0]]); // [[0,0]]
```

Dry run.
The path list grows on each `enter` and shrinks on each dead end.

| Step | Event | Path length |
| --- | --- | --- |
| 1 | enter (0,0) | 1 |
| 2 | enter (0,1) | 2 |
| 3 | enter (0,2) | 3 |
| 4 | enter (0,3). Right is a wall, down is a wall, left is visited, up is outside | 4 |
| 5 | **dead end**: back out of (0,3) | 3 |
| 6 | back at (0,2): right was the dead end, so try down: enter (1,2) | 4 |
| 7 | enter (2,2). Right is a wall, down is a wall, left is a wall, up is visited | 5 |
| 8 | **dead end**: back out of (2,2) | 4 |
| 9 | back at (1,2): right is a wall, down was the dead end, so try left: enter (1,1) | 5 |
| 10 to 16 | (1,1) right is visited, down is a wall, left: enter (1,0), down (2,0), (3,0), then right (3,1), down (4,1), right (4,2), (4,3), (4,4) | 6 to 12 |
| 17 | enter (4,4), the exit: return `true` all the way up | 13 |

The route has 13 cells, which is 12 moves, but the shortest route is only 8 moves: down to `(3,0)`, right to `(3,1)`, down to `(4,1)`, then right along the bottom.
DFS found the first route it could, not the best one.

Because dead-end cells such as `(0,3)` and `(2,2)` stay marked as visited, each cell is entered at most once.
That gives O(rows * cols) time and O(rows * cols) space for the visited array and the recursion.

### 3.4 Extra Variants

**Shortest path: use BFS.**
BFS explores in rings of equal distance, so the first time it reaches the exit is the shortest.

```js
function shortestMaze(maze) {
  const rows = maze.length;
  const cols = maze[0].length;
  if (maze[0][0] === 1 || maze[rows - 1][cols - 1] === 1) return -1;
  const dist = maze.map(row => row.map(() => -1));
  dist[0][0] = 0;
  const queue = [[0, 0]];
  for (let head = 0; head < queue.length; head++) {      // index pointer: shift() would be O(n)
    const [r, c] = queue[head];
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      if (maze[nr][nc] === 1 || dist[nr][nc] !== -1) continue;
      dist[nr][nc] = dist[r][c] + 1;                     // marked when pushed, not when popped
      queue.push([nr, nc]);
    }
  }
  return dist[rows - 1][cols - 1];
}

shortestMaze(maze); // 8
shortestMaze([[0, 1], [1, 0]]); // -1
```

**Count every simple path.**
Now the visited mark **is** cleared on the way out, since a cell can be part of many different paths.

```js
function countPaths(maze) {
  const rows = maze.length;
  const cols = maze[0].length;
  const visited = maze.map(row => row.map(() => false));
  let count = 0;

  function dfs(r, c) {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return;
    if (maze[r][c] === 1 || visited[r][c]) return;
    if (r === rows - 1 && c === cols - 1) {
      count++;
      return;
    }
    visited[r][c] = true;
    for (const [dr, dc] of DIRS) dfs(r + dr, c + dc);
    visited[r][c] = false;                               // un-choose: other paths may use this cell
  }

  if (maze[0][0] === 0 && maze[rows - 1][cols - 1] === 0) dfs(0, 0);
  return count;
}

countPaths(maze); // 12
countPaths([[0, 0], [0, 0]]); // 2
```

The 5 x 5 maze above has 12 different simple paths, from 8 moves to 14 moves long.
In an open grid the count grows exponentially with the grid size, which is why this form is only for small mazes.

**Rat in a maze: list every path as a move string.**
Try the moves in the order `D`, `L`, `R`, `U` and the strings come out already sorted.

```js
function allPathStrings(maze) {
  const rows = maze.length;
  const cols = maze[0].length;
  const moves = [["D", 1, 0], ["L", 0, -1], ["R", 0, 1], ["U", -1, 0]];
  const visited = maze.map(row => row.map(() => false));
  const result = [];

  function dfs(r, c, route) {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return;
    if (maze[r][c] === 1 || visited[r][c]) return;
    if (r === rows - 1 && c === cols - 1) {
      result.push(route);
      return;
    }
    visited[r][c] = true;
    for (const [letter, dr, dc] of moves) dfs(r + dr, c + dc, route + letter);
    visited[r][c] = false;
  }

  if (maze[0][0] === 0 && maze[rows - 1][cols - 1] === 0) dfs(0, 0, "");
  return result;
}

allPathStrings([[0, 0, 0], [0, 1, 0], [0, 0, 0]]); // ["DDRR","RRDD"]
allPathStrings([[0, 1], [1, 0]]); // []
```

**Word search** (LeetCode 79) is the same pattern on a letter grid.
The "visited" mark is replaced by temporarily overwriting the cell, and the overwrite is undone on the way out.

```js
function wordSearch(board, word) {
  const rows = board.length;
  const cols = board[0].length;

  function dfs(r, c, i) {
    if (i === word.length) return true;
    if (r < 0 || c < 0 || r >= rows || c >= cols || board[r][c] !== word[i]) return false;
    const saved = board[r][c];
    board[r][c] = "#";                                   // choose: mark as used
    const found = DIRS.some(([dr, dc]) => dfs(r + dr, c + dc, i + 1));
    board[r][c] = saved;                                 // un-choose
    return found;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (dfs(r, c, 0)) return true;
    }
  }
  return false;
}

wordSearch([["A", "B", "C", "E"], ["S", "F", "C", "S"], ["A", "D", "E", "E"]], "ABCCED"); // true
wordSearch([["A", "B", "C", "E"], ["S", "F", "C", "S"], ["A", "D", "E", "E"]], "ABCB"); // false
```

Word search must clear its marks, because a letter cell may be wasted on one attempt and needed by another.
It is the "all paths" kind of backtracking, not the "find one path" kind.

### 3.5 Pitfalls

- **Clearing `visited` in the find-one-path version.** The code is still correct, but the running time becomes exponential, since dead ends are re-explored from every route.
- **Not clearing `visited` in the count-all or word-search version.** Cells stay blocked, and you miss valid paths.
- **Checking the goal before the bounds and wall checks.** A start or exit that is a wall must return no path.
- **Bounds check after indexing.** `maze[r][c]` with `r = -1` is `undefined` in JavaScript and a crash in Java.
  Check the bounds first.
- **Using DFS for the shortest path.** The first route found is not the shortest, as the 12-versus-8 example shows.
  Use BFS.
- **Marking visited when popping in BFS.** A cell can then be queued many times.
  Mark it when it is pushed.
- **Mutating the input without restoring it.** Word search overwrites cells and must restore each one.
- **Recursion depth on a large open grid.** A 1000 x 1000 grid can recurse a million cells deep.
  Use an explicit stack for DFS, or BFS.
- **Forgetting `path.pop()`.** The returned path then includes dead-end cells.

### 3.6 Java Implementation

```java
static final int[][] DIRS = {{0, 1}, {1, 0}, {0, -1}, {-1, 0}};

static List<int[]> solveMaze(int[][] maze) {
    int rows = maze.length;
    int cols = maze[0].length;
    if (maze[0][0] == 1 || maze[rows - 1][cols - 1] == 1) return null;
    boolean[][] visited = new boolean[rows][cols];
    List<int[]> path = new ArrayList<>();
    return mazeDfs(maze, visited, path, 0, 0) ? path : null;
}

static boolean mazeDfs(int[][] maze, boolean[][] visited, List<int[]> path, int r, int c) {
    int rows = maze.length;
    int cols = maze[0].length;
    if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
    if (maze[r][c] == 1 || visited[r][c]) return false;
    visited[r][c] = true;
    path.add(new int[]{r, c});
    if (r == rows - 1 && c == cols - 1) return true;
    for (int[] d : DIRS) {
        if (mazeDfs(maze, visited, path, r + d[0], c + d[1])) return true;
    }
    path.remove(path.size() - 1);
    return false;
}

static String pathString(List<int[]> path) {
    if (path == null) return "none";
    StringBuilder sb = new StringBuilder();
    for (int[] cell : path) sb.append('(').append(cell[0]).append(',').append(cell[1]).append(')');
    return sb.toString();
}
// pathString(solveMaze(new int[][]{{0, 0, 0, 0, 1}, {0, 0, 0, 1, 0}, {0, 1, 0, 1, 0}, {0, 0, 1, 0, 0}, {0, 0, 0, 0, 0}})) -> (0,0)(0,1)(0,2)(1,2)(1,1)(1,0)(2,0)(3,0)(3,1)(4,1)(4,2)(4,3)(4,4)
// pathString(solveMaze(new int[][]{{0, 1}, {1, 0}})) -> none
```

`path.remove(path.size() - 1)` removes by index.
Calling `path.remove(someInteger)` on a `List<Integer>` would remove by index too, which is a classic trap, so the safe pattern is the explicit index shown here.

```java
static int shortestMaze(int[][] maze) {
    int rows = maze.length;
    int cols = maze[0].length;
    if (maze[0][0] == 1 || maze[rows - 1][cols - 1] == 1) return -1;
    int[][] dist = new int[rows][cols];
    for (int[] row : dist) Arrays.fill(row, -1);
    dist[0][0] = 0;
    Queue<int[]> queue = new ArrayDeque<>();
    queue.add(new int[]{0, 0});
    while (!queue.isEmpty()) {
        int[] cell = queue.poll();
        for (int[] d : DIRS) {
            int nr = cell[0] + d[0];
            int nc = cell[1] + d[1];
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
            if (maze[nr][nc] == 1 || dist[nr][nc] != -1) continue;
            dist[nr][nc] = dist[cell[0]][cell[1]] + 1;
            queue.add(new int[]{nr, nc});
        }
    }
    return dist[rows - 1][cols - 1];
}
// shortestMaze(new int[][]{{0, 0, 0, 0, 1}, {0, 0, 0, 1, 0}, {0, 1, 0, 1, 0}, {0, 0, 1, 0, 0}, {0, 0, 0, 0, 0}}) -> 8

static int countPaths(int[][] maze) {
    boolean[][] visited = new boolean[maze.length][maze[0].length];
    if (maze[0][0] == 1 || maze[maze.length - 1][maze[0].length - 1] == 1) return 0;
    return countFrom(maze, visited, 0, 0);
}

static int countFrom(int[][] maze, boolean[][] visited, int r, int c) {
    int rows = maze.length;
    int cols = maze[0].length;
    if (r < 0 || c < 0 || r >= rows || c >= cols) return 0;
    if (maze[r][c] == 1 || visited[r][c]) return 0;
    if (r == rows - 1 && c == cols - 1) return 1;
    visited[r][c] = true;
    int total = 0;
    for (int[] d : DIRS) total += countFrom(maze, visited, r + d[0], c + d[1]);
    visited[r][c] = false;
    return total;
}
// countPaths(new int[][]{{0, 0, 0, 0, 1}, {0, 0, 0, 1, 0}, {0, 1, 0, 1, 0}, {0, 0, 1, 0, 0}, {0, 0, 0, 0, 0}}) -> 12
// countPaths(new int[][]{{0, 0}, {0, 0}}) -> 2
```

Word search with an in-place mark:

```java
static boolean wordSearch(char[][] board, String word) {
    for (int r = 0; r < board.length; r++) {
        for (int c = 0; c < board[0].length; c++) {
            if (wordDfs(board, word, r, c, 0)) return true;
        }
    }
    return false;
}

static boolean wordDfs(char[][] board, String word, int r, int c, int i) {
    if (i == word.length()) return true;
    if (r < 0 || c < 0 || r >= board.length || c >= board[0].length || board[r][c] != word.charAt(i)) return false;
    char saved = board[r][c];
    board[r][c] = '#';
    boolean found = false;
    for (int[] d : DIRS) {
        if (wordDfs(board, word, r + d[0], c + d[1], i + 1)) {
            found = true;
            break;
        }
    }
    board[r][c] = saved;
    return found;
}
// wordSearch(new char[][]{{'A', 'B', 'C', 'E'}, {'S', 'F', 'C', 'S'}, {'A', 'D', 'E', 'E'}}, "ABCCED") -> true
// wordSearch(new char[][]{{'A', 'B', 'C', 'E'}, {'S', 'F', 'C', 'S'}, {'A', 'D', 'E', 'E'}}, "ABCB") -> false
```

---

## 4. P vs NP

### 4.1 When to Use

- An interviewer asks "is this problem NP-hard?", "what is the difference between P and NP?", or "why can't we do better than 2^n here?".
- A problem looks like **choosing a subset, an ordering, or an assignment** under a global constraint, and the only approach you can find tries every combination.
- You need to decide whether to keep looking for a polynomial algorithm, or to switch to backtracking with pruning, dynamic programming on small numbers, an approximation, or a heuristic.
- Keywords: "traveling salesman", "subset sum", "partition", "schedule with constraints", "vertex cover", "clique", "Hamiltonian path", "satisfiability", "decide whether there exists".

### 4.2 Core Idea

Complexity theory classifies **decision problems** (questions with a yes or no answer) by how much work they take, measured against the **input size** `n`.

| Class | Meaning | Example |
| --- | --- | --- |
| **P** | Can be **solved** in polynomial time, `O(n^k)` for some constant `k` | Sorting, shortest path, minimum spanning tree, strongly connected components |
| **NP** | A yes answer can be **verified** in polynomial time, given a hint (a **certificate**) | Subset sum: given the chosen numbers, adding them up is fast |
| **NP-hard** | At least as hard as every problem in NP | Traveling salesman (the optimization form), halting problem |
| **NP-complete** | In NP **and** NP-hard: the hardest problems in NP | SAT, 3-SAT, subset sum, Hamiltonian cycle, vertex cover, clique, graph 3-coloring |

NP stands for **nondeterministic polynomial time**.
It does **not** mean "not polynomial".
Every problem in P is also in NP, because if you can solve it quickly you can certainly verify the answer quickly, so `P ⊆ NP`.

```text
        +---------------------------------------+
        |  NP                                   |
        |     +-------------+     +-----------+ |
        |     |      P      |     |    NP-    | |
        |     |             |     | complete  | |    NP-hard extends
        |     +-------------+     +-----------+ |    beyond NP
        +---------------------------------------+
        (drawn assuming P != NP)
```

**The open question.**
Is `P = NP`?
In other words, whenever a solution can be **checked** quickly, can one also be **found** quickly?
Nobody has proved it either way, and it is one of the seven Millennium Prize problems.
Almost everyone believes `P != NP`.

**Reductions.**
To show that a new problem `B` is hard, take a known NP-complete problem `A` and show that any instance of `A` can be converted into an instance of `B` in polynomial time, with the same yes or no answer.
Then `B` is at least as hard as `A`.
A fast algorithm for `B` would give a fast algorithm for `A`, and for all of NP.
The standard chain begins with SAT, which is NP-complete by the Cook-Levin theorem, and continues through 3-SAT to clique, vertex cover, Hamiltonian cycle, and traveling salesman.

**Verify versus solve** is the whole idea in one picture:

| Problem | Verifying a certificate | Finding a solution |
| --- | --- | --- |
| Subset sum | Add the chosen numbers: O(n) | Try all `2^n` subsets, or DP in `O(n * target)` |
| Sudoku (n x n) | Check each row, column, and box: O(n^2) | Search, exponential in the worst case |
| Hamiltonian path | Check that the listed path visits every node once along real edges: O(n) | Try orderings: O(n!) |
| 3-SAT | Plug in the assignment and check every clause: O(clauses) | Try all `2^n` assignments |

Some neighbors that **are** in P, so beware of pattern matching on the name alone:

| Looks hard | Actually | Why |
| --- | --- | --- |
| Shortest path | P | Dijkstra, Bellman-Ford |
| Longest **simple** path | NP-hard | No known polynomial algorithm |
| Eulerian path (every edge once) | P | A degree check |
| Hamiltonian path (every node once) | NP-complete | - |
| 2-coloring | P | BFS |
| 3-coloring | NP-complete | - |
| 2-SAT | P | Strongly connected components |
| 3-SAT | NP-complete | - |
| Minimum spanning tree | P | Prim, Kruskal |
| Traveling salesman | NP-hard | - |

### 4.3 Problem: Subset Sum, Three Ways

Given `nums = [3, 34, 4, 12, 5, 2]` and `target = 9`, is there a subset that adds up to the target?
(Yes: `4 + 5`, and also `3 + 4 + 2`.)

**1. The verifier.**
It takes a proposed answer (a list of indexes) and checks it in time proportional to the answer's length.
This is what puts subset sum in **NP**.

```js
function verifySubsetSum(nums, target, chosen) {
  const seen = new Set();
  let sum = 0;
  for (const i of chosen) {
    if (i < 0 || i >= nums.length || seen.has(i)) return false;   // bad or repeated index
    seen.add(i);
    sum += nums[i];
  }
  return sum === target;
}

verifySubsetSum([3, 34, 4, 12, 5, 2], 9, [2, 4]); // true
verifySubsetSum([3, 34, 4, 12, 5, 2], 9, [0, 2, 5]); // true
verifySubsetSum([3, 34, 4, 12, 5, 2], 9, [1, 2]); // false
verifySubsetSum([3, 34, 4, 12, 5, 2], 9, [2, 2, 4]); // false
```

**2. Brute force.**
Try every one of the `2^n` subsets, using the bits of a counter as the choice of items.

```js
function subsetSumBruteForce(nums, target) {
  const n = nums.length;
  for (let mask = 0; mask < (1 << n); mask++) {
    let sum = 0;
    const chosen = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sum += nums[i];
        chosen.push(i);
      }
    }
    if (sum === target) return chosen;
  }
  return null;
}

subsetSumBruteForce([3, 34, 4, 12, 5, 2], 9); // [2,4]
subsetSumBruteForce([3, 34, 4, 12, 5, 2], 30); // null
subsetSumBruteForce([], 0); // []
```

**3. Dynamic programming.**
`reachable[s]` says whether some subset adds up to `s`.
Each number can update every sum, going downward so that no number is used twice.

```js
function subsetSumDP(nums, target) {
  const reachable = new Array(target + 1).fill(false);
  reachable[0] = true;                                  // the empty subset
  for (const x of nums) {
    for (let s = target; s >= x; s--) {
      if (reachable[s - x]) reachable[s] = true;
    }
  }
  return reachable[target];
}

subsetSumDP([3, 34, 4, 12, 5, 2], 9); // true
subsetSumDP([3, 34, 4, 12, 5, 2], 30); // false
```

Running time of the three, for `n` numbers:

| Method | Time | `n = 20` | `n = 40` | `n = 60` |
| --- | --- | --- | --- | --- |
| Verify one certificate | O(n) | instant | instant | instant |
| Brute force | O(2^n * n) | about a million subsets, instant | about 10^12 subsets, around 18 minutes at 10^9 per second | about 10^18 subsets, around 36 years |
| DP | O(n * target) | fast if `target` is small | fast if `target` is small | fast if `target` is small |

The DP looks polynomial, but it is **pseudo-polynomial**.
Its cost depends on the **value** of `target`, while the input size is the number of **bits** needed to write `target`.
A `target` with 60 bits is about 10^18, and the table would be that big.
So subset sum is still NP-complete, and the DP is only practical when the numbers are small.

Checking the dry run: for `[3, 34, 4, 12, 5, 2]` and target 9, brute force walks the masks from 0 upward.
Mask `20` (binary `010100`, items at indexes 2 and 4) is the first subset that sums to 9, `4 + 5`.
Mask `37` (indexes 0, 2, 5) would give `3 + 4 + 2`, a different valid answer found later.

### 4.4 Extra Variants

**3-SAT, brute force and verifier.**
A formula is a list of clauses, and each clause is a list of literals: `3` means variable 3, `-3` means its negation.
The formula `(x1 or not x2) and (x2 or x3) and (not x1 or not x3)` is `[[1, -2], [2, 3], [-1, -3]]`.

```js
function satisfies(clauses, assignment) {
  // assignment[i] is the value of variable i + 1
  return clauses.every(clause =>
    clause.some(lit => (lit > 0 ? assignment[lit - 1] : !assignment[-lit - 1]))
  );
}

function solveSat(numVars, clauses) {
  for (let mask = 0; mask < (1 << numVars); mask++) {
    const assignment = Array.from({ length: numVars }, (_, i) => (mask & (1 << i)) !== 0);
    if (satisfies(clauses, assignment)) return assignment;
  }
  return null;
}

satisfies([[1, -2], [2, 3], [-1, -3]], [true, true, false]); // true
satisfies([[1, -2], [2, 3], [-1, -3]], [false, false, false]); // false
solveSat(3, [[1, -2], [2, 3], [-1, -3]]); // [true,true,false]
solveSat(1, [[1], [-1]]); // null
```

`satisfies` is the polynomial verifier.
`solveSat` tries `2^n` assignments, and no polynomial algorithm for 3-SAT is known.

**Approximation: a 2-approximation for vertex cover.**
A **vertex cover** is a set of nodes that touches every edge, and finding the *smallest* one is NP-hard.
Take any edge whose two ends are both uncovered and add **both** ends.
The result is at most twice the optimum, because every chosen edge needs at least one of its ends in any cover.

```js
function vertexCover2Approx(edges) {
  const covered = new Set();
  for (const [u, v] of edges) {
    if (!covered.has(u) && !covered.has(v)) {
      covered.add(u);
      covered.add(v);
    }
  }
  return [...covered].sort((a, b) => a - b);
}

vertexCover2Approx([[0, 1], [1, 2], [2, 3], [3, 4]]); // [0,1,2,3]
```

The optimal cover of that path graph is `{1, 3}`, with 2 nodes, and the approximation returned 4 nodes, exactly twice the optimum.

**What to do when you recognize an NP-hard problem.**

| Situation | Approach |
| --- | --- |
| `n` is tiny (about 20 or less) | Bitmask enumeration, or backtracking with pruning |
| The numbers are small | Pseudo-polynomial dynamic programming (knapsack, subset sum, partition) |
| The graph has special structure | Trees, DAGs, planar or bounded-width graphs often make it easy |
| An approximate answer is acceptable | Approximation algorithms with a proven ratio |
| Only a good answer is needed | Greedy, local search, simulated annealing, or an integer programming solver |
| The interviewer expects a clean algorithm | Re-read the problem: a hidden constraint usually makes it polynomial |

### 4.5 Pitfalls

- **Reading NP as "not polynomial".** It means "verifiable in polynomial time".
- **Assuming NP-hard means "in NP".** NP-hard problems can be harder than NP, such as the halting problem, which is not even decidable.
- **Calling pseudo-polynomial DP polynomial.** `O(n * target)` is exponential in the number of bits of `target`.
- **Confusing the decision and optimization forms.** "Is there a tour of length at most `K`?" is the NP-complete decision problem, and "find the shortest tour" is the NP-hard optimization problem.
- **Pattern matching on the name.** Longest *simple* path is NP-hard but shortest path is easy, and 2-coloring is easy but 3-coloring is not.
- **Saying "I proved it is NP-hard so there is no solution."** It means no known polynomial worst-case algorithm, not that nothing works in practice.
  SAT solvers handle huge real instances.
- **Overflow in the brute-force mask.** `1 << n` is wrong for `n >= 31` in JavaScript and Java `int`, so enumeration of subsets stops being feasible long before that anyway.
- **Forgetting that a reduction must go the right way.** To prove `B` is hard, reduce a known hard problem `A` **to** `B`, not `B` to `A`.

### 4.6 Java Implementation

```java
static boolean verifySubsetSum(int[] nums, int target, int[] chosen) {
    Set<Integer> seen = new HashSet<>();
    long sum = 0;
    for (int i : chosen) {
        if (i < 0 || i >= nums.length || !seen.add(i)) return false;
        sum += nums[i];
    }
    return sum == target;
}
// verifySubsetSum(new int[]{3, 34, 4, 12, 5, 2}, 9, new int[]{2, 4}) -> true
// verifySubsetSum(new int[]{3, 34, 4, 12, 5, 2}, 9, new int[]{1, 2}) -> false
// verifySubsetSum(new int[]{3, 34, 4, 12, 5, 2}, 9, new int[]{2, 2, 4}) -> false

static List<Integer> subsetSumBruteForce(int[] nums, int target) {
    int n = nums.length;
    for (int mask = 0; mask < (1 << n); mask++) {
        long sum = 0;
        List<Integer> chosen = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            if ((mask & (1 << i)) != 0) {
                sum += nums[i];
                chosen.add(i);
            }
        }
        if (sum == target) return chosen;
    }
    return null;
}
// subsetSumBruteForce(new int[]{3, 34, 4, 12, 5, 2}, 9) -> [2, 4]
// subsetSumBruteForce(new int[]{3, 34, 4, 12, 5, 2}, 30) -> null

static boolean subsetSumDP(int[] nums, int target) {
    boolean[] reachable = new boolean[target + 1];
    reachable[0] = true;
    for (int x : nums) {
        for (int s = target; s >= x; s--) {
            if (reachable[s - x]) reachable[s] = true;
        }
    }
    return reachable[target];
}
// subsetSumDP(new int[]{3, 34, 4, 12, 5, 2}, 9) -> true
// subsetSumDP(new int[]{3, 34, 4, 12, 5, 2}, 30) -> false
```

```java
static boolean satisfies(int[][] clauses, boolean[] assignment) {
    for (int[] clause : clauses) {
        boolean ok = false;
        for (int lit : clause) {
            boolean value = lit > 0 ? assignment[lit - 1] : !assignment[-lit - 1];
            if (value) {
                ok = true;
                break;
            }
        }
        if (!ok) return false;
    }
    return true;
}

static boolean[] solveSat(int numVars, int[][] clauses) {
    for (int mask = 0; mask < (1 << numVars); mask++) {
        boolean[] assignment = new boolean[numVars];
        for (int i = 0; i < numVars; i++) assignment[i] = (mask & (1 << i)) != 0;
        if (satisfies(clauses, assignment)) return assignment;
    }
    return null;
}
// solveSat(3, new int[][]{{1, -2}, {2, 3}, {-1, -3}}) -> [true, true, false]
// solveSat(1, new int[][]{{1}, {-1}}) -> null

static List<Integer> vertexCover2Approx(int[][] edges) {
    Set<Integer> covered = new TreeSet<>();
    for (int[] e : edges) {
        if (!covered.contains(e[0]) && !covered.contains(e[1])) {
            covered.add(e[0]);
            covered.add(e[1]);
        }
    }
    return new ArrayList<>(covered);
}
// vertexCover2Approx(new int[][]{{0, 1}, {1, 2}, {2, 3}, {3, 4}}) -> [0, 1, 2, 3]
```

---

## 5. Java Pitfalls

- **Recursive DFS depth.** Kosaraju, Tarjan, and maze DFS recurse once per node.
  Around 10,000 to 20,000 frames overflows the default stack, so use an explicit `Deque<Integer>` or start the work in `new Thread(null, task, "dfs", 1L << 28)`.
- **Sharing a counter across recursive calls.** Java has no pass-by-reference for `int`.
  Use a field, a one-element `int[]`, or an `AtomicInteger`.
- **`List.remove(int)` versus `List.remove(Object)`.** On a `List<Integer>`, `remove(3)` removes the element at index 3.
  Use `remove(Integer.valueOf(3))` to remove the value.
- **Comparator subtraction in the Prim heap.** `(a, b) -> a[0] - b[0]` overflows for large weights.
  Use `Integer.compare`.
- **`Integer.MAX_VALUE` as infinity.** `minEdge[v] + w` overflows.
  Compare first, or use `long`.
- **`char[][]` copies.** `board.clone()` copies only the outer array, so rows are still shared.
  A word-search mark that is not undone corrupts the caller's board.
- **Mutating an array while a stream or iterator reads it.** Maze solvers that mark cells in place must restore them.
- **`HashMap` and `HashSet` iteration order.** Any output built from iteration (components, covers) can differ between runs and JVMs.
  Sort it, or use `TreeSet` and `LinkedHashMap`, as the code above does.
- **`1 << n` for `n >= 31`.** It overflows `int`.
  Use `1L << n` with `long` masks, and remember that enumerating `2^n` subsets is infeasible for large `n` anyway.

---

## 6. Quick Recap

| Topic | Signal in the problem | Core tool | Time | Space |
| --- | --- | --- | --- | --- |
| Strongly connected components | Directed graph, mutual reachability, cycles of dependencies | Kosaraju (two DFS passes, transpose) or Tarjan (`low` link and stack) | O(V + E) | O(V + E) |
| Prim's algorithm | Connect all nodes at minimum cost, undirected weighted graph | Min-heap of crossing edges, skip stale entries | O(E log V), or O(V^2) dense | O(E) |
| Maze, find a path | Grid with walls, reachability, one route | DFS with visited that stays set, pop the path on a dead end | O(rows * cols) | O(rows * cols) |
| Maze, all paths, word search | List or count every route | Backtracking that clears the mark on the way out | Exponential | O(rows * cols) |
| Maze, shortest path | Fewest moves on a grid | BFS, mark on push | O(rows * cols) | O(rows * cols) |
| P vs NP | Pick a subset or ordering under a global constraint | Verify in polynomial time, solve by search, DP on small numbers, or approximate | Exponential worst case | Varies |

Next: return to the [Pattern Playbook](/docs/dsa/pattern-playbook) to practice choosing between these tools, or use the [LeetCode 30-Day Plan](/docs/dsa/leetcode-30-day-plan) for problems that use them.
