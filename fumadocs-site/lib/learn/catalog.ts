/**
 * Server-safe metadata for interactive lessons.
 * The full lesson (scene, frames, step copy) lives in components/learn/lessons and is client-only.
 * `steps` must match the number of steps the lesson file defines.
 */

export type LessonLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type LessonTrack = 'system-design' | 'frontend-system-design' | 'dsa' | 'networking' | 'backend' | 'databases' | 'oops' | 'redux' | 'javascript' | 'typescript' | 'java' | 'react' | 'nextjs' | 'react-native' | 'operating-systems' | 'computer-fundamentals' | 'python' | 'sdlc' | 'sdui';

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
  { id: 'frontend-system-design', title: 'Frontend System Design', blurb: 'Rendering, performance, state and real-time, from the browser to the release pipeline.' },
  { id: 'dsa', title: 'Data Structures & Algorithms', blurb: 'The interview patterns, traced element by element.' },
  { id: 'networking', title: 'Networking', blurb: 'Packets, subnets, TCP, QUIC and TLS, from the wire to the browser.' },
  { id: 'backend', title: 'Backend', blurb: 'Requests, auth, pagination, messaging and shutdown, the parts that break in production.' },
  { id: 'databases', title: 'Databases', blurb: 'Query execution, joins, indexes, concurrency and durability, run on real rows.' },
  { id: 'oops', title: 'OOP & Design Patterns', blurb: 'Pillars, SOLID and the patterns that bend with change, drawn as running diagrams.' },
  { id: 'redux', title: 'Redux Toolkit', blurb: 'The store loop, thunks, normalized state and re-render debugging, simulated step by step.' },
  { id: 'javascript', title: 'JavaScript', blurb: 'The event loop, closures, this and the prototype chain, with the output computed for real.' },
  { id: 'typescript', title: 'TypeScript', blurb: 'Narrowing, generics, unions and boundaries, shown as types flowing through real checks.' },
  { id: 'react', title: 'React', blurb: 'Rendering, state, hooks, memoization and React 19, simulated with real queues, slots and comparisons.' },
  { id: 'nextjs', title: 'Next.js', blurb: 'Rendering, Server Components, caching layers, navigation and auth, run through small real models.' },
  { id: 'react-native', title: 'React Native', blurb: 'Threads, JSI, Fabric, lists, navigation and OTA updates, run through small real models.' },
  { id: 'operating-systems', title: 'Operating Systems', blurb: 'Scheduling, paging, synchronization, storage and containers, run through real simulators.' },
  { id: 'computer-fundamentals', title: 'Computer Fundamentals', blurb: 'Bits, floats, caches, pipelines and compilers, computed from real encodings and simulators.' },
  { id: 'python', title: 'Python', blurb: 'Names, the GIL, asyncio, generators and NumPy, run through small models of how CPython behaves.' },
  { id: 'sdlc', title: 'SDLC', blurb: 'The phases, the models and the delivery pipeline, run through small simulations of real projects.' },
  { id: 'sdui', title: 'Server-Driven UI', blurb: 'Registries, validation, versioning, actions and orchestration, shown as a payload meeting a client.' },
  { id: 'java', title: 'Java', blurb: 'The JVM, HashMap, streams, threads and GC, with hashes and schedules computed for real.' },
];

/**
 * Ordered modules for tracks that follow a fixed course outline. A module with no lessons yet stays hidden.
 * Tracks without an entry use the order in which their sections first appear in LESSONS.
 */
