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

**Java:**

```java
public class BankAccount {
    private double balance;

    public BankAccount(double initialBalance) {
        this.balance = initialBalance;
    }

    public void deposit(double amount) {
        this.balance += amount;
    }

    public double getBalance() {
        return balance;
    }
}

public class Main {
    public static void main(String[] args) {
        BankAccount acc = new BankAccount(100); // acc is an object (instance)
        acc.deposit(50);
        System.out.println(acc.getBalance()); // 150.0
    }
}
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

**Java:**

```java
public class BankAccount {
    private double balance; // private: only this class can touch it

    public BankAccount(double balance) {
        this.balance = balance;
    }

    public void withdraw(double amount) {
        if (amount > balance) {
            throw new IllegalArgumentException("Insufficient funds");
        }
        balance -= amount;
    }

    public double getBalance() { // getter only, no setter
        return balance;
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

**Java:**

```java
public interface PaymentGateway {
    boolean charge(double amount);
}

public class StripeGateway implements PaymentGateway {
    @Override
    public boolean charge(double amount) {
        // complex HTTP calls, retries, signature verification hidden here
        return true;
    }
}

public class CheckoutService {
    // doesn't know or care HOW charging happens
    public boolean checkout(PaymentGateway gateway, double amount) {
        return gateway.charge(amount);
    }
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

**Java:**

```java
public class Employee {
    protected String name;
    protected double baseSalary;

    public Employee(String name, double baseSalary) {
        this.name = name;
        this.baseSalary = baseSalary;
    }

    public double getSalary() {
        return baseSalary;
    }
}

public class Manager extends Employee {
    private double bonus;

    public Manager(String name, double baseSalary, double bonus) {
        super(name, baseSalary);
        this.bonus = bonus;
    }

    @Override
    public double getSalary() {
        return baseSalary + bonus; // overrides base behavior
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

**Java:**

```java
public abstract class Shape {
    public abstract double area();
}

public class Circle extends Shape {
    private final double radius;

    public Circle(double radius) { this.radius = radius; }

    @Override
    public double area() { return Math.PI * radius * radius; }
}

public class Rectangle extends Shape {
    private final double w, h;

    public Rectangle(double w, double h) { this.w = w; this.h = h; }

    @Override
    public double area() { return w * h; }
}

static void printArea(Shape shape) {
    System.out.println(shape.area()); // correct area() runs based on actual type
}

printArea(new Circle(2));       // 12.566...
printArea(new Rectangle(3, 4)); // 12.0
```

Two common flavors:

- **Runtime (dynamic) polymorphism** — method overriding, resolved at runtime via the object's actual class (shown above).
- **Compile-time (static) polymorphism** — method overloading, resolved at compile time based on argument types/count (common in Java/C++, simulated in TS via overload signatures).

Java supports both natively. Overloading (compile-time) vs overriding (runtime):

```java
class Calculator {
    int add(int a, int b) { return a + b; }             // overloading: same name,
    double add(double a, double b) { return a + b; }    // different parameter types
    int add(int a, int b, int c) { return a + b + c; }  // or different count
}

Shape s = new Circle(2);
s.area(); // overriding: Circle.area() chosen at runtime from the actual object
```

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

**Java:**

```java
// Inheritance (is-a) - Manager IS an Employee
class Manager extends Employee { /* ... */ }

// Composition (has-a) - Car HAS an Engine
class Engine {
    void start() { System.out.println("engine started"); }
}

class Car {
    private final Engine engine = new Engine();

    void start() {
        engine.start();
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

**Java:**

```java
// Bad: three reasons to change in one class
class Invoice {
    double calculateTotal() { /* ... */ return 0; }
    void saveToDatabase() { /* ... */ }
    byte[] renderPdf() { /* ... */ return new byte[0]; }
}

// Good: one responsibility each
class Invoice {
    double calculateTotal() { /* data + calculation */ return 0; }
}

class InvoiceRepository {
    void save(Invoice invoice) { /* persistence */ }
}

class InvoicePdfFormatter {
    byte[] format(Invoice invoice) { /* presentation */ return new byte[0]; }
}
```

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

**Java:**

```java
interface DiscountStrategy {
    double apply(double price);
}

class NoDiscount implements DiscountStrategy {
    public double apply(double price) { return price; }
}

class SeasonalDiscount implements DiscountStrategy {
    public double apply(double price) { return price * 0.9; }
}

class PriceCalculator {
    static double finalPrice(double price, DiscountStrategy strategy) {
        return strategy.apply(price);
    }
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

**Java:**

```java
class Bird {
    void fly() { System.out.println("flying"); }
}

class Penguin extends Bird {
    @Override
    void fly() { throw new UnsupportedOperationException("Penguins can't fly!"); } // breaks LSP
}

// Fix: split the hierarchy so only flying birds promise fly()
interface Flyable { void fly(); }

abstract class Bird { /* eat(), layEggs(), ... */ }
class Sparrow extends Bird implements Flyable {
    public void fly() { System.out.println("flying"); }
}
class Penguin extends Bird { /* no fly() to break */ }
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

**Java:**

```java
// Bad: one fat interface
interface Worker {
    void work();
    void eat();
}
// A Robot implementing Worker is forced to implement eat(), which makes no sense.

// Good: split it
interface Workable { void work(); }
interface Eatable { void eat(); }

class Robot implements Workable {
    public void work() { System.out.println("welding"); }
}

class Human implements Workable, Eatable {
    public void work() { System.out.println("coding"); }
    public void eat() { System.out.println("lunch"); }
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

**Java:**

```java
// Bad: OrderService is tightly coupled to a concrete MySQLDatabase
class OrderService {
    private final MySQLDatabase db = new MySQLDatabase();
}

// Good: depends on an interface, concrete implementation is injected
interface Database {
    void save(Order order);
}

class OrderService {
    private final Database db;

    OrderService(Database db) { // dependency injected via constructor
        this.db = db;
    }
}

class MySQLDatabase implements Database {
    public void save(Order order) { /* ... */ }
}

class InMemoryTestDatabase implements Database {
    public void save(Order order) { /* ... */ }
}

OrderService service = new OrderService(new InMemoryTestDatabase()); // e.g. in a unit test
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

**Java:**

```java
// Association: Teacher uses Student, neither owns the other
class Teacher {
    void teach(Student student) { /* ... */ }
}

// Aggregation: Professors are created elsewhere and outlive the Department
class Department {
    private final List<Professor> professors;

    Department(List<Professor> professors) {
        this.professors = professors;
    }
}

// Composition: House creates its Rooms, so Rooms die with the House
class House {
    private final List<Room> rooms = new ArrayList<>();

    House() {
        rooms.add(new Room("Kitchen"));
        rooms.add(new Room("Bedroom"));
    }
}

// Inheritance (Generalization)
class Manager extends Employee { /* ... */ }

// Realization
class StripeGateway implements PaymentGateway { /* ... */ }
```

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

**Java:**

```java
public class ConfigManager {
    private final Map<String, String> settings = new HashMap<>();

    private ConfigManager() {} // no outside instantiation

    // Initialization-on-demand holder: lazy and thread-safe without explicit locking
    private static class Holder {
        private static final ConfigManager INSTANCE = new ConfigManager();
    }

    public static ConfigManager getInstance() {
        return Holder.INSTANCE;
    }

    public Map<String, String> getSettings() {
        return settings;
    }
}

// Simplest thread-safe alternative (also safe against reflection and serialization):
enum AppConfig {
    INSTANCE;
    private final Map<String, String> settings = new HashMap<>();
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

**Java:**

```java
interface Notification {
    void send(String msg);
}

class EmailNotification implements Notification {
    public void send(String msg) { /* ... */ }
}

class SmsNotification implements Notification {
    public void send(String msg) { /* ... */ }
}

class NotificationFactory {
    static Notification create(String type) {
        return switch (type) {
            case "email" -> new EmailNotification();
            case "sms" -> new SmsNotification();
            default -> throw new IllegalArgumentException("Unknown type: " + type);
        };
    }
}

Notification n = NotificationFactory.create("email"); // caller only sees the interface
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

**Java:**

```java
interface Observer<T> {
    void update(T data);
}

class EventEmitter<T> {
    private final List<Observer<T>> listeners = new ArrayList<>();

    void subscribe(Observer<T> observer) {
        listeners.add(observer);
    }

    void publish(T data) {
        listeners.forEach(o -> o.update(data));
    }
}

EventEmitter<String> orderPlaced = new EventEmitter<>();
orderPlaced.subscribe(id -> System.out.println("send confirmation email " + id));
orderPlaced.subscribe(id -> System.out.println("update inventory " + id));
orderPlaced.publish("123");
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

**Java:**

```java
interface Coffee {
    double cost();
}

class SimpleCoffee implements Coffee {
    public double cost() { return 2; }
}

class MilkDecorator implements Coffee {
    private final Coffee coffee;

    MilkDecorator(Coffee coffee) { this.coffee = coffee; }

    public double cost() { return coffee.cost() + 0.5; }
}

Coffee order = new MilkDecorator(new SimpleCoffee());
System.out.println(order.cost()); // 2.5
```

`java.io` is the classic real-world example: `new BufferedReader(new InputStreamReader(System.in))` wraps one reader in another.

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

Java also has single class inheritance, but allows multiple interfaces, and `default` methods give mixin-like reuse:

```java
interface Loggable {
    default void log(String msg) { System.out.println("[LOG] " + msg); }
}

interface Serializable {
    default String toJson() { return "{}"; } // real code would delegate to Jackson/Gson
}

class Model {}
class User extends Model implements Loggable, Serializable {}
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
