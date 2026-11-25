---
title: "Subarrays and String Matching"
description: "Maximum subarray with Kadane's algorithm, naive and Rabin-Karp pattern matching, and KMP search with the failure table, with dry runs, variants, pitfalls, and JavaScript and Java code."
---

# 📘 Subarrays and String Matching

This page covers three topics that share one idea: **reuse what you already know instead of starting over**.
Kadane's algorithm reuses the best subarray ending at the previous index.
Rabin-Karp reuses the previous window's hash.
KMP reuses the part of the pattern that already matched.
Each section has recognition signals, a core idea, a worked problem with a dry run, variants, pitfalls, and a **Java Implementation** subsection.
JavaScript and Java code is included, and every snippet on this page was executed against test cases.
Java conventions: all methods are `static` members of one `Solution` class, `import java.util.*;` is assumed, and the trailing `//` comments show a sample call and its result.
For the window-based relatives of these problems, see [Sliding Window](/docs/dsa/arrays-and-linked-lists#2-sliding-window) and [Prefix Sum and Hash Map](/docs/dsa/pattern-playbook#61-prefix-sum-and-hash-map).

## Table of Contents

1. [Maximum Subarray (Kadane)](#1-maximum-subarray-kadane)
2. [Pattern Matching](#2-pattern-matching)
3. [KMP Search](#3-kmp-search)
4. [Java Pitfalls](#4-java-pitfalls)
5. [Quick Recap](#5-quick-recap)

---

## 1. Maximum Subarray (Kadane)

### 1.1 When to Use

- The input is an array of numbers that **may be negative**, and the answer is the **best contiguous subarray**.
- Keywords: "maximum subarray", "largest sum contiguous", "best run", "maximum profit over consecutive days".
- A sliding window does not work, because with negative numbers neither shrinking nor growing the window has a clear effect on the sum.
- The brute force is O(n^2) or O(n^3), and you want O(n) time with O(1) space.

### 1.2 Core Idea

At each index `i`, ask one question: what is the best sum of a subarray that **ends at `i`**?
There are only two choices.
Either the subarray is just `nums[i]` alone, or it extends the best subarray that ended at `i - 1`.

```text
endingHere[i] = max(nums[i], endingHere[i - 1] + nums[i])
answer        = max over all i of endingHere[i]
```

If the running sum before `i` is negative, carrying it forward can only hurt, so **restart at `i`**.
This is a one-state dynamic program, and keeping only the previous value gives O(1) space.

Prefix-sum view of the same fact: the best subarray ending at `j` is `P[j] - min(P[i])` for `i < j`, where `P` is the prefix sum.
Kadane tracks that minimum implicitly.

| Method | Time | Space |
| --- | --- | --- |
| Brute force over all pairs, running sum | O(n^2) | O(1) |
| Divide and conquer (left, right, crossing) | O(n log n) | O(log n) |
| Kadane | O(n) | O(1) |

### 1.3 Problem: Maximum Subarray

LeetCode 53.
Given `nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]`, return `6` (the subarray `[4, -1, 2, 1]`).

```js
function maxSubArray(nums) {
  let endingHere = nums[0];
  let best = nums[0];
  for (let i = 1; i < nums.length; i++) {
    endingHere = Math.max(nums[i], endingHere + nums[i]);   // restart or extend
    best = Math.max(best, endingHere);
  }
  return best;
}

maxSubArray([-2, 1, -3, 4, -1, 2, 1, -5, 4]); // 6
maxSubArray([1]); // 1
maxSubArray([5, 4, -1, 7, 8]); // 23
maxSubArray([-3, -1, -2]); // -1
```

Dry run on `[-2, 1, -3, 4, -1, 2, 1, -5, 4]`:

| i | nums[i] | endingHere before | Decision | endingHere after | best |
| --- | --- | --- | --- | --- | --- |
| 0 | -2 | - | start | -2 | -2 |
| 1 | 1 | -2 | restart (1 > -1) | 1 | 1 |
| 2 | -3 | 1 | extend (-2 > -3) | -2 | 1 |
| 3 | 4 | -2 | restart (4 > 2) | 4 | 4 |
| 4 | -1 | 4 | extend | 3 | 4 |
| 5 | 2 | 3 | extend | 5 | 5 |
| 6 | 1 | 5 | extend | 6 | 6 |
| 7 | -5 | 6 | extend | 1 | 6 |
| 8 | 4 | 1 | extend | 5 | 6 |

The answer is `6`.
The subarray started at the last restart, index `3`, and ended where `best` last improved, index `6`.

To return the **indices** as well, remember where the current run started.

```js
function maxSubArrayRange(nums) {
  let endingHere = nums[0];
  let start = 0;
  let best = nums[0];
  let bestStart = 0;
  let bestEnd = 0;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] > endingHere + nums[i]) {
      endingHere = nums[i];                   // restart: the run begins at i
      start = i;
    } else {
      endingHere += nums[i];
    }
    if (endingHere > best) {
      best = endingHere;
      bestStart = start;
      bestEnd = i;
    }
  }
  return { sum: best, from: bestStart, to: bestEnd };
}

maxSubArrayRange([-2, 1, -3, 4, -1, 2, 1, -5, 4]); // { sum: 6, from: 3, to: 6 }
```

### 1.4 Extra Variants

**Maximum product subarray** (LeetCode 152).
A negative number flips the biggest product into the smallest, so track both the maximum and the minimum ending at `i`.

```js
function maxProduct(nums) {
  let maxEnd = nums[0];
  let minEnd = nums[0];
  let best = nums[0];
  for (let i = 1; i < nums.length; i++) {
    const x = nums[i];
    const candidates = [x, maxEnd * x, minEnd * x];
    maxEnd = Math.max(...candidates);
    minEnd = Math.min(...candidates);
    best = Math.max(best, maxEnd);
  }
  return best;
}

maxProduct([2, 3, -2, 4]); // 6
maxProduct([-2, 0, -1]); // 0
maxProduct([-2, 3, -4]); // 24
```

**Maximum sum circular subarray** (LeetCode 918).
The best subarray either does not wrap, which is plain Kadane, or it wraps around the end.
A wrapping subarray is the total minus a **minimum** subarray in the middle.
If every number is negative, the "total minus minimum" candidate would be the empty subarray, so return plain Kadane.

```js
function maxSubarraySumCircular(nums) {
  let total = 0;
  let maxEnd = 0;
  let minEnd = 0;
  let maxBest = -Infinity;
  let minBest = Infinity;
  for (const x of nums) {
    total += x;
    maxEnd = Math.max(x, maxEnd + x);
    maxBest = Math.max(maxBest, maxEnd);
    minEnd = Math.min(x, minEnd + x);
    minBest = Math.min(minBest, minEnd);
  }
  return maxBest < 0 ? maxBest : Math.max(maxBest, total - minBest);
}

maxSubarraySumCircular([1, -2, 3, -2]); // 3
maxSubarraySumCircular([5, -3, 5]); // 10
maxSubarraySumCircular([-3, -2, -3]); // -2
```

**Best time to buy and sell stock** (LeetCode 121) is Kadane on the day-to-day differences.
The maximum subarray of `prices[i] - prices[i - 1]` is the best profit.

```js
function maxProfit(prices) {
  let endingHere = 0;
  let best = 0;
  for (let i = 1; i < prices.length; i++) {
    endingHere = Math.max(0, endingHere + prices[i] - prices[i - 1]);
    best = Math.max(best, endingHere);
  }
  return best;
}

maxProfit([7, 1, 5, 3, 6, 4]); // 5
maxProfit([7, 6, 4, 3, 1]); // 0
```

### 1.5 Pitfalls

- **Starting `best` at `0`.** That is right only if the empty subarray is allowed.
  With `[-3, -1, -2]` the answer is `-1`, and a `best = 0` start returns `0`.
  Start from `nums[0]`, or from `-Infinity`.
- **Resetting to `0` instead of to `nums[i]`.** The "reset to zero when negative" form is fine only if `best` is updated first and all-negative input is handled separately.
- **Confusing subarray and subsequence.** A subarray is contiguous.
  The best subsequence would just add every positive number.
- **Max product without the minimum.** `[-2, 3, -4]` gives 24 only because the minimum `-6` becomes the maximum after the second negative.
- **Circular case with all negatives.** `total - minBest` equals zero (the empty array) and wrongly beats every real answer.
- **Overflow in Java.** Sums of up to 10^5 values near 10^9 do not fit in `int`.
  Use `long`.

### 1.6 Java Implementation

```java
static int maxSubArray(int[] nums) {
    int endingHere = nums[0];
    int best = nums[0];
    for (int i = 1; i < nums.length; i++) {
        endingHere = Math.max(nums[i], endingHere + nums[i]);
        best = Math.max(best, endingHere);
    }
    return best;
}
// maxSubArray(new int[]{-2, 1, -3, 4, -1, 2, 1, -5, 4}) -> 6
// maxSubArray(new int[]{-3, -1, -2}) -> -1

static int[] maxSubArrayRange(int[] nums) {
    int endingHere = nums[0];
    int start = 0;
    int best = nums[0];
    int bestStart = 0;
    int bestEnd = 0;
    for (int i = 1; i < nums.length; i++) {
        if (nums[i] > endingHere + nums[i]) {
            endingHere = nums[i];
            start = i;
        } else {
            endingHere += nums[i];
        }
        if (endingHere > best) {
            best = endingHere;
            bestStart = start;
            bestEnd = i;
        }
    }
    return new int[]{best, bestStart, bestEnd};
}
// maxSubArrayRange(new int[]{-2, 1, -3, 4, -1, 2, 1, -5, 4}) -> [6, 3, 6]
```

```java
static int maxProduct(int[] nums) {
    int maxEnd = nums[0];
    int minEnd = nums[0];
    int best = nums[0];
    for (int i = 1; i < nums.length; i++) {
        int x = nums[i];
        int a = maxEnd * x;
        int b = minEnd * x;
        maxEnd = Math.max(x, Math.max(a, b));
        minEnd = Math.min(x, Math.min(a, b));
        best = Math.max(best, maxEnd);
    }
    return best;
}
// maxProduct(new int[]{2, 3, -2, 4}) -> 6
// maxProduct(new int[]{-2, 3, -4}) -> 24

static int maxSubarraySumCircular(int[] nums) {
    int total = 0;
    int maxEnd = 0;
    int minEnd = 0;
    int maxBest = Integer.MIN_VALUE;
    int minBest = Integer.MAX_VALUE;
    for (int x : nums) {
        total += x;
        maxEnd = Math.max(x, maxEnd + x);
        maxBest = Math.max(maxBest, maxEnd);
        minEnd = Math.min(x, minEnd + x);
        minBest = Math.min(minBest, minEnd);
    }
    return maxBest < 0 ? maxBest : Math.max(maxBest, total - minBest);
}
// maxSubarraySumCircular(new int[]{5, -3, 5}) -> 10
// maxSubarraySumCircular(new int[]{-3, -2, -3}) -> -2

static int maxProfit(int[] prices) {
    int endingHere = 0;
    int best = 0;
    for (int i = 1; i < prices.length; i++) {
        endingHere = Math.max(0, endingHere + prices[i] - prices[i - 1]);
        best = Math.max(best, endingHere);
    }
    return best;
}
// maxProfit(new int[]{7, 1, 5, 3, 6, 4}) -> 5
```

---

## 2. Pattern Matching

### 2.1 When to Use

- You must find where a **pattern string occurs inside a longer text**: first occurrence, all occurrences, or a count.
- Keywords: "find the index of the first occurrence", "needle in a haystack", "substring search", "does `s` contain `t`".
- This is the base problem behind `indexOf`, `Ctrl+F`, plagiarism detection, and DNA search.
- Choose the algorithm from the constraints:

| Algorithm | Time (text length `n`, pattern length `m`) | Extra space | Pick it when |
| --- | --- | --- | --- |
| Naive | O(n * m) worst, often near O(n) | O(1) | Inputs are small, or you only need the idea |
| Rabin-Karp | O(n + m) expected, O(n * m) worst | O(1) | Many patterns of one length, or 2D matching |
| KMP | O(n + m) always | O(m) | You need a guaranteed bound ([next section](#3-kmp-search)) |
| Library `indexOf` | Implementation defined | - | Production code, unless the interviewer says write it |

### 2.2 Core Idea

Slide the pattern across the text one position (a **shift**) at a time.
At each shift, compare characters left to right and stop at the first mismatch.
A shift where all `m` characters agree is a match at that start index.

```text
text:     A A B A A C A A D A A B A A B A
shift 0:  A A B A         match at 0
shift 1:    A A B A       A = A, then B != A, stop
shift 2:      A A B A     B != A, stop
```

The naive method throws away everything it learned at a mismatch and restarts at the next shift.
Two ideas fix that:

- **Rabin-Karp** compares a cheap **fingerprint** (a rolling hash) of each window to the pattern's hash, and runs the character comparison only when the hashes agree.
- **KMP** keeps a table that says how far the pattern can safely slide back after a mismatch, so the text pointer never moves backwards.

A rolling hash updates in O(1) when the window moves one character.
Treat the window as a number in base `B`, then drop the leading character and append the new one:

```text
hash(window at i+1) = ((hash(window at i) - text[i] * B^(m-1)) * B + text[i+m]) mod M
```

### 2.3 Problem: Find All Occurrences

Return every index where `pattern` starts in `text`.
Take `text = "AABAACAADAABAABA"` and `pattern = "AABA"`.
The answer is `[0, 9, 12]`.

```js
function naiveSearch(text, pattern) {
  const n = text.length;
  const m = pattern.length;
  const out = [];
  if (m === 0 || m > n) return out;
  for (let shift = 0; shift <= n - m; shift++) {
    let k = 0;
    while (k < m && text[shift + k] === pattern[k]) k++;
    if (k === m) out.push(shift);
  }
  return out;
}

naiveSearch("AABAACAADAABAABA", "AABA"); // [0,9,12]
naiveSearch("aaaa", "aa"); // [0,1,2]
naiveSearch("hello", "ll"); // [2]
naiveSearch("hello", "xyz"); // []
naiveSearch("abc", ""); // []
```

Dry run for `pattern = "AABA"`.
"Compares" counts character comparisons made at that shift, including the one that failed.

| Shift | Window | Result | Compares |
| --- | --- | --- | --- |
| 0 | AABA | match | 4 |
| 1 | ABAA | mismatch at position 1 | 2 |
| 2 | BAAC | mismatch at position 0 | 1 |
| 3 | AACA | mismatch at position 2 | 3 |
| 4 | ACAA | mismatch at position 1 | 2 |
| 5 | CAAD | mismatch at position 0 | 1 |
| 6 | AADA | mismatch at position 2 | 3 |
| 7 | ADAA | mismatch at position 1 | 2 |
| 8 | DAAB | mismatch at position 0 | 1 |
| 9 | AABA | match | 4 |
| 10 | ABAA | mismatch at position 1 | 2 |
| 11 | BAAB | mismatch at position 0 | 1 |
| 12 | AABA | match | 4 |

Total: 30 comparisons for a 16-character text.
Typical text mismatches early, which is why the naive method is usually fast.

The **worst case** is a text and pattern that agree for almost the whole pattern at every shift, such as `"aaaaaaaaaa"` and `"aaab"`.

```js
function naiveComparisons(text, pattern) {
  let count = 0;
  for (let shift = 0; shift <= text.length - pattern.length; shift++) {
    for (let k = 0; k < pattern.length; k++) {
      count++;
      if (text[shift + k] !== pattern[k]) break;
    }
  }
  return count;
}

naiveComparisons("AABAACAADAABAABA", "AABA"); // 30
naiveComparisons("aaaaaaaaaa", "aaab"); // 28
```

That is `(n - m + 1) * m = 7 * 4 = 28` comparisons, the O(n * m) behavior.

### 2.4 Rabin-Karp

Hash the pattern once, then roll the hash across the text.
On a hash hit, **verify** with a real comparison, because two different strings can share a hash (a **collision**).

```js
function rabinKarp(text, pattern) {
  const n = text.length;
  const m = pattern.length;
  const out = [];
  if (m === 0 || m > n) return out;

  const BASE = 256;
  const MOD = 1_000_000_007;
  let high = 1;                                  // BASE^(m-1) mod MOD
  for (let i = 0; i < m - 1; i++) high = (high * BASE) % MOD;

  let patternHash = 0;
  let windowHash = 0;
  for (let i = 0; i < m; i++) {
    patternHash = (patternHash * BASE + pattern.charCodeAt(i)) % MOD;
    windowHash = (windowHash * BASE + text.charCodeAt(i)) % MOD;
  }

  for (let i = 0; i <= n - m; i++) {
    if (windowHash === patternHash && text.startsWith(pattern, i)) out.push(i);
    if (i < n - m) {
      const drop = (text.charCodeAt(i) * high) % MOD;
      windowHash = ((windowHash - drop + MOD) * BASE + text.charCodeAt(i + m)) % MOD;
    }
  }
  return out;
}

rabinKarp("AABAACAADAABAABA", "AABA"); // [0,9,12]
rabinKarp("aaaa", "aa"); // [0,1,2]
rabinKarp("hello", "xyz"); // []
```

Every intermediate product stays below 2^53 here (`MOD` is about 10^9 and `BASE` is 256), so plain JavaScript numbers are exact.
A larger base or modulus needs `BigInt`.

Expected time is O(n + m).
A bad hash or an adversarial input makes many windows collide, and each collision costs an O(m) verification, so the worst case is O(n * m).

### 2.5 Extra Variants

**Implement `strStr`** (LeetCode 28).
Return the first index, or `-1`.
An empty needle returns `0` by the problem statement.

```js
function strStr(haystack, needle) {
  if (needle.length === 0) return 0;
  for (let shift = 0; shift + needle.length <= haystack.length; shift++) {
    if (haystack.startsWith(needle, shift)) return shift;
  }
  return -1;
}

strStr("sadbutsad", "sad"); // 0
strStr("leetcode", "leeto"); // -1
strStr("a", ""); // 0
```

**Count occurrences of a pattern** is `naiveSearch(...).length`.
Decide whether overlapping matches count: `"aaaa"` contains `"aa"` three times with overlap and twice without.

**Search several patterns at once** is the job of a [Trie](/docs/dsa/pattern-playbook#65-trie) or the Aho-Corasick automaton, which is KMP generalized to a set of patterns.

### 2.6 Pitfalls

- **Off-by-one in the shift bound.** The last valid start is `n - m`, and the loop condition is `shift <= n - m`.
  With `<` you miss a match at the very end.
- **Empty pattern.** Decide up front: an empty list of matches, or `0` as `strStr` demands.
- **Pattern longer than the text.** `n - m` is negative and the loop body never runs, which is correct, but a subtraction on unsigned types would wrap.
- **Slicing inside the loop.** `text.slice(i, i + m) === pattern` allocates a string per shift, turning a cheap check into O(m) copies.
  Compare in place or use `startsWith(pattern, i)`.
- **Trusting a hash match.** A matching Rabin-Karp hash is only a candidate.
  Verify before reporting it.
- **Negative remainder in the rolling hash.** `(windowHash - drop)` can be negative, so add `MOD` before multiplying and taking the remainder.
- **Overflow in Java.** `hash * BASE` overflows `int`.
  Use `long` for every intermediate value.

### 2.7 Java Implementation

```java
static List<Integer> naiveSearch(String text, String pattern) {
    int n = text.length();
    int m = pattern.length();
    List<Integer> out = new ArrayList<>();
    if (m == 0 || m > n) return out;
    for (int shift = 0; shift <= n - m; shift++) {
        int k = 0;
        while (k < m && text.charAt(shift + k) == pattern.charAt(k)) k++;
        if (k == m) out.add(shift);
    }
    return out;
}
// naiveSearch("AABAACAADAABAABA", "AABA") -> [0, 9, 12]
// naiveSearch("aaaa", "aa") -> [0, 1, 2]

static int naiveComparisons(String text, String pattern) {
    int count = 0;
    for (int shift = 0; shift <= text.length() - pattern.length(); shift++) {
        for (int k = 0; k < pattern.length(); k++) {
            count++;
            if (text.charAt(shift + k) != pattern.charAt(k)) break;
        }
    }
    return count;
}
// naiveComparisons("AABAACAADAABAABA", "AABA") -> 30
// naiveComparisons("aaaaaaaaaa", "aaab") -> 28
```

```java
static List<Integer> rabinKarp(String text, String pattern) {
    int n = text.length();
    int m = pattern.length();
    List<Integer> out = new ArrayList<>();
    if (m == 0 || m > n) return out;

    final long BASE = 256;
    final long MOD = 1_000_000_007L;
    long high = 1;
    for (int i = 0; i < m - 1; i++) high = (high * BASE) % MOD;

    long patternHash = 0;
    long windowHash = 0;
    for (int i = 0; i < m; i++) {
        patternHash = (patternHash * BASE + pattern.charAt(i)) % MOD;
        windowHash = (windowHash * BASE + text.charAt(i)) % MOD;
    }

    for (int i = 0; i <= n - m; i++) {
        if (windowHash == patternHash && text.startsWith(pattern, i)) out.add(i);
        if (i < n - m) {
            long drop = (text.charAt(i) * high) % MOD;
            windowHash = ((windowHash - drop + MOD) * BASE + text.charAt(i + m)) % MOD;
        }
    }
    return out;
}
// rabinKarp("AABAACAADAABAABA", "AABA") -> [0, 9, 12]
// rabinKarp("hello", "xyz") -> []

static int strStr(String haystack, String needle) {
    return haystack.indexOf(needle);
}
// strStr("sadbutsad", "sad") -> 0
// strStr("leetcode", "leeto") -> -1
```

`String.indexOf` already returns `-1` when absent and `0` for an empty needle, so it matches the `strStr` contract.
Write the shift loop by hand in an interview, and mention `indexOf` as the library answer.

---

## 3. KMP Search

### 3.1 When to Use

- You need substring search with a **guaranteed O(n + m)** bound, or the text arrives as a stream you can read only once.
- The pattern has **repeated structure** (`"aaaa"`, `"abababc"`), where the naive method does the most wasted work.
- A problem asks about the **border** of a string, which is a prefix that is also a suffix: repeated substring, shortest palindrome by adding characters in front, string period.
- Keywords: "prefix function", "failure function", "LPS array", "longest prefix which is also a suffix".

### 3.2 Core Idea

Suppose the pattern `ababaca` has matched `ababa` and the next text character is not `c`.
The naive method restarts the pattern one position to the right and re-reads text it has already seen.
But the matched part `ababa` ends with `aba`, which is also the **start** of the pattern.
So the pattern can slide until its prefix `aba` lines up with the end of the text we already matched, and the text pointer does not move back.

The failure table makes that precise.
`lps[i]` is the length of the **longest proper prefix of `pattern[0..i]` that is also a suffix** of `pattern[0..i]`.
"Proper" means it is shorter than the whole substring.

```text
pattern: a b a b a c a
index:   0 1 2 3 4 5 6
lps:     0 0 1 2 3 0 1
```

Reading the table: `lps[4] = 3` because `pattern[0..4] = "ababa"` has the border `"aba"`.

**Using the table in the search.**
Keep `j`, the number of pattern characters currently matched.

1. If `text[i] === pattern[j]`, advance `j`.
2. If they differ and `j > 0`, fall back with `j = lps[j - 1]` and compare again, without moving `i`.
3. If they differ and `j === 0`, just move on to the next text character.
4. When `j === m`, record a match at `i - m + 1`, then set `j = lps[m - 1]` so overlapping matches are found.

The text index `i` only moves forward.
`j` rises by at most one per text character and every fallback lowers it, so the total number of fallbacks is at most `n`.
That is why the search is O(n), and building the table is O(m) by the same argument.

### 3.3 Problem: Build the Table, Then Search

First the table.
The construction is the same fallback logic run on the pattern against itself.

```js
function buildLps(pattern) {
  const lps = new Array(pattern.length).fill(0);
  let len = 0;                                  // length of the current border
  let i = 1;
  while (i < pattern.length) {
    if (pattern[i] === pattern[len]) {
      len++;
      lps[i] = len;
      i++;
    } else if (len > 0) {
      len = lps[len - 1];                       // try a shorter border, do not advance i
    } else {
      lps[i] = 0;
      i++;
    }
  }
  return lps;
}

buildLps("ababaca"); // [0,0,1,2,3,0,1]
buildLps("abcaby"); // [0,0,0,1,2,0]
buildLps("aabaaab"); // [0,1,0,1,2,2,3]
buildLps("aaaa"); // [0,1,2,3]
```

Dry run of `buildLps("ababaca")`:

| i | Compare | Action | lps so far |
| --- | --- | --- | --- |
| 1 | `b` vs `a` (len 0) | no border, `lps[1] = 0` | `[0,0,_,_,_,_,_]` |
| 2 | `a` vs `a` | `len = 1`, `lps[2] = 1` | `[0,0,1,_,_,_,_]` |
| 3 | `b` vs `b` | `len = 2`, `lps[3] = 2` | `[0,0,1,2,_,_,_]` |
| 4 | `a` vs `a` | `len = 3`, `lps[4] = 3` | `[0,0,1,2,3,_,_]` |
| 5 | `c` vs `b` | mismatch, `len = lps[2] = 1` | unchanged |
| 5 | `c` vs `b` | mismatch again, `len = lps[0] = 0` | unchanged |
| 5 | `c` vs `a` (len 0) | `lps[5] = 0` | `[0,0,1,2,3,0,_]` |
| 6 | `a` vs `a` | `len = 1`, `lps[6] = 1` | `[0,0,1,2,3,0,1]` |

Now the search.

```js
function kmpSearch(text, pattern) {
  const out = [];
  if (pattern.length === 0) return out;
  const lps = buildLps(pattern);
  let j = 0;                                    // pattern characters matched so far
  for (let i = 0; i < text.length; i++) {
    while (j > 0 && text[i] !== pattern[j]) j = lps[j - 1];   // fall back
    if (text[i] === pattern[j]) j++;
    if (j === pattern.length) {
      out.push(i - j + 1);
      j = lps[j - 1];                           // keep going for overlapping matches
    }
  }
  return out;
}

kmpSearch("abxabcabcaby", "abcaby"); // [6]
kmpSearch("AABAACAADAABAABA", "AABA"); // [0,9,12]
kmpSearch("aaaa", "aa"); // [0,1,2]
kmpSearch("ababababa", "ababa"); // [0,2,4]
kmpSearch("hello", "xyz"); // []
```

Dry run for `text = "abxabcabcaby"` and `pattern = "abcaby"`, whose table is `[0,0,0,1,2,0]`:

| i | text[i] | j before | Fallbacks | j after | Note |
| --- | --- | --- | --- | --- | --- |
| 0 | a | 0 | - | 1 | |
| 1 | b | 1 | - | 2 | |
| 2 | x | 2 | `lps[1] = 0` | 0 | `x` matches nothing |
| 3 | a | 0 | - | 1 | |
| 4 | b | 1 | - | 2 | |
| 5 | c | 2 | - | 3 | |
| 6 | a | 3 | - | 4 | |
| 7 | b | 4 | - | 5 | |
| 8 | c | 5 | `lps[4] = 2` | 3 | `c` != `y`, slide to border `ab`, then `c` matches `pattern[2]` |
| 9 | a | 3 | - | 4 | |
| 10 | b | 4 | - | 5 | |
| 11 | y | 5 | - | 6 | `j === 6`: match at `11 - 6 + 1 = 6` |

Row `i = 8` is the whole point of KMP.
The naive method would restart at text index 4 and re-read characters 4 to 8.
KMP keeps `i` at 8 and moves only `j`.

Total cost: O(n + m) time, O(m) space for the table.

### 3.4 Extra Variants

**Repeated substring pattern** (LeetCode 459).
A string `s` of length `n` is built from repeats of a block exactly when the longest border is positive and the leftover `n - lps[n - 1]` divides `n`.

```js
function repeatedSubstringPattern(s) {
  const n = s.length;
  const border = buildLps(s)[n - 1];
  return border > 0 && n % (n - border) === 0;
}

repeatedSubstringPattern("abab"); // true
repeatedSubstringPattern("abcabcabc"); // true
repeatedSubstringPattern("aba"); // false
```

`n - lps[n - 1]` is the length of the shortest repeating block.
For `"abab"`, `lps` ends in `2`, the block length is `4 - 2 = 2` (`"ab"`), and `4 % 2 === 0`.

**Shortest palindrome** (LeetCode 214).
Find the longest palindromic **prefix** of `s`, then add the reverse of the remaining suffix in front.
Compute the prefix length with the table of `s + "#" + reverse(s)`, where `#` is a separator that cannot appear in `s`.

```js
function shortestPalindrome(s) {
  const reversed = [...s].reverse().join("");
  const lps = buildLps(s + "#" + reversed);
  const palindromicPrefix = lps[lps.length - 1];
  return reversed.slice(0, s.length - palindromicPrefix) + s;
}

shortestPalindrome("aacecaaa"); // aaacecaaa
shortestPalindrome("abcd"); // dcbabcd
```

**Smallest period** of a string is `n - lps[n - 1]`, as above, even when it does not divide `n` evenly.
This is the border-based way to read the table, and it is a common follow-up question.

**Z-algorithm** is the other linear-time matcher.
It computes, for every position, how long the substring starting there matches a prefix of the string.
It solves the same problems with a different table, and it is worth knowing it exists.

### 3.5 Pitfalls

- **Falling back with `j--`.** The fallback target is `lps[j - 1]`, which can skip many positions at once.
  Decrementing by one is just the naive algorithm again.
- **Using `lps[j]` instead of `lps[j - 1]`.** The table entry for the last **matched** character is at index `j - 1`.
- **Advancing `i` during a fallback.** A fallback re-compares the same text character against a shorter border.
- **Forgetting to reset after a full match.** Without `j = lps[j - 1]` the next iteration reads `pattern[m]`, which is `undefined`, and overlapping matches are missed.
- **Building the table on the text.** The table belongs to the pattern only.
- **Empty pattern.** `lps[-1]` and `pattern[0]` are both invalid, so return early.
- **Separator missing in the combined string.** In shortest palindrome, without `#` the border can run across the join.

### 3.6 Java Implementation

```java
static int[] buildLps(String pattern) {
    int[] lps = new int[pattern.length()];
    int len = 0;
    int i = 1;
    while (i < pattern.length()) {
        if (pattern.charAt(i) == pattern.charAt(len)) {
            len++;
            lps[i] = len;
            i++;
        } else if (len > 0) {
            len = lps[len - 1];
        } else {
            lps[i] = 0;
            i++;
        }
    }
    return lps;
}
// buildLps("ababaca") -> [0, 0, 1, 2, 3, 0, 1]
// buildLps("aabaaab") -> [0, 1, 0, 1, 2, 2, 3]

static List<Integer> kmpSearch(String text, String pattern) {
    List<Integer> out = new ArrayList<>();
    if (pattern.isEmpty()) return out;
    int[] lps = buildLps(pattern);
    int j = 0;
    for (int i = 0; i < text.length(); i++) {
        while (j > 0 && text.charAt(i) != pattern.charAt(j)) j = lps[j - 1];
        if (text.charAt(i) == pattern.charAt(j)) j++;
        if (j == pattern.length()) {
            out.add(i - j + 1);
            j = lps[j - 1];
        }
    }
    return out;
}
// kmpSearch("abxabcabcaby", "abcaby") -> [6]
// kmpSearch("ababababa", "ababa") -> [0, 2, 4]
// kmpSearch("aaaa", "aa") -> [0, 1, 2]
```

```java
static boolean repeatedSubstringPattern(String s) {
    int n = s.length();
    int border = buildLps(s)[n - 1];
    return border > 0 && n % (n - border) == 0;
}
// repeatedSubstringPattern("abab") -> true
// repeatedSubstringPattern("aba") -> false

static String shortestPalindrome(String s) {
    String reversed = new StringBuilder(s).reverse().toString();
    int[] lps = buildLps(s + "#" + reversed);
    int palindromicPrefix = lps[lps.length - 1];
    return reversed.substring(0, s.length() - palindromicPrefix) + s;
}
// shortestPalindrome("aacecaaa") -> aaacecaaa
// shortestPalindrome("abcd") -> dcbabcd
```

---

## 4. Java Pitfalls

- **`char` arithmetic.** `text.charAt(i) * high` promotes to `int`, which can overflow before the `% MOD`.
  Cast to `long` first.
- **`==` on strings.** `text.substring(i, i + m) == pattern` compares references.
  Use `equals`, or better `text.startsWith(pattern, i)`.
- **`substring` cost.** In modern Java it copies, so calling it inside the shift loop is O(m) per shift.
- **`Math.max(int, long)` hides a widening.** Keep Kadane sums in `long` when values are large, and compare like with like.
- **`Integer.MIN_VALUE` as a sentinel.** `Integer.MIN_VALUE + x` underflows.
  Start `best` from `nums[0]` instead.
- **`new int[0]` in a Kadane call.** The code reads `nums[0]`, so guard an empty input if the problem allows one.
- **`StringBuilder.reverse()` and surrogate pairs.** It treats a pair as one character, which matters only for text outside the basic plane.

---

## 5. Quick Recap

| Topic | Signal in the problem | Core tool | Time | Space |
| --- | --- | --- | --- | --- |
| Maximum subarray | Best contiguous sum with negatives | `endingHere = max(x, endingHere + x)` | O(n) | O(1) |
| Max product, circular | Sign flips, wrap-around | Track min and max, or `total - minSubarray` | O(n) | O(1) |
| Naive matching | Small inputs, first occurrence | Shift and compare | O(n * m) worst | O(1) |
| Rabin-Karp | Many windows, hash friendly | Rolling hash plus verify | O(n + m) expected | O(1) |
| KMP | Guaranteed linear, borders, periods | `lps` table, never move `i` back | O(n + m) | O(m) |

Next: the [Hashing Deep Dive](/docs/dsa/hashing-deep-dive) explains the collisions that Rabin-Karp had to verify against, or return to the [Pattern Playbook](/docs/dsa/pattern-playbook) to see where these fit among the other patterns.
