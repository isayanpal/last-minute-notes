---
title: "Typing, Tooling, and Modern Python"
description: "Type hints from basics to generics, Protocols, TypedDict, TypeIs, and PEP 695 syntax, runtime validation with Pydantic, virtual environments and packaging with pyproject.toml and uv, linting with Ruff, testing with pytest, logging, and a feature map of Python 3.8 to 3.14."
---

# 📘 Typing, Tooling, and Modern Python

Production Python in 2026 is typed, linted, tested, and packaged with `pyproject.toml`.
Interviewers for backend and ML engineering roles expect you to read modern type hints, explain how dependencies are isolated, and write a pytest test with fixtures and mocks.
This page covers those skills plus a feature map of recent versions.

## Table of Contents

1. [Type Hints Basics](#1-type-hints-basics)
2. [Generics and PEP 695 Syntax](#2-generics-and-pep-695-syntax)
3. [Advanced Typing](#3-advanced-typing)
4. [Type Checkers and Runtime Validation](#4-type-checkers-and-runtime-validation)
5. [Environments and Packaging](#5-environments-and-packaging)
6. [Linting and Formatting](#6-linting-and-formatting)
7. [Testing with pytest](#7-testing-with-pytest)
8. [Logging and Configuration](#8-logging-and-configuration)
9. [Standard Library Highlights](#9-standard-library-highlights)
10. [Feature Map: 3.8 to 3.14](#10-feature-map-38-to-314)
11. [Questions](#11-questions)

---

## 1. Type Hints Basics

Type hints are **not enforced at runtime**.
They are read by type checkers (mypy, Pyright, ty), IDEs, and libraries that choose to inspect them (Pydantic, FastAPI, dataclasses).

```python
def greet(name: str, times: int = 1) -> str:
    return ", ".join([f"hi {name}"] * times)

count: int = 0
scores: dict[str, list[float]] = {}            # built-in generics since 3.9
maybe: int | None = None                       # union syntax since 3.10
coords: tuple[float, float] = (0.0, 0.0)       # fixed length
values: tuple[int, ...] = (1, 2, 3)            # variable length
```

| Hint | Meaning |
| --- | --- |
| `X \| None` | Optional value (older: `Optional[X]`) |
| `Any` | Opt out of checking entirely |
| `object` | Anything, but you can only use `object` methods on it |
| `Callable[[int, str], bool]` | A function taking `(int, str)` returning `bool` |
| `Iterable[T]`, `Sequence[T]`, `Mapping[K, V]` | Accept the most general type you need (from `collections.abc`) |
| `list[T]`, `dict[K, V]` | Return concrete types |
| `Literal["r", "w"]` | Exact values |
| `Final` | Constant; must not be reassigned |
| `ClassVar[int]` | Class attribute, not an instance field (important in dataclasses) |
| `None` as return | Function returns nothing |
| `NoReturn` / `Never` | Function never returns (always raises or loops) |

**Rule of thumb:** accept abstract types (`Iterable`, `Mapping`), return concrete ones (`list`, `dict`).

### 1.1 Annotations at runtime

Python 3.14 (PEP 649 and 749) **defers evaluation of annotations**: they are computed only when something asks for them.
Forward references like `def f() -> Node` work without quotes or `from __future__ import annotations`, and the new `annotationlib` module can fetch them as values, forward references, or strings.

---

## 2. Generics and PEP 695 Syntax

Python 3.12 introduced built-in syntax for generics, replacing most uses of `TypeVar`.

```python
# 3.12+
def first[T](items: list[T]) -> T:
    return items[0]

class Stack[T]:
    def __init__(self) -> None:
        self.items: list[T] = []

    def push(self, item: T) -> None:
        self.items.append(item)

    def pop(self) -> T:
        return self.items.pop()

type Pair[K] = tuple[K, K]                   # type alias statement
type JSON = dict[str, JSON] | list[JSON] | str | int | float | bool | None   # recursive alias

def biggest[T: (int, float)](xs: list[T]) -> T: ...     # constrained
def longest[S: Sized](a: S, b: S) -> S: ...             # upper bound
class Box[T = int]: ...                                 # 3.13: type parameter default
```

The pre-3.12 equivalent for reading older code:

```python
from typing import TypeVar, Generic

T = TypeVar("T")

class Stack(Generic[T]):
    ...
```

**Variance** is inferred with the new syntax.
Remember the intuition: `list[Dog]` is **not** a `list[Animal]` (lists are mutable, so invariant), but `Sequence[Dog]` **is** a `Sequence[Animal]` (read-only, so covariant).

---

## 3. Advanced Typing

### 3.1 Protocols

Structural typing, covered on the [OOP page](/docs/python/python-oop#7-abstract-base-classes-and-protocols).

### 3.2 TypedDict

Types for dict-shaped data such as JSON payloads.

```python
from typing import TypedDict, NotRequired, ReadOnly

class User(TypedDict):
    id: ReadOnly[int]                # 3.13
    name: str
    email: NotRequired[str]

u: User = {"id": 1, "name": "ana"}
```

### 3.3 Narrowing

Type checkers narrow types after `isinstance`, `is None`, `in`, and `match`.

```python
from typing import TypeIs, assert_never

def is_str_list(val: list[object]) -> TypeIs[list[str]]:     # 3.13, better than TypeGuard
    return all(isinstance(x, str) for x in val)

def area(s: Circle | Square) -> float:
    match s:
        case Circle(): return 3.14159 * s.r ** 2
        case Square(): return s.side ** 2
        case _: assert_never(s)       # checker errors if a new shape is not handled
```

### 3.4 Other tools you will see

| Tool | Use |
| --- | --- |
| `Self` (3.11) | Methods returning their own class: `def copy(self) -> Self` |
| `@override` (3.12) | Checker errors if the method does not override anything |
| `@overload` | Several signatures for one function |
| `ParamSpec`, `Concatenate` | Type decorators that preserve the wrapped function's signature |
| `Annotated[int, Gt(0)]` | Attach metadata (used by Pydantic and FastAPI) |
| `NewType("UserId", int)` | A distinct type at check time, a plain `int` at runtime |
| `cast(T, x)` | Tell the checker to trust you; no runtime effect |
| `TYPE_CHECKING` | Import only for type checking, avoiding circular imports |
| `reveal_type(x)` | Ask the checker what it inferred |

```python
from typing import Callable
import functools

def logged[**P, R](fn: Callable[P, R]) -> Callable[P, R]:    # decorator keeps the signature
    @functools.wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print("calling", fn.__name__)
        return fn(*args, **kwargs)
    return wrapper
```

---

## 4. Type Checkers and Runtime Validation

| Tool | Notes |
| --- | --- |
| **mypy** | The original checker; `--strict` for new code |
| **Pyright** / Pylance | Fast, powers VS Code; strict mode is popular |
| **ty** (Astral) | Rust-based, very fast, newer |
| **Pyrefly** (Meta) | Rust-based, newer |

Gradual typing: start with public functions and new modules, turn on `strict` per package, and avoid sprinkling `Any`.

**Type hints do not validate data at runtime.**
For untrusted input (HTTP bodies, config, queue messages) use a validation library:

```python
from pydantic import BaseModel, EmailStr, Field

class SignUp(BaseModel):
    email: EmailStr
    age: int = Field(ge=13)
    tags: list[str] = []

SignUp.model_validate({"email": "a@b.com", "age": "21"})   # "21" coerced to 21
SignUp.model_validate({"email": "x", "age": 5})             # ValidationError listing both problems
```

FastAPI uses the same Pydantic models to validate requests and generate OpenAPI docs.
See the [Backend section](/docs/backend) for API design.

---

## 5. Environments and Packaging

### 5.1 Virtual environments

A **virtual environment** is a directory with its own `site-packages` and a `python` that uses it, so each project gets isolated dependency versions.

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
python -m pip install httpx
deactivate
```

Always run `python -m pip` rather than bare `pip` so you install into the interpreter you think you are using.
Most modern Linux distributions and Homebrew mark the system Python as **externally managed** (PEP 668), so `pip install` outside a venv is refused.

### 5.2 `pyproject.toml`

The single standard config file for metadata, dependencies, build backend, and tool settings.

```toml
[project]
name = "orders-service"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "httpx>=0.27",
]

[project.optional-dependencies]
postgres = ["asyncpg>=0.29"]

[dependency-groups]
dev = ["pytest>=8", "ruff", "mypy"]

[project.scripts]
orders = "orders_service.cli:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
line-length = 100
```

### 5.3 Tools

| Tool | Role |
| --- | --- |
| **uv** | Fast all-in-one: installs Python versions, creates venvs, resolves and locks dependencies (`uv.lock`), runs tools |
| pip + venv | The built-in baseline |
| Poetry, PDM, Hatch | Project managers with lock files |
| pipx / `uv tool` | Install CLI apps in isolated environments |
| conda / pixi | Environments that include non-Python binaries (CUDA, GDAL), common in data science |

```bash
uv init myapp && cd myapp
uv add fastapi httpx          # updates pyproject.toml and uv.lock
uv add --dev pytest ruff
uv run pytest                 # runs inside the project environment
uv python install 3.14
uvx ruff check .              # run a tool without installing it
```

**Lock files** pin every transitive dependency to an exact version and hash, so CI and production install exactly what you tested.
Libraries declare ranges in `pyproject.toml`; applications also commit a lock file.

### 5.4 Wheels vs source distributions

- A **wheel** (`.whl`) is a pre-built archive that installs by unzipping, including compiled extensions for a specific platform.
- An **sdist** (`.tar.gz`) is source that must be built on install, which may need a compiler.

---

## 6. Linting and Formatting

| Tool | Role |
| --- | --- |
| **Ruff** | Linter and formatter in one (replaces flake8, isort, pyupgrade, and Black-compatible formatting), very fast |
| Black | The formatter that standardized Python style |
| pre-commit | Run linters on every commit |

PEP 8 highlights interviewers notice: `snake_case` for functions and variables, `PascalCase` for classes, `UPPER_CASE` for constants, 4-space indentation, and imports grouped as standard library, third-party, then local.

---

## 7. Testing with pytest

```python
# test_cart.py
import pytest
from cart import Cart, OutOfStock

@pytest.fixture
def cart() -> Cart:
    return Cart(stock={"apple": 3})

def test_add_item(cart: Cart) -> None:
    cart.add("apple", 2)
    assert cart.count("apple") == 2          # plain assert, rich failure diffs

def test_out_of_stock(cart: Cart) -> None:
    with pytest.raises(OutOfStock, match="apple"):
        cart.add("apple", 10)

@pytest.mark.parametrize(("qty", "expected"), [(1, 1.0), (10, 9.0), (100, 80.0)])
def test_bulk_discount(qty: int, expected: float) -> None:
    assert price_for(qty) == pytest.approx(expected)
```

| Feature | Use |
| --- | --- |
| Fixtures | Setup and teardown with `yield`; scopes `function`, `module`, `session`; share via `conftest.py` |
| `tmp_path`, `monkeypatch`, `capsys` | Built-in fixtures for temp dirs, patching env and attributes, capturing output |
| `parametrize` | Table-driven tests |
| Markers | `@pytest.mark.slow`, `skip`, `xfail` |
| `pytest -x -k name --lf` | Stop on first failure, filter by name, rerun last failures |
| `pytest-cov`, `pytest-xdist`, `pytest-asyncio` | Coverage, parallel runs, async tests |

### 7.1 Mocking

```python
from unittest.mock import patch, MagicMock

def test_fetch_user_handles_404():
    with patch("app.users.httpx.get") as fake_get:     # patch where it is LOOKED UP, not where defined
        fake_get.return_value = MagicMock(status_code=404)
        assert fetch_user(1) is None
        fake_get.assert_called_once_with("https://api/users/1", timeout=5)
```

The most common mocking bug is patching the wrong path: if `app/users.py` does `from httpx import get`, patch `app.users.get`.
Prefer fakes and dependency injection over deep mocking; mocks that mirror implementation details make refactors painful.

---

## 8. Logging and Configuration

```python
import logging

log = logging.getLogger(__name__)          # one logger per module

def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    log.info("user %s logged in", user_id)  # lazy formatting, not an f-string
    try:
        risky()
    except Exception:
        log.exception("risky failed")       # logs the traceback at ERROR level
```

- Libraries should only create loggers, never configure handlers; the application configures logging once at startup.
- Use `%s` arguments so the message is only formatted if the level is enabled.
- For production, emit structured JSON logs (`structlog` or a JSON formatter) so your log platform can index fields.
- Read config from environment variables (`os.environ`, `pydantic-settings`) following twelve-factor practice; parse TOML with the built-in `tomllib` (3.11).

---

## 9. Standard Library Highlights

| Module | Reach for it when |
| --- | --- |
| `pathlib` | Any file path work: `Path("data") / "x.csv"`, `.read_text()`, `.glob("*.py")` |
| `datetime`, `zoneinfo` | Time; always use timezone-aware datetimes (`datetime.now(UTC)`) |
| `json`, `csv`, `tomllib` | Data formats |
| `re` | Regular expressions; compile once for hot paths |
| `subprocess.run([...], check=True, capture_output=True, text=True)` | Run commands; never `shell=True` with user input |
| `argparse` | CLIs (or Typer and Click from PyPI) |
| `dataclasses`, `enum`, `typing` | Modeling |
| `functools`, `itertools`, `collections`, `heapq`, `bisect` | Algorithms |
| `concurrent.futures`, `asyncio` | Concurrency |
| `contextlib` | Context manager helpers |
| `secrets` | Security tokens (not `random`) |
| `hashlib`, `hmac` | Hashing and signatures |
| `sqlite3` | Embedded database |
| `unittest.mock` | Test doubles |
| `compression.zstd` (3.14) | Zstandard compression |

---

## 10. Feature Map: 3.8 to 3.14

| Version | Language features you should recognize |
| --- | --- |
| 3.8 | `:=` walrus, positional-only `/`, `f"{x=}"`, `TypedDict`, `Protocol`, `Literal`, `Final` |
| 3.9 | `dict \| dict`, `str.removeprefix`, `list[int]` hints, `zoneinfo`, `functools.cache` |
| 3.10 | `match`, `int \| str` unions, parenthesized context managers, `zip(strict=True)`, dataclass `slots` and `kw_only` |
| 3.11 | About 25 percent faster, `ExceptionGroup` and `except*`, `TaskGroup`, `asyncio.timeout`, `tomllib`, `Self`, `StrEnum`, fine-grained error locations |
| 3.12 | `def f[T]()` and `type` statement (PEP 695), flexible f-strings (PEP 701), `@override`, `itertools.batched`, per-interpreter GIL |
| 3.13 | New colorful REPL, experimental free-threading and JIT, `TypeIs`, `ReadOnly`, type parameter defaults, `copy.replace`, dead batteries removed |
| 3.14 | t-strings, deferred annotations, `except A, B:` without parentheses, supported free-threaded build, `concurrent.interpreters`, `compression.zstd`, `heapq` max-heap functions, `pdb -p PID`, forkserver default on Linux |

---

## 11. Questions

**Q: Are type hints enforced at runtime?**
No; they are metadata for tools, and only libraries like Pydantic choose to validate against them.

**Q: `Optional[int]` vs `int | None`?**
Identical; `int | None` is the modern syntax since 3.10.

**Q: What is a Protocol and when would you use it over an ABC?**
A structural type checked by shape, useful for accepting any object with the right methods without forcing inheritance.

**Q: Why is `list[Dog]` not a `list[Animal]`?**
Lists are mutable, so allowing it would let you append a `Cat` into a list of dogs; mutable containers are invariant.

**Q: What is a virtual environment and why use one?**
An isolated interpreter environment with its own installed packages, so projects do not conflict and dependencies are reproducible.

**Q: Why have a lock file?**
It pins exact versions and hashes of every transitive dependency so every install is identical and supply-chain changes are visible.

**Q: How do you patch a dependency in a test?**
`unittest.mock.patch` on the name where the code under test looks it up, or better, inject the dependency.

**Q: What are pytest fixtures?**
Functions that provide setup (and teardown after `yield`) to tests by parameter name, with configurable scope and sharing via `conftest.py`.

**Q: Why use `%s` arguments instead of f-strings in log calls?**
Formatting is deferred until the record is actually emitted, and log aggregation can group messages by template.
