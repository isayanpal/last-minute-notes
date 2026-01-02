# 📘 Advanced TypeScript Patterns (Production + Interview Focused)

## Table of Contents

1. [Type Narrowing Patterns](#1-type-narrowing-patterns-critical-for-interviews)
   - [typeof Narrowing](#11-typeof-narrowing)
   - [in Operator Narrowing](#12-in-operator-narrowing)
   - [instanceof Narrowing](#13-instanceof-narrowing)
2. [Exhaustive Checking with never](#2-exhaustive-checking-with-never-very-important)
3. [Discriminated Unions](#3-discriminated-unions-most-asked-advanced-topic)
4. [Generic Utility Patterns](#4-generic-utility-patterns)
   - [Identity + Constraint Pattern](#41-identity--constraint-pattern)
   - [Generic Default Types](#42-generic-default-types)
5. [Conditional Types](#5-conditional-types-advanced-but-real)
6. [Mapped Types in Production](#6-mapped-types-in-production)
   - [Readonly Mapping](#61-readonly-mapping)
   - [Optional Mapping](#62-optional-mapping)
   - [API DTO Pattern](#63-api-dto-pattern)
7. [Keyof + Lookup Types](#7-keyof--lookup-types-interview-favorite)
8. [Function Overloads in Real Code](#8-function-overloads-in-real-code)
9. [Type-safe Event Systems](#9-type-safe-event-systems)
10. [React-Specific Advanced Patterns](#10-react-specific-advanced-patterns)
    - [Generic Components](#101-generic-components)
    - [Polymorphic Components](#102-polymorphic-components)
11. [API Response Safety Pattern](#11-api-response-safety-pattern)
12. [Assertion Functions](#12-assertion-functions-asserts-keyword)
13. [Preventing Invalid States](#13-preventing-invalid-states-senior-level)
14. [Branded Types](#14-branded-types-advanced-safety)
15. [When NOT to Use Advanced Types](#15-when-not-to-use-advanced-types)
16. [What Interviewers Actually Look For](#16-what-interviewers-actually-look-for)
17. [One-Line Senior Summary](#17-one-line-senior-summary)

---

## 1. Type Narrowing Patterns (Critical for Interviews)

### 1.1 `typeof` Narrowing

```ts
function format(value: string | number) {
  if (typeof value === "string") {
    return value.toUpperCase();
  }
  return value.toFixed(2);
}
```

Why it matters:

- Eliminates runtime errors
- Compiler understands control flow

---

### 1.2 `in` Operator Narrowing

```ts
type Admin = { role: "admin"; permissions: string[] };
type User = { role: "user"; name: string };

function handleAccount(account: Admin | User) {
  if ("permissions" in account) {
    account.permissions.push("write");
  }
}
```

Used heavily with:

- API responses
- Role-based logic

---

### 1.3 `instanceof` Narrowing

```ts
class ApiError extends Error {
  statusCode: number = 500;
}

function handleError(error: unknown) {
  if (error instanceof ApiError) {
    console.log(error.statusCode);
  }
}
```

---

## 2. Exhaustive Checking with `never` (Very Important)

### Pattern

```ts
type Status = "loading" | "success" | "error";

function assertNever(x: never): never {
  throw new Error("Unhandled case");
}

function render(status: Status) {
  switch (status) {
    case "loading":
      return "Loading...";
    case "success":
      return "Success!";
    case "error":
      return "Error!";
    default:
      return assertNever(status);
  }
}
```

Why interviewers love this:

- Guarantees **future safety**
- Compiler error when new union member is added

---

## 3. Discriminated Unions (Most Asked Advanced Topic)

### Core Pattern

```ts
type ApiResponse =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: string[] }
  | { status: "error"; error: string };
```

Usage:

```ts
function render(response: ApiResponse) {
  switch (response.status) {
    case "success":
      return response.data.map((item) => item);
    case "error":
      return response.error;
  }
}
```

Production usage:

- API state management
- Redux reducers
- UI state machines

---

## 4. Generic Utility Patterns

### 4.1 Identity + Constraint Pattern

```ts
function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((i) => [i.id, i]));
}
```

Why it matters:

- Type-safe helpers
- Reusable logic
- No runtime checks needed

---

### 4.2 Generic Default Types

```ts
type ApiResult<T = unknown> = {
  data: T;
  error?: string;
};
```

Used in:

- SDKs
- API wrappers
- Hooks

---

## 5. Conditional Types (Advanced but Real)

### Basic Conditional Type

```ts
type IsString<T> = T extends string ? true : false;
```

Example:

```ts
type A = IsString<string>; // true
type B = IsString<number>; // false
```

---

### Conditional Types with Inference (`infer`)

```ts
type ReturnTypeOf<T> = T extends (...args: any[]) => infer R ? R : never;
```

This is how **built-in `ReturnType` works**.

---

## 6. Mapped Types in Production

### 6.1 Readonly Mapping

```ts
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};
```

---

### 6.2 Optional Mapping

```ts
type Optional<T> = {
  [K in keyof T]?: T[K];
};
```

---

### 6.3 API DTO Pattern

```ts
type ApiUser = {
  id: string;
  name: string;
  createdAt: string;
};

type UiUser = {
  id: string;
  name: string;
  createdAt: Date;
};
```

Conversion helper:

```ts
function mapUser(apiUser: ApiUser): UiUser {
  return {
    ...apiUser,
    createdAt: new Date(apiUser.createdAt),
  };
}
```

---

## 7. Keyof + Lookup Types (Interview Favorite)

```ts
type User = {
  id: number;
  name: string;
  isActive: boolean;
};

type UserValue<T extends keyof User> = User[T];

type NameType = UserValue<"name">; // string
```

Why this matters:

- Type-safe property access
- Used in forms, tables, configs

---

## 8. Function Overloads in Real Code

### API Helper Example

```ts
function fetchData(url: string): Promise<string>;
function fetchData(url: string, parseJson: true): Promise<object>;
function fetchData(url: string, parseJson?: boolean) {
  return fetch(url).then((res) => (parseJson ? res.json() : res.text()));
}
```

Used in:

- SDKs
- Utility libraries
- Shared services

---

## 9. Type-safe Event Systems

```ts
type Events = {
  login: { userId: string };
  logout: undefined;
};

function emit<K extends keyof Events>(event: K, payload: Events[K]) {}
```

Usage:

```ts
emit("login", { userId: "123" });
emit("logout", undefined);
```

Very common in:

- Analytics
- Pub/sub
- Feature flags

---

## 10. React-Specific Advanced Patterns

### 10.1 Generic Components

```ts
type ListProps<T> = {
  items: T[];
  render: (item: T) => React.ReactNode;
};

function List<T>({ items, render }: ListProps<T>) {
  return <>{items.map(render)}</>;
}
```

---

### 10.2 Polymorphic Components

```ts
type ButtonProps<T extends React.ElementType> = {
  as?: T;
} & React.ComponentPropsWithoutRef<T>;

function Button<T extends React.ElementType = "button">(props: ButtonProps<T>) {
  const { as: Component = "button", ...rest } = props;
  return <Component {...rest} />;
}
```

Used in:

- Design systems
- Component libraries

---

## 11. API Response Safety Pattern

```ts
type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiError = {
  success: false;
  error: string;
};

type ApiResponse<T> = ApiSuccess<T> | ApiError;
```

Usage:

```ts
function handle(res: ApiResponse<User>) {
  if (res.success) {
    res.data.name;
  } else {
    res.error;
  }
}
```

---

## 12. Assertion Functions (`asserts` keyword)

```ts
function assertIsDefined<T>(value: T): asserts value is NonNullable<T> {
  if (value == null) {
    throw new Error("Value is null");
  }
}
```

Usage:

```ts
assertIsDefined(user);
user.name; // fully typed
```

Used in:

- Runtime validation
- Critical paths

---

## 13. Preventing Invalid States (Senior-Level)

### Bad

```ts
type State = {
  loading: boolean;
  data?: string[];
  error?: string;
};
```

### Good

```ts
type State =
  | { status: "loading" }
  | { status: "success"; data: string[] }
  | { status: "error"; error: string };
```

This is a **huge senior engineering signal**.

---

## 14. Branded Types (Advanced Safety)

```ts
type UserId = string & { readonly brand: unique symbol };

function createUserId(id: string): UserId {
  return id as UserId;
}
```

Prevents:

```ts
const postId: string = "123";
const userId: UserId = postId; // ❌
```

Used in:

- Finance
- IDs
- Security-sensitive apps

---

## 15. When NOT to Use Advanced Types

Senior rule:

- Avoid clever types if they hurt readability
- Prefer simple interfaces
- Types are for humans first, compiler second

---

## 16. What Interviewers Actually Look For

They check if you:

- Model states correctly
- Avoid impossible states
- Use `unknown` safely
- Use discriminated unions
- Avoid `any`
- Understand generics deeply

---

## 17. One-Line Senior Summary

> Advanced TypeScript is about **designing correct systems**, not writing complex types.