export const TRACK_SECTIONS: Partial<Record<LessonTrack, string[]>> = {
  dsa: [
    'Foundations',
    'Arrays & Strings',
    'Linked Lists',
    'Stacks & Queues',
    'Hashing',
    'Trees',
    'Heaps',
    'Graphs',
    'Sorting & Searching',
    'Greedy Algorithms',
    'Backtracking',
    'Dynamic Programming',
    'Bit Manipulation',
    'Hard Problems',
  ],
};

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
    slug: "littles-law",
    track: "system-design",
    section: "Foundations",
    title: "Little's Law",
    subtitle: "Concurrency equals rate times latency: size pools and see how overload spirals.",
    minutes: 6,
    level: "Beginner",
    steps: 6,
    notes: {
      href: "/docs/system-design/fundamentals#73-littles-law",
      label: "System Design Fundamentals, 7.3"
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
    slug: "quorums",
    track: "system-design",
    section: "Distributed Systems",
    title: "Quorums & Conflicts",
    subtitle: "Pick W and R, survive failures, and merge writes that raced.",
    minutes: 9,
    level: "Advanced",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/distributed-systems#3-replication-in-depth",
      label: "Distributed Systems, 3"
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
    slug: "monolith-microservices",
    track: "system-design",
    section: "Distributed Systems",
    title: "Monolith or Microservices",
    subtitle: "Start modular, split for real reasons, and count the cost of the network.",
    minutes: 7,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/system-design/hld/distributed-systems#14-monolith-or-microservices",
      label: "Distributed Systems, 14"
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
    slug: "capacity-cost",
    track: "system-design",
    section: "Reliability & Operations",
    title: "Capacity, Load Tests & Cost",
    subtitle: "Find the knee, keep headroom, autoscale sanely and watch the bill.",
    minutes: 7,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/system-design/hld/reliability-and-operations#5-capacity-load-testing-and-cost",
      label: "Reliability and Operations, 5"
    }
  },
  {
    slug: "security-architecture",
    track: "system-design",
    section: "Reliability & Operations",
    title: "Security Architecture",
    subtitle: "AuthN vs AuthZ, OAuth with PKCE, token hygiene and defence in depth.",
    minutes: 9,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/reliability-and-operations#6-security-architecture",
      label: "Reliability and Operations, 6"
    }
  },
  {
    slug: "incident-response",
    track: "system-design",
    section: "Reliability & Operations",
    title: "Incident Response",
    subtitle: "Detect fast, mitigate before diagnosing, and learn without blame.",
    minutes: 6,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/system-design/hld/reliability-and-operations#7-incident-response",
      label: "Reliability and Operations, 7"
    }
  },
  {
    slug: "url-shortener",
    track: "system-design",
    section: "HLD Case Studies",
    title: "Design a URL Shortener",
    subtitle: "Size it, mint short codes, and trace the redirect through cache and store.",
    minutes: 8,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/system-design/hld/classic-designs#1-url-shortener",
      label: "Classic Designs, 1"
    }
  },
  {
    slug: "id-generator",
    track: "system-design",
    section: "HLD Case Studies",
    title: "Design a Unique ID Generator",
    subtitle: "Snowflake bit by bit, and the clock and machine-id traps.",
    minutes: 7,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/classic-designs#3-unique-id-generator",
      label: "Classic Designs, 3"
    }
  },
  {
    slug: "news-feed",
    track: "system-design",
    section: "HLD Case Studies",
    title: "Design a News Feed",
    subtitle: "Push, pull and the hybrid that survives a celebrity post.",
    minutes: 9,
    level: "Advanced",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/large-scale-designs#1-news-feed",
      label: "Large-Scale Designs, 1"
    }
  },
  {
    slug: "chat-system",
    track: "system-design",
    section: "HLD Case Studies",
    title: "Design a Chat System",
    subtitle: "Gateways, offline sync, dedupe and per-chat ordering.",
    minutes: 9,
    level: "Advanced",
    steps: 7,
    notes: {
      href: "/docs/system-design/hld/large-scale-designs#2-chat-system",
      label: "Large-Scale Designs, 2"
    }
  },
  {
    slug: "ticket-booking",
    track: "system-design",
    section: "HLD Case Studies",
    title: "Design Ticket Booking",
    subtitle: "Never double book: atomic holds, payments and a flash-sale waiting room.",
    minutes: 8,
    level: "Advanced",
    steps: 6,
    notes: {
      href: "/docs/system-design/hld/large-scale-designs#6-ticket-booking",
      label: "Large-Scale Designs, 6"
    }
  },
  {
    slug: "fe-radio",
    track: "frontend-system-design",
    section: "Framework & Delivery",
    title: "The RADIO Interview Framework",
    subtitle: "Structure 45 minutes so every senior signal gets airtime.",
    minutes: 7,
    level: "Beginner",
    steps: 7,
    notes: {
      href: "/docs/frontend-system-design/frontend-system-design-fundamentals#2-the-radio-framework",
      label: "Fundamentals, 2"
    }
  },
  {
    slug: "fe-rendering-strategies",
    track: "frontend-system-design",
    section: "Framework & Delivery",
    title: "CSR, SSR, SSG and Streaming",
    subtitle: "See where the HTML is made and what the user waits for.",
    minutes: 7,
    level: "Beginner",
    steps: 7,
    notes: {
      href: "/docs/frontend-system-design/rendering-and-delivery#2-rendering-strategies",
      label: "Rendering and Delivery, 2"
    }
  },
  {
    slug: "fe-hydration",
    track: "frontend-system-design",
    section: "Framework & Delivery",
    title: "Hydration and Its Alternatives",
    subtitle: "Why a page that looks ready is not, and how to pay less for it.",
    minutes: 7,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/frontend-system-design/rendering-and-delivery#4-hydration-and-its-alternatives",
      label: "Rendering and Delivery, 4"
    }
  },
  {
    slug: "fe-http-caching",
    track: "frontend-system-design",
    section: "Framework & Delivery",
    title: "HTTP Caching and Deploys",
    subtitle: "Cache-Control, ETags and stale-while-revalidate, one request at a time.",
    minutes: 7,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/frontend-system-design/rendering-and-delivery#6-http-caching",
      label: "Rendering and Delivery, 6"
    }
  },
  {
    slug: "fe-web-vitals",
    track: "frontend-system-design",
    section: "Performance & Data",
    title: "Core Web Vitals",
    subtitle: "LCP, INP and CLS broken into parts, with a fix for each.",
    minutes: 8,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/frontend-system-design/performance-engineering#2-core-web-vitals",
      label: "Performance Engineering, 2"
    }
  },
  {
    slug: "fe-state-data",
    track: "frontend-system-design",
    section: "Performance & Data",
    title: "State and Data Fetching",
    subtitle: "Query caches, normalization, optimistic updates and request races.",
    minutes: 7,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/frontend-system-design/state-and-data-management#3-server-state-and-query-caches",
      label: "State and Data Management, 3"
    }
  },
  {
    slug: "fe-realtime-sync",
    track: "frontend-system-design",
    section: "Performance & Data",
    title: "Real-Time, Offline and Sync",
    subtitle: "Transports, resume, backpressure, outboxes and conflicts.",
    minutes: 7,
    level: "Advanced",
    steps: 7,
    notes: {
      href: "/docs/frontend-system-design/real-time-offline-and-sync#4-reconnection-resume-and-ordering",
      label: "Real-Time, Offline and Sync, 4"
    }
  },
  {
    slug: "fe-micro-frontends",
    track: "frontend-system-design",
    section: "Architecture & Quality",
    title: "Micro-Frontends",
    subtitle: "Split a frontend across teams, and know when it is not worth it.",
    minutes: 7,
    level: "Advanced",
    steps: 7,
    notes: {
      href: "/docs/frontend-system-design/architecture-and-scalability#6-micro-frontends",
      label: "Architecture and Scalability, 6"
    }
  },
  {
    slug: "fe-security",
    track: "frontend-system-design",
    section: "Architecture & Quality",
    title: "Frontend Security",
    subtitle: "XSS, CSP, CSRF and token storage, attack and defense.",
    minutes: 7,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/frontend-system-design/security-accessibility-and-i18n#2-xss-and-content-security-policy",
      label: "Security, A11y and i18n, 2"
    }
  },
  {
    slug: "fe-accessibility-i18n",
    track: "frontend-system-design",
    section: "Architecture & Quality",
    title: "Accessibility and i18n",
    subtitle: "The accessibility tree, focus, comboboxes and plural rules.",
    minutes: 7,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/frontend-system-design/security-accessibility-and-i18n#6-accessibility-foundations",
      label: "Security, A11y and i18n, 6"
    }
  },
  {
    slug: "fe-release",
    track: "frontend-system-design",
    section: "Architecture & Quality",
    title: "Testing, Release and Incidents",
    subtitle: "Pipelines, canaries, version skew and the incident loop.",
    minutes: 7,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/frontend-system-design/testing-observability-and-release#8-progressive-delivery",
      label: "Testing and Release, 8"
    }
  },
  {
    slug: "fe-typeahead",
    track: "frontend-system-design",
    section: "Component Designs",
    title: "Design a Typeahead",
    subtitle: "Debounce, races, caching and ARIA in one component.",
    minutes: 8,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/frontend-system-design/ui-component-designs#2-typeahead-and-autocomplete",
      label: "UI Component Designs, 2"
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
    slug: "monotonic-stack",
    track: "dsa",
    section: "Stacks & Queues",
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
    slug: "prefix-sum",
    track: "dsa",
    section: "Hashing",
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
    slug: "tree-bfs",
    track: "dsa",
    section: "Trees",
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
    section: "Trees",
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
    slug: "trie",
    track: "dsa",
    section: "Trees",
    title: "Trie",
    subtitle: "Share prefixes to search words and autocomplete fast.",
    minutes: 7,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/dsa/pattern-playbook#65-trie",
      label: "DSA Pattern Playbook, 6.5"
    }
  },
  {
    slug: "two-heaps",
    track: "dsa",
    section: "Heaps",
    title: "Two Heaps",
    subtitle: "Keep a running median with a max-heap and a min-heap.",
    minutes: 8,
    level: "Advanced",
    steps: 8,
    notes: {
      href: "/docs/dsa/trees-graphs-and-search#4-two-heaps",
      label: "Trees, Graphs and Search, 4"
    }
  },
  {
    slug: "top-k",
    track: "dsa",
    section: "Heaps",
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
    section: "Heaps",
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
    slug: "topological-sort",
    track: "dsa",
    section: "Graphs",
    title: "Topological Sort",
    subtitle: "Order tasks by dependency with Kahn's queue, and spot cycles.",
    minutes: 7,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/dsa/trees-graphs-and-search#9-topological-sort",
      label: "Trees, Graphs and Search, 9"
    }
  },
  {
    slug: "union-find",
    track: "dsa",
    section: "Graphs",
    title: "Union-Find",
    subtitle: "Merge groups and answer same-group questions in near constant time.",
    minutes: 7,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/dsa/pattern-playbook#63-union-find-disjoint-set-union",
      label: "Pattern Playbook, 6.3"
    }
  },
  {
    slug: "dijkstra",
    track: "dsa",
    section: "Graphs",
    title: "Dijkstra",
    subtitle: "Weighted shortest path with a min-heap, and why edges must be non-negative.",
    minutes: 8,
    level: "Advanced",
    steps: 6,
    notes: {
      href: "/docs/dsa/pattern-playbook#66-dijkstra-weighted-shortest-path",
      label: "Pattern Playbook, 6.6"
    }
  },
  {
    slug: "binary-search",
    track: "dsa",
    section: "Sorting & Searching",
    title: "Modified Binary Search",
    subtitle: "One template for sorted, rotated and answer-space searches.",
    minutes: 9,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/dsa/trees-graphs-and-search#6-modified-binary-search",
      label: "Trees, Graphs and Search, 6"
    }
  },
  {
    slug: "greedy",
    track: "dsa",
    section: "Greedy Algorithms",
    title: "Greedy",
    subtitle: "Take the best choice now, and know when that is provably safe.",
    minutes: 7,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/dsa/pattern-playbook#67-greedy",
      label: "Pattern Playbook, 6.7"
    }
  },
  {
    slug: "backtracking",
    track: "dsa",
    section: "Backtracking",
    title: "Subsets & Backtracking",
    subtitle: "Choose, explore, undo, and watch the decision tree get walked.",
    minutes: 9,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/dsa/trees-graphs-and-search#5-subsets-and-backtracking",
      label: "Trees, Graphs and Search, 5"
    }
  },
  {
    slug: "dynamic-programming",
    track: "dsa",
    section: "Dynamic Programming",
    title: "Dynamic Programming",
    subtitle: "The five-question recipe on house robber, coin change and LCS.",
    minutes: 10,
    level: "Advanced",
    steps: 6,
    notes: {
      href: "/docs/dsa/pattern-playbook#64-dynamic-programming-recipe",
      label: "Pattern Playbook, 6.4"
    }
  },
  {
    slug: "bit-manipulation",
    track: "dsa",
    section: "Bit Manipulation",
    title: "Bit Manipulation",
    subtitle: "XOR, n & (n - 1) and the 32-bit traps, bit by bit.",
    minutes: 7,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/dsa/pattern-playbook#68-bit-manipulation",
      label: "Pattern Playbook, 6.8"
    }
  },
  {
    slug: "net-osi-encapsulation",
    track: "networking",
    section: "Foundations",
    title: "Layers & Encapsulation",
    subtitle: "Follow data down the stack as headers wrap it, and see which addresses change per hop.",
    minutes: 7,
    level: "Beginner",
    steps: 7,
    notes: {
      href: "/docs/networking/networking-fundamentals#5-encapsulation",
      label: "Networking Fundamentals, 5"
    }
  },
  {
    slug: "net-subnetting",
    track: "networking",
    section: "IP & Routing",
    title: "CIDR & Subnetting",
    subtitle: "Split addresses into network and host bits, size blocks, and plan subnets with VLSM.",
    minutes: 9,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/networking/ip-addressing-and-routing#2-cidr-and-subnetting",
      label: "IP Addressing & Routing, 2"
    }
  },
  {
    slug: "net-routing-nat",
    track: "networking",
    section: "IP & Routing",
    title: "DHCP, Routing & NAT",
    subtitle: "From getting an address to longest prefix match, TTL and sharing one public IP.",
    minutes: 9,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/networking/ip-addressing-and-routing#8-how-routing-works",
      label: "IP Addressing & Routing, 8"
    }
  },
  {
    slug: "net-tcp-handshake",
    track: "networking",
    section: "Transport",
    title: "TCP Lifecycle",
    subtitle: "Handshake, SYN floods, loss recovery, closing and why connection reuse pays.",
    minutes: 9,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/networking/tcp-udp-and-quic#4-the-three-way-handshake",
      label: "TCP, UDP & QUIC, 4"
    }
  },
  {
    slug: "net-tcp-congestion",
    track: "networking",
    section: "Transport",
    title: "Flow & Congestion Control",
    subtitle: "Two windows, slow start and the AIMD sawtooth, simulated RTT by RTT.",
    minutes: 8,
    level: "Advanced",
    steps: 7,
    notes: {
      href: "/docs/networking/tcp-udp-and-quic#9-congestion-control",
      label: "TCP, UDP & QUIC, 9"
    }
  },
  {
    slug: "net-quic-http3",
    track: "networking",
    section: "Transport",
    title: "HTTP/2, QUIC & HTTP/3",
    subtitle: "Head-of-line blocking, 1-RTT setup, connection migration and 0-RTT.",
    minutes: 8,
    level: "Advanced",
    steps: 7,
    notes: {
      href: "/docs/networking/tcp-udp-and-quic#12-quic",
      label: "TCP, UDP & QUIC, 12"
    }
  },
  {
    slug: "net-tls",
    track: "networking",
    section: "Security & Ops",
    title: "TLS 1.3 & Certificates",
    subtitle: "Key exchange, the 1-RTT handshake, chain validation and the errors you will see.",
    minutes: 9,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/networking/dns-http-and-tls#11-the-tls-13-handshake",
      label: "DNS, HTTP & TLS, 11"
    }
  },
  {
    slug: "net-troubleshooting",
    track: "networking",
    section: "Security & Ops",
    title: "Troubleshooting Method",
    subtitle: "Work up the stack, read refused vs timeout, 5xx codes and a NAT port incident.",
    minutes: 7,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/networking/troubleshooting-and-tools#1-a-method",
      label: "Troubleshooting & Tools, 1"
    }
  },
  {
    slug: "be-request-lifecycle",
    track: "backend",
    section: "Foundations",
    title: "Life of a Request",
    subtitle: "From the edge through validation and errors to health probes, hop by hop.",
    minutes: 8,
    level: "Beginner",
    steps: 7,
    notes: {
      href: "/docs/backend/backend-fundamentals#1-the-life-of-a-request",
      label: "Backend Fundamentals, 1"
    }
  },
  {
    slug: "be-event-loop",
    track: "backend",
    section: "Foundations",
    title: "The Node Event Loop",
    subtitle: "Why one thread serves thousands of waits, and what blocks it.",
    minutes: 8,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/backend/nodejs-and-spring#2-nodejs-runtime",
      label: "Node.js & Spring, 2"
    }
  },
  {
    slug: "be-sessions-jwt",
    track: "backend",
    section: "Auth & Security",
    title: "Sessions, CSRF & JWT",
    subtitle: "Cookie sessions, CSRF, signed tokens, their attacks and refresh rotation.",
    minutes: 9,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/backend/authentication-and-security#2-sessions-and-tokens",
      label: "Authentication & Security, 2"
    }
  },
  {
    slug: "be-pagination",
    track: "backend",
    section: "API & Data",
    title: "Pagination That Scales",
    subtitle: "Offset drift versus keyset cursors, traced on a real list.",
    minutes: 8,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/backend/api-design#5-collections-filtering-sorting-pagination",
      label: "API Design, 5"
    }
  },
  {
    slug: "be-outbox-consumers",
    track: "backend",
    section: "Async & Reliability",
    title: "Outbox & Reliable Consumers",
    subtitle: "Dual writes, the outbox, duplicates, idempotent consumers and dead letters.",
    minutes: 9,
    level: "Advanced",
    steps: 6,
    notes: {
      href: "/docs/backend/async-processing-and-messaging#5-reliable-producers-the-outbox",
      label: "Async Processing, 5"
    }
  },
  {
    slug: "be-graceful-shutdown",
    track: "backend",
    section: "Deploy & Ops",
    title: "Graceful Shutdown & Probes",
    subtitle: "SIGTERM, the load balancer race, clean drains and shallow liveness.",
    minutes: 8,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/backend/deployment-and-runtime#5-health-checks-and-graceful-shutdown",
      label: "Deployment & Runtime, 5"
    }
  },
  {
    slug: "db-query-execution",
    track: "databases",
    section: "SQL & Queries",
    title: "How a Query Executes",
    subtitle: "Logical order of FROM, WHERE, GROUP BY and SELECT, traced on real rows.",
    minutes: 8,
    level: "Beginner",
    steps: 6,
    notes: {
      href: "/docs/databases/sql-essentials#2-how-a-query-executes",
      label: "SQL Essentials, 2"
    }
  },
  {
    slug: "db-join-algorithms",
    track: "databases",
    section: "SQL & Queries",
    title: "Join Algorithms",
    subtitle: "Nested loop, hash and merge joins, each run and counted on real data.",
    minutes: 8,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/databases/database-internals#7-join-algorithms",
      label: "Database Internals, 7"
    }
  },
  {
    slug: "db-composite-index",
    track: "databases",
    section: "Indexing",
    title: "Composite & Covering Indexes",
    subtitle: "Leftmost prefix, column order, sargable predicates and index-only scans.",
    minutes: 9,
    level: "Intermediate",
    steps: 7,
    notes: {
      href: "/docs/databases/indexing-and-query-performance#3-composite-covering-partial-expression",
      label: "Indexing & Performance, 3"
    }
  },
  {
    slug: "db-mvcc-locks",
    track: "databases",
    section: "Transactions",
    title: "MVCC, Locks & Deadlocks",
    subtitle: "Snapshots, row locks, SKIP LOCKED queues and how deadlocks form.",
    minutes: 9,
    level: "Advanced",
    steps: 7,
    notes: {
      href: "/docs/databases/transactions-and-concurrency#4-mvcc",
      label: "Transactions & Concurrency, 4"
    }
  },
  {
    slug: "db-wal-recovery",
    track: "databases",
    section: "Durability",
    title: "WAL & Crash Recovery",
    subtitle: "Log first, page later, and how ARIES redoes and undoes after a crash.",
    minutes: 8,
    level: "Advanced",
    steps: 6,
    notes: {
      href: "/docs/databases/database-internals#5-write-ahead-logging-and-recovery",
      label: "Database Internals, 5"
    }
  },
  {
    slug: "db-migrations",
    track: "databases",
    section: "Operations",
    title: "Zero-Downtime Migrations",
    subtitle: "Expand and contract, batched backfills, lock_timeout and concurrent indexes.",
    minutes: 8,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/databases/replication-sharding-and-operations#8-schema-migrations-without-downtime",
      label: "Replication & Operations, 8"
    }
  },
  {
    slug: "oop-four-pillars",
    track: "oops",
    section: "Foundations",
    title: "The Four Pillars",
    subtitle: "Encapsulation, abstraction, inheritance and polymorphism, each shown as a real call.",
    minutes: 9,
    level: "Beginner",
    steps: 7,
    notes: {
      href: "/docs/oops/oops#3-the-four-pillars",
      label: "OOPS Notes, 3"
    }
  },
  {
    slug: "oop-composition-uml",
    track: "oops",
    section: "Foundations",
    title: "Composition & UML",
    subtitle: "Why favor has-a, when inheritance is fine, and the five UML relationships.",
    minutes: 8,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/oops/oops#5-composition-vs-inheritance",
      label: "OOPS Notes, 5"
    }
  },
  {
    slug: "oop-solid-srp-ocp-lsp",
    track: "oops",
    section: "SOLID",
    title: "SRP, OCP & LSP",
    subtitle: "Split god classes, extend without edits, and spot a Liskov violation.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/oops/oops#6-solid-principles",
      label: "OOPS Notes, 6"
    }
  },
  {
    slug: "oop-solid-isp-dip",
    track: "oops",
    section: "SOLID",
    title: "ISP & Dependency Inversion",
    subtitle: "Small interfaces, injected dependencies and tests without real infrastructure.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/oops/oops#64-interface-segregation-principle",
      label: "OOPS Notes, 6.4"
    }
  },
  {
    slug: "oop-patterns-creation-strategy",
    track: "oops",
    section: "Design Patterns",
    title: "Singleton, Factory & Strategy",
    subtitle: "Control creation and swap algorithms at runtime.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/oops/oops#81-singleton",
      label: "OOPS Notes, 8.1"
    }
  },
  {
    slug: "oop-patterns-observer-decorator",
    track: "oops",
    section: "Design Patterns",
    title: "Observer, Decorator & Prototypes",
    subtitle: "Notify without knowing listeners, wrap to extend, and the JS prototype chain.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/oops/oops#84-observer",
      label: "OOPS Notes, 8.4"
    }
  },
  {
    slug: "redux-data-flow",
    track: "redux",
    section: "Core",
    title: "The Redux Loop",
    subtitle: "Dispatch, reduce, select: slices, Immer and why selectors decide who re-renders.",
    minutes: 8,
    level: "Beginner",
    steps: 6,
    notes: {
      href: "/docs/redux/redux#2-createslice-most-important-concept",
      label: "Redux Notes, 2"
    }
  },
  {
    slug: "redux-async-thunk",
    track: "redux",
    section: "Core",
    title: "Async with createAsyncThunk",
    subtitle: "Pending, fulfilled and rejected: one dispatch, the lifecycle actions and extraReducers.",
    minutes: 7,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/redux/redux#5-async-logic--createasyncthunk",
      label: "Redux Notes, 5"
    }
  },
  {
    slug: "redux-normalized-selectors",
    track: "redux",
    section: "State Design",
    title: "Normalized State & Selectors",
    subtitle: "Why nested state widens updates, entity adapters and memoized selectors with real counts.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/redux/redux#8-normalized-state-shape",
      label: "Redux Notes, 8"
    }
  },
  {
    slug: "redux-rerender-debugging",
    track: "redux",
    section: "Performance",
    title: "Debugging Re-renders",
    subtitle: "Which components re-render and why: whole-store selectors, monolithic slices and spreads.",
    minutes: 9,
    level: "Advanced",
    steps: 6,
    notes: {
      href: "/docs/redux/rtk-rq#how-redux-causes-performance-issues",
      label: "RTK Query & Performance"
    }
  },
  {
    slug: "redux-rtk-query",
    track: "redux",
    section: "Data Fetching",
    title: "RTK Query & Caching",
    subtitle: "Cache keys, lifetimes, tag invalidation and how it compares to React Query.",
    minutes: 8,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/redux/redux#12-redux-toolkit-query-rtk-query",
      label: "Redux Notes, 12"
    }
  },
  {
    slug: "js-event-loop",
    track: "javascript",
    section: "Async",
    title: "The Event Loop",
    subtitle: "Call stack, microtasks and macrotasks, traced by a small simulator.",
    minutes: 9,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/javascript/adv-js#13-event-loop-priority-order-critical",
      label: "Advanced JS, 1.3"
    }
  },
  {
    slug: "js-async-await",
    track: "javascript",
    section: "Async",
    title: "async and await",
    subtitle: "What await really does, why C A D B, and why a busy stack stalls timers.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/javascript/adv-js#17-async--await-internals-important",
      label: "Advanced JS, 1.7"
    }
  },
  {
    slug: "js-closures",
    track: "javascript",
    section: "Core",
    title: "Closures & Scope",
    subtitle: "Closures that remember, and the var versus let loop trap, run for real.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/javascript/js#6-closures",
      label: "JavaScript, 6"
    }
  },
  {
    slug: "js-this",
    track: "javascript",
    section: "Core",
    title: "How this Is Decided",
    subtitle: "Method call, lost context, call, bind and arrows, each evaluated.",
    minutes: 8,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/javascript/js#10-this-keyword",
      label: "JavaScript, 10"
    }
  },
  {
    slug: "js-coercion",
    track: "javascript",
    section: "Core",
    title: "Coercion & Equality",
    subtitle: "Why \"5\" + 1 and \"5\" - 1 differ, and why [] == ![] is true, step by step.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/javascript/js#8-type-coercion",
      label: "JavaScript, 8"
    }
  },
  {
    slug: "js-prototypes",
    track: "javascript",
    section: "Objects",
    title: "Prototype Chain",
    subtitle: "Shared methods, new, the lookup walk to null, and class as sugar.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/javascript/js#17-prototype--prototypal-inheritance",
      label: "JavaScript, 17"
    }
  },
  {
    slug: "js-debounce-throttle",
    track: "javascript",
    section: "Patterns",
    title: "Debounce & Throttle",
    subtitle: "The same events run through both wrappers, so you see exactly when fn fires.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/javascript/js#22-debouncing--throttling",
      label: "JavaScript, 22"
    }
  },
  {
    slug: "ts-unknown-narrowing",
    track: "typescript",
    section: "Core types",
    title: "any, unknown and Narrowing",
    subtitle: "Why any hides bugs, how unknown forces a check, and typeof, in and instanceof run on real values.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/typescript/ts#5-any-vs-unknown",
      label: "TypeScript, 5"
    }
  },
  {
    slug: "ts-generics",
    track: "typescript",
    section: "Core types",
    title: "Generics",
    subtitle: "Inference, constraints and useState<T>, shown as a type flowing through a call.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/typescript/ts#17-generics-very-important",
      label: "TypeScript, 17"
    }
  },
  {
    slug: "ts-mapped-types",
    track: "typescript",
    section: "Type tools",
    title: "keyof, Mapped and Utility Types",
    subtitle: "Rebuild a type key by key, then see Partial, Pick and Omit do it for you.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/typescript/ts#23-mapped-types",
      label: "TypeScript, 23"
    }
  },
  {
    slug: "ts-discriminated-unions",
    track: "typescript",
    section: "Modelling",
    title: "Discriminated Unions",
    subtitle: "A kind tag narrows each case, and never turns a forgotten variant into a compile error.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/typescript/adv-ts-patterns#3-discriminated-unions-most-asked-advanced-topic",
      label: "Advanced TS, 3"
    }
  },
  {
    slug: "ts-impossible-states",
    track: "typescript",
    section: "Modelling",
    title: "Impossible States",
    subtitle: "Count the states three flags allow, then replace them with a status union.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/typescript/system-design-decisions#3-preventing-impossible-states-most-important",
      label: "TS System Design, 3"
    }
  },
  {
    slug: "ts-boundaries",
    track: "typescript",
    section: "Design",
    title: "Types at Boundaries",
    subtitle: "unknown plus a type guard at the edge, and one mapper that converts the API shape.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/typescript/system-design-decisions#2-core-principle-types-at-boundaries",
      label: "TS System Design, 2"
    }
  },
  {
    slug: "java-jvm-flow",
    track: "java",
    section: "Platform",
    title: "From Source to Running Code",
    subtitle: "javac, bytecode, the interpreter and the JIT, and how JDK, JRE and JVM nest.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/java/java#1-the-java-platform",
      label: "Java, 1"
    }
  },
  {
    slug: "java-pass-by-value",
    track: "java",
    section: "Language",
    title: "Pass by Value",
    subtitle: "Why a method can mutate your object but never repoint your variable.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/java/java#4-pass-by-value",
      label: "Java, 4"
    }
  },
  {
    slug: "java-string-boxing",
    track: "java",
    section: "Language",
    title: "String Pool & Integer Cache",
    subtitle: "Why == works for 127 and \"java\" literals, and fails for 128 and new String.",
    minutes: 8,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/java/java#51-the-string-pool",
      label: "Java, 5.1"
    }
  },
  {
    slug: "java-init-order",
    track: "java",
    section: "Language",
    title: "Initialization Order",
    subtitle: "Static blocks, instance blocks and constructors, recorded by running the hierarchy.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/java/java#81-initialization-order",
      label: "Java, 8.1"
    }
  },
  {
    slug: "java-equals-hashcode",
    track: "java",
    section: "Collections",
    title: "equals and hashCode",
    subtitle: "Real bucket numbers show why overriding only equals loses entries.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/java/java#101-the-equals-and-hashcode-contract",
      label: "Java, 10.1"
    }
  },
  {
    slug: "java-hashmap",
    track: "java",
    section: "Collections",
    title: "HashMap Internals",
    subtitle: "Java's own hash arithmetic places keys, chains collisions and doubles the table.",
    minutes: 10,
    level: "Intermediate",
    steps: 6,
    notes: {
      href: "/docs/java/java-collections-streams#6-hashmap-internals",
      label: "Java Collections, 6"
    }
  },
  {
    slug: "java-streams",
    track: "java",
    section: "Collections",
    title: "Streams",
    subtitle: "A lazy pipeline run element by element, with limit stopping early.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/java/java-collections-streams#13-streams",
      label: "Java Collections, 13"
    }
  },
  {
    slug: "java-thread-states",
    track: "java",
    section: "Concurrency",
    title: "Thread States",
    subtitle: "Move one thread through NEW, RUNNABLE, BLOCKED, WAITING and TERMINATED.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/java/java-concurrency-jvm#2-thread-lifecycle",
      label: "Java Concurrency, 2"
    }
  },
  {
    slug: "java-race-synchronized",
    track: "java",
    section: "Concurrency",
    title: "Races and synchronized",
    subtitle: "A lost update replayed step by step, then fixed with a lock and with CAS.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/java/java-concurrency-jvm#3-race-conditions-and-synchronized",
      label: "Java Concurrency, 3"
    }
  },
  {
    slug: "java-thread-pool",
    track: "java",
    section: "Concurrency",
    title: "Thread Pool Executor",
    subtitle: "Core, queue, extra threads, reject: seven tasks placed by the real rule.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/java/java-concurrency-jvm#8-executor-framework-and-thread-pools",
      label: "Java Concurrency, 8"
    }
  },
  {
    slug: "java-gc-generational",
    track: "java",
    section: "JVM",
    title: "Generational GC",
    subtitle: "Eden, survivor and old generation, and how a leak survives the collector.",
    minutes: 8,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/java/java-concurrency-jvm#15-garbage-collection",
      label: "Java JVM, 15"
    }
  },
  {
    slug: "react-render-commit",
    track: "react",
    section: "Rendering",
    title: "Render and Commit",
    subtitle: "Trigger, render, reconcile, commit and effects, with a real tree diff.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/react/react#20-rendering-behavior-important-interview-topic",
      label: "React, 20"
    }
  },
  {
    slug: "react-keys-reconciliation",
    track: "react",
    section: "Rendering",
    title: "Keys & Reconciliation",
    subtitle: "Delete a row with index keys and with ids, and watch the typed text land on the wrong row.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/react/react#19-reconciliation--virtual-dom",
      label: "React, 19"
    }
  },
  {
    slug: "react-setstate-batching",
    track: "react",
    section: "State",
    title: "setState & Batching",
    subtitle: "Why three setCount(count + 1) calls add 1, and how updater functions fix it.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/react/react#4-state",
      label: "React, 4"
    }
  },
  {
    slug: "react-context",
    track: "react",
    section: "State",
    title: "Context API",
    subtitle: "Prop drilling, a direct provider, and what re-renders when the value changes.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/react/react#16-context-api",
      label: "React, 16"
    }
  },
  {
    slug: "react-hook-order",
    track: "react",
    section: "Hooks",
    title: "Why Hooks Have Rules",
    subtitle: "A tiny hook runtime shows a conditional hook reading the wrong slot.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/react/react#q-why-hooks-must-be-called-at-top-level",
      label: "React, 25"
    }
  },
  {
    slug: "react-useeffect",
    track: "react",
    section: "Hooks",
    title: "useEffect Dependencies",
    subtitle: "No array, empty array and [a], run or skip decided by Object.is, plus cleanup.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/react/react#11-useeffect-hook",
      label: "React, 11"
    }
  },
  {
    slug: "react-memo",
    track: "react",
    section: "Performance",
    title: "memo, useMemo, useCallback",
    subtitle: "Count child renders with and without memo, and see inline props defeat it.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/react/react#15-reactmemo",
      label: "React, 15"
    }
  },
  {
    slug: "react-actions",
    track: "react",
    section: "React 19",
    title: "Actions & Optimistic UI",
    subtitle: "useActionState, useFormStatus and useOptimistic, including the failure rollback.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/react/react#27-react-19-actions--new-hooks",
      label: "React, 27"
    }
  },
  {
    slug: "react-use-suspense",
    track: "react",
    section: "React 19",
    title: "use() and Suspense",
    subtitle: "Read a promise in render, suspend, fall back, and re-render with the value.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/react/react#use",
      label: "React, 27"
    }
  },
  {
    slug: "react-19-2",
    track: "react",
    section: "React 19",
    title: "Activity & useEffectEvent",
    subtitle: "Hidden UI that keeps its state, and effects that stop re-running on every theme change.",
    minutes: 8,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/react/react#29-react-192-updates",
      label: "React, 29"
    }
  },
  {
    slug: "next-rendering-spectrum",
    track: "nextjs",
    section: "Rendering",
    title: "The Rendering Spectrum",
    subtitle: "CSR, SSR, SSG, ISR and streaming on one timeline, with example latencies.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/nextjs/rendering-and-server-components#1-the-rendering-spectrum",
      label: "Next.js Rendering, 1"
    }
  },
  {
    slug: "next-static-dynamic-ppr",
    track: "nextjs",
    section: "Rendering",
    title: "Static, Dynamic and PPR",
    subtitle: "A classifier applies the real rules: cookies, searchParams, Suspense and the static shell.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/nextjs/rendering-and-server-components#2-static-vs-dynamic-rendering",
      label: "Next.js Rendering, 2"
    }
  },
  {
    slug: "next-server-client-boundary",
    track: "nextjs",
    section: "Server Components",
    title: "The use client Boundary",
    subtitle: "Walk the import graph to see how many KB each boundary placement ships.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/nextjs/rendering-and-server-components#4-the-use-client-boundary",
      label: "Next.js Rendering, 4"
    }
  },
  {
    slug: "next-rsc-hydration",
    track: "nextjs",
    section: "Server Components",
    title: "RSC Payload and Hydration",
    subtitle: "Why only Client Components hydrate, and a real hydration mismatch.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/nextjs/rendering-and-server-components#8-hydration",
      label: "Next.js Rendering, 8"
    }
  },
  {
    slug: "next-fetch-waterfall",
    track: "nextjs",
    section: "Data",
    title: "Waterfalls and Streaming",
    subtitle: "200 + 300 + 150 ms awaited in a row, then in parallel, then streamed per section.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/nextjs/data-fetching-and-caching#3-parallel-vs-sequential-fetching",
      label: "Next.js Data, 3"
    }
  },
  {
    slug: "next-caching-layers",
    track: "nextjs",
    section: "Caching",
    title: "The Four Caching Layers",
    subtitle: "A layered lookup shows which cache answers each request and what revalidate clears.",
    minutes: 9,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/nextjs/data-fetching-and-caching#5-the-classic-caching-layers",
      label: "Next.js Data, 5"
    }
  },
  {
    slug: "next-cache-lifetimes",
    track: "nextjs",
    section: "Caching",
    title: "cacheLife: stale, revalidate, expire",
    subtitle: "Three requests at different ages get fresh, stale plus refresh, and a wait.",
    minutes: 8,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/nextjs/data-fetching-and-caching#7-cache-lifetimes-and-tags",
      label: "Next.js Data, 7"
    }
  },
  {
    slug: "next-revalidation",
    track: "nextjs",
    section: "Caching",
    title: "revalidateTag vs updateTag",
    subtitle: "Stale-while-revalidate for visitors, read-your-writes for the author, and a safe webhook.",
    minutes: 8,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/nextjs/data-fetching-and-caching#8-revalidation-apis",
      label: "Next.js Data, 8"
    }
  },
  {
    slug: "next-client-navigation",
    track: "nextjs",
    section: "Routing",
    title: "How Link Navigates",
    subtitle: "A path diff shows which segments are fetched and which layouts stay mounted.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/nextjs/routing-and-navigation#9-client-navigation-behavior",
      label: "Next.js Routing, 9"
    }
  },
  {
    slug: "next-server-actions-security",
    track: "nextjs",
    section: "Security",
    title: "Server Action Security",
    subtitle: "The same deletePost called anonymously, by another user, and by the owner.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/nextjs/server-actions-and-route-handlers#11-security-model",
      label: "Next.js Actions, 11"
    }
  },
  {
    slug: "next-proxy-dal",
    track: "nextjs",
    section: "Security",
    title: "proxy.ts and the DAL",
    subtitle: "Four requests through the layers show what a proxy alone misses.",
    minutes: 8,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/nextjs/auth-security-and-proxy#5-the-data-access-layer",
      label: "Next.js Auth, 5"
    }
  },
  {
    slug: "rn-thread-frame-budget",
    track: "react-native",
    section: "Architecture",
    title: "Threads and the Frame Budget",
    subtitle: "A frame simulator shows which frames a busy JS thread drops, and which ones UI-driven motion keeps.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/react-native/architecture-and-internals#2-threads",
      label: "RN Architecture, 2"
    }
  },
  {
    slug: "rn-bridge-to-jsi",
    track: "react-native",
    section: "Architecture",
    title: "Bridge to JSI",
    subtitle: "JSON bytes from a real batch, a synchronous host call, and lazy versus eager modules.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/react-native/architecture-and-internals#3-the-legacy-bridge",
      label: "RN Architecture, 3"
    }
  },
  {
    slug: "rn-fabric-pipeline",
    track: "react-native",
    section: "Architecture",
    title: "Fabric: Render, Commit, Mount",
    subtitle: "An immutable shadow tree clones a path, and the diff yields one mutation.",
    minutes: 8,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/react-native/architecture-and-internals#6-fabric-the-renderer",
      label: "RN Architecture, 6"
    }
  },
  {
    slug: "rn-startup",
    track: "react-native",
    section: "Architecture",
    title: "App Startup",
    subtitle: "Five startup phases, then Hermes, inline requires and cached data each remove time.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/react-native/architecture-and-internals#11-app-startup",
      label: "RN Architecture, 11"
    }
  },
  {
    slug: "rn-flatlist-virtualization",
    track: "react-native",
    section: "Lists",
    title: "FlatList and FlashList",
    subtitle: "A mounted window, blank areas on a fling, and a recycled cell that leaks state.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/react-native/lists-state-and-data#2-flatlist",
      label: "RN Lists, 2"
    }
  },
  {
    slug: "rn-offline-first",
    track: "react-native",
    section: "Data",
    title: "Offline-first",
    subtitle: "Local database, an outbox, and a retry that duplicates without a client id.",
    minutes: 8,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/react-native/lists-state-and-data#10-offline-first",
      label: "RN Lists, 10"
    }
  },
  {
    slug: "rn-animation-tools",
    track: "react-native",
    section: "Animation",
    title: "Animation Tools",
    subtitle: "Native driver limits, worklets, a lagging drag gesture, and picking the right tool.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/react-native/animations-and-gestures#3-the-native-driver",
      label: "RN Animations, 3"
    }
  },
  {
    slug: "rn-screen-lifecycle",
    track: "react-native",
    section: "Navigation",
    title: "Screens Stay Mounted",
    subtitle: "A stack simulator emits every mount, focus and blur, and why useFocusEffect exists.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/react-native/navigation-and-routing#10-screen-lifecycle-and-focus",
      label: "RN Navigation, 10"
    }
  },
  {
    slug: "rn-auth-deeplink",
    track: "react-native",
    section: "Navigation",
    title: "Auth Flows and Deep Links",
    subtitle: "Screens from auth state, no back into private screens, and a link queued until sign-in.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/react-native/navigation-and-routing#7-authentication-flows",
      label: "RN Navigation, 7"
    }
  },
  {
    slug: "rn-ota-updates",
    track: "react-native",
    section: "Release",
    title: "Over-the-Air Updates",
    subtitle: "A real fingerprint hash decides who gets an update and what needs a store build.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/react-native/testing-build-and-release#7-over-the-air-updates",
      label: "RN Release, 7"
    }
  },
  {
    slug: "os-cpu-scheduling",
    track: "operating-systems",
    section: "Scheduling",
    title: "CPU Scheduling",
    subtitle: "FCFS, SJF, SRTF and round robin on the notes' workload, with every Gantt bar computed.",
    minutes: 9,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/operating-systems/cpu-scheduling#5-sjf-and-srtf",
      label: "CPU Scheduling, 5"
    }
  },
  {
    slug: "os-priority-inversion",
    track: "operating-systems",
    section: "Scheduling",
    title: "Priority Inversion",
    subtitle: "A tick scheduler runs three tasks with and without priority inheritance.",
    minutes: 7,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/operating-systems/cpu-scheduling#7-priority-scheduling",
      label: "CPU Scheduling, 7"
    }
  },
  {
    slug: "os-address-translation",
    track: "operating-systems",
    section: "Memory",
    title: "Address Translation and the TLB",
    subtitle: "Translate 0x00403ABC through a page table, then compute the effective access time.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/operating-systems/memory-management#4-paging",
      label: "Memory, 4"
    }
  },
  {
    slug: "os-page-faults",
    track: "operating-systems",
    section: "Memory",
    title: "Page Faults",
    subtitle: "Valid and invalid faults step by step, and why one fault per 100,000 accesses doubles access time.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/operating-systems/memory-management#7-demand-paging-and-page-faults",
      label: "Memory, 7"
    }
  },
  {
    slug: "os-page-replacement",
    track: "operating-systems",
    section: "Memory",
    title: "Page Replacement",
    subtitle: "FIFO, LRU and Optimal on one reference string, plus Belady's anomaly.",
    minutes: 9,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/operating-systems/memory-management#8-page-replacement",
      label: "Memory, 8"
    }
  },
  {
    slug: "os-fork-cow",
    track: "operating-systems",
    section: "Processes",
    title: "fork, Copy-on-Write and Zombies",
    subtitle: "Three forks make 8 processes, pages are copied only on write, and zombies hold a PID.",
    minutes: 8,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/operating-systems/processes-and-threads#6-creating-processes-fork-and-exec",
      label: "Processes, 6"
    }
  },
  {
    slug: "os-process-states",
    track: "operating-systems",
    section: "Processes",
    title: "Process States",
    subtitle: "Fold real events through the state machine, including preemption and I/O waits.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/operating-systems/processes-and-threads#4-process-states",
      label: "Processes, 4"
    }
  },
  {
    slug: "os-producer-consumer",
    track: "operating-systems",
    section: "Synchronization",
    title: "Producer-Consumer",
    subtitle: "Two semaphores and a mutex, and the lock order that deadlocks a full buffer.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/operating-systems/synchronization-and-deadlocks#8-classic-problems",
      label: "Synchronization, 8"
    }
  },
  {
    slug: "os-deadlock-cycle",
    track: "operating-systems",
    section: "Synchronization",
    title: "Deadlock and Lock Ordering",
    subtitle: "A real wait-for cycle detector, and the global lock order that removes the cycle.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/operating-systems/synchronization-and-deadlocks#10-deadlock",
      label: "Synchronization, 10"
    }
  },
  {
    slug: "os-banker",
    track: "operating-systems",
    section: "Synchronization",
    title: "The Banker's Algorithm",
    subtitle: "The safety check runs on the notes' table and finds P1, P3, P0, P2, P4.",
    minutes: 9,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/operating-systems/synchronization-and-deadlocks#12-the-bankers-algorithm",
      label: "Synchronization, 12"
    }
  },
  {
    slug: "os-disk-scheduling",
    track: "operating-systems",
    section: "Storage",
    title: "Disk Scheduling",
    subtitle: "The same eight requests under FCFS, SSTF, SCAN and C-SCAN: 640, 236, 236 and 382 cylinders.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/operating-systems/file-systems-and-storage#10-disk-scheduling",
      label: "Storage, 10"
    }
  },
  {
    slug: "os-inodes-journaling",
    track: "operating-systems",
    section: "Storage",
    title: "Inodes, Links and Journaling",
    subtitle: "Link counts and open files decide when data is freed, and a journal survives every crash point.",
    minutes: 9,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/operating-systems/file-systems-and-storage#3-inodes",
      label: "Storage, 3"
    }
  },
  {
    slug: "os-io-multiplexing",
    track: "operating-systems",
    section: "Linux",
    title: "select, poll and epoll",
    subtitle: "Count the work per wakeup for 10,000 connections with 5 ready.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/operating-systems/io-and-linux-internals#2-io-multiplexing-select-poll-epoll",
      label: "Linux I/O, 2"
    }
  },
  {
    slug: "os-containers",
    track: "operating-systems",
    section: "Linux",
    title: "What a Container Is",
    subtitle: "Namespaces decide what a process sees, cgroups decide how much it can use.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/operating-systems/io-and-linux-internals#9-what-a-container-really-is",
      label: "Linux I/O, 9"
    }
  },
  {
    slug: "cf-number-bases",
    track: "computer-fundamentals",
    section: "Data representation",
    title: "Number Bases",
    subtitle: "Divide by 2 for binary, group 4 bits for hex, and why Unix permissions are octal.",
    minutes: 6,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/computer-fundamentals/number-systems-and-data-representation#2-number-bases-and-conversion",
      label: "Number Systems, 2"
    }
  },
  {
    slug: "cf-twos-complement",
    track: "computer-fundamentals",
    section: "Data representation",
    title: "Two's Complement",
    subtitle: "Invert and add one, a negative top bit, and an overflow that wraps 127 to -128.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/computer-fundamentals/number-systems-and-data-representation#4-signed-integers-and-twos-complement",
      label: "Number Systems, 4"
    }
  },
  {
    slug: "cf-bitwise",
    track: "computer-fundamentals",
    section: "Data representation",
    title: "Bitwise Operations",
    subtitle: "AND, OR, XOR and the lowest-set-bit tricks, run on real integers.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/computer-fundamentals/number-systems-and-data-representation#6-bitwise-operations",
      label: "Number Systems, 6"
    }
  },
  {
    slug: "cf-ieee754",
    track: "computer-fundamentals",
    section: "Data representation",
    title: "Floating Point (IEEE 754)",
    subtitle: "Encode -5.75 as 0xC0B80000 from real bits, and see why 0.1 + 0.2 is off.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/computer-fundamentals/number-systems-and-data-representation#7-floating-point-ieee-754",
      label: "Number Systems, 7"
    }
  },
  {
    slug: "cf-utf8",
    track: "computer-fundamentals",
    section: "Data representation",
    title: "Unicode and UTF-8",
    subtitle: "One emoji, four different lengths, and the byte patterns behind UTF-8.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/computer-fundamentals/number-systems-and-data-representation#9-characters-and-text-encoding",
      label: "Number Systems, 9"
    }
  },
  {
    slug: "cf-cache-address",
    track: "computer-fundamentals",
    section: "Memory",
    title: "Cache Address Breakdown",
    subtitle: "Tag, index and offset bits for a 32 KB 8-way cache, and a 4 KB stride that thrashes one set.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/computer-fundamentals/memory-hierarchy-and-caches#5-address-breakdown-example",
      label: "Memory Hierarchy, 5"
    }
  },
  {
    slug: "cf-amat",
    track: "computer-fundamentals",
    section: "Memory",
    title: "Average Memory Access Time",
    subtitle: "6 ns with one level, 3 ns with an L2, and 9 ns without it.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/computer-fundamentals/memory-hierarchy-and-caches#8-average-memory-access-time",
      label: "Memory Hierarchy, 8"
    }
  },
  {
    slug: "cf-false-sharing",
    track: "computer-fundamentals",
    section: "Memory",
    title: "MESI and False Sharing",
    subtitle: "A real MESI model counts the invalidations two threads cause on one cache line.",
    minutes: 8,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/computer-fundamentals/memory-hierarchy-and-caches#10-false-sharing",
      label: "Memory Hierarchy, 10"
    }
  },
  {
    slug: "cf-pipelining",
    track: "computer-fundamentals",
    section: "CPU",
    title: "Pipelining and Hazards",
    subtitle: "Four instructions in 8 cycles, then data hazards, stalls and forwarding.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/computer-fundamentals/digital-logic-and-computer-architecture#9-pipelining",
      label: "Architecture, 9"
    }
  },
  {
    slug: "cf-branch-prediction",
    track: "computer-fundamentals",
    section: "CPU",
    title: "Branch Prediction",
    subtitle: "A 2-bit predictor on random and sorted data shows why sorted arrays run faster.",
    minutes: 8,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/computer-fundamentals/digital-logic-and-computer-architecture#10-branch-prediction-and-speculation",
      label: "Architecture, 10"
    }
  },
  {
    slug: "cf-amdahl",
    track: "computer-fundamentals",
    section: "CPU",
    title: "Amdahl's Law",
    subtitle: "Speedup caps at 10x when 10 percent of the work is serial.",
    minutes: 6,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/computer-fundamentals/digital-logic-and-computer-architecture#12-measuring-cpu-performance",
      label: "Architecture, 12"
    }
  },
  {
    slug: "cf-compiler-phases",
    track: "computer-fundamentals",
    section: "Programs",
    title: "Compiler Phases",
    subtitle: "A tiny lexer, parser and optimizer turn total = price * 2 into addsd.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/computer-fundamentals/compilers-and-program-execution#2-compiler-phases",
      label: "Compilers, 2"
    }
  },
  {
    slug: "cf-call-stack",
    track: "computer-fundamentals",
    section: "Programs",
    title: "The Call Stack",
    subtitle: "Frames for factorial(4) push and unwind, and where stack overflow comes from.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/computer-fundamentals/compilers-and-program-execution#7-the-call-stack",
      label: "Compilers, 7"
    }
  },
  {
    slug: "cf-gc",
    track: "computer-fundamentals",
    section: "Programs",
    title: "Reference Counting vs Mark and Sweep",
    subtitle: "A reference cycle leaks under counting and is collected by tracing from roots.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/computer-fundamentals/compilers-and-program-execution#9-garbage-collection",
      label: "Compilers, 9"
    }
  },
  {
    slug: "py-names-references",
    track: "python",
    section: "Names and objects",
    title: "Names, Objects and References",
    subtitle: "b = a names the same list, mutation is shared, rebinding is not, and functions pass references by value.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/python/python-fundamentals#2-names-objects-and-references",
      label: "Fundamentals, 2"
    }
  },
  {
    slug: "py-mutable-defaults",
    track: "python",
    section: "Names and objects",
    title: "The Mutable Default Argument",
    subtitle: "A default list is created once, and [[0]*3]*3 is three names for one row.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/python/python-fundamentals#12-common-pitfalls",
      label: "Fundamentals, 12"
    }
  },
  {
    slug: "py-late-binding",
    track: "python",
    section: "Names and objects",
    title: "Late-Binding Closures",
    subtitle: "One shared cell makes [lambda: i for i in range(3)] return [2, 2, 2].",
    minutes: 6,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/python/functions-and-functional-python#4-closures",
      label: "Functions, 4"
    }
  },
  {
    slug: "py-small-ints",
    track: "python",
    section: "Names and objects",
    title: "is vs ==, and the Small Int Cache",
    subtitle: "256 is 256 but 1000 is not 1000, and 1, 1.0 and True are one dict key.",
    minutes: 6,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/python/python-internals#7-caching-and-interning",
      label: "Internals, 7"
    }
  },
  {
    slug: "py-refcount-gc",
    track: "python",
    section: "Memory",
    title: "Reference Counting and the Cycle GC",
    subtitle: "Counts free at zero, cycles leak, and the gc_ref subtraction finds them.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/python/python-internals#5-the-garbage-collector",
      label: "Internals, 5"
    }
  },
  {
    slug: "py-list-dynamic-array",
    track: "python",
    section: "Data structures",
    title: "list: A Dynamic Array",
    subtitle: "Capacity grows at lengths 1, 5, 9, 17, 25, 33, and insert(0) shifts every pointer.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/python/python-data-structures#2-list-a-dynamic-array",
      label: "Data Structures, 2"
    }
  },
  {
    slug: "py-dict-internals",
    track: "python",
    section: "Data structures",
    title: "dict: A Compact Hash Table",
    subtitle: "A sparse index table points into a dense, ordered entries array.",
    minutes: 8,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/python/python-data-structures#4-dict-a-compact-hash-table",
      label: "Data Structures, 4"
    }
  },
  {
    slug: "py-gil",
    track: "python",
    section: "Concurrency",
    title: "The GIL",
    subtitle: "Two CPU-bound threads gain nothing, two I/O-bound threads overlap, two processes really run in parallel.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/python/python-internals#8-the-gil",
      label: "Internals, 8"
    }
  },
  {
    slug: "py-asyncio",
    track: "python",
    section: "Concurrency",
    title: "asyncio: One Thread, Many Tasks",
    subtitle: "Sequential awaits take 3 s, gather takes 1 s, and one blocking call freezes the loop.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/python/concurrency-and-asyncio#7-asyncio-the-mental-model",
      label: "Concurrency, 7"
    }
  },
  {
    slug: "py-generators",
    track: "python",
    section: "Functions",
    title: "Iterators and Generators",
    subtitle: "An exhausted iterator is empty, a generator resumes where it paused, and pipelines stay lazy.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/python/functions-and-functional-python#7-generators",
      label: "Functions, 7"
    }
  },
  {
    slug: "py-decorators",
    track: "python",
    section: "Functions",
    title: "Decorators",
    subtitle: "@deco is f = deco(f), stacked decorators wrap inside out, and functools.wraps keeps the name.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/python/functions-and-functional-python#5-decorators",
      label: "Functions, 5"
    }
  },
  {
    slug: "py-mro-super",
    track: "python",
    section: "Classes",
    title: "MRO and super()",
    subtitle: "C3 linearization orders M, L, R, Base, and super() means the next class in that order.",
    minutes: 8,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/python/python-oop#6-inheritance-super-and-the-mro",
      label: "OOP, 6"
    }
  },
  {
    slug: "py-numpy-strides",
    track: "python",
    section: "NumPy",
    title: "ndarray Strides and Views",
    subtitle: "A header over one buffer: transpose swaps strides, slicing writes through, fancy indexing copies.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/python/numpy-and-data-stack#2-the-ndarray-memory-model",
      label: "NumPy, 2"
    }
  },
  {
    slug: "py-numpy-broadcasting",
    track: "python",
    section: "NumPy",
    title: "Broadcasting",
    subtitle: "Align shapes from the right, stretch size-1 dimensions, and see (3, 4) plus (3,) fail.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/python/numpy-and-data-stack#6-broadcasting",
      label: "NumPy, 6"
    }
  },
  {
    slug: "sdlc-phases",
    track: "sdlc",
    section: "Phases",
    title: "The Seven Phases and Their Loops",
    subtitle: "Fold a project through requirements to maintenance, including the bug loop and the new-needs loop.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/sdlc/sdlc#2-the-core-phases",
      label: "SDLC, 2"
    }
  },
  {
    slug: "sdlc-waterfall-vs-agile",
    track: "sdlc",
    section: "Models",
    title: "Waterfall vs Iterative vs Agile",
    subtitle: "The same project on three schedules: when does working software first appear, and what does a wrong requirement cost?",
    minutes: 8,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/sdlc/sdlc#31-waterfall-model",
      label: "SDLC, 3.1"
    }
  },
  {
    slug: "sdlc-model-picker",
    track: "sdlc",
    section: "Models",
    title: "Picking a Model",
    subtitle: "The notes' decision tree as real code, run on five project descriptions.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/sdlc/sdlc#4-comparing-the-models",
      label: "SDLC, 4"
    }
  },
  {
    slug: "sdlc-spiral-risk",
    track: "sdlc",
    section: "Models",
    title: "The Spiral Model",
    subtitle: "Why risk analysis comes first: the same unknown found in loop 1 or in the final build.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/sdlc/sdlc#34-spiral-model",
      label: "SDLC, 3.4"
    }
  },
  {
    slug: "sdlc-scrum-sprint",
    track: "sdlc",
    section: "Agile",
    title: "One Scrum Sprint",
    subtitle: "A 20 point sprint, daily standups and a burndown computed from story completions.",
    minutes: 8,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/sdlc/sdlc#36-scrum",
      label: "SDLC, 3.6"
    }
  },
  {
    slug: "sdlc-kanban-wip",
    track: "sdlc",
    section: "Agile",
    title: "Kanban and WIP Limits",
    subtitle: "A pull system that refuses the fourth card until something finishes.",
    minutes: 7,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/sdlc/sdlc#37-kanban",
      label: "SDLC, 3.7"
    }
  },
  {
    slug: "sdlc-ci-cd",
    track: "sdlc",
    section: "Delivery",
    title: "CI, Delivery and Deployment",
    subtitle: "A change runs a pipeline, fails, is fixed, and stops at the approval gate or goes straight to production.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/sdlc/sdlc#5-devops-and-cicd-in-sdlc",
      label: "SDLC, 5"
    }
  },
  {
    slug: "sdlc-testing-regression",
    track: "sdlc",
    section: "Delivery",
    title: "Testing Levels and Regression",
    subtitle: "A double-click race creates two orders, and the regression test keeps it fixed.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/sdlc/sdlc#6-testing-levels-across-sdlc",
      label: "SDLC, 6"
    }
  },
  {
    slug: "sdui-registry",
    track: "sdui",
    section: "Foundations",
    title: "Registry and Renderer",
    subtitle: "The server composes, the client implements: a payload becomes components through a registry lookup.",
    minutes: 8,
    level: "Beginner",
    steps: 5,
    notes: {
      href: "/docs/sdui/server-driven-ui#7-component-registry",
      label: "SDUI, 7"
    }
  },
  {
    slug: "sdui-validation",
    track: "sdui",
    section: "Foundations",
    title: "Validate, Then Render",
    subtitle: "A payload passes schema, registry, action and URL checks, or the screen falls back safely.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/sdui/server-driven-ui#83-runtime-validation",
      label: "SDUI, 8.3"
    }
  },
  {
    slug: "sdui-versioning",
    track: "sdui",
    section: "Contract",
    title: "Versioning and Fallback",
    subtitle: "Old clients stay installed: negotiate a schema version and decide what an unknown component does.",
    minutes: 9,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/sdui/server-driven-ui#10-versioning-and-fallback",
      label: "SDUI, 10"
    }
  },
  {
    slug: "sdui-actions",
    track: "sdui",
    section: "Contract",
    title: "Actions and the Allowlist",
    subtitle: "The payload names an action, and the client decides whether and how to run it.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/sdui/server-driven-ui#11-actions",
      label: "SDUI, 11"
    }
  },
  {
    slug: "sdui-personalization",
    track: "sdui",
    section: "Server",
    title: "Personalization and Cache Keys",
    subtitle: "Stable A/B assignment from a user hash, and how segments multiply cache keys.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/sdui/server-driven-ui#5-why-companies-use-it",
      label: "SDUI, 5"
    }
  },
  {
    slug: "sdui-orchestration",
    track: "sdui",
    section: "Server",
    title: "Orchestration and Payload Size",
    subtitle: "Parallel service calls, a latency budget that drops a slow section, and inline versus referenced data.",
    minutes: 8,
    level: "Advanced",
    steps: 5,
    notes: {
      href: "/docs/sdui/server-driven-ui#14-data-vs-ui-and-server-orchestration",
      label: "SDUI, 14"
    }
  },
  {
    slug: "sdui-cache-fallback",
    track: "sdui",
    section: "Client",
    title: "Cache, Refresh and Fallback",
    subtitle: "Render the cached screen at once, swap in fresh content, and never show a blank screen.",
    minutes: 8,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/sdui/server-driven-ui#15-analytics-caching-offline-performance",
      label: "SDUI, 15"
    }
  },
  {
    slug: "sdui-design-tokens",
    track: "sdui",
    section: "Client",
    title: "Design Tokens, Not Raw Styles",
    subtitle: "A token name resolves differently per platform, and raw values turn the backend into a CSS engine.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/sdui/server-driven-ui#17-design-tokens-over-arbitrary-styling",
      label: "SDUI, 17"
    }
  },
  {
    slug: "sdui-should-it",
    track: "sdui",
    section: "Strategy",
    title: "Should This Be Server-Driven?",
    subtitle: "The notes' three questions as real code, run on six screens.",
    minutes: 7,
    level: "Intermediate",
    steps: 5,
    notes: {
      href: "/docs/sdui/server-driven-ui#12-what-should-and-should-not-be-server-driven",
      label: "SDUI, 12"
    }
  },
];

/** Sections of a track in course order. Modules with no lessons yet are left out until they get one. */
export function sectionsOf(track: LessonTrack): string[] {
  const declared = TRACK_SECTIONS[track] ?? [];
  const seen = LESSONS.filter((l) => l.track === track).map((l) => l.section);
  return [...new Set([...declared, ...seen])].filter((name) => seen.includes(name));
}

export function getLessonMeta(slug: string): LessonMeta | undefined {
  return LESSONS.find((l) => l.slug === slug);
}
