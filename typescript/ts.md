# 📘 TypeScript Complete Interview Notes (Frontend – In Depth)

## Table of Contents

1. [What is TypeScript?](#1-what-is-typescript)
2. [TypeScript vs JavaScript](#2-typescript-vs-javascript)
3. [Type System Basics](#3-type-system-basics)
4. [Type Inference](#4-type-inference)
5. [Any vs Unknown](#5-any-vs-unknown)
6. [Void, Never](#6-void-never)
7. [Arrays & Tuples](#7-arrays--tuples)
8. [Enums](#8-enums)
9. [Objects & Type Aliases](#9-objects--type-aliases)
10. [Interfaces vs Type](#10-interfaces-vs-type)
11. [Optional & Readonly Properties](#11-optional--readonly-properties)
12. [Union Types](#12-union-types)
13. [Intersection Types](#13-intersection-types)
14. [Literal Types](#14-literal-types)
15. [Functions](#15-functions)
16. [Function Overloading](#16-function-overloading)
17. [Generics](#17-generics-very-important)
18. [Utility Types](#18-utility-types-frequently-asked)
19. [Type Guards](#19-type-guards)
20. [Discriminated Unions](#20-discriminated-unions)
21. [Type Assertions](#21-type-assertions)
22. [Index Signatures](#22-index-signatures)
23. [Mapped Types](#23-mapped-types)
24. [keyof & typeof](#24-keyof--typeof)
25. [Modules & Namespaces](#25-modules--namespaces)
26. [tsconfig.json](#26-tsconfigjson-very-important)
27. [TypeScript with React](#27-typescript-with-react)
28. [Common Interview Traps](#28-common-interview-traps)
29. [When NOT to use TypeScript](#29-when-not-to-use-typescript)
30. [Senior Engineer Best Practices](#30-senior-engineer-best-practices)
31. [One-Line Interview Summary](#31-one-line-interview-summary)

---

## 1. What is TypeScript?

**TypeScript is a statically typed superset of JavaScript** that compiles to plain JavaScript.

### Why TypeScript exists

JavaScript problems at scale:

- No static type checking
- Runtime errors instead of compile-time errors
- Poor IDE autocomplete and refactoring
- Hard to maintain large codebases

TypeScript solves this by:

- Adding **static typing**
- Catching errors **before runtime**
- Improving **developer experience**
- Making code **self-documenting**

### Example

```ts
function add(a: number, b: number) {
  return a + b;
}

add(2, "3"); // ❌ Compile-time error
```

---

## 2. TypeScript vs JavaScript

| Feature         | JavaScript | TypeScript   |
| --------------- | ---------- | ------------ |
| Typing          | Dynamic    | Static       |
| Error detection | Runtime    | Compile time |
| IDE support     | Limited    | Excellent    |
| Refactoring     | Risky      | Safe         |
| Scale           | Poor       | Excellent    |

---

## 3. Type System Basics

### Primitive Types

```ts
let isDone: boolean = false;
let count: number = 10;
let name: string = "Sayan";
let value: null = null;
let data: undefined = undefined;
```

### Why typing matters

Prevents accidental misuse:

```ts
let age: number = 25;
age = "twenty"; // ❌
```

---

## 4. Type Inference

TypeScript can **infer types automatically**.

```ts
let count = 10; // inferred as number
count = 20; // OK
count = "30"; // ❌
```

### Interview insight

> Explicit types are recommended for **function boundaries**, not internal variables.

---

## 5. Any vs Unknown

### `any`

- Disables type checking
- Dangerous

```ts
let value: any = 10;
value.toUpperCase(); // No error, runtime crash
```

### `unknown`

- Safer alternative to `any`

```ts
let value: unknown = 10;
value.toUpperCase(); // ❌

if (typeof value === "string") {
  value.toUpperCase(); // ✅
}
```

### Interview rule

> Prefer `unknown` over `any` always.

---

## 6. Void, Never

### `void`

Function returns nothing

```ts
function logMessage(msg: string): void {
  console.log(msg);
}
```

### `never`

Function never completes

```ts
function throwError(): never {
  throw new Error("Crash");
}
```

Used for:

- Infinite loops
- Exhaustive checks

---

## 7. Arrays & Tuples

### Arrays

```ts
let numbers: number[] = [1, 2, 3];
let names: Array<string> = ["A", "B"];
```

### Tuples

Fixed-length arrays

```ts
let user: [number, string] = [1, "Sayan"];
```

---

## 8. Enums

### Numeric Enum

```ts
enum Status {
  Pending,
  Approved,
  Rejected,
}
```

### String Enum (recommended)

```ts
enum Status {
  Pending = "PENDING",
  Approved = "APPROVED",
  Rejected = "REJECTED",
}
```

### Why string enums are better

- Readable
- Safer during debugging
- Stable values

---

## 9. Objects & Type Aliases

```ts
type User = {
  id: number;
  name: string;
  isActive: boolean;
};
```

Usage:

```ts
const user: User = {
  id: 1,
  name: "Sayan",
  isActive: true,
};
```

---

## 10. Interfaces vs Type

### Interface

```ts
interface User {
  id: number;
  name: string;
}
```

### Type

```ts
type User = {
  id: number;
  name: string;
};
```

### Key Differences

| Feature             | interface | type       |
| ------------------- | --------- | ---------- |
| Declaration merging | Yes       | No         |
| Union types         | No        | Yes        |
| Extend              | extends   | &          |
| Preferred for       | Objects   | Everything |

### Interview rule

> Use `interface` for public APIs, `type` for unions & advanced types.

---

## 11. Optional & Readonly Properties

```ts
interface User {
  id: number;
  name?: string;
  readonly email: string;
}
```

---

## 12. Union Types

```ts
type Status = "loading" | "success" | "error";

function setStatus(status: Status) {}
```

### Real-world usage

- API states
- Feature flags
- Role-based access

---

## 13. Intersection Types

```ts
type Admin = { role: "admin" };
type User = { name: string };

type AdminUser = Admin & User;
```

---

## 14. Literal Types

```ts
let direction: "left" | "right";
direction = "left";
```

Used heavily in:

- Redux
- Component props
- State machines

---

## 15. Functions

### Function Types

```ts
function add(a: number, b: number): number {
  return a + b;
}
```

### Optional Parameters

```ts
function greet(name?: string) {}
```

### Default Parameters

```ts
function greet(name = "Guest") {}
```

---

## 16. Function Overloading

```ts
function getValue(value: string): string;
function getValue(value: number): number;
function getValue(value: any) {
  return value;
}
```

Used in:

- Libraries
- Complex APIs

---

## 17. Generics (Very Important)

### Basic Generic

```ts
function identity<T>(value: T): T {
  return value;
}
```

### Generic Constraints

```ts
function logLength<T extends { length: number }>(value: T) {
  console.log(value.length);
}
```

### React Example

```ts
const useState = <T>(initial: T): [T, (v: T) => void] => {};
```

---

## 18. Utility Types (Frequently Asked)

### Partial

```ts
type UserUpdate = Partial<User>;
```

### Required

```ts
type FullUser = Required<User>;
```

### Pick

```ts
type UserPreview = Pick<User, "id" | "name">;
```

### Omit

```ts
type UserWithoutId = Omit<User, "id">;
```

### Record

```ts
type Roles = Record<string, boolean>;
```

---

## 19. Type Guards

```ts
function isString(value: unknown): value is string {
  return typeof value === "string";
}
```

Used in:

- API responses
- Runtime validation

---

## 20. Discriminated Unions

```ts
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; size: number };

function area(shape: Shape) {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.size ** 2;
  }
}
```

### Interview favorite question

---

## 21. Type Assertions

```ts
const value = document.getElementById("app") as HTMLDivElement;
```

Avoid excessive use — it bypasses safety.

---

## 22. Index Signatures

```ts
interface ErrorMap {
  [key: string]: string;
}
```

Used in:

- Dynamic objects
- Error handling

---

## 23. Mapped Types

```ts
type ReadonlyUser = {
  readonly [K in keyof User]: User[K];
};
```

Foundation of utility types.

---

## 24. keyof & typeof

```ts
type UserKeys = keyof User;

const user = { id: 1, name: "A" };
type UserType = typeof user;
```

---

## 25. Modules & Namespaces

### ES Modules

```ts
export interface User {}
import { User } from "./types";
```

Namespaces are legacy — avoid.

---

## 26. tsconfig.json (Very Important)

Key options:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "baseUrl": "./src",
  "paths": {
    "@components/*": ["components/*"]
  }
}
```

### Interview insight

> `strict` mode should always be enabled in production apps.

---

## 27. TypeScript with React

### Props Typing

```ts
interface ButtonProps {
  label: string;
  onClick: () => void;
}
```

### Children

```ts
interface Props {
  children: React.ReactNode;
}
```

### useState

```ts
const [count, setCount] = useState<number>(0);
```

### Event Types

```ts
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {};
```

---

## 28. Common Interview Traps

- Overusing `any`
- Not narrowing `unknown`
- Incorrect union handling
- Missing `never` exhaustive checks
- Ignoring strict null checks

---

## 29. When NOT to use TypeScript

- Very small scripts
- Prototypes with no future
- Simple static pages

---

## 30. Senior Engineer Best Practices

- Types at boundaries (API, props)
- Avoid over-engineering types
- Prefer readability over cleverness
- Let inference work
- Keep types close to usage

---

## 31. One-Line Interview Summary

> TypeScript is about **correctness, scalability, and developer confidence**, not just types.
