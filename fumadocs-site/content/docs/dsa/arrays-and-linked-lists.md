---
title: "Patterns: Arrays, Strings and Linked Lists"
description: "Sliding window, two pointers, fast and slow pointers, merge intervals, cyclic sort, and in-place linked list reversal with templates, dry runs, variants, and Java implementations."
---

# 📘 Patterns: Arrays, Strings and Linked Lists

This page covers the first six of the 14 patterns from the [dsa-patterns](https://github.com/isayanpal/dsa-patterns) repository.
For each pattern you get the recognition signals, a reusable template, the repository problems solved step by step, extra variants that show up in interviews, and the bugs people hit most.
JavaScript and Java code is included, and every snippet on this page was executed against test cases.
Every pattern section ends with a **Java Implementation** subsection.
Java conventions: all methods are `static` members of one `Solution` class, `import java.util.*;` is assumed, helper classes such as `ListNode` and `TreeNode` are top-level package-private classes in the same file, and the trailing `//` comments show a sample call and its result.
Every Java snippet was compiled with JDK 17 and run against test cases.

## Table of Contents

1. [Shared Helpers](#1-shared-helpers)
2. [Sliding Window](#2-sliding-window)
3. [Two Pointers](#3-two-pointers)
4. [Fast and Slow Pointers](#4-fast-and-slow-pointers)
5. [Merge Intervals](#5-merge-intervals)
6. [Cyclic Sort](#6-cyclic-sort)
7. [In-Place Reversal of a Linked List](#7-in-place-reversal-of-a-linked-list)
8. [Java Pitfalls](#8-java-pitfalls)
9. [Quick Recap](#9-quick-recap)

---

## 1. Shared Helpers

Linked list problems reuse the same node class.
The two helpers convert between arrays and lists so you can test quickly.

```js
class ListNode {
  constructor(val = 0, next = null) {
    this.val = val;
    this.next = next;
  }
}

function fromArray(values) {
  const dummy = new ListNode();
  let tail = dummy;
  for (const v of values) {
    tail.next = new ListNode(v);
    tail = tail.next;
  }
  return dummy.next;
}

function toArray(head) {
  const out = [];
  for (let node = head; node; node = node.next) out.push(node.val);
  return out;
}
```

The **dummy head** trick above shows up in almost every list problem.
It removes the special case where the head itself changes.

### 1.1 Java Implementation

```java
class ListNode {
    int val;
    ListNode next;

    ListNode(int val) {
        this.val = val;
    }

    ListNode(int val, ListNode next) {
        this.val = val;
        this.next = next;
    }
}
```

```java
static ListNode fromArray(int... values) {
    ListNode dummy = new ListNode(0);
    ListNode tail = dummy;
    for (int v : values) {
        tail.next = new ListNode(v);
        tail = tail.next;
    }
    return dummy.next;
}

static List<Integer> toList(ListNode head) {
    List<Integer> out = new ArrayList<>();
    for (ListNode node = head; node != null; node = node.next) out.add(node.val);
    return out;
}

static void swap(int[] a, int i, int j) {
    int tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
}
```

The `int... values` varargs parameter lets you write `fromArray(1, 2, 3)`.
The dummy head trick is identical to the JavaScript version.

---

## 2. Sliding Window

### 2.1 When to Use

- The input is an **array or string** and the answer is about a **contiguous** subarray or substring.
- Keywords: "longest", "shortest", "maximum sum of size k", "at most k distinct", "contains all of".
- The brute force is O(n²) because it recomputes the same overlapping range for every start index.

### 2.2 Core Idea

Keep a window `[left, right]` and update its state **incrementally**.
When `right` moves forward you add one element.
When `left` moves forward you remove one element.
Each element enters and leaves at most once, so the total work is O(n).

There are two shapes:

| Shape | Window size | Loop |
| --- | --- | --- |
| Fixed | Given as `k` | Add the new element, remove the one that fell off |
| Variable | Grows and shrinks | Expand `right`, shrink `left` while the window is invalid (or while it is still valid, when minimizing) |

### 2.3 Templates

```js
// Fixed window of size k
function fixedWindow(nums, k) {
  let state = 0;
  for (let i = 0; i < nums.length; i++) {
    state += nums[i];                    // add nums[i]
    if (i >= k - 1) {
      // window [i - k + 1, i] is full: record the answer here
      state -= nums[i - (k - 1)];        // remove the element leaving the window
    }
  }
}
```

```js
// Variable window: "longest valid" shape
function longestValid(nums) {
  let left = 0;
  let best = 0;
  for (let right = 0; right < nums.length; right++) {
    // 1. add nums[right] to the window state
    while (/* window is invalid */ false) {
      // 2. remove nums[left] from the window state
      left++;
    }
    best = Math.max(best, right - left + 1); // 3. window is valid, record it
  }
  return best;
}
```

For a **minimum** window flip the logic: shrink while the window is still valid and record the answer inside the `while`.

### 2.4 Problem: Maximum Sum Subarray of Size K

Given `nums = [2, 1, 5, 1, 3, 2]` and `k = 3`, return the largest sum of any 3 consecutive elements.

```js
function maxSumSubarray(nums, k) {
  let windowSum = 0;
  let best = -Infinity;
  for (let i = 0; i < nums.length; i++) {
    windowSum += nums[i];
    if (i >= k - 1) {
      best = Math.max(best, windowSum);
      windowSum -= nums[i - (k - 1)];
    }
  }
  return best;
}

maxSumSubarray([2, 1, 5, 1, 3, 2], 3); // 9  (5 + 1 + 3)
```

Dry run:

| i | nums[i] | windowSum after add | best | removed |
| --- | --- | --- | --- | --- |
| 0 | 2 | 2 | - | - |
| 1 | 1 | 3 | - | - |
| 2 | 5 | 8 | 8 | 2 -> sum 6 |
| 3 | 1 | 7 | 8 | 1 -> sum 6 |
| 4 | 3 | 9 | 9 | 5 -> sum 4 |
| 5 | 2 | 6 | 9 | 1 -> sum 5 |

Complexity: O(n) time, O(1) space.

Clarifying questions to ask: can values be negative, and what should be returned when `nums.length < k`?
The code above returns `-Infinity` for that case, which is usually not what the caller wants.

### 2.5 Problem: Longest Substring Without Repeating Characters

Given `s = "abcabcbb"`, return `3` (`"abc"`).

Instead of shrinking one step at a time, remember the **last index** of each character and jump `left` directly past the previous occurrence.

```js
function lengthOfLongestSubstring(s) {
  const lastSeen = new Map();
  let left = 0;
  let best = 0;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (lastSeen.has(ch) && lastSeen.get(ch) >= left) {
      left = lastSeen.get(ch) + 1;
    }
    lastSeen.set(ch, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}

lengthOfLongestSubstring("abcabcbb"); // 3
lengthOfLongestSubstring("bbbbb");    // 1
lengthOfLongestSubstring("pwwkew");   // 3
```

Dry run on `"abcabcbb"`:

| right | char | lastSeen before | left after | window | best |
| --- | --- | --- | --- | --- | --- |
| 0 | a | none | 0 | a | 1 |
| 1 | b | none | 0 | ab | 2 |
| 2 | c | none | 0 | abc | 3 |
| 3 | a | a at 0 | 1 | bca | 3 |
| 4 | b | b at 1 | 2 | cab | 3 |
| 5 | c | c at 2 | 3 | abc | 3 |
| 6 | b | b at 4 | 5 | cb | 3 |
| 7 | b | b at 6 | 7 | b | 3 |

The check `lastSeen.get(ch) >= left` matters.
Without it, a stale index from before the window would drag `left` backwards.
Test it with `"abba"`: the correct answer is `2`, and a version without the check returns `3`.

Complexity: O(n) time, O(min(n, alphabet)) space.

### 2.6 Extra Variants

**Smallest subarray with sum at least target** (positive numbers only).
This is the minimum-window shape.

```js
function minSubArrayLen(target, nums) {
  let left = 0;
  let sum = 0;
  let best = Infinity;
  for (let right = 0; right < nums.length; right++) {
    sum += nums[right];
    while (sum >= target) {
      best = Math.min(best, right - left + 1);
      sum -= nums[left++];
    }
  }
  return best === Infinity ? 0 : best;
}

minSubArrayLen(7, [2, 3, 1, 2, 4, 3]); // 2  ([4, 3])
```

**Longest substring with at most K distinct characters.**
Track counts in a map and shrink while `map.size > k`.

```js
function longestKDistinct(s, k) {
  const count = new Map();
  let left = 0;
  let best = 0;
  for (let right = 0; right < s.length; right++) {
    count.set(s[right], (count.get(s[right]) ?? 0) + 1);
    while (count.size > k) {
      const c = s[left++];
      count.set(c, count.get(c) - 1);
      if (count.get(c) === 0) count.delete(c);
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}

longestKDistinct("araaci", 2); // 4  ("araa")
```

**Minimum window substring.**
Given `s` and `t`, find the shortest substring of `s` containing every character of `t` (with multiplicity).
The `missing` counter avoids scanning the whole map on every step.

```js
function minWindow(s, t) {
  const need = new Map();
  for (const c of t) need.set(c, (need.get(c) ?? 0) + 1);
  let missing = t.length;
  let left = 0;
  let bestStart = 0;
  let bestLen = Infinity;
  for (let right = 0; right < s.length; right++) {
    const c = s[right];
    if (need.has(c)) {
      if (need.get(c) > 0) missing--;
      need.set(c, need.get(c) - 1);
    }
    while (missing === 0) {
      if (right - left + 1 < bestLen) {
        bestLen = right - left + 1;
        bestStart = left;
      }
      const l = s[left++];
      if (need.has(l)) {
        need.set(l, need.get(l) + 1);
        if (need.get(l) > 0) missing++;
      }
    }
  }
  return bestLen === Infinity ? "" : s.slice(bestStart, bestStart + bestLen);
}

minWindow("ADOBECODEBANC", "ABC"); // "BANC"
```

**Exactly K distinct values** cannot be done with a plain window, because shrinking is not monotonic.
Use the identity `exactly(k) = atMost(k) - atMost(k - 1)`.

```js
function subarraysWithKDistinct(nums, k) {
  return atMostKDistinct(nums, k) - atMostKDistinct(nums, k - 1);
}

function atMostKDistinct(nums, k) {
  const count = new Map();
  let left = 0;
  let total = 0;
  for (let right = 0; right < nums.length; right++) {
    count.set(nums[right], (count.get(nums[right]) ?? 0) + 1);
    while (count.size > k) {
      const c = nums[left++];
      count.set(c, count.get(c) - 1);
      if (count.get(c) === 0) count.delete(c);
    }
    total += right - left + 1; // every subarray ending at right and starting in [left, right]
  }
  return total;
}

subarraysWithKDistinct([1, 2, 1, 2, 3], 2); // 7
```

### 2.7 Pitfalls

- **Negative numbers break shrinking.** "Shrink while sum is too big" only works when removing an element always reduces the sum. With negatives use a prefix sum plus hash map instead (see the [Playbook](/docs/dsa/pattern-playbook)).
- **Updating the answer at the wrong time.** For "longest" record after the window is valid. For "shortest" record inside the shrinking loop.
- **Off by one in the fixed window.** The first full window ends at index `k - 1`, not `k`.

### 2.8 Java Implementation

#### Fixed Window: Maximum Sum Subarray of Size K

```java
static int maxSumSubarray(int[] nums, int k) {
    int windowSum = 0;
    int best = Integer.MIN_VALUE;
    for (int i = 0; i < nums.length; i++) {
        windowSum += nums[i];
        if (i >= k - 1) {
            best = Math.max(best, windowSum);
            windowSum -= nums[i - (k - 1)];
        }
    }
    return best;
}
// maxSumSubarray(new int[]{2, 1, 5, 1, 3, 2}, 3) -> 9
```

`int` sums overflow silently.
If values can be around 10^9 and `k` is large, accumulate in a `long`.

#### Variable Window: Longest Substring Without Repeating Characters

```java
static int lengthOfLongestSubstring(String s) {
    Map<Character, Integer> lastSeen = new HashMap<>();
    int left = 0;
    int best = 0;
    for (int right = 0; right < s.length(); right++) {
        char ch = s.charAt(right);
        Integer previous = lastSeen.get(ch);
        if (previous != null && previous >= left) {
            left = previous + 1;
        }
        lastSeen.put(ch, right);
        best = Math.max(best, right - left + 1);
    }
    return best;
}
// lengthOfLongestSubstring("abcabcbb") -> 3
// lengthOfLongestSubstring("abba")     -> 2
```

When the alphabet is small and known (ASCII), an `int[128]` array of last indices is faster and avoids boxing.
Initialize it with `-1` using `Arrays.fill(last, -1)`.

```java
static int lengthOfLongestSubstringAscii(String s) {
    int[] last = new int[128];
    Arrays.fill(last, -1);
    int left = 0;
    int best = 0;
    for (int right = 0; right < s.length(); right++) {
        char ch = s.charAt(right);
        if (last[ch] >= left) left = last[ch] + 1;
        last[ch] = right;
        best = Math.max(best, right - left + 1);
    }
    return best;
}
```

#### Extra Variants

**Smallest subarray with sum at least target.**

```java
static int minSubArrayLen(int target, int[] nums) {
    int left = 0;
    int sum = 0;
    int best = Integer.MAX_VALUE;
    for (int right = 0; right < nums.length; right++) {
        sum += nums[right];
        while (sum >= target) {
            best = Math.min(best, right - left + 1);
            sum -= nums[left++];
        }
    }
    return best == Integer.MAX_VALUE ? 0 : best;
}
// minSubArrayLen(7, new int[]{2, 3, 1, 2, 4, 3}) -> 2
```

**Longest substring with at most K distinct characters.**
`Map.merge` is the concise way to increment a counter.

```java
static int longestKDistinct(String s, int k) {
    Map<Character, Integer> count = new HashMap<>();
    int left = 0;
    int best = 0;
    for (int right = 0; right < s.length(); right++) {
        count.merge(s.charAt(right), 1, Integer::sum);
        while (count.size() > k) {
            char c = s.charAt(left++);
            if (count.merge(c, -1, Integer::sum) == 0) count.remove(c);
        }
        best = Math.max(best, right - left + 1);
    }
    return best;
}
// longestKDistinct("araaci", 2) -> 4
```

**Minimum window substring.**
A plain `int[128]` counter is the fastest option, and the `missing` counter avoids scanning it.

```java
static String minWindow(String s, String t) {
    int[] need = new int[128];
    for (char c : t.toCharArray()) need[c]++;
    int missing = t.length();
    int left = 0;
    int bestStart = 0;
    int bestLen = Integer.MAX_VALUE;
    for (int right = 0; right < s.length(); right++) {
        if (need[s.charAt(right)]-- > 0) missing--;
        while (missing == 0) {
            if (right - left + 1 < bestLen) {
                bestLen = right - left + 1;
                bestStart = left;
            }
            if (++need[s.charAt(left++)] > 0) missing++;
        }
    }
    return bestLen == Integer.MAX_VALUE ? "" : s.substring(bestStart, bestStart + bestLen);
}
// minWindow("ADOBECODEBANC", "ABC") -> "BANC"
```

Characters that are not in `t` go negative in `need`, and come back to 0 when they leave the window, so they never affect `missing`.

**Exactly K distinct values** as `atMost(k) - atMost(k - 1)`.

```java
static int subarraysWithKDistinct(int[] nums, int k) {
    return atMostKDistinct(nums, k) - atMostKDistinct(nums, k - 1);
}

static int atMostKDistinct(int[] nums, int k) {
    Map<Integer, Integer> count = new HashMap<>();
    int left = 0;
    int total = 0;
    for (int right = 0; right < nums.length; right++) {
        count.merge(nums[right], 1, Integer::sum);
        while (count.size() > k) {
            int c = nums[left++];
            if (count.merge(c, -1, Integer::sum) == 0) count.remove(c);
        }
        total += right - left + 1;
    }
    return total;
}
// subarraysWithKDistinct(new int[]{1, 2, 1, 2, 3}, 2) -> 7
```

---

## 3. Two Pointers

### 3.1 When to Use

- The array is **sorted** (or can be sorted without losing information) and you need a pair or triplet.
- You compare or partition from both ends: palindromes, container problems, reversing.
- You need an **in-place** filter or partition with O(1) extra space.

### 3.2 Three Shapes

| Shape | Pointers | Typical problems |
| --- | --- | --- |
| Opposite ends | `lo = 0`, `hi = n - 1`, move toward each other | Two Sum II, container with most water, valid palindrome |
| Same direction (read/write) | `read` scans, `write` marks the next slot to fill | Remove duplicates, move zeroes |
| Partition | Three or more pointers splitting regions | Dutch national flag (sort colors) |

### 3.3 Template: Opposite Ends

```js
function oppositeEnds(nums) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo < hi) {
    // inspect nums[lo] and nums[hi]
    // decide which pointer moves, and justify why the skipped pairs cannot be the answer
    lo++;
    hi--;
  }
}
```

The justification step is the whole pattern.
If you cannot say why discarding a pointer is safe, the greedy move is wrong.

### 3.4 Problem: Two Sum on a Sorted Array

```js
function twoSumSorted(nums, target) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo < hi) {
    const sum = nums[lo] + nums[hi];
    if (sum === target) return [lo, hi];
    if (sum < target) lo++;
    else hi--;
  }
  return [-1, -1];
}

twoSumSorted([1, 2, 3, 4, 6], 6); // [1, 3]
```

Why it is safe: if `sum < target`, then `nums[lo]` paired with **any** element at or before `hi` is even smaller, so `nums[lo]` can never be part of the answer and `lo` can move.
The mirrored argument works when `sum > target`.

The unsorted version (LeetCode Two Sum) uses a hash map from value to index in O(n) time and O(n) space.
Sorting first costs O(n log n) and loses the original indices, so prefer the map there.

### 3.5 Problem: Container With Most Water

`height[i]` is a vertical line at `x = i`. Pick two lines that hold the most water.
Area is `min(height[lo], height[hi]) * (hi - lo)`.

```js
function maxArea(height) {
  let lo = 0;
  let hi = height.length - 1;
  let best = 0;
  while (lo < hi) {
    best = Math.max(best, Math.min(height[lo], height[hi]) * (hi - lo));
    if (height[lo] < height[hi]) lo++;
    else hi--;
  }
  return best;
}

maxArea([1, 8, 6, 2, 5, 4, 8, 3, 7]); // 49
```

Why we move the **shorter** line:
the current area is capped by the shorter side.
Moving the taller side inward makes the width smaller and the cap can only stay the same or drop, so no pair involving the shorter line and anything closer can beat the current area.
That means the shorter line is finished and can be discarded.

### 3.6 Extra Variants

**Three Sum.**
Sort, fix one number, then run Two Sum II on the rest.
The de-duplication is the part interviewers watch.

```js
function threeSum(nums) {
  nums.sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < nums.length - 2; i++) {
    if (nums[i] > 0) break;                              // smallest is positive, no zero-sum possible
    if (i > 0 && nums[i] === nums[i - 1]) continue;      // skip duplicate anchors
    let lo = i + 1;
    let hi = nums.length - 1;
    while (lo < hi) {
      const sum = nums[i] + nums[lo] + nums[hi];
      if (sum === 0) {
        result.push([nums[i], nums[lo], nums[hi]]);
        lo++;
        hi--;
        while (lo < hi && nums[lo] === nums[lo - 1]) lo++;
        while (lo < hi && nums[hi] === nums[hi + 1]) hi--;
      } else if (sum < 0) {
        lo++;
      } else {
        hi--;
      }
    }
  }
  return result;
}

threeSum([-1, 0, 1, 2, -1, -4]); // [[-1, -1, 2], [-1, 0, 1]]
```

Complexity: O(n²) time, O(1) extra space (ignoring the sort and output).

**Remove duplicates from a sorted array in place** (read/write pointers).

```js
function removeDuplicates(nums) {
  if (nums.length === 0) return 0;
  let write = 1;
  for (let read = 1; read < nums.length; read++) {
    if (nums[read] !== nums[write - 1]) nums[write++] = nums[read];
  }
  return write; // new length; nums[0..write) holds the unique values
}
```

**Sort colors (Dutch national flag).**
Sort an array of `0`, `1`, `2` in one pass with three regions: `[0, low)` are zeros, `[low, mid)` are ones, `(high, n)` are twos.

```js
function sortColors(nums) {
  let low = 0;
  let mid = 0;
  let high = nums.length - 1;
  while (mid <= high) {
    if (nums[mid] === 0) {
      [nums[low], nums[mid]] = [nums[mid], nums[low]];
      low++;
      mid++;
    } else if (nums[mid] === 1) {
      mid++;
    } else {
      [nums[mid], nums[high]] = [nums[high], nums[mid]];
      high--;                                            // do NOT advance mid, the swapped value is unchecked
    }
  }
}
```

**Valid palindrome** compares from both ends while skipping non-alphanumeric characters.
**Trapping rain water** has an O(1) space two pointer solution that tracks `leftMax` and `rightMax` and always advances the side with the smaller max.

### 3.7 Pitfalls

- Using `lo <= hi` when the two pointers must reference different elements. Use `lo < hi` for pair problems.
- Forgetting to skip duplicates in Three Sum, which returns repeated triplets.
- In the Dutch flag, advancing `mid` after swapping with `high`. The value that came from `high` has not been classified yet.

### 3.8 Java Implementation

#### Two Sum on a Sorted Array

```java
static int[] twoSumSorted(int[] nums, int target) {
    int lo = 0;
    int hi = nums.length - 1;
    while (lo < hi) {
        int sum = nums[lo] + nums[hi];
        if (sum == target) return new int[]{lo, hi};
        if (sum < target) lo++;
        else hi--;
    }
    return new int[]{-1, -1};
}
// twoSumSorted(new int[]{1, 2, 3, 4, 6}, 6) -> [1, 3]
```

The unsorted version uses `Map<Integer, Integer>` from value to index:

```java
static int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> indexOf = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        Integer j = indexOf.get(target - nums[i]);
        if (j != null) return new int[]{j, i};
        indexOf.put(nums[i], i);
    }
    return new int[]{-1, -1};
}
// twoSum(new int[]{2, 7, 11, 15}, 9) -> [0, 1]
```

#### Container With Most Water

```java
static int maxArea(int[] height) {
    int lo = 0;
    int hi = height.length - 1;
    int best = 0;
    while (lo < hi) {
        best = Math.max(best, Math.min(height[lo], height[hi]) * (hi - lo));
        if (height[lo] < height[hi]) lo++;
        else hi--;
    }
    return best;
}
// maxArea(new int[]{1, 8, 6, 2, 5, 4, 8, 3, 7}) -> 49
```

#### Extra Variants

**Three Sum.**
`Arrays.asList` builds a small immutable-size list, which is fine for output.

```java
static List<List<Integer>> threeSum(int[] nums) {
    Arrays.sort(nums);
    List<List<Integer>> result = new ArrayList<>();
    for (int i = 0; i < nums.length - 2; i++) {
        if (nums[i] > 0) break;
        if (i > 0 && nums[i] == nums[i - 1]) continue;
        int lo = i + 1;
        int hi = nums.length - 1;
        while (lo < hi) {
            int sum = nums[i] + nums[lo] + nums[hi];
            if (sum == 0) {
                result.add(Arrays.asList(nums[i], nums[lo], nums[hi]));
                lo++;
                hi--;
                while (lo < hi && nums[lo] == nums[lo - 1]) lo++;
                while (lo < hi && nums[hi] == nums[hi + 1]) hi--;
            } else if (sum < 0) {
                lo++;
            } else {
                hi--;
            }
        }
    }
    return result;
}
// threeSum(new int[]{-1, 0, 1, 2, -1, -4}) -> [[-1, -1, 2], [-1, 0, 1]]
```

If the inputs can be near `Integer.MAX_VALUE`, compute `sum` as a `long`.

**Remove duplicates from a sorted array in place.**

```java
static int removeDuplicates(int[] nums) {
    if (nums.length == 0) return 0;
    int write = 1;
    for (int read = 1; read < nums.length; read++) {
        if (nums[read] != nums[write - 1]) nums[write++] = nums[read];
    }
    return write;
}
```

**Sort colors (Dutch national flag).**

```java
static void sortColors(int[] nums) {
    int low = 0;
    int mid = 0;
    int high = nums.length - 1;
    while (mid <= high) {
        if (nums[mid] == 0) {
            swap(nums, low++, mid++);
        } else if (nums[mid] == 1) {
            mid++;
        } else {
            swap(nums, mid, high--);      // do not advance mid, the swapped value is unchecked
        }
    }
}
```

---

## 4. Fast and Slow Pointers

Also called **Floyd's tortoise and hare**.

### 4.1 When to Use

- A linked list or a **sequence that can be modelled as a linked list** (functions like `next(x)`).
- Keywords: cycle, loop, middle, "kth from the end", palindrome list, happy number.
- You must use O(1) extra space, which rules out a hash set of visited nodes.

### 4.2 Core Idea

Two pointers move at different speeds, usually `slow` by 1 and `fast` by 2.

- If there is a cycle, `fast` laps `slow` and they meet inside the loop.
- If there is no cycle, `fast` reaches the end when `slow` is at the middle.

### 4.3 Problem: Detect a Cycle

```js
function hasCycle(head) {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}
```

The loop condition checks both `fast` and `fast.next`, because `fast.next.next` would throw on a null `fast.next`.

Why they must meet: once both are in the cycle, the gap between them changes by exactly 1 each step, so the gap goes through every value down to 0 and cannot jump over it.

### 4.4 Problem: Find Where the Cycle Starts

Let `F` be the distance from the head to the cycle start, `C` the cycle length, and `a` the distance from the cycle start to the meeting point.

When they meet, slow has walked `F + a` and fast has walked `2(F + a)`.
Fast has also walked `F + a + n * C` for some whole number of laps `n`.
So `F + a = n * C`, which gives `F = n * C - a`.

That means walking `F` steps from the meeting point lands exactly on the cycle start.
Start one pointer at the head and one at the meeting point, move both one step at a time, and they meet at the cycle start.

```js
function detectCycle(head) {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) {
      let probe = head;
      while (probe !== slow) {
        probe = probe.next;
        slow = slow.next;
      }
      return probe;
    }
  }
  return null;
}
```

To get the **cycle length**, after they meet keep one pointer still and walk the other around until they meet again, counting steps.

### 4.5 Problem: Middle of a Linked List

```js
function middleNode(head) {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
  }
  return slow;
}

toArray(middleNode(fromArray([1, 2, 3, 4, 5])));    // [3, 4, 5]
toArray(middleNode(fromArray([1, 2, 3, 4, 5, 6]))); // [4, 5, 6]  (second middle)
```

For an even length this returns the **second** middle.
If the problem needs the first middle (for example to split the list in two halves), use `while (fast.next && fast.next.next)` instead.

### 4.6 Extra Variants

**Happy number.**
Repeatedly replace `n` by the sum of the squares of its digits.
It is happy if it reaches 1, otherwise it enters a cycle.
The sequence of values is a linked list where `next(x)` is the digit-square sum.

```js
function isHappy(n) {
  const next = (x) => {
    let sum = 0;
    while (x > 0) {
      const d = x % 10;
      sum += d * d;
      x = Math.floor(x / 10);
    }
    return sum;
  };
  let slow = n;
  let fast = next(n);
  while (fast !== 1 && slow !== fast) {
    slow = next(slow);
    fast = next(next(fast));
  }
  return fast === 1;
}

isHappy(19); // true
isHappy(2);  // false
```

**Find the duplicate number** in an array of `n + 1` values from `1..n` without modifying it.
Treat `nums[i]` as a pointer to index `nums[i]`.
The duplicate is the entry point of the cycle, so run the cycle-start algorithm from section 4.4.

```js
function findDuplicateFloyd(nums) {
  let slow = nums[0];
  let fast = nums[0];
  do {
    slow = nums[slow];
    fast = nums[nums[fast]];
  } while (slow !== fast);
  slow = nums[0];
  while (slow !== fast) {
    slow = nums[slow];
    fast = nums[fast];
  }
  return slow;
}

findDuplicateFloyd([1, 3, 4, 2, 2]); // 2
```

**Kth node from the end.**
Not strictly fast/slow speeds but the same family: advance one pointer `k` steps, then move both until the leader reaches the end.
**Palindrome linked list** combines this pattern with reversal, see section 7.4.

### 4.7 Pitfalls

- Starting `fast` one step ahead of `slow` in the cycle check makes the `slow === fast` test fire immediately in some layouts. Start both at `head` and compare **after** moving.
- Returning `slow` from a cycle loop is not the cycle start, you need the second phase.
- Mutating the list to mark visited nodes is usually not allowed and never O(1) clean.

### 4.8 Java Implementation

#### Detect a Cycle and Find Its Start

```java
static boolean hasCycle(ListNode head) {
    ListNode slow = head;
    ListNode fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) return true;
    }
    return false;
}
```

```java
static ListNode detectCycle(ListNode head) {
    ListNode slow = head;
    ListNode fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) {
            ListNode probe = head;
            while (probe != slow) {
                probe = probe.next;
                slow = slow.next;
            }
            return probe;
        }
    }
    return null;
}
```

Compare nodes with `==` (reference equality).
Never call `equals` on nodes unless you have overridden it, because a value-based `equals` would treat two different nodes holding the same value as the same node.

#### Middle of a Linked List

```java
static ListNode middleNode(ListNode head) {
    ListNode slow = head;
    ListNode fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
    }
    return slow;
}
// toList(middleNode(fromArray(1, 2, 3, 4, 5)))    -> [3, 4, 5]
// toList(middleNode(fromArray(1, 2, 3, 4, 5, 6))) -> [4, 5, 6]
```

#### Extra Variants

**Happy number.**

```java
static boolean isHappy(int n) {
    int slow = n;
    int fast = digitSquareSum(n);
    while (fast != 1 && slow != fast) {
        slow = digitSquareSum(slow);
        fast = digitSquareSum(digitSquareSum(fast));
    }
    return fast == 1;
}

static int digitSquareSum(int x) {
    int sum = 0;
    while (x > 0) {
        int d = x % 10;
        sum += d * d;
        x /= 10;
    }
    return sum;
}
// isHappy(19) -> true, isHappy(2) -> false
```

**Find the duplicate number** without modifying the array.

```java
static int findDuplicateFloyd(int[] nums) {
    int slow = nums[0];
    int fast = nums[0];
    do {
        slow = nums[slow];
        fast = nums[nums[fast]];
    } while (slow != fast);
    slow = nums[0];
    while (slow != fast) {
        slow = nums[slow];
        fast = nums[fast];
    }
    return slow;
}
// findDuplicateFloyd(new int[]{1, 3, 4, 2, 2}) -> 2
```

---

## 5. Merge Intervals

### 5.1 When to Use

- Input is a list of `[start, end]` pairs.
- Keywords: overlap, merge, insert, schedule, meeting rooms, free time, conflicts.

### 5.2 Six Ways Two Intervals Can Relate

Let `a = [a1, a2]` and `b = [b1, b2]` with `a1 <= b1` (after sorting by start).

```text
1. Disjoint          a: |---|        b:        |---|        a2 < b1
2. Touching          a: |---|        b:     |---|           a2 == b1 (overlap or not depends on the problem)
3. Partial overlap   a: |-----|      b:    |------|         b1 <= a2 < b2
4. b inside a        a: |----------|                        b2 <= a2
                     b:    |---|
5. Same start        a: |------|     b: |---|              a1 == b1
6. Same interval     a: |---|        b: |---|
```

Once sorted by start, everything reduces to one comparison: does `b1 <= a2`?
If yes they overlap and the merged interval is `[a1, max(a2, b2)]`.
If no, `a` is finished.

Ask whether intervals touching at a single point (for example `[1, 3]` and `[3, 5]`) count as overlapping.
It changes `<=` to `<`.

### 5.3 Problem: Merge Overlapping Intervals

```js
function merge(intervals) {
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of intervals) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

merge([[1, 3], [2, 6], [8, 10], [15, 18]]); // [[1, 6], [8, 10], [15, 18]]
merge([[1, 4], [4, 5]]);                    // [[1, 5]]
merge([[1, 10], [2, 3]]);                   // [[1, 10]]  (needs Math.max)
```

Complexity: O(n log n) for the sort, O(n) for the scan, O(n) output space.

The sort is not optional.
Without it, `[[1, 4], [8, 9], [2, 3]]` would never merge `[2, 3]` into `[1, 4]`.

### 5.4 Problem: Insert Interval

The list is already sorted and non-overlapping, so no sort is needed.
Split the work into three phases:

1. Copy every interval that ends **before** the new one starts.
2. Merge every interval that **overlaps** the new one by growing `[s, e]`.
3. Copy the rest.

```js
function insertInterval(intervals, newInterval) {
  const result = [];
  const n = intervals.length;
  let i = 0;
  while (i < n && intervals[i][1] < newInterval[0]) result.push(intervals[i++]);

  let [s, e] = newInterval;
  while (i < n && intervals[i][0] <= e) {
    s = Math.min(s, intervals[i][0]);
    e = Math.max(e, intervals[i][1]);
    i++;
  }
  result.push([s, e]);

  while (i < n) result.push(intervals[i++]);
  return result;
}

insertInterval([[1, 3], [6, 9]], [2, 5]); // [[1, 5], [6, 9]]
```

Complexity: O(n) time and space.

### 5.5 Extra Variants

**Minimum meeting rooms.**
How many rooms are needed so no meetings collide?
Sort starts and ends separately.
Walk the starts: if the next meeting starts before the earliest end, we need a new room, otherwise a room frees up and we reuse it.

```js
function minMeetingRooms(intervals) {
  const starts = intervals.map((i) => i[0]).sort((a, b) => a - b);
  const ends = intervals.map((i) => i[1]).sort((a, b) => a - b);
  let rooms = 0;
  let e = 0;
  for (let s = 0; s < starts.length; s++) {
    if (starts[s] < ends[e]) rooms++;
    else e++;
  }
  return rooms;
}

minMeetingRooms([[0, 30], [5, 10], [15, 20]]); // 2
```

The heap version keeps a min-heap of end times and is easier to extend (for example to assign actual room ids).

**Non-overlapping intervals (minimum removals).**
This is the classic greedy: sort by **end** time and keep every interval that starts after the last kept end.

```js
function eraseOverlapIntervals(intervals) {
  intervals.sort((a, b) => a[1] - b[1]);
  let lastEnd = -Infinity;
  let removed = 0;
  for (const [start, end] of intervals) {
    if (start >= lastEnd) lastEnd = end;
    else removed++;
  }
  return removed;
}

eraseOverlapIntervals([[1, 2], [2, 3], [3, 4], [1, 3]]); // 1
```

Sorting by end is the key insight: finishing early leaves the most room for later intervals.

**Intersection of two interval lists.**
Both lists are sorted and internally disjoint.
Use two pointers, take the overlap `[max(starts), min(ends)]` when it is non-empty, then advance the list whose interval ends first.

```js
function intervalIntersection(A, B) {
  const result = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    const lo = Math.max(A[i][0], B[j][0]);
    const hi = Math.min(A[i][1], B[j][1]);
    if (lo <= hi) result.push([lo, hi]);
    if (A[i][1] < B[j][1]) i++;
    else j++;
  }
  return result;
}

intervalIntersection([[0, 2], [5, 10]], [[1, 5], [8, 12]]); // [[1, 2], [5, 5], [8, 10]]
```

**Employee free time** merges all employees' schedules, then reports the gaps.
It is Merge Intervals plus a final "gaps between merged blocks" pass.

### 5.6 Pitfalls

- `arr.sort()` with no comparator sorts numbers **as strings** (`[10, 9, 1].sort()` gives `[1, 10, 9]`). Always pass `(a, b) => a - b`.
- Forgetting `Math.max` when merging, which breaks the "b inside a" case.
- Mutating the input intervals. The `merge` above mutates `last[1]` on arrays it created itself, which is safe, but sorting mutates the caller's array. Copy first if the caller might reuse it.

### 5.7 Java Implementation

Java intervals are usually `int[][]`, and sorting needs a comparator.
Use `Integer.compare(a[0], b[0])` and **not** `a[0] - b[0]`, which overflows for values like `Integer.MIN_VALUE`.

#### Merge Overlapping Intervals

```java
static int[][] merge(int[][] intervals) {
    int[][] sorted = intervals.clone();
    Arrays.sort(sorted, (a, b) -> Integer.compare(a[0], b[0]));
    List<int[]> merged = new ArrayList<>();
    for (int[] current : sorted) {
        if (merged.isEmpty() || current[0] > merged.get(merged.size() - 1)[1]) {
            merged.add(new int[]{current[0], current[1]});
        } else {
            int[] last = merged.get(merged.size() - 1);
            last[1] = Math.max(last[1], current[1]);
        }
    }
    return merged.toArray(new int[0][]);
}
// merge(new int[][]{{1, 3}, {2, 6}, {8, 10}, {15, 18}}) -> [[1, 6], [8, 10], [15, 18]]
```

`intervals.clone()` copies the outer array only, so the caller's array order is preserved.
The rows are copied when added to `merged`, so `last[1] = ...` never mutates the caller's rows.

#### Insert Interval

```java
static int[][] insertInterval(int[][] intervals, int[] newInterval) {
    List<int[]> result = new ArrayList<>();
    int i = 0;
    int n = intervals.length;
    while (i < n && intervals[i][1] < newInterval[0]) result.add(intervals[i++]);

    int start = newInterval[0];
    int end = newInterval[1];
    while (i < n && intervals[i][0] <= end) {
        start = Math.min(start, intervals[i][0]);
        end = Math.max(end, intervals[i][1]);
        i++;
    }
    result.add(new int[]{start, end});

    while (i < n) result.add(intervals[i++]);
    return result.toArray(new int[0][]);
}
// insertInterval(new int[][]{{1, 3}, {6, 9}}, new int[]{2, 5}) -> [[1, 5], [6, 9]]
```

#### Extra Variants

**Minimum meeting rooms.**

```java
static int minMeetingRooms(int[][] intervals) {
    int n = intervals.length;
    int[] starts = new int[n];
    int[] ends = new int[n];
    for (int i = 0; i < n; i++) {
        starts[i] = intervals[i][0];
        ends[i] = intervals[i][1];
    }
    Arrays.sort(starts);
    Arrays.sort(ends);
    int rooms = 0;
    int e = 0;
    for (int s = 0; s < n; s++) {
        if (starts[s] < ends[e]) rooms++;
        else e++;
    }
    return rooms;
}
// minMeetingRooms(new int[][]{{0, 30}, {5, 10}, {15, 20}}) -> 2
```

The heap version, which also works when you must know **which** room:

```java
static int minMeetingRoomsHeap(int[][] intervals) {
    int[][] sorted = intervals.clone();
    Arrays.sort(sorted, (a, b) -> Integer.compare(a[0], b[0]));
    PriorityQueue<Integer> endTimes = new PriorityQueue<>();
    for (int[] meeting : sorted) {
        if (!endTimes.isEmpty() && endTimes.peek() <= meeting[0]) endTimes.poll();
        endTimes.add(meeting[1]);
    }
    return endTimes.size();
}
```

**Non-overlapping intervals (minimum removals).**

```java
static int eraseOverlapIntervals(int[][] intervals) {
    int[][] sorted = intervals.clone();
    Arrays.sort(sorted, (a, b) -> Integer.compare(a[1], b[1]));
    long lastEnd = Long.MIN_VALUE;
    int removed = 0;
    for (int[] interval : sorted) {
        if (interval[0] >= lastEnd) lastEnd = interval[1];
        else removed++;
    }
    return removed;
}
// eraseOverlapIntervals(new int[][]{{1, 2}, {2, 3}, {3, 4}, {1, 3}}) -> 1
```

`lastEnd` is a `long` so that `Long.MIN_VALUE` is a safe sentinel that cannot equal a real interval start.

**Intersection of two interval lists.**

```java
static int[][] intervalIntersection(int[][] a, int[][] b) {
    List<int[]> result = new ArrayList<>();
    int i = 0;
    int j = 0;
    while (i < a.length && j < b.length) {
        int lo = Math.max(a[i][0], b[j][0]);
        int hi = Math.min(a[i][1], b[j][1]);
        if (lo <= hi) result.add(new int[]{lo, hi});
        if (a[i][1] < b[j][1]) i++;
        else j++;
    }
    return result.toArray(new int[0][]);
}
// intervalIntersection(new int[][]{{0, 2}, {5, 10}}, new int[][]{{1, 5}, {8, 12}})
//   -> [[1, 2], [5, 5], [8, 10]]
```

---

## 6. Cyclic Sort

### 6.1 When to Use

- The array holds numbers in a **known range** such as `1..n` or `0..n`.
- Keywords: missing number, duplicate number, first missing positive, all disappeared numbers, corrupt pair.
- You need O(n) time and **O(1) space**, which rules out a hash set and makes sorting too slow.

### 6.2 Core Idea

If the values are `1..n`, the number `x` belongs at index `x - 1`.
Loop over the array. If the current value is not at its home index, swap it there. Otherwise move on.
Each swap puts at least one value in its final place, so there are at most `n` swaps and O(n) total work.

```js
function cyclicSort(nums) {
  let i = 0;
  while (i < nums.length) {
    const home = nums[i] - 1;
    if (nums[i] !== nums[home]) {
      [nums[i], nums[home]] = [nums[home], nums[i]];   // put nums[i] where it belongs, stay on i
    } else {
      i++;                                             // already home, or a duplicate of what is home
    }
  }
  return nums;
}

cyclicSort([3, 1, 5, 4, 2]); // [1, 2, 3, 4, 5]
```

Comparing `nums[i] !== nums[home]` (values) instead of `i !== home` (positions) is what makes the loop safe with **duplicates**.
With `i !== home` the array `[2, 2]` would swap forever.

### 6.3 Problem: Missing Number

Given `n` distinct numbers from `0..n`, find the one missing.
The value `n` has no index, so ignore it during the swaps.
After sorting, the first index where `nums[i] !== i` is the answer, or `n` if all match.

```js
function missingNumber(nums) {
  const n = nums.length;
  let i = 0;
  while (i < n) {
    const home = nums[i];
    if (home < n && nums[i] !== nums[home]) {
      [nums[i], nums[home]] = [nums[home], nums[i]];
    } else {
      i++;
    }
  }
  for (let k = 0; k < n; k++) {
    if (nums[k] !== k) return k;
  }
  return n;
}

missingNumber([4, 0, 3, 1]); // 2
missingNumber([0, 1]);       // 2
```

Dry run on `[4, 0, 3, 1]` (`n = 4`):

| i | array before | action |
| --- | --- | --- |
| 0 | [4, 0, 3, 1] | 4 is out of range, skip, i = 1 |
| 1 | [4, 0, 3, 1] | 0 belongs at 0, swap -> [0, 4, 3, 1] |
| 1 | [0, 4, 3, 1] | 4 out of range, skip, i = 2 |
| 2 | [0, 4, 3, 1] | 3 belongs at 3, swap -> [0, 4, 1, 3] |
| 2 | [0, 4, 1, 3] | 1 belongs at 1, swap -> [0, 1, 4, 3] |
| 2 | [0, 1, 4, 3] | 4 out of range, skip, i = 3 |
| 3 | [0, 1, 4, 3] | 3 is home, i = 4, loop ends |

Final scan: index 2 holds `4` instead of `2`, so `2` is missing.

Alternatives with the same complexity that are worth mentioning in an interview:

- Sum formula: `n * (n + 1) / 2 - sum(nums)`. Simplest, but the sum can overflow in fixed-width integer languages.
- XOR: XOR all indices `0..n` with all values. Pairs cancel and the missing number is left.

Cyclic sort mutates the input, which is worth stating out loud.

### 6.4 Extra Variants

**Find the duplicate** (`n + 1` values in `1..n`, exactly one repeated).
While swapping, if the value is already at its home index and this is a different position, we found the duplicate.

```js
function findDuplicate(nums) {
  let i = 0;
  while (i < nums.length) {
    if (nums[i] !== i + 1) {
      const home = nums[i] - 1;
      if (nums[i] !== nums[home]) {
        [nums[i], nums[home]] = [nums[home], nums[i]];
      } else {
        return nums[i];
      }
    } else {
      i++;
    }
  }
  return -1;
}

findDuplicate([1, 4, 4, 3, 2]); // 4
```

**All disappeared numbers** (values in `1..n`, some repeat, find the ones that never appear).
Run cyclic sort, then every index where `nums[i] !== i + 1` means `i + 1` is missing.

```js
function findDisappearedNumbers(nums) {
  let i = 0;
  while (i < nums.length) {
    const home = nums[i] - 1;
    if (nums[i] !== nums[home]) {
      [nums[i], nums[home]] = [nums[home], nums[i]];
    } else {
      i++;
    }
  }
  const missing = [];
  for (let k = 0; k < nums.length; k++) {
    if (nums[k] !== k + 1) missing.push(k + 1);
  }
  return missing;
}

findDisappearedNumbers([4, 3, 2, 7, 8, 2, 3, 1]); // [5, 6]
```

**First missing positive** (hard).
The array can hold negatives, zeros, and huge values.
The answer is always in `1..n + 1`, so only swap values in `1..n` and ignore the rest.

```js
function firstMissingPositive(nums) {
  const n = nums.length;
  let i = 0;
  while (i < n) {
    const home = nums[i] - 1;
    if (nums[i] > 0 && nums[i] <= n && nums[i] !== nums[home]) {
      [nums[i], nums[home]] = [nums[home], nums[i]];
    } else {
      i++;
    }
  }
  for (let k = 0; k < n; k++) {
    if (nums[k] !== k + 1) return k + 1;
  }
  return n + 1;
}

firstMissingPositive([3, 4, -1, 1]); // 2
firstMissingPositive([7, 8, 9]);     // 1
```

### 6.5 Pitfalls

- Advancing `i` after a swap. The value that just arrived at `i` has not been placed yet.
- Off by one between the `0..n` (home is `nums[i]`) and `1..n` (home is `nums[i] - 1`) ranges.
- Forgetting the range guard in the missing-number and first-missing-positive versions, which reads outside the array.
- Using the pattern when the range is not bounded by the array length. Then use a hash set.

### 6.6 Java Implementation

#### The Core Loop

```java
static int[] cyclicSort(int[] nums) {
    int i = 0;
    while (i < nums.length) {
        int home = nums[i] - 1;
        if (nums[i] != nums[home]) swap(nums, i, home);
        else i++;
    }
    return nums;
}
// cyclicSort(new int[]{3, 1, 5, 4, 2}) -> [1, 2, 3, 4, 5]
```

#### Missing Number

```java
static int missingNumber(int[] nums) {
    int n = nums.length;
    int i = 0;
    while (i < n) {
        int home = nums[i];
        if (home < n && nums[i] != nums[home]) swap(nums, i, home);
        else i++;
    }
    for (int k = 0; k < n; k++) {
        if (nums[k] != k) return k;
    }
    return n;
}
// missingNumber(new int[]{4, 0, 3, 1}) -> 2
```

The XOR alternative is one loop with no mutation:

```java
static int missingNumberXor(int[] nums) {
    int xor = nums.length;
    for (int i = 0; i < nums.length; i++) xor ^= i ^ nums[i];
    return xor;
}
```

#### Extra Variants

```java
static int findDuplicate(int[] nums) {
    int i = 0;
    while (i < nums.length) {
        if (nums[i] != i + 1) {
            int home = nums[i] - 1;
            if (nums[i] != nums[home]) swap(nums, i, home);
            else return nums[i];
        } else {
            i++;
        }
    }
    return -1;
}
// findDuplicate(new int[]{1, 4, 4, 3, 2}) -> 4
```

```java
static List<Integer> findDisappearedNumbers(int[] nums) {
    int i = 0;
    while (i < nums.length) {
        int home = nums[i] - 1;
        if (nums[i] != nums[home]) swap(nums, i, home);
        else i++;
    }
    List<Integer> missing = new ArrayList<>();
    for (int k = 0; k < nums.length; k++) {
        if (nums[k] != k + 1) missing.add(k + 1);
    }
    return missing;
}
// findDisappearedNumbers(new int[]{4, 3, 2, 7, 8, 2, 3, 1}) -> [5, 6]
```

```java
static int firstMissingPositive(int[] nums) {
    int n = nums.length;
    int i = 0;
    while (i < n) {
        int v = nums[i];
        if (v > 0 && v <= n && nums[v - 1] != v) swap(nums, i, v - 1);
        else i++;
    }
    for (int k = 0; k < n; k++) {
        if (nums[k] != k + 1) return k + 1;
    }
    return n + 1;
}
// firstMissingPositive(new int[]{3, 4, -1, 1}) -> 2
```

In Java the range check `v > 0 && v <= n` **must** come before `nums[v - 1]`, otherwise an out-of-range value throws `ArrayIndexOutOfBoundsException`.

---

## 7. In-Place Reversal of a Linked List

### 7.1 When to Use

- You are asked to reverse a list, a sublist, or every group of `k` nodes.
- The problem requires O(1) extra space, so you cannot copy into an array.
- Palindrome checks and "reorder list" need the second half reversed.

### 7.2 Core Idea

Walk the list and flip each `next` pointer to point backwards.
You need three references: `prev`, `curr`, and a saved `next` so you do not lose the rest of the list.

```text
before:  null   1 -> 2 -> 3 -> 4 -> null
                ^
               curr, prev = null

step:    save next = curr.next
         curr.next = prev
         prev = curr
         curr = next

after:   null <- 1 <- 2 <- 3 <- 4     prev = 4 is the new head
```

### 7.3 Problem: Reverse a Linked List

```js
function reverseList(head) {
  let prev = null;
  let curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}

toArray(reverseList(fromArray([1, 2, 3, 4, 5]))); // [5, 4, 3, 2, 1]
```

The recursive version is shorter but uses O(n) stack:

```js
function reverseListRecursive(head) {
  if (!head || !head.next) return head;
  const newHead = reverseListRecursive(head.next);
  head.next.next = head;
  head.next = null;
  return newHead;
}
```

### 7.4 Problem: Reverse a Sublist (positions left to right)

Reverse only the nodes between positions `left` and `right` (1-indexed) and keep the rest.

Walk to the node just **before** the sublist, then repeatedly take the node after the sublist head and move it to the front.
This head-insertion technique reverses in one pass without tracking two extra pointers.

```js
function reverseBetween(head, left, right) {
  const dummy = new ListNode(0, head);
  let before = dummy;
  for (let i = 1; i < left; i++) before = before.next;

  const start = before.next;      // becomes the tail of the reversed segment
  let then = start.next;
  for (let i = 0; i < right - left; i++) {
    start.next = then.next;
    then.next = before.next;
    before.next = then;
    then = start.next;
  }
  return dummy.next;
}

toArray(reverseBetween(fromArray([1, 2, 3, 4, 5]), 2, 4)); // [1, 4, 3, 2, 5]
```

Dry run on `1 -> 2 -> 3 -> 4 -> 5`, `left = 2`, `right = 4`:

| Iteration | List after | Notes |
| --- | --- | --- |
| start | 1, 2, 3, 4, 5 | `before` = 1, `start` = 2, `then` = 3 |
| 1 | 1, 3, 2, 4, 5 | 3 moved to the front of the segment |
| 2 | 1, 4, 3, 2, 5 | 4 moved to the front of the segment |

The dummy node makes `left = 1` work without a special case.

### 7.5 Extra Variants

**Reverse nodes in k-group.**
Reverse each block of exactly `k` nodes and leave a shorter tail block as it is.

```js
function reverseKGroup(head, k) {
  const dummy = new ListNode(0, head);
  let groupPrev = dummy;
  while (true) {
    let kth = groupPrev;
    for (let i = 0; i < k && kth; i++) kth = kth.next;
    if (!kth) break;                                   // fewer than k nodes left

    const groupNext = kth.next;
    let prev = groupNext;
    let curr = groupPrev.next;
    while (curr !== groupNext) {
      const next = curr.next;
      curr.next = prev;
      prev = curr;
      curr = next;
    }
    const oldFirst = groupPrev.next;                   // now the tail of the reversed block
    groupPrev.next = kth;
    groupPrev = oldFirst;
  }
  return dummy.next;
}

toArray(reverseKGroup(fromArray([1, 2, 3, 4, 5]), 2)); // [2, 1, 4, 3, 5]
```

Trick: setting `prev = groupNext` at the start means the reversed block's tail automatically links to the next block.

**Palindrome linked list** in O(1) space.
Find the middle with fast/slow pointers, reverse the second half, compare with the first half, then reverse again to restore the list.

```js
function isPalindromeList(head) {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
  }
  const secondHalf = reverseList(slow);
  let p1 = head;
  let p2 = secondHalf;
  let ok = true;
  while (p2) {
    if (p1.val !== p2.val) {
      ok = false;
      break;
    }
    p1 = p1.next;
    p2 = p2.next;
  }
  reverseList(secondHalf);                             // restore the original list
  return ok;
}

isPalindromeList(fromArray([1, 2, 2, 1])); // true
isPalindromeList(fromArray([1, 2, 3]));    // false
```

Restoring the list is a courtesy that interviewers like.
Say whether the problem allows mutation.

**Rotate list** by `k` places: find the length, connect tail to head, then break the ring at `length - k % length`.
**Reorder list** (`L0 -> Ln -> L1 -> Ln-1 ...`): find the middle, reverse the second half, then interleave.
**Swap nodes in pairs** is `reverseKGroup` with `k = 2`.

### 7.6 Pitfalls

- Losing the rest of the list by overwriting `curr.next` before saving it.
- Forgetting to set the old head's `next` to `null` (the recursive version does it with `head.next = null`), which leaves a cycle.
- Off by one on sublist positions. Draw the pointers for a 5 node list before coding.
- Returning `head` instead of `prev` (or `dummy.next`) from the iterative reversal.

### 7.7 Java Implementation

#### Reverse a Linked List

```java
static ListNode reverseList(ListNode head) {
    ListNode prev = null;
    ListNode curr = head;
    while (curr != null) {
        ListNode next = curr.next;
        curr.next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
}
// toList(reverseList(fromArray(1, 2, 3, 4, 5))) -> [5, 4, 3, 2, 1]
```

Recursive version (O(n) stack, the JVM default stack overflows at roughly 10 to 20 thousand frames):

```java
static ListNode reverseListRecursive(ListNode head) {
    if (head == null || head.next == null) return head;
    ListNode newHead = reverseListRecursive(head.next);
    head.next.next = head;
    head.next = null;
    return newHead;
}
```

#### Reverse a Sublist

```java
static ListNode reverseBetween(ListNode head, int left, int right) {
    ListNode dummy = new ListNode(0, head);
    ListNode before = dummy;
    for (int i = 1; i < left; i++) before = before.next;

    ListNode start = before.next;
    ListNode then = start.next;
    for (int i = 0; i < right - left; i++) {
        start.next = then.next;
        then.next = before.next;
        before.next = then;
        then = start.next;
    }
    return dummy.next;
}
// toList(reverseBetween(fromArray(1, 2, 3, 4, 5), 2, 4)) -> [1, 4, 3, 2, 5]
```

#### Extra Variants

**Reverse nodes in k-group.**

```java
static ListNode reverseKGroup(ListNode head, int k) {
    ListNode dummy = new ListNode(0, head);
    ListNode groupPrev = dummy;
    while (true) {
        ListNode kth = groupPrev;
        for (int i = 0; i < k && kth != null; i++) kth = kth.next;
        if (kth == null) break;

        ListNode groupNext = kth.next;
        ListNode prev = groupNext;
        ListNode curr = groupPrev.next;
        while (curr != groupNext) {
            ListNode next = curr.next;
            curr.next = prev;
            prev = curr;
            curr = next;
        }
        ListNode oldFirst = groupPrev.next;
        groupPrev.next = kth;
        groupPrev = oldFirst;
    }
    return dummy.next;
}
// toList(reverseKGroup(fromArray(1, 2, 3, 4, 5), 2)) -> [2, 1, 4, 3, 5]
```

**Palindrome linked list** in O(1) space.

```java
static boolean isPalindromeList(ListNode head) {
    ListNode slow = head;
    ListNode fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
    }
    ListNode secondHalf = reverseList(slow);
    ListNode p1 = head;
    ListNode p2 = secondHalf;
    boolean ok = true;
    while (p2 != null) {
        if (p1.val != p2.val) {
            ok = false;
            break;
        }
        p1 = p1.next;
        p2 = p2.next;
    }
    reverseList(secondHalf);
    return ok;
}
// isPalindromeList(fromArray(1, 2, 2, 1)) -> true
```

Compare `val` fields with `!=` only because they are primitive `int`.
If the node held an `Integer`, `p1.val != p2.val` would compare references, see the pitfalls below.

---

## 8. Java Pitfalls

- **`Integer` comparison with `==`.** `Integer a = 127, b = 127; a == b` is `true` because of the small-value cache, but `Integer a = 1000, b = 1000; a == b` is `false`. Use `equals`, or unbox to `int`. This bites when you read values out of a `Map<Character, Integer>` or a `List<Integer>`.
- **`a[0] - b[0]` in comparators overflows.** Use `Integer.compare`.
- **`int` overflow is silent.** Sums, products, and `mid = (lo + hi) / 2` can wrap negative. Use `long`, or `lo + (hi - lo) / 2`.
- **`Arrays.sort(int[])` versus `Arrays.sort(Integer[], comparator)`.** A comparator only works on object arrays. `int[][]` is an object array (its rows are objects), so `Arrays.sort(int[][], comparator)` works, but `Arrays.sort(int[], comparator)` does not compile.
- **`Arrays.asList(int[])` gives a `List<int[]>` of one element**, not a list of ints. It only unpacks for `Integer[]` or varargs of boxed values.
- **`char` arithmetic yields `int`.** `s.charAt(i) - 'a'` is an `int` index into a 26 element array. Assigning back to `char` needs a cast.
- **`String` concatenation in a loop is O(n²).** Use `StringBuilder`.
- **`ArrayList.remove(int)` versus `remove(Object)`.** On a `List<Integer>`, `list.remove(1)` removes **index** 1. Use `list.remove(Integer.valueOf(1))` to remove the value.
- **`List.toArray(new int[0][])`** is how a `List<int[]>` becomes an `int[][]`. `toArray()` alone returns `Object[]`.
- **Do not modify a collection while iterating it** with for-each, you get `ConcurrentModificationException`. Use an `Iterator` and `remove`, or `removeIf`.

---

## 9. Quick Recap

| Pattern | Signal in the problem | Data structure | Time | Space |
| --- | --- | --- | --- | --- |
| Sliding window | Contiguous subarray or substring, longest or shortest | Map or counter for window state | O(n) | O(1) to O(k) |
| Two pointers | Sorted array, pairs, palindromes, in-place partition | Just indices | O(n) after sort | O(1) |
| Fast and slow | Cycle, middle, kth from end, O(1) space list | Just pointers | O(n) | O(1) |
| Merge intervals | Overlap, merge, insert, rooms | Sorted array, sometimes a heap | O(n log n) | O(n) |
| Cyclic sort | Values in `1..n` or `0..n`, missing or duplicate | The array itself | O(n) | O(1) |
| In-place reversal | Reverse a list or part of it, palindrome list | Pointers, dummy node | O(n) | O(1) |

Next: [Trees, Heaps, Search and Graphs](/docs/dsa/trees-graphs-and-search) covers the remaining eight patterns.
