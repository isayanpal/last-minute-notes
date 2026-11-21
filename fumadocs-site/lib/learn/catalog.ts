/**
 * Server-safe metadata for interactive lessons.
 * The full lesson (scene, frames, step copy) lives in components/learn/lessons and is client-only.
 * `steps` must match the number of steps the lesson file defines.
 */

export type LessonLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type LessonTrack = 'system-design' | 'frontend-system-design' | 'dsa' | 'networking' | 'backend' | 'databases' | 'oops' | 'redux' | 'javascript';

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
  },
  {
    slug: "binary-search",
    track: "dsa",
    section: "Search & Backtracking",
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
    slug: "backtracking",
    track: "dsa",
    section: "Search & Backtracking",
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
    slug: "dynamic-programming",
    track: "dsa",
    section: "DP, Greedy & Bits",
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
    slug: "greedy",
    track: "dsa",
    section: "DP, Greedy & Bits",
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
    slug: "bit-manipulation",
    track: "dsa",
    section: "DP, Greedy & Bits",
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
  }
];

export function getLessonMeta(slug: string): LessonMeta | undefined {
  return LESSONS.find((l) => l.slug === slug);
}
