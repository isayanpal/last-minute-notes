---
id: redux
title: Redux Toolkit (RTK)
---

# Redux Toolkit (RTK)

> Focus is on **why**, **when**, and **how**, not just syntax.

## Table of Contents

1. [What is Redux Toolkit?](#what-is-redux-toolkit)
2. [Why Redux Exists](#why-redux-exists-interview-context)
3. [Problems with Classic Redux](#problems-with-classic-redux)
4. [Core Principles of Redux Toolkit](#core-principles-of-redux-toolkit)
5. [Redux Toolkit Architecture](#redux-toolkit-architecture)
6. [configureStore](#1-configurestore)
7. [createSlice](#2-createslice-most-important-concept)
8. [Immer](#3-immer-hidden-superpower)
9. [Action Creators](#4-action-creators-auto-generated)
10. [Async Logic — createAsyncThunk](#5-async-logic--createasyncthunk)
11. [useSelector & useDispatch](#6-useselector--usedispatch)
12. [Typed Redux](#7-typed-redux-typescript-best-practice)
13. [Normalized State Shape](#8-normalized-state-shape)
14. [createEntityAdapter](#9-createentityadapter)
15. [Selectors](#10-selectors-performance-critical)
16. [Redux vs Context](#11-redux-vs-context-interview-favorite)
17. [Redux Toolkit Query](#12-redux-toolkit-query-rtk-query)
18. [Common Anti-Patterns](#13-common-anti-patterns-senior-red-flags)
19. [Folder Structure](#14-folder-structure-production-ready)
20. [Performance Considerations](#15-performance-considerations)
21. [Real Interview Questions](#16-real-interview-questions)
22. [When NOT to Use Redux](#17-when-not-to-use-redux)

---

## What is Redux Toolkit?

**Redux Toolkit** is the **official, recommended way** to write Redux logic.

It solves the **three biggest problems of classic Redux**:

1. Too much boilerplate
2. Complex immutable updates
3. Difficult async handling

---

## Why Redux Exists (Interview Context)

Redux solves:

- **Global state management**
- **Predictable state updates**
- **Single source of truth**
- **Debuggability (time-travel, logs)**

React alone is not enough when:

- Many components need shared state
- State transitions are complex
- Business logic grows

---

## Problems with Classic Redux

```txt
ACTION → DISPATCH → REDUCER → STORE
```

Issues:

- Separate action types
- Switch-case reducers
- Manual immutability
- Thunks written separately

RTK abstracts all of this.

---

## Core Principles of Redux Toolkit

1. Single global store
2. State is immutable (handled internally)
3. Reducers must be pure
4. Actions describe **what happened**
5. Reducers describe **how state changes**

---

## Redux Toolkit Architecture

```
UI
 ↓ dispatch
Slice Actions
 ↓
Reducers (Immer)
 ↓
Store
 ↓
Selectors
 ↓
UI
```

---

## 1. configureStore

### Why configureStore?

- Replaces `createStore`
- Automatically sets up:

  - Redux DevTools
  - Thunk middleware
  - Better defaults

### Example

```ts
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});
```

### Interview Insight

`configureStore` enforces **best practices by default**.

---

## 2. createSlice (Most Important Concept)

### What is a Slice?

A **slice** contains:

- Initial state
- Reducers
- Auto-generated action creators

### Example

```ts
import { createSlice } from "@reduxjs/toolkit";

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    token: null,
  },
  reducers: {
    loginSuccess(state, action) {
      state.user = action.payload.user;
      state.token = action.payload.token;
    },
    logout(state) {
      state.user = null;
      state.token = null;
    },
  },
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;
```

### Key Interview Point

This **looks mutable**, but RTK uses **Immer** under the hood.

---

## 3. Immer (Hidden Superpower)

### What is Immer?

Immer allows you to write **mutable-looking code** that produces **immutable updates**.

```ts
state.count += 1; // SAFE
```

Internally:

```txt
Draft → Diff → Immutable copy
```

### Interview Question

**Q:** Why is immutability important?
**A:** Enables change detection, time-travel debugging, and predictable updates.

---

## 4. Action Creators (Auto-Generated)

```ts
dispatch(loginSuccess(payload));
```

No need to manually write:

```ts
{
  type: "LOGIN_SUCCESS", payload;
}
```

---

## 5. Async Logic — createAsyncThunk

### Why Thunks?

Redux reducers must be **synchronous & pure**.

Async logic belongs in **thunks**.

---

### createAsyncThunk Example

```ts
import { createAsyncThunk } from "@reduxjs/toolkit";

export const fetchUser = createAsyncThunk("auth/fetchUser", async (userId) => {
  const res = await fetch(`/api/users/${userId}`);
  return res.json();
});
```

---

### Handling Async States in Slice

```ts
extraReducers: (builder) => {
  builder
    .addCase(fetchUser.pending, (state) => {
      state.loading = true;
    })
    .addCase(fetchUser.fulfilled, (state, action) => {
      state.loading = false;
      state.user = action.payload;
    })
    .addCase(fetchUser.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });
};
```

---

### Async Lifecycle

| State     | Meaning     |
| --------- | ----------- |
| pending   | API started |
| fulfilled | Success     |
| rejected  | Failure     |

---

## 6. useSelector & useDispatch

### useSelector

```ts
const user = useSelector((state) => state.auth.user);
```

### useDispatch

```ts
const dispatch = useDispatch();
dispatch(logout());
```

---

## 7. Typed Redux (TypeScript Best Practice)

### Infer Store Types

```ts
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### Typed Hooks

```ts
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = useSelector<RootState>;
```

### Interview Expectation

Senior engineers **always type Redux**.

---

## 8. Normalized State Shape

### Bad (Nested)

```ts
users: [{ posts: [{ comments: [] }] }];
```

### Good (Normalized)

```ts
users: { byId: {}, allIds: [] }
posts: { byId: {}, allIds: [] }
```

### Why?

- Faster updates
- Simpler reducers
- Less re-renders

---

## 9. createEntityAdapter

Used for **normalized collections**.

```ts
const usersAdapter = createEntityAdapter();
```

Gives:

- addOne
- updateOne
- removeOne
- selectors

---

## 10. Selectors (Performance Critical)

### What are Selectors?

Functions that extract data from store.

```ts
const selectUser = (state) => state.auth.user;
```

### Memoized Selectors

```ts
import { createSelector } from "@reduxjs/toolkit";

const selectFiltered = createSelector(
  [selectItems, selectFilter],
  (items, filter) => items.filter(...)
);
```

---

## 11. Redux vs Context (Interview Favorite)

| Redux              | Context             |
| ------------------ | ------------------- |
| Predictable        | Simple              |
| Debuggable         | Lightweight         |
| Scales well        | Not for heavy logic |
| Middleware support | No middleware       |

**Rule of Thumb**

- Context → Theme, auth flag
- Redux → Business state, async-heavy logic

---

## 12. Redux Toolkit Query (RTK Query)

### What is RTK Query?

A **data-fetching & caching layer** built into RTK.

### Why Use It?

- Automatic caching
- Auto refetching
- Loading & error handling
- No manual thunks

### Example

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

```ts
const { data, isLoading } = useGetUsersQuery();
```

---

## 13. Common Anti-Patterns (Senior Red Flags)

- Putting derived data in Redux
- Overusing global state
- Huge slices
- Mixing UI state with business state
- API calls inside components

---

## 14. Folder Structure (Production-Ready)

```
store/
  index.ts
features/
  auth/
    authSlice.ts
    authApi.ts
    selectors.ts
```

---

## 15. Performance Considerations

- Split slices logically
- Memoize selectors
- Avoid deep nested state
- Prefer RTK Query for APIs

---

## 16. Real Interview Questions

### Q: Why Redux Toolkit over Redux?

- Less boilerplate
- Built-in best practices
- Safer immutability
- Better DX

### Q: Where should async logic live?

- Thunks / RTK Query

### Q: Can Redux replace backend state?

- No, Redux is a client cache, not a database

---

## 17. When NOT to Use Redux

- Small apps
- Local UI state
- Single-page forms
- Simple data flow
