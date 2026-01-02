# React.js Complete Notes

> All examples use **modern React (hooks + functional components)**.

## Table of Contents

1. [What is React?](#what-is-react)
2. [Core Principles of React](#core-principles-of-react)
3. [Components](#1-components)
4. [JSX](#2-jsx)
5. [Props](#3-props)
6. [State](#4-state)
7. [useState Hook](#5-usestate-hook)
8. [Conditional Rendering](#6-conditional-rendering)
9. [Lists and Keys](#7-lists-and-keys)
10. [Event Handling](#8-event-handling)
11. [Controlled vs Uncontrolled Components](#9-controlled-vs-uncontrolled-components)
12. [Lifting State Up](#10-lifting-state-up)
13. [useEffect Hook](#11-useeffect-hook)
14. [useRef](#12-useref)
15. [useMemo](#13-usememo)
16. [useCallback](#14-usecallback)
17. [React.memo](#15-reactmemo)
18. [Context API](#16-context-api)
19. [Custom Hooks](#17-custom-hooks)
20. [Error Boundaries](#18-error-boundaries)
21. [Reconciliation & Virtual DOM](#19-reconciliation--virtual-dom)
22. [Rendering Behavior](#20-rendering-behavior-important-interview-topic)
23. [Strict Mode](#21-strict-mode)
24. [Forms & Validation Strategy](#22-forms--validation-strategy)
25. [Performance Optimization Summary](#23-performance-optimization-summary)
26. [Folder Structure](#24-folder-structure-senior-level)
27. [Common Interview Questions](#25-common-interview-questions)
28. [Anti-Patterns](#26-anti-patterns)

---

## What is React?

**React** is a JavaScript library for building **component-based, declarative, and efficient user interfaces**.

### Why React Exists

- DOM manipulation is slow and error-prone
- UI complexity grows with state
- React introduces **Virtual DOM**, **component abstraction**, and **unidirectional data flow**

---

## Core Principles of React

1. **Declarative UI**
2. **Component-Based Architecture**
3. **Unidirectional Data Flow**
4. **Virtual DOM Diffing**
5. **State-driven rendering**

---

## 1. Components

### What is a Component?

A **component** is a reusable, isolated piece of UI that can accept inputs (props) and manage its own state.

### Types of Components

- Functional Components (recommended)
- Class Components (legacy)

### Functional Component Example

```jsx
function Greeting({ name }) {
  return <h1>Hello, {name}</h1>;
}
```

### Why Functional Components?

- Simpler syntax
- Hooks support
- Better performance
- Easier testing

---

## 2. JSX

### What is JSX?

JSX is **syntactic sugar over `React.createElement`**.

```jsx
const el = <h1>Hello</h1>;
```

Equivalent:

```js
const el = React.createElement("h1", null, "Hello");
```

### JSX Rules

- Must return a **single parent**
- JavaScript expressions inside `{ }`
- Attributes use **camelCase**
- `className` instead of `class`

---

## 3. Props

### What are Props?

Props are **read-only inputs** passed from parent to child.

```jsx
function Button({ label }) {
  return <button>{label}</button>;
}
```

### Key Rules

- Immutable
- Flow from parent → child
- Used for configuration

### Interview Question

**Q:** Can child modify props?
**A:** No. Props are immutable.

---

## 4. State

### What is State?

State represents **mutable data** that affects rendering.

```jsx
const [count, setCount] = useState(0);
```

### State Update Rules

- State updates are **asynchronous**
- Never mutate state directly
- Triggers re-render

Incorrect:

```js
count++;
```

Correct:

```js
setCount((prev) => prev + 1);
```

---

## 5. useState Hook

```jsx
const [value, setValue] = useState(initialValue);
```

### When to Use

- Form inputs
- Toggles
- Counters
- UI state

### Interview Tip

State updates may be **batched** for performance.

---

## 6. Conditional Rendering

```jsx
{
  isLoggedIn ? <Dashboard /> : <Login />;
}
```

```jsx
{
  items.length > 0 && <List />;
}
```

---

## 7. Lists and Keys

```jsx
items.map((item) => <li key={item.id}>{item.name}</li>);
```

### Why Keys Matter

- Helps React identify changes
- Improves reconciliation
- Prevents incorrect re-renders

### Interview Question

**Q:** Why not use index as key?
**A:** Causes bugs during reordering, insertion, deletion.

---

## 8. Event Handling

```jsx
<button onClick={handleClick}>Click</button>
```

```jsx
const handleClick = (e) => {
  e.preventDefault();
};
```

---

## 9. Controlled vs Uncontrolled Components

### Controlled Input

```jsx
<input value={value} onChange={(e) => setValue(e.target.value)} />
```

### Uncontrolled Input

```jsx
<input ref={inputRef} />
```

### Interview Insight

Controlled inputs give **predictable state** and validation control.

---

## 10. Lifting State Up

When **multiple components need the same state**, move it to the nearest common parent.

```jsx
function Parent() {
  const [value, setValue] = useState("");
  return <Child value={value} setValue={setValue} />;
}
```

---

## 11. useEffect Hook

### Purpose

Handles **side effects**:

- API calls
- Subscriptions
- Timers
- DOM manipulation

```jsx
useEffect(() => {
  fetchData();
}, []);
```

### Dependency Array Rules

| Dependency | Meaning              |
| ---------- | -------------------- |
| `[]`       | Run once (mount)     |
| `[a]`      | Run when `a` changes |
| No array   | Runs every render    |

### Cleanup

```jsx
useEffect(() => {
  const id = setInterval(() => {}, 1000);
  return () => clearInterval(id);
}, []);
```

---

## 12. useRef

### Purpose

- Persist values without re-render
- Access DOM elements

```jsx
const inputRef = useRef(null);
inputRef.current.focus();
```

### Interview Question

**Q:** Difference between useRef and useState?
**A:** `useRef` does NOT trigger re-render.

---

## 13. useMemo

### Purpose

Memoize **expensive calculations**

```jsx
const result = useMemo(() => heavyCalc(a), [a]);
```

### Use When

- Expensive computations
- Prevent recalculation

---

## 14. useCallback

### Purpose

Memoize **functions**

```jsx
const handleClick = useCallback(() => {
  setCount((c) => c + 1);
}, []);
```

### Interview Insight

Used to prevent unnecessary re-renders in memoized children.

---

## 15. React.memo

```jsx
const Child = React.memo(function Child({ value }) {
  return <div>{value}</div>;
});
```

Prevents re-render unless props change.

---

## 16. Context API

### Problem Solved

**Prop drilling**

```jsx
const ThemeContext = createContext();
```

```jsx
<ThemeContext.Provider value="dark">
```

```jsx
const theme = useContext(ThemeContext);
```

### Interview Question

**Q:** Context vs Redux?
**A:** Context for low-frequency global state, Redux for complex state logic.

---

## 17. Custom Hooks

### Why?

- Reuse logic
- Cleaner components

```jsx
function useFetch(url) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(url)
      .then((r) => r.json())
      .then(setData);
  }, [url]);
  return data;
}
```

---

## 18. Error Boundaries

Only available in **class components**.

```jsx
componentDidCatch(error, info) {}
```

Used to catch runtime errors in UI.

---

## 19. Reconciliation & Virtual DOM

### How React Updates UI

1. Creates Virtual DOM
2. Compares with previous tree (diffing)
3. Updates minimal DOM nodes

### Optimization Heuristics

- Same type → update
- Different type → replace

---

## 20. Rendering Behavior (Important Interview Topic)

- Parent re-render → children re-render
- Memoization can stop unnecessary renders
- State update triggers render, not mutation

---

## 21. Strict Mode

```jsx
<React.StrictMode>
```

- Double-invokes lifecycle in dev
- Detects unsafe patterns

---

## 22. Forms & Validation Strategy

- Controlled inputs
- Field-level validation
- Disable submit based on validity

---

## 23. Performance Optimization Summary

- React.memo
- useCallback
- useMemo
- Avoid unnecessary state
- Normalize data
- Split components

---

## 24. Folder Structure (Senior-Level)

```
features/
  auth/
    components/
    hooks/
    api.ts
shared/
  components/
  hooks/
  utils/
```

---

## 25. Common Interview Questions

### Q: Why hooks must be called at top level?

- Ensures consistent hook order

### Q: How React batches state updates?

- Groups updates for performance

### Q: Why immutability matters?

- Enables change detection

### Q: Controlled vs uncontrolled?

- Predictability vs performance

---

## 26. Anti-Patterns

- Storing derived state
- Excessive context usage
- Index as key
- Overusing useEffect
