# RTK Query vs React Query — Deep Comparison

This document compares **Redux Toolkit Query** and **React Query** from a **systems, performance, and architecture** perspective

## Table of Contents

### Part 1: RTK Query vs React Query

1. [What They Are](#what-they-are-high-level)
2. [Core Philosophy Difference](#core-philosophy-difference-very-important)
3. [Mental Model Comparison](#mental-model-comparison)
4. [Setup & Boilerplate](#setup--boilerplate)
5. [Caching Strategy](#caching-strategy)
6. [Refetching Behavior](#refetching-behavior)
7. [Mutations & Cache Invalidation](#mutations--cache-invalidation)
8. [DevTools & Debugging](#devtools--debugging)
9. [TypeScript Experience](#typescript-experience)
10. [Performance Characteristics](#performance-characteristics)
11. [Bundle Size & Complexity](#bundle-size--complexity)
12. [When to Use RTK Query](#when-to-use-rtk-query)
13. [When to Use React Query](#when-to-use-react-query)
14. [Interview Summary](#interview-summary-one-liner)

### Part 2: Debugging Redux Performance Issues

1. [How Redux Causes Performance Issues](#how-redux-causes-performance-issues)
2. [Unnecessary Re-renders](#1-unnecessary-re-renders-most-common)
3. [Missing Memoized Selectors](#2-missing-memoized-selectors)
4. [Overusing Global State](#3-overusing-global-state)
5. [Large, Monolithic Slices](#4-large-monolithic-slices)
6. [Referential Equality Issues](#5-referential-equality-issues)
7. [Incorrect useCallback / memo Usage](#6-incorrect-usecallback--memo-usage)
8. [Redux DevTools Profiling](#7-redux-devtools-profiling)
9. [Normalization Problems](#8-normalization-problems)
10. [Middleware Overhead](#9-middleware-overhead)
11. [When Redux Is NOT the Problem](#10-when-redux-is-not-the-problem)
12. [Senior Interview Takeaway](#senior-interview-takeaway)
13. [Final Verdict Summary](#final-verdict-summary)

---

## What They Are (High-Level)

- **RTK Query**

  - A **data fetching and caching layer built into Redux Toolkit**
  - Treats server data as **part of the Redux store**

- **React Query**
  - A **standalone async state manager**
  - Treats server data as **external cached state**

---

## Core Philosophy Difference (Very Important)

### RTK Query

> "Server state should live inside Redux, alongside client state."

### React Query

> "Server state is NOT app state — it's a cache."

This single distinction drives **all architectural decisions**.

---

## Mental Model Comparison

| Concept          | RTK Query          | React Query    |
| ---------------- | ------------------ | -------------- |
| Ownership        | Redux store        | Internal cache |
| Server data      | Global Redux state | External cache |
| Reducers         | Yes                | No             |
| Actions          | Yes                | No             |
| Middleware       | Yes                | No             |
| Redux dependency | Mandatory          | None           |

---

## Setup & Boilerplate

### RTK Query Setup

```ts
const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (builder) => ({
    getUsers: builder.query<User[], void>({
      query: () => "/users",
    }),
  }),
});
```

Requires:

- Adding reducer
- Adding middleware
- Redux store setup

### React Query Setup

```ts
const queryClient = new QueryClient();

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>;
```

Minimal setup, framework-agnostic.

---

## Caching Strategy

### RTK Query

- Cache stored in Redux
- Keyed by **endpoint + serialized arguments**
- Cache lifecycle controlled via:

  - `keepUnusedDataFor`
  - `refetchOnMountOrArgChange`

```ts
keepUnusedDataFor: 60;
```

### React Query

- Cache stored internally
- Keyed by **query keys**
- More granular cache controls

```ts
useQuery({
  queryKey: ["users", id],
  staleTime: 5 * 60 * 1000,
});
```

---

## Refetching Behavior

| Trigger           | RTK Query    | React Query     |
| ----------------- | ------------ | --------------- |
| Window focus      | Configurable | Default enabled |
| Network reconnect | Configurable | Default enabled |
| Component remount | Optional     | Optional        |
| Manual refetch    | Yes          | Yes             |

React Query has **more aggressive freshness strategies by default**.

---

## Mutations & Cache Invalidation

### RTK Query (Tag-Based)

```ts
providesTags: ["User"];
invalidatesTags: ["User"];
```

- Declarative
- Centralized
- Safer for large teams

### React Query (Query Keys)

```ts
queryClient.invalidateQueries(["users"]);
```

- Flexible
- Powerful
- Easier to misuse

---

## DevTools & Debugging

### RTK Query

- Redux DevTools
- Actions, reducers, state snapshots
- Time-travel debugging

### React Query

- Dedicated React Query DevTools
- Cache status
- Background refetch visibility

---

## TypeScript Experience

| Aspect         | RTK Query   | React Query |
| -------------- | ----------- | ----------- |
| Type inference | Strong      | Strong      |
| Boilerplate    | Medium      | Low         |
| API typing     | Centralized | Per hook    |

RTK Query is preferred in **strictly typed Redux codebases**.

---

## Performance Characteristics

### RTK Query

- Redux subscription-based updates
- Can cause re-renders if selectors are not scoped
- Predictable but global

### React Query

- Component-level subscriptions
- Highly optimized
- Fewer unintended re-renders

---

## Bundle Size & Complexity

| Factor         | RTK Query               | React Query |
| -------------- | ----------------------- | ----------- |
| Bundle size    | Larger (Redux included) | Smaller     |
| Concept count  | High                    | Moderate    |
| Learning curve | Steep                   | Gentle      |

---

## When to Use RTK Query

Choose RTK Query if:

- App already uses Redux
- You need:

  - Centralized data logic
  - Strong conventions
  - Enterprise-scale consistency

- Multiple teams share APIs
- Debugging & predictability matter more than speed

**Common in:** fintech, dashboards, enterprise products

---

## When to Use React Query

Choose React Query if:

- You don't need Redux
- App is API-heavy
- You want:

  - Minimal boilerplate
  - Best-in-class caching
  - Excellent performance

- You treat backend as source of truth

**Common in:** startups, consumer apps, Next.js apps

---

## Interview Summary (One-Liner)

> RTK Query is a **Redux-first server-state solution**, while React Query is a **cache-first async state manager**.

---

# Debugging Redux Performance Issues

This section focuses on **real-world Redux performance debugging**, not theoretical advice.

---

## How Redux Causes Performance Issues

Redux itself is fast — performance problems usually come from:

1. Too much global state
2. Poor selector usage
3. Over-rendering components
4. Deeply nested state
5. Incorrect memoization

---

## 1. Unnecessary Re-renders (Most Common)

### Problem

```ts
const state = useSelector((state) => state);
```

This subscribes the component to **entire store**.

### Fix

```ts
useSelector((state) => state.auth.user);
```

Always select the **smallest possible slice**.

---

## 2. Missing Memoized Selectors

### Problem

```ts
const filtered = useSelector((state) =>
  state.items.filter(...)
);
```

This recalculates on every render.

### Fix

```ts
const selectFilteredItems = createSelector(
  [selectItems],
  (items) => items.filter(...)
);
```

Memoization prevents unnecessary recalculations.

---

## 3. Overusing Global State

### Smell

- UI flags in Redux
- Modal open/close
- Input values

### Rule

> If state is used by **one component**, it does NOT belong in Redux.

Use:

- `useState`
- `useReducer`

---

## 4. Large, Monolithic Slices

### Problem

```ts
state.app = { auth, user, settings, ui, data };
```

Any change re-triggers subscribers.

### Fix

Split slices by **domain**, not screen.

```txt
authSlice
userSlice
settingsSlice
```

---

## 5. Referential Equality Issues

### Problem

```ts
return { ...state };
```

Even unchanged data creates a new reference.

### Fix

- Update only changed fields
- Let Immer handle immutability
- Avoid unnecessary spreading

---

## 6. Incorrect useCallback / memo Usage

### Anti-Pattern

```ts
useCallback(() => doSomething(), []);
```

Used blindly without profiling.

### Rule

- Memoization is a **tool**, not default behavior
- Measure before optimizing

---

## 7. Redux DevTools Profiling

### What to Look For

- High-frequency actions
- Repeated identical updates
- Large state diffs
- Expensive reducers

Use:

- Action replay
- Time-travel
- Diff view

---

## 8. Normalization Problems

### Bad

```ts
posts: [{ comments: [{ replies: [] }] }];
```

### Good

```ts
posts: {
  byId, allIds;
}
comments: {
  byId, allIds;
}
```

Normalization reduces update scope.

---

## 9. Middleware Overhead

Too many middlewares:

- Logging
- Analytics
- Custom interceptors

Disable heavy middleware in production.

---

## 10. When Redux Is NOT the Problem

Often performance issues are due to:

- Expensive React components
- Heavy DOM trees
- Poor memoization
- Layout thrashing

Redux gets blamed unfairly.

---

## Senior Interview Takeaway

> Redux performance issues are rarely about Redux itself — they are about **how you model state and subscribe to it**.

---

## Final Verdict Summary

| Topic               | Recommendation                              |
| ------------------- | ------------------------------------------- |
| Server state        | Prefer React Query unless Redux is required |
| Global client state | Redux Toolkit                               |
| Performance         | Optimize selectors, not reducers            |
| Interviews          | Explain trade-offs, not tools               |
