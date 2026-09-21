---
title: "SQL Practice Problems"
description: "Twenty classic SQL interview problems with executed solutions: second highest salary, top N per group, median, gaps and islands streaks, retention, date series, overlapping and merged intervals, deduplication, pivot and unpivot, plus a pattern map."
---

# 📘 SQL Practice Problems

These are the query patterns that appear again and again in interviews.
Each problem has a prompt, a solution that was run on SQLite 3.54, and the idea behind it.
Solutions use standard SQL where possible, and a note tells you the PostgreSQL or MySQL variant when the date functions differ.

Try each problem yourself for five minutes before reading the solution.
First read [SQL Essentials](/docs/databases/sql-essentials) if window functions or CTEs are unfamiliar.

## Table of Contents

1. [Pattern Map](#1-pattern-map)
2. [Employees: Ranking, Comparison, Median](#2-employees-ranking-comparison-median)
3. [Orders: Anti Join, Growth, Date Series](#3-orders-anti-join-growth-date-series)
4. [Logins: Gaps and Islands, Retention](#4-logins-gaps-and-islands-retention)
5. [Intervals: Overlap and Merge](#5-intervals-overlap-and-merge)
6. [Data Cleanup: Duplicates, Pivot, Unpivot](#6-data-cleanup-duplicates-pivot-unpivot)
7. [How to Approach a SQL Question](#7-how-to-approach-a-sql-question)

---

## 1. Pattern Map

| If the question says | Reach for | Problems |
| --- | --- | --- |
| Nth highest, top N per group | `DENSE_RANK` or `ROW_NUMBER` with `PARTITION BY`, filter in an outer query | 1, 2, 4 |
| Compare a row with its manager, parent or previous row | Self join, or `LAG` and `LEAD` | 3, 9 |
| Never did X, has no matching row | `LEFT JOIN ... WHERE right IS NULL`, or `NOT EXISTS` | 8 |
| Median, percentile | `ROW_NUMBER` and `COUNT` window, or `PERCENTILE_CONT` (PostgreSQL) | 5 |
| Share of total, running total | `SUM() OVER` with a frame | 6, 9 |
| Rows to columns | Conditional aggregation `SUM(CASE ...)` | 7 |
| Columns to rows | `UNION ALL` or `UNPIVOT` or `CROSS JOIN LATERAL` | 20 |
| Missing days with zero | Generate a series (recursive CTE), `LEFT JOIN`, `COALESCE` | 12 |
| Consecutive days or numbers, streaks | Gaps and islands: value minus `ROW_NUMBER` is constant within a run | 13, 15 |
| Retention, "returned the next day" | Self join on date plus one | 14 |
| Overlapping ranges | `a.start < b.end AND b.start < a.end` | 16 |
| Merge ranges | Running max of previous ends, start a new group when a gap appears | 17 |
| Remove duplicates | `ROW_NUMBER() OVER (PARTITION BY key ORDER BY id)` and delete `rn > 1` | 18 |

---

## 2. Employees: Ranking, Comparison, Median

Setup: the company dataset from Essentials plus one more employee, Ivy, who earns more than her manager Dara.

```sql
-- runnable
CREATE TABLE employees (
  id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, manager_id INTEGER, salary INTEGER, hired DATE
);
INSERT INTO employees VALUES
  (1,'Asha',1,NULL,180,'2019-03-01'), (2,'Bo',1,1,140,'2020-07-15'), (3,'Chen',1,1,140,'2021-01-10'),
  (4,'Dara',2,1,120,'2018-05-20'), (5,'Eli',2,4,90,'2022-02-01'), (6,'Fay',2,4,90,'2023-06-30'),
  (7,'Gus',3,1,80,'2020-11-11'), (8,'Hana',NULL,1,70,'2024-01-05'), (9,'Ivy',2,4,150,'2024-03-01');

-- 1. Second highest DISTINCT salary. Returns NULL (not an error) if there is none.
SELECT MAX(salary) AS second_highest
FROM employees WHERE salary < (SELECT MAX(salary) FROM employees);

-- generalized to the Nth: DENSE_RANK handles ties and any N
SELECT DISTINCT salary AS third_highest FROM (
  SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS r FROM employees
) WHERE r = 3;

-- 2. Top 2 salaries in each department, including ties
SELECT dept_id, name, salary FROM (
  SELECT dept_id, name, salary, DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS r
  FROM employees WHERE dept_id IS NOT NULL
) WHERE r <= 2 ORDER BY dept_id, salary DESC, name;

-- 3. Employees who earn more than their manager (self join)
SELECT e.name AS employee, e.salary, m.name AS manager, m.salary AS manager_salary
FROM employees e JOIN employees m ON m.id = e.manager_id
WHERE e.salary > m.salary;

-- 4. Department with the highest average salary (RANK keeps ties)
SELECT dept_id, ROUND(avg_salary, 1) AS avg_salary FROM (
  SELECT dept_id, AVG(salary) AS avg_salary, RANK() OVER (ORDER BY AVG(salary) DESC) AS r
  FROM employees WHERE dept_id IS NOT NULL GROUP BY dept_id
) WHERE r = 1;

-- 5. Median salary without a MEDIAN function: the middle one or two rows
WITH ranked AS (
  SELECT salary, ROW_NUMBER() OVER (ORDER BY salary) AS rn, COUNT(*) OVER () AS cnt FROM employees
)
SELECT AVG(salary) AS median_salary FROM ranked WHERE rn IN ((cnt + 1) / 2, (cnt + 2) / 2);

-- 6. Each person's share of their department payroll
SELECT name, dept_id, salary,
       ROUND(100.0 * salary / SUM(salary) OVER (PARTITION BY dept_id), 1) AS pct_of_dept
FROM employees WHERE dept_id IS NOT NULL ORDER BY dept_id, salary DESC, name;

-- 7. Pivot: headcount per department split into salary bands, one column per band
SELECT dept_id,
       SUM(CASE WHEN salary >= 140 THEN 1 ELSE 0 END)                AS senior,
       SUM(CASE WHEN salary >= 90 AND salary < 140 THEN 1 ELSE 0 END) AS mid,
       SUM(CASE WHEN salary < 90 THEN 1 ELSE 0 END)                   AS junior
FROM employees WHERE dept_id IS NOT NULL GROUP BY dept_id ORDER BY dept_id;
```

Ideas to take away:

- **Nth highest:** `DENSE_RANK` counts distinct values, so "third highest salary" means rank 3 even with ties above it.
- **Median:** with `cnt` rows, the middle row is `(cnt + 1) / 2` and `(cnt + 2) / 2` in integer division, which is the same row for odd counts and the two middle rows for even counts. PostgreSQL has `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary)`.
- **Top N per group** needs a window function in a subquery, because `LIMIT` applies to the whole result. In PostgreSQL a `LATERAL` join with `LIMIT` is an alternative that uses an index well.
- **Pivot** is conditional aggregation. There is no dynamic pivot in plain SQL, the column list must be known.

---

## 3. Orders: Anti Join, Growth, Date Series

```sql
-- runnable
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, order_date DATE, amount INTEGER);
INSERT INTO customers VALUES (1,'Ana'), (2,'Ben'), (3,'Cy'), (4,'Dan');
INSERT INTO orders VALUES
  (1,1,'2026-01-05',100), (2,1,'2026-01-20',50),  (3,2,'2026-01-25',200), (4,2,'2026-02-03',120),
  (5,3,'2026-02-14',80),  (6,1,'2026-03-02',300), (7,3,'2026-03-18',70),  (8,2,'2026-03-30',30);

-- 8. Customers who never ordered
SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL;

-- 9. Month over month revenue and growth percentage
WITH monthly AS (
  SELECT strftime('%Y-%m', order_date) AS month, SUM(amount) AS revenue
  FROM orders GROUP BY 1
)
SELECT month, revenue,
       LAG(revenue) OVER (ORDER BY month) AS prev_revenue,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month)) / LAG(revenue) OVER (ORDER BY month), 1) AS growth_pct
FROM monthly ORDER BY month;

-- 10. Each customer's first and most recent order date and amount
SELECT DISTINCT customer_id,
       FIRST_VALUE(order_date) OVER w AS first_order,
       FIRST_VALUE(amount)     OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS latest_amount,
       LAST_VALUE(order_date)  OVER (PARTITION BY customer_id ORDER BY order_date
                                     ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS latest_order
FROM orders
WINDOW w AS (PARTITION BY customer_id ORDER BY order_date)
ORDER BY customer_id;

-- 11. Customers whose total spend is above the average customer's total
WITH totals AS (SELECT customer_id, SUM(amount) AS total FROM orders GROUP BY customer_id)
SELECT c.name, t.total FROM totals t JOIN customers c ON c.id = t.customer_id
WHERE t.total > (SELECT AVG(total) FROM totals) ORDER BY t.total DESC;

-- 12. Daily revenue for a whole week, with zero for days that have no orders
WITH RECURSIVE days(d) AS (
  SELECT '2026-01-01' UNION ALL SELECT date(d, '+1 day') FROM days WHERE d < '2026-01-07'
)
SELECT days.d AS day, COALESCE(SUM(o.amount), 0) AS revenue
FROM days LEFT JOIN orders o ON o.order_date = days.d
GROUP BY days.d ORDER BY days.d;
```

Ideas to take away:

- **Anti join** (`LEFT JOIN ... WHERE right.id IS NULL`) and `NOT EXISTS` are the safe "never happened" patterns.
- **Growth** needs the previous row, so `LAG`. Guard the divide by zero with `NULLIF(LAG(...), 0)` in real code.
- **`LAST_VALUE` needs an explicit full frame**, otherwise it returns the current row.
- **Date series:** a recursive CTE generates the calendar. In PostgreSQL use `generate_series('2026-01-01'::date, '2026-01-07', '1 day')`. Always `LEFT JOIN` from the calendar so empty days survive, and `COALESCE` the sum to zero.
- Group and order by position (`GROUP BY 1`) is allowed but fragile, prefer names in production.

---

## 4. Logins: Gaps and Islands, Retention

**Gaps and islands** finds runs of consecutive values.
Trick: within a run of consecutive dates, `date minus row_number` is the same constant, so grouping by that constant groups each run.

```text
login_date   row_number   date - row_number (days)
Jan 1        1            Dec 31
Jan 2        2            Dec 31      same group, a streak of 3 days
Jan 3        3            Dec 31
Jan 5        4            Jan 1       gap, the constant changes, a new island starts
Jan 6        5            Jan 1
```

```sql
-- runnable
CREATE TABLE logins (user_id INTEGER, login_date DATE);
INSERT INTO logins VALUES
  (1,'2026-01-01'), (1,'2026-01-02'), (1,'2026-01-03'), (1,'2026-01-05'), (1,'2026-01-06'), (1,'2026-01-09'),
  (2,'2026-01-01'), (2,'2026-01-03'), (2,'2026-01-04'), (2,'2026-01-05'), (2,'2026-01-06'), (2,'2026-01-06');

-- 13. All streaks (islands) per user, then the longest.
--     DISTINCT first, because a user may log in twice a day.
WITH d AS (SELECT DISTINCT user_id, login_date FROM logins),
g AS (
  SELECT user_id, login_date,
         date(login_date, '-' || ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) || ' days') AS grp
  FROM d
),
islands AS (
  SELECT user_id, grp, COUNT(*) AS days, MIN(login_date) AS first_day, MAX(login_date) AS last_day
  FROM g GROUP BY user_id, grp
)
SELECT user_id, first_day, last_day, days FROM islands ORDER BY user_id, first_day;

WITH d AS (SELECT DISTINCT user_id, login_date FROM logins),
g AS (
  SELECT user_id, login_date,
         date(login_date, '-' || ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) || ' days') AS grp
  FROM d
)
SELECT user_id, MAX(days) AS longest_streak FROM (
  SELECT user_id, COUNT(*) AS days FROM g GROUP BY user_id, grp
) GROUP BY user_id ORDER BY user_id;

-- 14. Day-1 retention: share of users who came back the day after their first login
WITH first_login AS (SELECT user_id, MIN(login_date) AS d0 FROM logins GROUP BY user_id)
SELECT COUNT(DISTINCT f.user_id) AS new_users,
       COUNT(DISTINCT l.user_id) AS returned_day1,
       ROUND(100.0 * COUNT(DISTINCT l.user_id) / COUNT(DISTINCT f.user_id), 1) AS retention_pct
FROM first_login f
LEFT JOIN logins l ON l.user_id = f.user_id AND l.login_date = date(f.d0, '+1 day');
```

Dialect notes for the islands key:

| Database | Expression |
| --- | --- |
| SQLite | `date(login_date, '-' \|\| rn \|\| ' days')` |
| PostgreSQL | `login_date - rn * INTERVAL '1 day'`, or `login_date - rn::int` for a `DATE` |
| MySQL | `DATE_SUB(login_date, INTERVAL rn DAY)` |

For consecutive integers (ids, sequence numbers) use `value - ROW_NUMBER()` directly.
Always deduplicate the value first, otherwise the trick breaks.

```sql
-- runnable
CREATE TABLE seq (id INTEGER PRIMARY KEY, num INTEGER);
INSERT INTO seq VALUES (1,1), (2,1), (3,1), (4,2), (5,1), (6,2), (7,2);

-- 15. Numbers that appear at least 3 times in a row: compare with the two previous rows
SELECT DISTINCT num AS consecutive_num FROM (
  SELECT num, LAG(num, 1) OVER (ORDER BY id) AS p1, LAG(num, 2) OVER (ORDER BY id) AS p2 FROM seq
) WHERE num = p1 AND num = p2;

-- generalized to any run length N with the islands trick (id minus row number per value)
SELECT num, COUNT(*) AS run_length FROM (
  SELECT id, num, id - ROW_NUMBER() OVER (PARTITION BY num ORDER BY id) AS grp FROM seq
) GROUP BY num, grp HAVING COUNT(*) >= 3;
```

Retention generalizes: join each cohort (first login date) to activity `N` days later, and group by `N` to build a retention table.

---

## 5. Intervals: Overlap and Merge

```sql
-- runnable
CREATE TABLE bookings (id INTEGER PRIMARY KEY, room TEXT, start_t INTEGER, end_t INTEGER);
INSERT INTO bookings VALUES
  (1,'A',1,3), (2,'A',2,5), (3,'A',7,9), (4,'A',8,10), (5,'A',12,13), (6,'B',1,4), (7,'B',4,6);

-- 16. Conflicting bookings in the same room. Two intervals overlap when each starts before the other ends.
--     Using a strict less-than means back-to-back bookings (4 to 4) do not conflict.
SELECT a.id AS booking_a, b.id AS booking_b, a.room
FROM bookings a JOIN bookings b
  ON a.room = b.room AND a.id < b.id AND a.start_t < b.end_t AND b.start_t < a.end_t
ORDER BY a.id, b.id;

-- 17. Merge overlapping intervals per room into continuous busy ranges.
--     Start a new group whenever an interval begins after the maximum end seen so far.
WITH prior AS (
  SELECT *, MAX(end_t) OVER (PARTITION BY room ORDER BY start_t, id
                             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_max_end
  FROM bookings
),
flagged AS (
  SELECT *, CASE WHEN prev_max_end IS NULL OR start_t > prev_max_end THEN 1 ELSE 0 END AS new_range
  FROM prior
),
grouped AS (
  SELECT *, SUM(new_range) OVER (PARTITION BY room ORDER BY start_t, id ROWS UNBOUNDED PRECEDING) AS range_id
  FROM flagged
)
SELECT room, MIN(start_t) AS busy_from, MAX(end_t) AS busy_to
FROM grouped GROUP BY room, range_id ORDER BY room, busy_from;
```

Note the boundary rule: with `start_t > prev_max_end`, touching intervals such as (1,4) and (4,6) **are merged** into one busy range (1,6), as room B shows.
Use `start_t >= prev_max_end` in the test if touching intervals should stay separate.
The overlap test `a.start < b.end AND b.start < a.end` is worth memorizing: it covers containment, partial overlap, and identical ranges.

---

## 6. Data Cleanup: Duplicates, Pivot, Unpivot

```sql
-- runnable
CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, name TEXT);
INSERT INTO users VALUES
  (1,'a@x.com','Ann'), (2,'b@x.com','Bob'), (3,'a@x.com','Ann again'), (4,'c@x.com','Cy'), (5,'b@x.com','Bob again'), (6,NULL,'No email');

-- 18a. Find duplicated emails
SELECT email, COUNT(*) AS copies FROM users WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1 ORDER BY email;

-- 18b. See which rows would be removed: keep the lowest id per email
SELECT id, email FROM (
  SELECT id, email, ROW_NUMBER() OVER (PARTITION BY email ORDER BY id) AS rn FROM users WHERE email IS NOT NULL
) WHERE rn > 1 ORDER BY id;

-- 18c. Delete them (run 18b first to check). NULL emails are left alone on purpose.
DELETE FROM users WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY id) AS rn FROM users WHERE email IS NOT NULL
  ) WHERE rn > 1
);
SELECT id, email FROM users ORDER BY id;

-- 20. Unpivot: quarterly columns to one row per quarter
CREATE TABLE sales_wide (region TEXT, q1 INTEGER, q2 INTEGER, q3 INTEGER);
INSERT INTO sales_wide VALUES ('North', 10, 20, 30), ('South', 5, 15, 25);
SELECT region, 'Q1' AS quarter, q1 AS amount FROM sales_wide
UNION ALL SELECT region, 'Q2', q2 FROM sales_wide
UNION ALL SELECT region, 'Q3', q3 FROM sales_wide
ORDER BY region, quarter;
```

Preventing duplicates in the first place is a `UNIQUE` constraint, not a cleanup job.
Add `CREATE UNIQUE INDEX ... ON users (lower(email))` after cleanup (PostgreSQL and SQLite support expression indexes).

Other problems worth practicing:

| Problem | Hint |
| --- | --- |
| **19.** Users who made a purchase on at least 3 consecutive days | Gaps and islands on distinct purchase dates, keep islands with `days >= 3` |
| Swap adjacent seat ids | `CASE WHEN id % 2 = 1 THEN id + 1 ELSE id - 1 END` with care for the last odd id |
| Cumulative distinct users per day | Mark each user's first day with `MIN` per user, then running `SUM` of first-day flags |
| Sessionize events (gap over 30 minutes starts a new session) | `LAG` timestamp, flag gaps, running `SUM` of flags, same shape as merging intervals |
| Top product per category by revenue | Aggregate first, then `ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC)` |
| Employees who earn the maximum in their department | Correlated subquery, or `salary = MAX(salary) OVER (PARTITION BY dept_id)` |
| Running balance from debits and credits | `SUM(CASE WHEN type = 'credit' THEN amt ELSE -amt END) OVER (ORDER BY ts)` |

---

## 7. How to Approach a SQL Question

1. **Restate the output:** which columns, one row per what? Say the grain aloud ("one row per customer per month").
2. **Ask about edge cases:** ties, NULLs, empty groups, duplicates, time zones, inclusive or exclusive ranges.
3. **Build in steps** with CTEs: first the rows you need, then aggregates, then ranking or filtering. Test each step.
4. **Check the grain after every join.** A one-to-many join changes the row count, and aggregates above it may double count.
5. **Pick the pattern** from the map in section 1.
6. **Verify with a tiny example** by hand.
7. **Mention performance** if asked: which index would serve the join and filter, and whether the window sort can be avoided.

Common follow-ups:

- "Can you do it without a window function?" (correlated subquery or self join, and say it is slower.)
- "What if the table has a billion rows?" (index on the partition and sort columns, pre-aggregate, partition by date, run on a replica or warehouse.)
- "What does this do with NULLs?" (walk through each operator).

Next: [Indexing and Query Performance](/docs/databases/indexing-and-query-performance) explains why some of these queries are fast and others are not.
