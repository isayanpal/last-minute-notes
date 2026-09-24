---
title: "Number Systems and Data Representation"
description: "How computers represent data: bits and bytes, binary, octal, and hex conversions, unsigned and two's complement integers, overflow, bitwise operations and tricks, IEEE 754 floating point and why 0.1 + 0.2 is not 0.3, fixed point and decimals for money, characters from ASCII to Unicode and UTF-8, endianness, and data units."
---

# 📘 Number Systems and Data Representation

Everything in a computer is bits.
This page explains how bits become integers, fractions, text, and multi-byte values, and where those representations surprise programmers.
Every example value on this page was checked with Python.

## Table of Contents

1. [Bits, Bytes, and Words](#1-bits-bytes-and-words)
2. [Number Bases and Conversion](#2-number-bases-and-conversion)
3. [Unsigned Integers](#3-unsigned-integers)
4. [Signed Integers and Two's Complement](#4-signed-integers-and-twos-complement)
5. [Overflow](#5-overflow)
6. [Bitwise Operations](#6-bitwise-operations)
7. [Floating Point (IEEE 754)](#7-floating-point-ieee-754)
8. [Money and Exact Decimals](#8-money-and-exact-decimals)
9. [Characters and Text Encoding](#9-characters-and-text-encoding)
10. [Endianness](#10-endianness)
11. [Data Size Units](#11-data-size-units)
12. [Questions](#12-questions)

---

## 1. Bits, Bytes, and Words

| Unit | Size | Values |
| --- | --- | --- |
| **Bit** | 1 binary digit | 0 or 1 |
| **Nibble** | 4 bits | 16, one hex digit |
| **Byte** | 8 bits | 256, the smallest addressable unit |
| **Word** | The CPU's natural size | 64 bits on modern CPUs (x86-64, ARM64) |

With `n` bits you can represent **2^n** distinct values.
Powers of two worth memorizing: 2^8 = 256, 2^10 = 1,024, 2^16 = 65,536, 2^20 ≈ 1 million, 2^30 ≈ 1 billion, 2^31 ≈ 2.1 billion, 2^32 ≈ 4.3 billion, 2^63 ≈ 9.2 x 10^18, 2^64 ≈ 1.8 x 10^19.

---

## 2. Number Bases and Conversion

| Base | Digits | Prefix | Example (45 decimal) |
| --- | --- | --- | --- |
| Binary (2) | 0, 1 | `0b` | `0b101101` |
| Octal (8) | 0 to 7 | `0o` or leading `0` in C | `0o55` |
| Decimal (10) | 0 to 9 | none | `45` |
| Hexadecimal (16) | 0 to 9, A to F | `0x` | `0x2D` |

**Decimal to binary**: divide by 2 repeatedly, read remainders bottom up.

```text
45 / 2 = 22 r 1
22 / 2 = 11 r 0
11 / 2 =  5 r 1
 5 / 2 =  2 r 1
 2 / 2 =  1 r 0
 1 / 2 =  0 r 1      -> read upward: 101101
```

**Binary to decimal**: sum the powers of two where bits are 1: `101101` = 32 + 8 + 4 + 1 = 45.

**Binary to hex**: group 4 bits from the right; each group is one hex digit.
`1101 1110 1010 1101` = `D E A D` = `0xDEAD`.
Octal groups 3 bits the same way (which is why Unix permissions like `755` are octal: `rwx` is 3 bits).

Hex is popular because two hex digits are exactly one byte: colors (`#FF8800`), memory addresses, hashes, MAC addresses.

---

## 3. Unsigned Integers

An n-bit unsigned integer holds 0 to 2^n - 1.

| Type | Bits | Max |
| --- | --- | --- |
| `uint8` | 8 | 255 |
| `uint16` | 16 | 65,535 |
| `uint32` | 32 | 4,294,967,295 |
| `uint64` | 64 | 18,446,744,073,709,551,615 |

Java has no unsigned primitive types (except `char`), which is why it offers `Integer.toUnsignedString` and friends.

---

## 4. Signed Integers and Two's Complement

Three historical schemes for negative numbers:

| Scheme | -5 in 8 bits | Problem |
| --- | --- | --- |
| **Sign-magnitude** | `10000101` | Two zeros (+0, -0), addition needs special cases |
| **One's complement** | `11111010` (flip all bits) | Still two zeros |
| **Two's complement** | `11111011` (flip, add 1) | One zero, same adder works for signed and unsigned: **used by every modern CPU** |

To negate in two's complement: **invert all bits and add 1**.

```text
 13 = 00001101
~13 = 11110010
+1  = 11110011   -> this is -13
```

Check: `11110011` + `00001101` = `1 00000000`; the carry out drops, leaving 0.

| Bits | Range |
| --- | --- |
| 8 | -128 to 127 |
| 16 | -32,768 to 32,767 |
| 32 | -2,147,483,648 to 2,147,483,647 |
| 64 | about -9.2 x 10^18 to 9.2 x 10^18 |

The range is asymmetric: there is one more negative value than positive, so `abs(INT_MIN)` overflows (it stays `INT_MIN` in Java and is undefined behavior in C).

The top bit tells the sign, and its weight is **negative**: `11110011` = -128 + 64 + 32 + 16 + 2 + 1 = -13.

**Sign extension**: widening a signed value copies the sign bit into the new high bits (`11110011` becomes `11111111 11110011`), keeping the value -13.

---

## 5. Overflow

Fixed-width integers wrap around.

```text
int8:  127 + 1  = -128      (01111111 + 1 = 10000000)
uint8: 0 - 1    = 255
int32: 2,147,483,647 + 1 = -2,147,483,648
```

| Language | On signed overflow |
| --- | --- |
| C, C++ | **Undefined behavior**: the compiler may assume it never happens and optimize accordingly |
| Java, C#, Go | Wraps silently (two's complement); `Math.addExact` throws |
| Rust | Panics in debug builds, wraps in release; `checked_add`, `wrapping_add`, `saturating_add` |
| Python | Arbitrary precision integers, no overflow |
| JavaScript | Numbers are doubles; integers are exact only up to 2^53 - 1 (`Number.MAX_SAFE_INTEGER`); `BigInt` for more |

Famous overflow bugs:

- **Binary search midpoint**: `mid = (lo + hi) / 2` overflows for large arrays; use `lo + (hi - lo) / 2`. This bug sat in the JDK for about nine years.
- **Year 2038**: 32-bit signed `time_t` overflows on 19 January 2038; 64-bit time fixes it.
- **Ariane 5** (1996): a 64-bit float converted to a 16-bit integer overflowed and destroyed the rocket.
- **Gangnam Style** exceeded YouTube's 32-bit view counter in 2014.

JavaScript example: `2 ** 53 + 1 === 2 ** 53` is `true`, which is why large IDs (Twitter/X snowflake IDs) are sent as strings in JSON.

---

## 6. Bitwise Operations

| Operator | Meaning | Example (6 = `110`, 3 = `011`) |
| --- | --- | --- |
| `&` AND | 1 if both are 1 | `6 & 3 = 2` (`010`) |
| `\|` OR | 1 if either is 1 | `6 \| 3 = 7` (`111`) |
| `^` XOR | 1 if they differ | `6 ^ 3 = 5` (`101`) |
| `~` NOT | Flip all bits | `~5 = -6` |
| `<<` left shift | Multiply by 2^k | `3 << 2 = 12` |
| `>>` right shift | Divide by 2^k (arithmetic keeps sign) | `-5 >> 1 = -3` (rounds toward negative infinity) |
| `>>>` (Java, JS) | Logical right shift, fills with zeros | `-1 >>> 28 = 15` |

### Common tricks

| Goal | Expression | Example with x = 12 (`1100`) |
| --- | --- | --- |
| Check bit k | `(x >> k) & 1` | bit 2 of 12 is 1 |
| Set bit k | `x \| (1 << k)` | |
| Clear bit k | `x & ~(1 << k)` | |
| Toggle bit k | `x ^ (1 << k)` | |
| Lowest set bit | `x & -x` | 4 (`0100`) |
| Clear lowest set bit | `x & (x - 1)` | 8 (`1000`) |
| Is power of two | `x > 0 && (x & (x - 1)) == 0` | 12 is not |
| Count set bits | Loop `x &= x - 1`, or `popcount` | 2 |
| Even or odd | `x & 1` | even |
| Swap without temp | `a ^= b; b ^= a; a ^= b;` | Clever, rarely worth it |
| Find the single non-duplicate | XOR everything | Pairs cancel out |

Real uses: permission flags (`O_RDONLY | O_CREAT`), bitmaps and Bloom filters, hash functions, network masks (`ip & mask`), compact sets (bitmask DP), and feature flags packed into one integer.

---

## 7. Floating Point (IEEE 754)

Floating point stores numbers in **scientific notation in base 2**: `(-1)^sign x 1.mantissa x 2^(exponent - bias)`.

| Format | Total | Sign | Exponent | Mantissa (fraction) | Bias | Decimal digits |
| --- | --- | --- | --- | --- | --- | --- |
| **Half (fp16)** | 16 | 1 | 5 | 10 | 15 | about 3 |
| **bfloat16** | 16 | 1 | 8 | 7 | 127 | about 2 (same range as fp32, used in ML) |
| **Single (float)** | 32 | 1 | 8 | 23 | 127 | about 7 |
| **Double** | 64 | 1 | 11 | 52 | 1023 | about 15 to 16 |

### Encoding -5.75 as a float

1. Sign: negative, so 1.
2. 5.75 in binary: 5 = `101`, 0.75 = `.11`, so `101.11`.
3. Normalize: `1.0111 x 2^2`.
4. Exponent: 2 + 127 = 129 = `10000001`.
5. Mantissa: bits after the leading 1: `0111` followed by zeros.
6. Result: `1 10000001 01110000000000000000000` = **`0xC0B80000`**.

### Why 0.1 + 0.2 != 0.3

0.1 in binary is `0.000110011001100...` repeating forever, like 1/3 in decimal.
It must be rounded to the nearest representable value (as a float, `0x3DCCCCCD`), and so must 0.2.
The rounding errors add up: in double precision, `0.1 + 0.2` is `0.30000000000000004`.

Rules that follow:

- Never compare floats with `==`; compare with a tolerance: `abs(a - b) <= eps * max(abs(a), abs(b))`.
- Adding a tiny number to a huge one may do nothing: `1e16 + 1 == 1e16` is true in doubles.
- Summation order changes results; use Kahan summation or higher precision for long sums.
- Integers are exact in a double only up to 2^53.

### Special values

| Value | Encoding | Arises from |
| --- | --- | --- |
| **+0 and -0** | Exponent and mantissa all zero, sign differs | `-0.0 == 0.0` is true, but `1 / -0.0 = -Infinity` |
| **Infinity** | Exponent all ones, mantissa zero (`0x7F800000`) | `1.0 / 0.0`, overflow |
| **NaN** | Exponent all ones, mantissa nonzero | `0.0 / 0.0`, `sqrt(-1)`; `NaN != NaN` |
| **Subnormals** | Exponent zero, mantissa nonzero | Very tiny values near zero, gradual underflow; can be slow on some CPUs |

Largest float is about 3.4 x 10^38, smallest positive subnormal float about 1.4 x 10^-45.

Machine learning increasingly uses low precision (bfloat16, fp8, even 4-bit formats) because models tolerate rounding and smaller numbers mean more throughput per memory byte.

---

## 8. Money and Exact Decimals

**Never store money in binary floating point.**

| Approach | Example |
| --- | --- |
| **Integer minor units** | Store cents as `long`: $19.99 is `1999` |
| **Decimal types** | Java `BigDecimal`, Python `decimal.Decimal`, C# `decimal`, SQL `NUMERIC(19, 4)` |
| **Always store the currency** | Amount alone is ambiguous; different currencies have different minor units (JPY has 0, KWD has 3) |

Rounding mode matters too: financial systems often use **banker's rounding** (round half to even) to avoid systematic bias.
Python's `round(2.675, 2)` returns `2.67`, not because of banker's rounding but because 2.675 is actually stored as 2.67499999...

**Fixed point** (an integer with an implied decimal point) is also used in embedded systems without floating-point hardware and in some audio and DSP code.

---

## 9. Characters and Text Encoding

| Standard | Size | Covers |
| --- | --- | --- |
| **ASCII** | 7 bits (128 chars) | English letters, digits, punctuation, control characters; `'A'` = 65 = `0x41`, `'a'` = 97, `'0'` = 48 |
| **Latin-1 / Windows-1252** | 8 bits | Western European; a source of mojibake when mixed up with UTF-8 |
| **Unicode** | A catalog of over 150,000 characters, code points `U+0000` to `U+10FFFF` | Every script, symbols, emoji |
| **UTF-8** | 1 to 4 bytes per code point | Backward compatible with ASCII; about 98 percent of the web |
| **UTF-16** | 2 or 4 bytes (surrogate pairs above `U+FFFF`) | Java, JavaScript, Windows, .NET strings internally |
| **UTF-32** | 4 bytes always | Simple indexing, wasteful |

Unicode is the **character set** (which number each character gets); UTF-8 and UTF-16 are **encodings** (how that number becomes bytes).

### UTF-8 layout

| Code point range | Bytes | Pattern |
| --- | --- | --- |
| U+0000 to U+007F | 1 | `0xxxxxxx` |
| U+0080 to U+07FF | 2 | `110xxxxx 10xxxxxx` |
| U+0800 to U+FFFF | 3 | `1110xxxx 10xxxxxx 10xxxxxx` |
| U+10000 to U+10FFFF | 4 | `11110xxx 10xxxxxx 10xxxxxx 10xxxxxx` |

Examples: `A` is `41`, `€` (U+20AC) is `E2 82 AC`, `😀` (U+1F600) is `F0 9F 98 80`.

Properties that make UTF-8 the default: ASCII text is unchanged, no byte-order issues, self-synchronizing (you can find character boundaries from any byte), and no zero bytes except for NUL.

### String length is ambiguous

| "😀" measured as | Length |
| --- | --- |
| UTF-8 bytes | 4 |
| UTF-16 code units (JavaScript `"😀".length`, Java `length()`) | 2 |
| Code points (Python `len`) | 1 |
| User-perceived characters (grapheme clusters) | 1 |

Emoji like 👨‍👩‍👧 are several code points joined with zero-width joiners but display as one grapheme.
Consequences: truncating strings by bytes or UTF-16 units can cut characters in half; database column limits (`VARCHAR(255)`) may count bytes or characters depending on the engine; MySQL's old `utf8` charset holds only 3 bytes, so use `utf8mb4` for emoji.

**Normalization**: `é` can be one code point (U+00E9) or `e` plus a combining accent (U+0065 U+0301); compare strings after normalizing (NFC).

---

## 10. Endianness

How a multi-byte value is laid out in memory.
The value `0x12345678` stored at address 100:

| Address | 100 | 101 | 102 | 103 |
| --- | --- | --- | --- | --- |
| **Big-endian** (most significant byte first) | 12 | 34 | 56 | 78 |
| **Little-endian** (least significant byte first) | 78 | 56 | 34 | 12 |

| Uses big-endian | Uses little-endian |
| --- | --- |
| **Network byte order** (IP, TCP, and most protocol headers) | x86, x86-64 |
| Java class files, many file formats (PNG, JPEG) | ARM and RISC-V as typically configured (Apple silicon, Android, Linux on ARM) |

Convert at the boundary with `htonl` / `ntohl` (host to network long, and back) or `ByteBuffer.order(...)` in Java.
Endianness applies to bytes within a value, not to bits within a byte or to the order of characters in a UTF-8 string.
A **byte order mark** (BOM, U+FEFF) at the start of UTF-16 text tells readers which order was used.

---

## 11. Data Size Units

| Decimal (SI) | Bytes | Binary (IEC) | Bytes |
| --- | --- | --- | --- |
| KB (kilobyte) | 10^3 | KiB (kibibyte) | 2^10 = 1,024 |
| MB | 10^6 | MiB | 2^20 = 1,048,576 |
| GB | 10^9 | GiB | 2^30 ≈ 1.074 x 10^9 |
| TB | 10^12 | TiB | 2^40 ≈ 1.1 x 10^12 |

This is why a "1 TB" drive shows about 931 GiB in an operating system that reports binary units.
Network speeds use **bits** (Mbps), storage uses **bytes** (MB/s): 1 Gbps is at most 125 MB/s.

---

## 12. Questions

| Question | Short answer |
| --- | --- |
| Convert 45 to binary and hex. | `101101`, `0x2D` |
| How are negative integers stored? | Two's complement: invert bits and add 1 |
| Why two's complement? | One zero, the same adder works for signed and unsigned |
| Range of a 32-bit signed int? | -2^31 to 2^31 - 1 |
| What happens on integer overflow? | Wraps in Java and Go, undefined in C for signed, arbitrary precision in Python |
| Why is 0.1 + 0.2 != 0.3? | 0.1 and 0.2 have no exact binary representation; rounding errors add |
| How should money be stored? | Integer minor units or a decimal type, plus currency |
| How do you check if a number is a power of two? | `x > 0 && (x & (x - 1)) == 0` |
| Unicode vs UTF-8? | Character catalog vs byte encoding of it |
| Why is `"😀".length` 2 in JavaScript? | UTF-16 surrogate pair |
| Big vs little endian? | Most significant byte first vs least significant first; network order is big |
| Why does a 1 TB disk show 931 GB? | Decimal TB vs binary GiB |

Next: [Digital Logic and Computer Architecture](/docs/computer-fundamentals/digital-logic-and-computer-architecture).
