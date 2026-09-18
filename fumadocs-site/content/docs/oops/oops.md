---
title: "OOPS Notes"
description: "Object-Oriented Programming pillars, SOLID principles, and design patterns for interviews."
---

# 📘 Object-Oriented Programming (OOPS)

## Table of Contents

1. [What Is OOP](#1-what-is-oop)
2. [Classes and Objects](#2-classes-and-objects)
3. [The Four Pillars](#3-the-four-pillars)
   - [Encapsulation](#31-encapsulation)
   - [Abstraction](#32-abstraction)
   - [Inheritance](#33-inheritance)
   - [Polymorphism](#34-polymorphism)
4. [Encapsulation vs Abstraction](#4-encapsulation-vs-abstraction)
5. [Composition vs Inheritance](#5-composition-vs-inheritance)
6. [SOLID Principles](#6-solid-principles)
   - [Single Responsibility Principle](#61-single-responsibility-principle)
   - [Open/Closed Principle](#62-openclosed-principle)
   - [Liskov Substitution Principle](#63-liskov-substitution-principle)
   - [Interface Segregation Principle](#64-interface-segregation-principle)
   - [Dependency Inversion Principle](#65-dependency-inversion-principle)
7. [UML Relationships](#7-uml-relationships)
8. [Common Design Patterns](#8-common-design-patterns)
   - [Singleton](#81-singleton)
   - [Factory](#82-factory)
   - [Strategy](#83-strategy)
   - [Observer](#84-observer)
   - [Decorator](#85-decorator)
9. [OOP in JavaScript vs Classical OOP](#9-oop-in-javascript-vs-classical-oop)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Common Interview Questions](#11-common-interview-questions)
12. [One-Line Senior Summary](#12-one-line-senior-summary)

---

## 1. What Is OOP

Object-Oriented Programming is a paradigm that models software as a collection of **objects**, each bundling **state** (data) and **behavior** (methods) together, instead of separating data and functions.

It exists to make large systems easier to reason about by mapping code structure to real-world (or domain) entities: a `User`, an `Order`, a `PaymentMethod`.

---

## 2. Classes and Objects

- **Class** — a blueprint that defines what data and behavior instances of it will have.
- **Object** — a concrete instance of a class, with its own state.

```ts
class BankAccount {
  private balance: number;

  constructor(initialBalance: number) {
    this.balance = initialBalance;
  }

  deposit(amount: number): void {
    this.balance += amount;
  }

  getBalance(): number {
    return this.balance;
  }
}

const acc = new BankAccount(100); // acc is an object (instance)
acc.deposit(50);
console.log(acc.getBalance()); // 150
```

---

## 3. The Four Pillars

### 3.1 Encapsulation

Bundling data with the methods that operate on it, and restricting direct access to internal state.

```ts
class BankAccount {
  #balance: number; // truly private field

  constructor(balance: number) {
    this.#balance = balance;
  }

  withdraw(amount: number): void {
    if (amount > this.#balance) {
      throw new Error("Insufficient funds");
    }
    this.#balance -= amount;
  }

  get balance(): number {
    return this.#balance;
  }
}
```

Why it matters: `#balance` can't be set to a negative number from outside the class. All mutation goes through `withdraw`/`deposit`, which enforce the account's invariants.

### 3.2 Abstraction

Exposing only the essential behavior to the caller and hiding implementation detail.

```ts
interface PaymentGateway {
  charge(amount: number): Promise<boolean>;
}

class StripeGateway implements PaymentGateway {
  async charge(amount: number): Promise<boolean> {
    // complex HTTP calls, retries, signature verification hidden here
    return true;
  }
}

function checkout(gateway: PaymentGateway, amount: number) {
  // checkout() doesn't know or care HOW charging happens
  return gateway.charge(amount);
}
```

Why it matters: `checkout()` can work with `StripeGateway`, `PaypalGateway`, or a `MockGateway` in tests, without ever knowing their internals.

### 3.3 Inheritance

A class (subclass) acquires fields and methods from another class (superclass), enabling code reuse and an "is-a" relationship.

```ts
class Employee {
  constructor(protected name: string, protected baseSalary: number) {}

  getSalary(): number {
    return this.baseSalary;
  }
}

class Manager extends Employee {
  constructor(name: string, baseSalary: number, private bonus: number) {
    super(name, baseSalary);
  }

  getSalary(): number {
    return this.baseSalary + this.bonus; // overrides base behavior
  }
}
```

`Manager` **is an** `Employee`, with extra behavior layered on top.

### 3.4 Polymorphism

The same interface/method behaves differently depending on the actual object, allowing code to work with a general type while executing type-specific logic.

```ts
abstract class Shape {
  abstract area(): number;
}

class Circle extends Shape {
  constructor(private radius: number) { super(); }
  area(): number { return Math.PI * this.radius ** 2; }
}

class Rectangle extends Shape {
  constructor(private w: number, private h: number) { super(); }
  area(): number { return this.w * this.h; }
}

function printArea(shape: Shape) {
  console.log(shape.area()); // correct area() runs based on actual type
}

printArea(new Circle(2));      // 12.57
printArea(new Rectangle(3, 4)); // 12
```

Two common flavors:

- **Runtime (dynamic) polymorphism** — method overriding, resolved at runtime via the object's actual class (shown above).
- **Compile-time (static) polymorphism** — method overloading, resolved at compile time based on argument types/count (common in Java/C++, simulated in TS via overload signatures).

---

## 4. Encapsulation vs Abstraction

These get confused constantly in interviews:

- **Encapsulation** is about **hiding data** (implementation state) — a mechanism (`private`/`#field`, getters/setters).
- **Abstraction** is about **hiding complexity** (implementation detail) behind a simpler interface — a design decision (interfaces, abstract classes).

Analogy: a car's steering wheel is **abstraction** (you don't need to know how the steering rack works to drive). The steering rack being sealed inside the car body so you can't tamper with it is **encapsulation**.

---

## 5. Composition vs Inheritance

Inheritance models "is-a"; composition models "has-a" by including other objects as fields instead of extending them.

```ts
// Inheritance (is-a) — Manager IS an Employee
class Manager extends Employee { ... }

// Composition (has-a) — Car HAS an Engine
class Engine {
  start() { console.log("engine started"); }
}

class Car {
  private engine = new Engine();

  start() {
    this.engine.start();
  }
}
```

Rule of thumb, and a very common senior-level answer: **"favor composition over inheritance"** — deep inheritance hierarchies get fragile and hard to change (the "fragile base class" problem), while composition keeps components swappable and independently testable.

---

## 6. SOLID Principles

### 6.1 Single Responsibility Principle

A class should have only one reason to change.

Bad: an `Invoice` class that calculates totals *and* saves itself to the database *and* formats a PDF — three unrelated reasons to change.

Good: split into `Invoice` (data + calculation), `InvoiceRepository` (persistence), `InvoicePdfFormatter` (presentation).

### 6.2 Open/Closed Principle

Classes should be open for extension but closed for modification.

```ts
interface DiscountStrategy {
  apply(price: number): number;
}

class NoDiscount implements DiscountStrategy {
  apply(price: number) { return price; }
}

class SeasonalDiscount implements DiscountStrategy {
  apply(price: number) { return price * 0.9; }
}

function finalPrice(price: number, strategy: DiscountStrategy) {
  return strategy.apply(price);
}
```

Adding a new `BlackFridayDiscount` needs a new class, not edits to `finalPrice` or existing discount classes.

### 6.3 Liskov Substitution Principle

Subclasses must be substitutable for their base class without breaking correctness.

Classic violation:

```ts
class Bird {
  fly(): void { console.log("flying"); }
}

class Penguin extends Bird {
  fly(): void { throw new Error("Penguins can't fly!"); } // breaks LSP
}
```

Any code that does `bird.fly()` expecting a `Bird` now crashes when handed a `Penguin`. Fix: don't model `Penguin` as a `Bird` that flies — separate `FlyingBird` and `FlightlessBird`, or use composition.

### 6.4 Interface Segregation Principle

Prefer many small, specific interfaces over one large, general-purpose one, so implementers aren't forced to implement methods they don't need.

```ts
// Bad: one fat interface
interface Worker {
  work(): void;
  eat(): void;
}

// A Robot implementing Worker is forced to implement eat(), which makes no sense.

// Good: split it
interface Workable { work(): void; }
interface Eatable { eat(): void; }

class Robot implements Workable {
  work() { console.log("welding"); }
}

class Human implements Workable, Eatable {
  work() { console.log("coding"); }
  eat() { console.log("lunch"); }
}
```

### 6.5 Dependency Inversion Principle

High-level modules shouldn't depend on low-level modules directly, both should depend on abstractions.

```ts
// Bad: OrderService is tightly coupled to a concrete MySQLDatabase
class OrderService {
  private db = new MySQLDatabase();
}

// Good: depends on an interface, concrete implementation is injected
interface Database {
  save(order: Order): void;
}

class OrderService {
  constructor(private db: Database) {} // dependency injected
}

class MySQLDatabase implements Database {
  save(order: Order) { /* ... */ }
}
```

This is what makes swapping `MySQLDatabase` for `InMemoryTestDatabase` in unit tests trivial.

---

## 7. UML Relationships

Common relationships between classes, weakest to strongest coupling:

- **Association** — two classes interact, but neither owns the other (`Teacher` teaches `Student`).
- **Aggregation** — a "has-a" relationship where the part can exist independently of the whole (`Department` has `Professors`; a professor still exists if the department is dissolved).
- **Composition** — a stronger "has-a" where the part's lifecycle is bound to the whole (`House` has `Rooms`; a room doesn't exist without the house).
- **Inheritance (Generalization)** — "is-a" relationship (`Manager` is an `Employee`).
- **Realization/Implementation** — a class implements an interface's contract (`StripeGateway` implements `PaymentGateway`).

---

## 8. Common Design Patterns

### 8.1 Singleton

Ensures a class has exactly one instance, with a global access point.

```ts
class ConfigManager {
  private static instance: ConfigManager;
  private constructor(public settings: Record<string, string>) {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager({});
    }
    return ConfigManager.instance;
  }
}
```

Use case: app-wide configuration or a shared connection pool. Caution: overused Singletons become hidden global state that makes testing harder.

### 8.2 Factory

Delegates object creation to a dedicated method/class instead of calling `new` directly, so the caller doesn't need to know the concrete type.

```ts
interface Notification { send(msg: string): void; }
class EmailNotification implements Notification { send(msg: string) { /* ... */ } }
class SmsNotification implements Notification { send(msg: string) { /* ... */ } }

function createNotification(type: "email" | "sms"): Notification {
  return type === "email" ? new EmailNotification() : new SmsNotification();
}
```

### 8.3 Strategy

Encapsulates interchangeable algorithms behind a common interface, selected at runtime (already shown in [6.2](#62-openclosed-principle) with `DiscountStrategy`).

### 8.4 Observer

Defines a one-to-many dependency: when one object (subject) changes state, all its dependents (observers) are notified automatically.

```ts
class EventEmitter {
  private listeners: Array<(data: unknown) => void> = [];

  subscribe(fn: (data: unknown) => void) {
    this.listeners.push(fn);
  }

  publish(data: unknown) {
    this.listeners.forEach((fn) => fn(data));
  }
}

const orderPlaced = new EventEmitter();
orderPlaced.subscribe((data) => console.log("send confirmation email", data));
orderPlaced.subscribe((data) => console.log("update inventory", data));
orderPlaced.publish({ orderId: "123" });
```

This is the pattern behind DOM events, Redux subscriptions, and pub/sub systems.

### 8.5 Decorator

Adds behavior to an individual object dynamically, without altering other instances of the same class.

```ts
interface Coffee { cost(): number; }

class SimpleCoffee implements Coffee {
  cost() { return 2; }
}

class MilkDecorator implements Coffee {
  constructor(private coffee: Coffee) {}
  cost() { return this.coffee.cost() + 0.5; }
}

const order = new MilkDecorator(new SimpleCoffee());
console.log(order.cost()); // 2.5
```

---

## 9. OOP in JavaScript vs Classical OOP

- JS classes are **syntactic sugar over prototypal inheritance** — there's no real "class" at the engine level, just objects linked via `[[Prototype]]`.
- Private fields (`#field`) are a relatively recent (ES2022) addition; before that, privacy was only a convention (`_field`) or achieved via closures.
- JS supports multiple inheritance-like composition via **mixins** (functions that return a class extending their argument), since it only allows single `extends`.

```ts
const Serializable = (Base: any) => class extends Base {
  toJSON() { return JSON.stringify(this); }
};

class Model {}
class User extends Serializable(Model) {}
```

---

## 10. Common Pitfalls

- Overusing inheritance for code reuse when composition would be more flexible (see [Section 5](#5-composition-vs-inheritance)).
- Violating LSP by overriding a method to throw or no-op instead of properly modeling the type hierarchy.
- God classes that violate SRP by doing persistence, business logic, and presentation all in one place.
- Making everything `public` "to keep it simple," defeating encapsulation and letting invariants be broken from anywhere.
- Deep inheritance chains (4-5 levels) that make it hard to trace which class actually defines a given behavior.

---

## 11. Common Interview Questions

- "What are the four pillars of OOP?" — encapsulation, abstraction, inheritance, polymorphism, each with a concrete code example (see [Section 3](#3-the-four-pillars)).
- "Difference between abstraction and encapsulation?" — see [Section 4](#4-encapsulation-vs-abstraction).
- "Difference between method overloading and overriding?" — overloading is compile-time (same name, different signature); overriding is runtime (subclass redefines a parent method).
- "Why favor composition over inheritance?" — flexibility, avoids fragile base class problem, easier to test in isolation.
- "Explain SOLID with an example for each." — walk through [Section 6](#6-solid-principles) with the code samples.
- "What's the Liskov Substitution Principle, and give a violation example?" — the `Penguin extends Bird` example in [6.3](#63-liskov-substitution-principle).
- "Is JavaScript truly object-oriented?" — it's prototype-based; `class` syntax is sugar over prototypal inheritance (see [Section 9](#9-oop-in-javascript-vs-classical-oop)).

---

## 12. One-Line Senior Summary

> OOP pillars aren't checkboxes to recite, they're tools for managing change: encapsulation protects invariants, abstraction hides volatility, inheritance and composition model relationships, and polymorphism lets new types plug in without touching existing code.
