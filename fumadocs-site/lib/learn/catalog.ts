/**
 * Server-safe metadata for interactive lessons.
 * The full lesson (scene, frames, step copy) lives in components/learn/lessons and is client-only.
 * `steps` must match the number of steps the lesson file defines.
 */

export type LessonLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type LessonTrack = 'system-design' | 'dsa';

export type LessonMeta = {
  slug: string;
  track: LessonTrack;
  section: string;
  title: string;
  subtitle: string;
  minutes: number;
  level: LessonLevel;
  steps: number;
  notes: { href: string; label: string };
};

export const TRACKS: { id: LessonTrack; title: string; blurb: string }[] = [
  { id: 'system-design', title: 'System Design', blurb: 'From one request to planet-scale systems, one animated step at a time.' },
  { id: 'dsa', title: 'Data Structures & Algorithms', blurb: 'The interview patterns, traced element by element.' },
];

export const LESSONS: LessonMeta[] = [
  {
    slug: "request-path",
    track: "system-design",
    section: "Foundations",
    title: "How a Request Travels",
    subtitle: "Follow one request hop by hop and see what each layer adds.",
    minutes: 7,
    level: "Beginner",
    steps: 8,
    notes: {
      href: "/docs/system-design/hld/building-blocks#1-the-request-path",
      label: "HLD Building Blocks, 1"
    }
  },
  {
    slug: "estimation",
    track: "system-design",
    section: "Foundations",
    title: "Back-of-Envelope Math",
    subtitle: "Turn traffic and data numbers into servers, storage and bandwidth.",
    minutes: 7,
    level: "Beginner",
    steps: 8,
    notes: {
      href: "/docs/system-design/fundamentals#4-back-of-envelope-estimation",
      label: "System Design Fundamentals, 4"
    }
  },
  {
    slug: "latency-percentiles",
    track: "system-design",
    section: "Foundations",
    title: "Latency & Percentiles",
    subtitle: "Why averages lie and the slowest 1% decides how fast you feel.",
    minutes: 6,
    level: "Beginner",
    steps: 7,
    notes: {
      href: "/docs/system-design/fundamentals#7-latency-throughput-and-percentiles",
      label: "System Design Fundamentals, 7"
    }
  },
  {
    slug: "scaling-stages",
    track: "system-design",
    section: "Foundations",
    title: "From One Server to Many",
    subtitle: "Grow a system stage by stage, adding each piece only when it is needed.",
    minutes: 8,
    level: "Beginner",
    steps: 9,
    notes: {
      href: "/docs/system-design/fundamentals#5-scaling-stages",
      label: "System Design Fundamentals, 5"
    }
  },
  {
    slug: "availability",
    track: "system-design",
    section: "Foundations",
    title: "Availability & the Nines",
    subtitle: "How components in series lose nines and redundancy wins them back.",
    minutes: 6,
    level: "Beginner",
    steps: 7,
    notes: {
      href: "/docs/system-design/fundamentals#6-availability-and-reliability",
      label: "System Design Fundamentals, 6"
    }
  },
  {
    slug: "dns",
    track: "system-design",
    section: "Traffic & Edge",
    title: "DNS Resolution",
    subtitle: "How a name becomes an address, and why TTLs decide failover speed.",
    minutes: 6,
    level: "Beginner",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/building-blocks#2-dns",
      label: "HLD Building Blocks, 2"
    }
  },
  {
    slug: "cdn",
    track: "system-design",
    section: "Traffic & Edge",
    title: "Content Delivery Networks",
    subtitle: "Serve bytes from the edge, and know what happens on a miss.",
    minutes: 6,
    level: "Beginner",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/building-blocks#3-cdn",
      label: "HLD Building Blocks, 3"
    }
  },
  {
    slug: "load-balancing",
    track: "system-design",
    section: "Traffic & Edge",
    title: "Load Balancing",
    subtitle: "Spread traffic across servers and route around the ones that fail.",
    minutes: 8,
    level: "Beginner",
    steps: 8,
    notes: {
      href: "/docs/system-design/hld/building-blocks#4-load-balancers",
      label: "HLD Building Blocks, 4"
    }
  },
  {
    slug: "api-gateway",
    track: "system-design",
    section: "Traffic & Edge",
    title: "Gateways, Proxies & Meshes",
    subtitle: "Where auth, routing and retries live between clients and services.",
    minutes: 6,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/building-blocks#5-api-gateway-reverse-proxy-service-mesh",
      label: "HLD Building Blocks, 5"
    }
  },
  {
    slug: "caching",
    track: "system-design",
    section: "Traffic & Edge",
    title: "Caching",
    subtitle: "Cache-aside, write patterns, eviction and the stampede problem.",
    minutes: 9,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/system-design/hld/building-blocks#6-caching",
      label: "HLD Building Blocks, 6"
    }
  },
  {
    slug: "rate-limiting",
    track: "system-design",
    section: "Traffic & Edge",
    title: "Rate Limiting",
    subtitle: "Token bucket, sliding window and where to enforce a limit.",
    minutes: 8,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/system-design/hld/distributed-systems#9-rate-limiting-algorithms",
      label: "Distributed Systems, 9"
    }
  },
  {
    slug: "databases",
    track: "system-design",
    section: "Data & Storage",
    title: "SQL vs NoSQL",
    subtitle: "Pick a data store from the access pattern, not the hype.",
    minutes: 7,
    level: "Beginner",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/building-blocks#7-databases",
      label: "HLD Building Blocks, 7"
    }
  },
  {
    slug: "indexes",
    track: "system-design",
    section: "Data & Storage",
    title: "Indexes & Storage Engines",
    subtitle: "B-trees for reads, LSM trees for writes, and what each costs.",
    minutes: 8,
    level: "Intermediate",
    steps: 8,
    notes: {
      href: "/docs/system-design/hld/building-blocks#8-indexing-and-storage-engines",
      label: "HLD Building Blocks, 8"
    }
  },
  {
    slug: "replication",
    track: "system-design",
    section: "Data & Storage",
    title: "Replication",
    subtitle: "Leaders, followers, lag, and what a failover can lose.",
    minutes: 8,
    level: "Intermediate",
    steps: 8,
    notes: {
      href: "/docs/system-design/hld/building-blocks#9-replication",
      label: "HLD Building Blocks, 9"
    }
  },
  {
    slug: "sharding",
    track: "system-design",
    section: "Data & Storage",
    title: "Sharding",
    subtitle: "Split data across machines and choose a key that will not hot-spot.",
    minutes: 8,
    level: "Intermediate",
    steps: 8,
    notes: {
      href: "/docs/system-design/hld/building-blocks#10-sharding-and-consistent-hashing",
      label: "HLD Building Blocks, 10"
    }
  },
  {
    slug: "consistent-hashing",
    track: "system-design",
    section: "Data & Storage",
    title: "Consistent Hashing",
    subtitle: "Resize a fleet of servers and move only a small slice of the data.",
    minutes: 8,
    level: "Intermediate",
    steps: 10,
    notes: {
      href: "/docs/system-design/hld/building-blocks#103-consistent-hashing",
      label: "HLD Building Blocks, 10.3"
    }
  },
  {
    slug: "object-storage",
    track: "system-design",
    section: "Data & Storage",
    title: "Object Storage & Uploads",
    subtitle: "Presigned URLs keep large files off your servers.",
    minutes: 6,
    level: "Beginner",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/building-blocks#12-object-storage",
      label: "HLD Building Blocks, 12"
    }
  },
  {
    slug: "search",
    track: "system-design",
    section: "Data & Storage",
    title: "Search & Inverted Indexes",
    subtitle: "How a search engine finds documents by word in milliseconds.",
    minutes: 7,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/building-blocks#13-search",
      label: "HLD Building Blocks, 13"
    }
  },
  {
    slug: "queues-streams",
    track: "system-design",
    section: "Communication",
    title: "Queues & Streams",
    subtitle: "Decouple producers from consumers and absorb bursts.",
    minutes: 8,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/system-design/hld/building-blocks#11-queues-and-streams",
      label: "HLD Building Blocks, 11"
    }
  },
  {
    slug: "realtime",
    track: "system-design",
    section: "Communication",
    title: "Real-Time Updates",
    subtitle: "Polling, long polling, SSE and WebSockets side by side.",
    minutes: 7,
    level: "Beginner",
    steps: 6,
    notes: {
      href: "/docs/system-design/hld/building-blocks#14-real-time-communication",
      label: "HLD Building Blocks, 14"
    }
  },
  {
    slug: "api-protocols",
    track: "system-design",
    section: "Communication",
    title: "REST, gRPC & GraphQL",
    subtitle: "Three ways to shape an API and when each one fits.",
    minutes: 7,
    level: "Beginner",
    steps: 6,
    notes: {
      href: "/docs/system-design/hld/building-blocks#15-apis-and-protocols",
      label: "HLD Building Blocks, 15"
    }
  },
  {
    slug: "event-driven",
    track: "system-design",
    section: "Communication",
    title: "Events & the Outbox",
    subtitle: "Publish events reliably without dual writes.",
    minutes: 8,
    level: "Advanced",
    steps: 6,
    notes: {
      href: "/docs/system-design/hld/distributed-systems#11-event-driven-architecture",
      label: "Distributed Systems, 11"
    }
  },
  {
    slug: "cap-pacelc",
    track: "system-design",
    section: "Distributed Systems",
    title: "CAP & PACELC",
    subtitle: "During a partition you pick consistency or availability. Otherwise, latency.",
    minutes: 7,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/system-design/fundamentals#8-cap-and-pacelc",
      label: "System Design Fundamentals, 8"
    }
  },
  {
    slug: "consistency-models",
    track: "system-design",
    section: "Distributed Systems",
    title: "Consistency Models",
    subtitle: "Strong, read-your-writes, monotonic and eventual, shown with real reads.",
    minutes: 8,
    level: "Intermediate",
    steps: 8,
    notes: {
      href: "/docs/system-design/fundamentals#9-consistency-models",
      label: "System Design Fundamentals, 9"
    }
  },
  {
    slug: "time-ordering",
    track: "system-design",
    section: "Distributed Systems",
    title: "Time & Ordering",
    subtitle: "Clocks drift, so order events with logical clocks instead.",
    minutes: 8,
    level: "Advanced",
    steps: 8,
    notes: {
      href: "/docs/system-design/hld/distributed-systems#2-time-and-ordering",
      label: "Distributed Systems, 2"
    }
  },
  {
    slug: "raft",
    track: "system-design",
    section: "Distributed Systems",
    title: "Consensus with Raft",
    subtitle: "Elect a leader, replicate a log, survive failures.",
    minutes: 9,
    level: "Advanced",
    steps: 9,
    notes: {
      href: "/docs/system-design/hld/distributed-systems#4-consensus-and-raft",
      label: "Distributed Systems, 4"
    }
  },
  {
    slug: "locks-fencing",
    track: "system-design",
    section: "Distributed Systems",
    title: "Locks, Leases & Fencing",
    subtitle: "Why a distributed lock needs a fencing token to be safe.",
    minutes: 7,
    level: "Advanced",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/distributed-systems#5-locks-leases-and-fencing",
      label: "Distributed Systems, 5"
    }
  },
  {
    slug: "isolation-levels",
    track: "system-design",
    section: "Distributed Systems",
    title: "Isolation Levels & Anomalies",
    subtitle: "Dirty reads, lost updates and write skew, and the level that stops each.",
    minutes: 8,
    level: "Advanced",
    steps: 8,
    notes: {
      href: "/docs/system-design/hld/distributed-systems#6-isolation-levels-and-anomalies",
      label: "Distributed Systems, 6"
    }
  },
  {
    slug: "distributed-transactions",
    track: "system-design",
    section: "Distributed Systems",
    title: "2PC & Sagas",
    subtitle: "Commit across services, or compensate when you cannot.",
    minutes: 8,
    level: "Advanced",
    steps: 6,
    notes: {
      href: "/docs/system-design/hld/distributed-systems#7-distributed-transactions",
      label: "Distributed Systems, 7"
    }
  },
  {
    slug: "idempotency",
    track: "system-design",
    section: "Distributed Systems",
    title: "Idempotency & Exactly-Once",
    subtitle: "Make retries safe with idempotency keys and dedup.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/system-design/hld/distributed-systems#8-idempotency-and-exactly-once",
      label: "Distributed Systems, 8"
    }
  },
  {
    slug: "resilience",
    track: "system-design",
    section: "Reliability & Operations",
    title: "Timeouts, Retries & Breakers",
    subtitle: "Stop one slow dependency from taking the whole system down.",
    minutes: 8,
    level: "Intermediate",
    steps: 8,
    notes: {
      href: "/docs/system-design/hld/distributed-systems#10-resilience-patterns",
      label: "Distributed Systems, 10"
    }
  },
  {
    slug: "multi-region",
    track: "system-design",
    section: "Reliability & Operations",
    title: "Multi-Region Design",
    subtitle: "Active-passive vs active-active, and what each costs you.",
    minutes: 8,
    level: "Advanced",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/distributed-systems#12-multi-region-design",
      label: "Distributed Systems, 12"
    }
  },
  {
    slug: "cells",
    track: "system-design",
    section: "Reliability & Operations",
    title: "Cells & Shuffle Sharding",
    subtitle: "Shrink the blast radius so one bad tenant hurts few others.",
    minutes: 7,
    level: "Advanced",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/distributed-systems#13-blast-radius-cells-and-shuffle-sharding",
      label: "Distributed Systems, 13"
    }
  },
  {
    slug: "slos",
    track: "system-design",
    section: "Reliability & Operations",
    title: "SLIs, SLOs & Error Budgets",
    subtitle: "Turn reliability into a number you can spend.",
    minutes: 6,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/reliability-and-operations#1-slis-slos-and-error-budgets",
      label: "Reliability and Operations, 1"
    }
  },
  {
    slug: "observability",
    track: "system-design",
    section: "Reliability & Operations",
    title: "Observability",
    subtitle: "Metrics, logs and traces, and how a trace follows a request.",
    minutes: 7,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/reliability-and-operations#2-observability",
      label: "Reliability and Operations, 2"
    }
  },
  {
    slug: "deployments",
    track: "system-design",
    section: "Reliability & Operations",
    title: "Deployment Strategies",
    subtitle: "Rolling, blue-green and canary releases with safe rollback.",
    minutes: 7,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/system-design/hld/reliability-and-operations#3-deployment-strategies",
      label: "Reliability and Operations, 3"
    }
  },
  {
    slug: "disaster-recovery",
    track: "system-design",
    section: "Reliability & Operations",
    title: "Backups & Disaster Recovery",
    subtitle: "RPO and RTO, and the backup strategies that hit them.",
    minutes: 6,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/system-design/hld/reliability-and-operations#4-backups-and-disaster-recovery",
      label: "Reliability and Operations, 4"
    }
  },
  {
    slug: "complexity",
    track: "dsa",
    section: "Foundations",
    title: "Constraints to Complexity",
    subtitle: "Read n from the constraints and know which algorithm will fit.",
    minutes: 6,
    level: "Beginner",
    steps: 7,
    notes: {
      href: "/docs/dsa/pattern-playbook#4-constraints-tell-you-the-complexity",
      label: "DSA Pattern Playbook, 4"
    }
  },
  {
    slug: "sliding-window",
    track: "dsa",
    section: "Arrays & Strings",
    title: "Sliding Window",
    subtitle: "Grow and shrink a window instead of rescanning every subarray.",
    minutes: 8,
    level: "Beginner",
    steps: 9,
    notes: {
      href: "/docs/dsa/arrays-and-linked-lists#2-sliding-window",
      label: "Arrays and Linked Lists, 2"
    }
  },
  {
    slug: "two-pointers",
    track: "dsa",
    section: "Arrays & Strings",
    title: "Two Pointers",
    subtitle: "Walk inward from both ends of a sorted array in one pass.",
    minutes: 7,
    level: "Beginner",
    steps: 8,
    notes: {
      href: "/docs/dsa/arrays-and-linked-lists#3-two-pointers",
      label: "Arrays and Linked Lists, 3"
    }
  },
  {
    slug: "prefix-sum",
    track: "dsa",
    section: "Arrays & Strings",
    title: "Prefix Sum & Hash Map",
    subtitle: "Count subarrays that sum to k, even with negative numbers.",
    minutes: 7,
    level: "Intermediate",
    steps: 8,
    notes: {
      href: "/docs/dsa/pattern-playbook#61-prefix-sum-and-hash-map",
      label: "DSA Pattern Playbook, 6.1"
    }
  },
  {
    slug: "cyclic-sort",
    track: "dsa",
    section: "Arrays & Strings",
    title: "Cyclic Sort",
    subtitle: "Put each number in its own index and find what is missing.",
    minutes: 6,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/dsa/arrays-and-linked-lists#6-cyclic-sort",
      label: "Arrays and Linked Lists, 6"
    }
  },
  {
    slug: "merge-intervals",
    track: "dsa",
    section: "Arrays & Strings",
    title: "Merge Intervals",
    subtitle: "Sort by start, then merge or insert in one sweep.",
    minutes: 7,
    level: "Beginner",
    steps: 8,
    notes: {
      href: "/docs/dsa/arrays-and-linked-lists#5-merge-intervals",
      label: "Arrays and Linked Lists, 5"
    }
  },
  {
    slug: "monotonic-stack",
    track: "dsa",
    section: "Arrays & Strings",
    title: "Monotonic Stack",
    subtitle: "Find the next greater element for every item in O(n).",
    minutes: 7,
    level: "Intermediate",
    steps: 8,
    notes: {
      href: "/docs/dsa/pattern-playbook#62-monotonic-stack",
      label: "DSA Pattern Playbook, 6.2"
    }
  },
  {
    slug: "fast-slow-pointers",
    track: "dsa",
    section: "Linked Lists",
    title: "Fast & Slow Pointers",
    subtitle: "Detect cycles and find middles with two speeds.",
    minutes: 7,
    level: "Beginner",
    steps: 8,
    notes: {
      href: "/docs/dsa/arrays-and-linked-lists#4-fast-and-slow-pointers",
      label: "Arrays and Linked Lists, 4"
    }
  },
  {
    slug: "linked-list-reversal",
    track: "dsa",
    section: "Linked Lists",
    title: "In-Place List Reversal",
    subtitle: "Flip next pointers with prev, curr and next.",
    minutes: 6,
    level: "Beginner",
    steps: 7,
    notes: {
      href: "/docs/dsa/arrays-and-linked-lists#7-in-place-reversal-of-a-linked-list",
      label: "Arrays and Linked Lists, 7"
    }
  },
  {
    slug: "tree-bfs",
    track: "dsa",
    section: "Trees & Heaps",
    title: "Tree BFS",
    subtitle: "Visit a tree level by level with a queue.",
    minutes: 7,
    level: "Beginner",
    steps: 8,
    notes: {
      href: "/docs/dsa/trees-graphs-and-search#2-tree-breadth-first-search",
      label: "Trees, Graphs and Search, 2"
    }
  },
  {
    slug: "tree-dfs",
    track: "dsa",
    section: "Trees & Heaps",
    title: "Tree DFS",
    subtitle: "Recurse down paths and carry state back up.",
    minutes: 7,
    level: "Beginner",
    steps: 8,
    notes: {
      href: "/docs/dsa/trees-graphs-and-search#3-tree-depth-first-search",
      label: "Trees, Graphs and Search, 3"
    }
  },
  {
    slug: "two-heaps",
    track: "dsa",
    section: "Trees & Heaps",
    title: "Two Heaps",
    subtitle: "Keep a running median with a max-heap and a min-heap.",
    minutes: 8,
    level: "Advanced",
    steps: 9,
    notes: {
      href: "/docs/dsa/trees-graphs-and-search#4-two-heaps",
      label: "Trees, Graphs and Search, 4"
    }
  },
  {
    slug: "top-k",
    track: "dsa",
    section: "Trees & Heaps",
    title: "Top K Elements",
    subtitle: "A size-k heap beats sorting everything.",
    minutes: 7,
    level: "Intermediate",
    steps: 8,
    notes: {
      href: "/docs/dsa/trees-graphs-and-search#7-top-k-elements",
      label: "Trees, Graphs and Search, 7"
    }
  },
  {
    slug: "k-way-merge",
    track: "dsa",
    section: "Trees & Heaps",
    title: "K-way Merge",
    subtitle: "Merge k sorted lists with a min-heap of heads.",
    minutes: 7,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/dsa/trees-graphs-and-search#8-k-way-merge",
      label: "Trees, Graphs and Search, 8"
    }
  },
  {
    slug: "trie",
    track: "dsa",
    section: "Trees & Heaps",
    title: "Trie",
    subtitle: "Share prefixes to search words and autocomplete fast.",
    minutes: 7,
    level: "Intermediate",
    steps: 8,
    notes: {
      href: "/docs/dsa/pattern-playbook#65-trie",
      label: "DSA Pattern Playbook, 6.5"
    }
  }
];

export function getLessonMeta(slug: string): LessonMeta | undefined {
  return LESSONS.find((l) => l.slug === slug);
}
