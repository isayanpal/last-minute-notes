---
title: "OS Interview Playbook"
description: "Operating systems interview rehearsal: a 50-question bank with strong-answer checklists, numerical problem types (scheduling, paging, page replacement, Banker's, disk scheduling) with solving recipes, production scenarios, cheat sheets, common mistakes, and a 7-day study plan."
---

# 📘 OS Interview Playbook

The other pages teach the material.
This page is for rehearsal: a question bank with what a strong answer contains, recipes for the numerical problems that appear in written tests, production scenarios, cheat sheets, and a study plan.

## Table of Contents

1. [What Interviewers Look For](#1-what-interviewers-look-for)
2. [Question Bank](#2-question-bank)
3. [Numerical Problem Recipes](#3-numerical-problem-recipes)
4. [Production Scenarios](#4-production-scenarios)
5. [Cheat Sheets](#5-cheat-sheets)
6. [Common Mistakes](#6-common-mistakes)
7. [Study Plan](#7-study-plan)

---

## 1. What Interviewers Look For

| Level | Expected |
| --- | --- |
| **New grad / campus** | Definitions and differences (process vs thread, paging vs segmentation), scheduling and page replacement numericals, deadlock conditions, semaphores |
| **Mid** | Context switch costs, fork and exec, IPC choices, race conditions and locks in real code, virtual memory and page faults, file descriptors |
| **Senior** | Memory ordering, lock-free trade-offs, epoll and event loops, page cache and fsync durability, containers from namespaces and cgroups, performance debugging |
| **Systems / infra** | Scheduler internals (CFS, EEVDF), NUMA, TLB shootdowns, io_uring, eBPF, kernel bypass |

Signals that raise your rating: connecting theory to something observable (`ps` states, `free` output, `strace`), quoting rough costs (syscall, context switch, page fault, fsync), and explaining trade-offs rather than definitions.

---

## 2. Question Bank

### 2.1 Basics and processes (12)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 1 | What does an OS do? | Resource management and abstractions, isolation | [Fundamentals](/docs/operating-systems/os-fundamentals) |
| 2 | Kernel mode vs user mode? | CPU rings, privileged instructions, why | [Fundamentals](/docs/operating-systems/os-fundamentals) |
| 3 | What happens during a system call? | Registers, trap instruction, mode switch, return, cost, vDSO | [Fundamentals](/docs/operating-systems/os-fundamentals) |
| 4 | Monolithic vs microkernel? | Speed vs isolation, examples, Linux modules | [Fundamentals](/docs/operating-systems/os-fundamentals) |
| 5 | Process vs thread? | Address space, what is shared, cost, failure isolation | [Processes and Threads](/docs/operating-systems/processes-and-threads) |
| 6 | Describe process states. | Five states and transitions, `D` and `Z` in `ps` | [Processes and Threads](/docs/operating-systems/processes-and-threads) |
| 7 | What is a context switch? | Save and restore PCB, page table switch, cache and TLB cost | [Processes and Threads](/docs/operating-systems/processes-and-threads) |
| 8 | How does fork work? | Copy-on-write, return values, fork + exec pattern | [Processes and Threads](/docs/operating-systems/processes-and-threads) |
| 9 | Zombie vs orphan? | Not reaped vs re-parented to init, PID 1 in containers | [Processes and Threads](/docs/operating-systems/processes-and-threads) |
| 10 | User threads vs kernel threads? | Models 1:1, M:1, M:N, goroutines, virtual threads | [Processes and Threads](/docs/operating-systems/processes-and-threads) |
| 11 | IPC mechanisms and when to use each? | Pipes, sockets, shared memory, message queues, signals | [Processes and Threads](/docs/operating-systems/processes-and-threads) |
| 12 | SIGTERM vs SIGKILL, and graceful shutdown? | Catchable vs not, drain within a deadline | [Processes and Threads](/docs/operating-systems/processes-and-threads) |

### 2.2 Scheduling (6)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 13 | Compare FCFS, SJF, SRTF, RR, priority. | Preemption, waiting time, starvation, response time | [CPU Scheduling](/docs/operating-systems/cpu-scheduling) |
| 14 | How do you choose an RR time quantum? | Overhead vs responsiveness, 80 percent rule | [CPU Scheduling](/docs/operating-systems/cpu-scheduling) |
| 15 | What is starvation and aging? | Low priority never runs, raise priority over time | [CPU Scheduling](/docs/operating-systems/cpu-scheduling) |
| 16 | Explain MLFQ. | Queues, demotion, boost, learns interactivity | [CPU Scheduling](/docs/operating-systems/cpu-scheduling) |
| 17 | How does the Linux scheduler work? | Classes, CFS vruntime and red-black tree, EEVDF since 6.6, nice | [CPU Scheduling](/docs/operating-systems/cpu-scheduling) |
| 18 | What is priority inversion? | Mars Pathfinder, priority inheritance | [CPU Scheduling](/docs/operating-systems/cpu-scheduling) |

### 2.3 Synchronization and deadlock (12)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 19 | What is a race condition? Give an example. | `counter++` as load, add, store | [Synchronization](/docs/operating-systems/synchronization-and-deadlocks) |
| 20 | Critical section requirements? | Mutual exclusion, progress, bounded waiting | [Synchronization](/docs/operating-systems/synchronization-and-deadlocks) |
| 21 | Mutex vs semaphore? | Ownership, counting, signaling | [Synchronization](/docs/operating-systems/synchronization-and-deadlocks) |
| 22 | Spinlock vs mutex? | Busy wait vs sleep, when each wins, futex hybrid | [Synchronization](/docs/operating-systems/synchronization-and-deadlocks) |
| 23 | Why does condition wait use a while loop? | Spurious wakeups, Mesa semantics | [Synchronization](/docs/operating-systems/synchronization-and-deadlocks) |
| 24 | Solve producer-consumer with semaphores. | `empty`, `full`, mutex, correct order | [Synchronization](/docs/operating-systems/synchronization-and-deadlocks) |
| 25 | Dining philosophers solutions? | Ordering, limit seats, atomic pick-up | [Synchronization](/docs/operating-systems/synchronization-and-deadlocks) |
| 26 | What is CAS and the ABA problem? | Atomic compare and swap, version tags | [Synchronization](/docs/operating-systems/synchronization-and-deadlocks) |
| 27 | Four conditions for deadlock? | Coffman conditions with a way to break each | [Synchronization](/docs/operating-systems/synchronization-and-deadlocks) |
| 28 | Prevention vs avoidance vs detection? | Design out vs safe state check vs find cycles and recover | [Synchronization](/docs/operating-systems/synchronization-and-deadlocks) |
| 29 | Explain the Banker's algorithm. | Need matrix, safety check, safe sequence | [Synchronization](/docs/operating-systems/synchronization-and-deadlocks) |
| 30 | Deadlock vs livelock vs starvation? | Blocked vs busy without progress vs unfair | [Synchronization](/docs/operating-systems/synchronization-and-deadlocks) |

### 2.4 Memory (12)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 31 | What is virtual memory and why? | MMU translation, isolation, overcommit, sharing | [Memory](/docs/operating-systems/memory-management) |
| 32 | Paging vs segmentation? | Fixed vs variable, fragmentation types | [Memory](/docs/operating-systems/memory-management) |
| 33 | Internal vs external fragmentation? | Inside blocks vs between blocks, fixes | [Memory](/docs/operating-systems/memory-management) |
| 34 | How is an address translated? | Page number, offset, TLB, page walk | [Memory](/docs/operating-systems/memory-management) |
| 35 | Why multi-level page tables? | Sparse address spaces, 4-level x86-64 | [Memory](/docs/operating-systems/memory-management) |
| 36 | What is the TLB? | Cache of translations, miss cost, ASIDs, huge pages | [Memory](/docs/operating-systems/memory-management) |
| 37 | Walk through a page fault. | Valid check, frame, disk read, table update, restart | [Memory](/docs/operating-systems/memory-management) |
| 38 | Compare page replacement algorithms. | FIFO, LRU, Optimal, Clock, Belady's anomaly | [Memory](/docs/operating-systems/memory-management) |
| 39 | What is thrashing and how do you fix it? | Working set exceeds RAM, reduce load or add memory | [Memory](/docs/operating-systems/memory-management) |
| 40 | Stack vs heap? | Per-thread automatic frames vs dynamic shared allocations, sizes, errors | [Processes and Threads](/docs/operating-systems/processes-and-threads) |
| 41 | What is copy-on-write? | Shared read-only pages copied on first write, fork, snapshots | [Memory](/docs/operating-systems/memory-management) |
| 42 | What happens when a container hits its memory limit? | cgroup OOM kill, exit code 137 | [Memory](/docs/operating-systems/memory-management) |

### 2.5 Files, I/O, and Linux (8)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 43 | What is an inode? | Metadata without the name, links, extents | [File Systems](/docs/operating-systems/file-systems-and-storage) |
| 44 | Hard link vs symlink? | Same inode vs path file, cross-FS, dangling | [File Systems](/docs/operating-systems/file-systems-and-storage) |
| 45 | What does fsync do and why does it matter? | Page cache vs stable storage, atomic rename pattern | [File Systems](/docs/operating-systems/file-systems-and-storage) |
| 46 | What is journaling? | Write-ahead log for metadata, modes | [File Systems](/docs/operating-systems/file-systems-and-storage) |
| 47 | select vs poll vs epoll? | O(n) scans vs ready list, level vs edge | [I/O and Linux](/docs/operating-systems/io-and-linux-internals) |
| 48 | How does an event loop serve many connections? | Non-blocking sockets, epoll, callbacks, no CPU-heavy work on the loop | [I/O and Linux](/docs/operating-systems/io-and-linux-internals) |
| 49 | How are containers implemented? | Namespaces, cgroups, overlayfs, capabilities, seccomp | [I/O and Linux](/docs/operating-systems/io-and-linux-internals) |
| 50 | Container vs VM? | Shared kernel vs hypervisor, startup, isolation | [Fundamentals](/docs/operating-systems/os-fundamentals) |

---

## 3. Numerical Problem Recipes

| Problem type | Recipe |
| --- | --- |
| **CPU scheduling** | Draw a Gantt chart first. Turnaround = completion - arrival. Waiting = turnaround - burst. Response = first run - arrival. For RR, write the ready queue at every step and add new arrivals before the preempted process |
| **Address translation** | Offset bits = log2(page size). Page number = address >> offset bits. Physical = frame << offset bits OR offset |
| **Page table size** | Entries = 2^(VA bits - offset bits). Size = entries x entry size. Multi-level: bits per level = log2(page size / entry size) |
| **Effective access time (TLB)** | EAT = h x (TLB + mem) + (1 - h) x (TLB + levels x mem + mem) |
| **Effective access time (faults)** | EAT = (1 - p) x mem + p x fault service time |
| **Page replacement** | Draw frames as columns per reference, mark faults. Optimal: evict the page used furthest ahead. LRU: evict the one used longest ago |
| **Banker's** | Need = Max - Allocation. Repeatedly pick a process with Need <= Work, add its Allocation to Work. All finish = safe |
| **Disk scheduling** | List the order, sum absolute differences. SCAN goes to the end, LOOK turns at the last request. C-SCAN counts the return if the question says so |
| **Semaphore traces** | Track the value and the waiting queue after every operation |
| **fork counting** | n sequential `fork()` calls produce 2^n processes; with conditions (`fork() && fork()`), draw the tree |

Practice sets with verified answers: [CPU Scheduling](/docs/operating-systems/cpu-scheduling), [Memory Management](/docs/operating-systems/memory-management), [Synchronization and Deadlocks](/docs/operating-systems/synchronization-and-deadlocks), [File Systems and Storage](/docs/operating-systems/file-systems-and-storage).

---

## 4. Production Scenarios

| Scenario | Strong direction |
| --- | --- |
| "Load average is 40 on a 16-core box, but CPU is 30 percent busy." | Tasks in `D` state waiting on disk or NFS; `vmstat` `b` column, `iostat -x` for latency, `ps` for `D` processes |
| "The service's latency spikes every few seconds, CPU looks fine." | cgroup CPU throttling (`cpu.stat` nr_throttled), GC pauses, THP compaction, swap; remove CPU limits or size thread pools to the quota |
| "The container keeps restarting with exit code 137." | OOM kill by cgroup limit; check `memory.events`, heap vs native memory, raise limit or fix the leak |
| "Disk shows 100 percent used but `du` finds far less." | Deleted files still held open (`lsof +L1`), restart or truncate via `/proc/<pid>/fd`; also check inodes with `df -i` |
| "`Too many open files` errors under load." | FD limit (`ulimit -n`, systemd `LimitNOFILE`), leaked sockets, connection pooling |
| "The app hangs; all threads seem stuck." | Thread dump; look for lock cycles (deadlock) or a pool starved by blocking calls; fix lock ordering or pool design |
| "Writes were acknowledged but lost after a power failure." | No fsync, disk write cache without power-loss protection, wrong journaling mode; fsync plus atomic rename, group commit |
| "One Node.js process becomes unresponsive under a specific request." | CPU-heavy code blocking the event loop; profile, move work to worker threads or another service |

---

## 5. Cheat Sheets

### Costs to remember

| Operation | Rough cost |
| --- | --- |
| Function call | About 1 ns |
| Uncontended mutex lock and unlock | About 20 ns |
| System call | 100 ns to a few microseconds |
| Context switch (direct) | 1 to 5 microseconds |
| Minor page fault | About 1 microsecond |
| Thread creation | 10 to 50 microseconds |
| Process creation (`fork` + `exec`) | Hundreds of microseconds to milliseconds |
| NVMe random read | 10 to 100 microseconds |
| Major page fault from NVMe | About 100 microseconds |
| `fsync` on consumer SSD | Milliseconds |
| HDD seek | 5 to 10 ms |

### Process vs thread

| | Process | Thread |
| --- | --- | --- |
| Address space | Own | Shared |
| Creation | Slower | Faster |
| Switch | Page table change | Registers and stack only |
| Communication | IPC | Shared memory |
| Crash impact | Contained | Whole process |

### Deadlock at a glance

| Condition | Prevention |
| --- | --- |
| Mutual exclusion | Make resources sharable |
| Hold and wait | Request all at once |
| No preemption | Timeouts, tryLock |
| Circular wait | Global lock order |

### Page replacement

| Algorithm | Anomaly | Practical |
| --- | --- | --- |
| FIFO | Belady's anomaly possible | Simple, poor |
| LRU | None | Too costly exactly |
| Optimal | None | Impossible, benchmark |
| Clock | Possible (approximates LRU) | Real systems |

---

## 6. Common Mistakes

- Saying threads "have their own memory"; they share the heap and only own stacks and registers.
- Confusing a mode switch (syscall) with a context switch.
- Claiming SJF is practical without mentioning burst prediction.
- Using `if` instead of `while` around a condition wait.
- Treating a binary semaphore and a mutex as identical.
- Forgetting that deadlock needs all four conditions, and that lock ordering is the practical fix.
- Saying `write()` makes data durable.
- Calling low `free` memory on Linux a problem.
- Believing containers are lightweight VMs with their own kernel.
- Forgetting that epoll does not make regular file I/O asynchronous.

---

## 7. Study Plan

| Day | Focus | Output |
| --- | --- | --- |
| 1 | [OS Fundamentals](/docs/operating-systems/os-fundamentals) | Explain a system call end to end; `strace -c ls` |
| 2 | [Processes and Threads](/docs/operating-systems/processes-and-threads) | Write a fork + exec + wait program; draw the state diagram |
| 3 | [CPU Scheduling](/docs/operating-systems/cpu-scheduling) | Solve three scheduling problems with Gantt charts |
| 4 | [Synchronization and Deadlocks](/docs/operating-systems/synchronization-and-deadlocks) | Code producer-consumer; run the Banker's example by hand |
| 5 | [Memory Management](/docs/operating-systems/memory-management) | Translate addresses; FIFO, LRU, Optimal on a reference string |
| 6 | [File Systems](/docs/operating-systems/file-systems-and-storage) and [I/O and Linux](/docs/operating-systems/io-and-linux-internals) | Build a crude container with `unshare`; write an epoll echo server |
| 7 | This page | Answer the question bank out loud; do the production scenarios |

Related: [Computer Fundamentals](/docs/computer-fundamentals) for the hardware underneath (caches, CPU pipelines, memory hierarchy) and [Networking](/docs/networking) for the socket side of I/O.
