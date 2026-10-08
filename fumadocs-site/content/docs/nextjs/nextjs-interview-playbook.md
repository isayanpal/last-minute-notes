---
title: "Next.js Interview Playbook"
description: "Next.js interview rehearsal: what each level is expected to know, a 50-question bank with strong-answer checklists, predict-the-behavior puzzles, machine coding tasks, system design prompts, production scenarios, cheat sheets, common mistakes, and a 7-day study plan."
---

# 📘 Next.js Interview Playbook

The other pages teach the material.
This page is for rehearsal: a question bank with what a strong answer contains, predict-the-behavior puzzles, machine coding tasks that come up in live rounds, design prompts, and a study plan.

## Table of Contents

1. [What Interviewers Look For](#1-what-interviewers-look-for)
2. [Question Bank](#2-question-bank)
3. [Predict the Behavior](#3-predict-the-behavior)
4. [Machine Coding Tasks](#4-machine-coding-tasks)
5. [System Design Prompts](#5-system-design-prompts)
6. [Production Scenarios](#6-production-scenarios)
7. [Cheat Sheets](#7-cheat-sheets)
8. [Common Mistakes](#8-common-mistakes)
9. [Study Plan](#9-study-plan)

---

## 1. What Interviewers Look For

| Level | Expected |
| --- | --- |
| **Junior** | React fundamentals, App Router file conventions, `Link` and navigation, dynamic routes, layouts, `next/image`, environment variables, fetching in Server Components, basic forms |
| **Mid** | Server vs Client Components and the boundary, rendering modes, caching and revalidation, Server Actions with validation, `loading`/`error` UI, metadata and SEO, auth basics, Core Web Vitals, testing with Playwright |
| **Senior** | RSC payload and streaming internals, Cache Components and PPR, caching layers and debugging stale data, security model (DAL, CSRF, CSP), performance budgets, multi-instance deployments, observability, upgrade strategy |
| **Staff / platform** | Architecture for many teams (monorepos, design systems, micro-frontends and multi-zones), build and deploy infrastructure, cache handler design, migration from Pages Router or an SPA, performance and reliability governance |

Signals that raise your rating:

- Always saying **where code runs** (build, server request, browser) and **what is cached**.
- Naming the **trade-off**: static speed vs freshness, bundle size vs interactivity, convenience vs control.
- Knowing what is **current** (async request APIs, `proxy.ts`, Turbopack default, `"use cache"` and Cache Components, React 19.2 features) and which advice is from the older caching model.
- Treating Server Actions and Route Handlers as **public endpoints** that need authn, authz, and validation.
- Proposing how you would **measure and verify**: build output table, bundle analyzer, RUM, Playwright against a production build.

---

## 2. Question Bank

### 2.1 Fundamentals (10)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 1 | What is Next.js and why use it? | Full-stack React framework; SSR/SSG/streaming, routing, optimizations, API layer; trade-offs | [Fundamentals](/docs/nextjs/nextjs-fundamentals) |
| 2 | App Router vs Pages Router? | Server Components, nested layouts, streaming, Actions vs data functions; Pages in maintenance | [Fundamentals](/docs/nextjs/nextjs-fundamentals) |
| 3 | `layout` vs `template` vs `page`? | Persistence vs remount vs unique UI | [Fundamentals](/docs/nextjs/nextjs-fundamentals) |
| 4 | Special files in a route segment? | `loading`, `error`, `not-found`, `route`, `default`, nesting order | [Fundamentals](/docs/nextjs/nextjs-fundamentals) |
| 5 | How do env vars work? | `NEXT_PUBLIC_` inlined at build, others server-only, `server-only` package | [Fundamentals](/docs/nextjs/nextjs-fundamentals) |
| 6 | How does `next/image` help? | Resize, formats, lazy load, dimensions prevent CLS, `priority`, `sizes`, `remotePatterns` | [Fundamentals](/docs/nextjs/nextjs-fundamentals) |
| 7 | How does `next/font` work? | Self-hosted at build, no runtime request, fallback metrics, no CLS | [Fundamentals](/docs/nextjs/nextjs-fundamentals) |
| 8 | How do you handle SEO? | Metadata API, `generateMetadata`, sitemap, canonical, OG images, server HTML | [Fundamentals](/docs/nextjs/nextjs-fundamentals) |
| 9 | Why use `Link` instead of `<a>`? | Client navigation, prefetch, layout persistence | [Fundamentals](/docs/nextjs/nextjs-fundamentals) |
| 10 | Next.js vs Vite SPA vs Remix vs Astro? | Use cases, SEO, server runtime, data model | [Fundamentals](/docs/nextjs/nextjs-fundamentals) |

### 2.2 Rendering and Server Components (10)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 11 | CSR vs SSR vs SSG vs ISR? | Where and when HTML is made, freshness, cost, examples | [Rendering](/docs/nextjs/rendering-and-server-components) |
| 12 | What is a React Server Component? | Server-only, no client JS, async, RSC payload; not the same as SSR | [Rendering](/docs/nextjs/rendering-and-server-components) |
| 13 | What does `'use client'` do? | Module boundary, client bundle entry, still pre-rendered on the server | [Rendering](/docs/nextjs/rendering-and-server-components) |
| 14 | Can a Client Component render a Server Component? | Only via `children`/props passed from a server parent | [Rendering](/docs/nextjs/rendering-and-server-components) |
| 15 | What can be passed from server to client? | Serializable values, Promises, JSX, Server Actions; no functions/classes | [Rendering](/docs/nextjs/rendering-and-server-components) |
| 16 | What makes a route dynamic? | `cookies`, `headers`, `searchParams`, uncached data, `force-dynamic` | [Rendering](/docs/nextjs/rendering-and-server-components) |
| 17 | How does streaming work? | Suspense boundaries, shell first, `loading.tsx`, independent chunks | [Rendering](/docs/nextjs/rendering-and-server-components) |
| 18 | What causes hydration errors? | Server/client markup mismatch, dates, `window`, invalid nesting | [Rendering](/docs/nextjs/rendering-and-server-components) |
| 19 | What is Partial Prerendering? | Static shell plus dynamic holes in one response; Cache Components | [Rendering](/docs/nextjs/rendering-and-server-components) |
| 20 | Node vs Edge runtime? | API support, cold start, defaults, when to use each | [Rendering](/docs/nextjs/rendering-and-server-components) |

### 2.3 Routing and Data (10)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 21 | Dynamic, catch-all, optional catch-all? | `[x]`, `[...x]`, `[[...x]]`, precedence | [Routing](/docs/nextjs/routing-and-navigation) |
| 22 | Why are `params` async? | Reading them can make rendering dynamic; Promise allows prerender | [Routing](/docs/nextjs/routing-and-navigation) |
| 23 | Parallel and intercepting routes? | Slots, `default.tsx`, modal with its own URL | [Routing](/docs/nextjs/routing-and-navigation) |
| 24 | `generateStaticParams` and `dynamicParams`? | Build-time paths, on-demand fallback, 404 mode | [Routing](/docs/nextjs/routing-and-navigation) |
| 25 | Redirect vs rewrite, and where to define them? | Config, `proxy.ts`, `redirect()` | [Routing](/docs/nextjs/routing-and-navigation) |
| 26 | How do you fetch data and avoid waterfalls? | Server Components, `Promise.all`, Suspense per section, preload | [Data Fetching](/docs/nextjs/data-fetching-and-caching) |
| 27 | Explain the caching layers | Request memoization, Data Cache, Full Route Cache, Router Cache | [Data Fetching](/docs/nextjs/data-fetching-and-caching) |
| 28 | What changed in caching from 14 to 15 to 16? | Default cache removal; explicit `"use cache"` | [Data Fetching](/docs/nextjs/data-fetching-and-caching) |
| 29 | `revalidateTag` vs `updateTag` vs `revalidatePath`? | SWR semantics, read-your-writes, path-based | [Data Fetching](/docs/nextjs/data-fetching-and-caching) |
| 30 | `React.cache` vs `"use cache"`? | Per-render dedupe vs cross-request cache | [Data Fetching](/docs/nextjs/data-fetching-and-caching) |

### 2.4 Mutations, Security, and Auth (10)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 31 | What is a Server Action? | `'use server'`, POST endpoint, serializable args, auto UI update | [Actions](/docs/nextjs/server-actions-and-route-handlers) |
| 32 | Action vs Route Handler? | Mutations for own UI vs public HTTP API | [Actions](/docs/nextjs/server-actions-and-route-handlers) |
| 33 | `useActionState`, `useFormStatus`, `useOptimistic`? | State, pending, rollback semantics | [Actions](/docs/nextjs/server-actions-and-route-handlers) |
| 34 | How do you validate and report errors? | Zod server-side, return typed errors, throw only unexpected | [Actions](/docs/nextjs/server-actions-and-route-handlers) |
| 35 | Are Server Actions secure by default? | No, public endpoints; authn, authz, validation inside | [Actions](/docs/nextjs/server-actions-and-route-handlers) |
| 36 | What is `proxy.ts` for? | Early redirects/rewrites/headers; not the security boundary | [Auth](/docs/nextjs/auth-security-and-proxy) |
| 37 | Cookie sessions vs JWT? | Revocation, size, flags `HttpOnly`/`Secure`/`SameSite` | [Auth](/docs/nextjs/auth-security-and-proxy) |
| 38 | What is the Data Access Layer pattern? | Server-only module, session check, authorization, DTOs | [Auth](/docs/nextjs/auth-security-and-proxy) |
| 39 | How do you protect against CSRF and XSS? | SameSite, origin check, escaping, sanitize, CSP | [Auth](/docs/nextjs/auth-security-and-proxy) |
| 40 | How do you set up a strict CSP? | Nonce in proxy, `strict-dynamic`, dynamic rendering trade-off | [Auth](/docs/nextjs/auth-security-and-proxy) |

### 2.5 Performance and Operations (10)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 41 | Improve LCP? | TTFB, hero `priority`, `sizes`, fonts, static/streamed HTML | [Performance](/docs/nextjs/performance-and-optimization) |
| 42 | Improve INP? | Less hydration, transitions, long tasks, third-party scripts | [Performance](/docs/nextjs/performance-and-optimization) |
| 43 | Reduce bundle size? | Server Components, `dynamic`, analyzer, replace libraries, budget | [Performance](/docs/nextjs/performance-and-optimization) |
| 44 | Third-party scripts? | `next/script` strategies, `@next/third-parties`, facades | [Performance](/docs/nextjs/performance-and-optimization) |
| 45 | How do you test an app with Server Components? | Extract logic, RTL for clients, Playwright for server output | [Testing and Deployment](/docs/nextjs/testing-deployment-and-operations) |
| 46 | Deployment options? | Vercel, Node, Docker standalone, static export, adapters | [Testing and Deployment](/docs/nextjs/testing-deployment-and-operations) |
| 47 | ISR in multiple instances? | Shared `cacheHandler`, CDN purge, per-instance default | [Testing and Deployment](/docs/nextjs/testing-deployment-and-operations) |
| 48 | Observability setup? | `instrumentation.ts`, OTel, Sentry, RUM, request ids, source maps | [Testing and Deployment](/docs/nextjs/testing-deployment-and-operations) |
| 49 | Handling deployment skew? | Deployment id, skew protection, backward-compatible DB | [Testing and Deployment](/docs/nextjs/testing-deployment-and-operations) |
| 50 | Migrate a CRA/Pages app to App Router? | Incremental, coexistence, route by route, codemods, test coverage first | [Fundamentals](/docs/nextjs/nextjs-fundamentals) |

---

## 3. Predict the Behavior

**3.1**

```tsx
// app/page.tsx  (no directive)
import { useState } from 'react';

export default function Page() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>{n}</button>;
}
```

**Answer:** build error: `useState` and event handlers are not allowed in Server Components.
Add `'use client'` at the top, or better, extract the button into a small Client Component and keep the page on the server.

**3.2**

```tsx
// app/blog/[slug]/page.tsx
export default function Page({ params }: { params: { slug: string } }) {
  return <h1>{params.slug}</h1>;
}
```

**Answer:** in current versions `params` is a Promise, so `params.slug` is `undefined` (and TypeScript/dev warnings flag the sync access).
Make the component `async` and `const { slug } = await params`.

**3.3**

```tsx
export default async function Page() {
  const user = await getUser();          // 300 ms
  const posts = await getPosts();        // 300 ms
  return <Dashboard user={user} posts={posts} />;
}
```

**Answer:** about 600 ms because the awaits are sequential even though they are independent.
Use `Promise.all([getUser(), getPosts()])` (about 300 ms), or split into two components under separate `Suspense` boundaries.

**3.4**

```tsx
'use cache';
export default async function Page() {
  const theme = (await cookies()).get('theme')?.value;
  return <Themed theme={theme} />;
}
```

**Answer:** error: request-specific APIs such as `cookies()` cannot be used inside a cached scope, because the cached result would be shared between users.
Read the cookie in an uncached parent and pass it as an argument to a `"use cache"` child, or cache nothing here.

**3.5**

```tsx
// Server Component
<Button onClick={() => console.log('hi')} />   // Button is a Client Component
```

**Answer:** error: functions cannot be passed from a Server Component to a Client Component, since they are not serializable.
Define the handler inside the Client Component, or pass a Server Action (marked `'use server'`).

**3.6**

```tsx
'use server';
export async function save(formData: FormData) {
  try {
    await db.save(formData);
    redirect('/done');
  } catch (e) {
    return { error: 'failed' };
  }
}
```

**Answer:** the user is never redirected on success.
`redirect()` throws a special error, the `catch` swallows it, and the action returns `{ error: 'failed' }`.
Call `redirect` outside the `try/catch`.

**3.7**

```tsx
'use client';
export function Clock() {
  return <p>{new Date().toLocaleTimeString()}</p>;
}
```

**Answer:** hydration mismatch warning.
The server renders one time and the client renders another when hydrating.
Render a stable value first and update in `useEffect`, or render the time only after mount.

**3.8**

```tsx
// app/dashboard/layout.tsx
export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  return <>{children}</>;
}
```

**Answer:** not sufficient as the only protection.
Layouts do not re-render when navigating between child pages and pages can be rendered independently, so a check here can be skipped.
Verify authorization in each page and in the data access layer, Actions, and Route Handlers that touch the data.

**3.9**

```ts
// app/api/items/route.ts
export async function GET() {
  return Response.json(await db.item.findMany());
}
```

**Answer:** in current versions this `GET` is **not cached**; it runs on every request.
In Next 13/14 it was cached by default at build time and returned stale data.
Opt in to caching explicitly with `"use cache"` or `dynamic = 'force-static'` and revalidate with a tag.

**3.10**

```tsx
// Server Action
export async function addTodo(formData: FormData) {
  'use server';
  await db.todo.create({ data: { title: String(formData.get('title')) } });
}
// UI still shows the old list after submit
```

**Answer:** the mutation worked but no cache was invalidated, so the list (cached or Router Cache) is stale.
Call `revalidatePath('/todos')`, `updateTag('todos')`, or `refresh()` at the end of the action.

**3.11**

```tsx
const { data } = useSearchParams();   // inside a statically rendered page, no Suspense
```

**Answer:** `useSearchParams` returns a `URLSearchParams`, not `{ data }`, and, more importantly for builds, using it without a `Suspense` boundary in a static page makes `next build` fail with a "missing suspense boundary" error.
Wrap the component in `<Suspense>`.

**3.12**

```tsx
<Image src="https://cdn.example.com/a.jpg" alt="" />
```

**Answer:** error: missing `width`/`height` (or `fill`) for a remote image, and the host must be allowed in `images.remotePatterns`.
Provide dimensions or `fill` with a sized parent, and configure the host.

---

## 4. Machine Coding Tasks

Typical 60 to 90 minute live tasks, with what to show:

| Task | Show |
| --- | --- |
| **Blog with ISR** | `generateStaticParams`, `generateMetadata`, `notFound()`, tag revalidation webhook, sitemap, `next/image` cover |
| **Todo app with Server Actions** | Form + `useActionState`, Zod validation, `useOptimistic`, revalidation, pending UI, works without JS |
| **Auth flow** | Login/logout actions, HttpOnly session cookie, `proxy.ts` redirect, DAL with `verifySession`, protected page, error states |
| **Product listing with filters** | Search params state, server-side filtering, pagination, `Suspense` skeleton, shareable URLs, debounced input with `router.replace` |
| **Dashboard with streaming** | Independent `Suspense` widgets, parallel fetching, per-widget error boundaries, `loading.tsx` |
| **Infinite scroll feed** | Server-rendered first page, Client Component with TanStack Query `useInfiniteQuery` and a Route Handler, IntersectionObserver |
| **Photo gallery with modal route** | Parallel `@modal` slot and intercepting route, direct URL renders full page, `router.back()` close |
| **Checkout / form wizard** | Multi-step form state, server-side validation per step, persistence in cookie or DB, optimistic UI, idempotent submit |
| **Webhook receiver** | Raw body signature verification, idempotency key, quick 2xx, async processing, tests |
| **Search with autocomplete** | Debounce, cancel stale requests, Route Handler, keyboard accessibility, `useDeferredValue` |

Structure your solution like production code: typed props, schema validation shared by client and server, a data access module, a short note on caching and revalidation, and what you would test.

---

## 5. System Design Prompts

Frame every answer with: requirements (SEO? personalization? scale? freshness?), rendering strategy per page type, data flow and caching, auth and security, performance budget, deployment, and monitoring.

| Prompt | Key points |
| --- | --- |
| **Design an e-commerce storefront** | Static product pages with tag-based revalidation from inventory/CMS, PPR for cart and price personalization, search via dedicated service, `next/image` and CDN, checkout server-side with idempotency, A/B tests in `proxy.ts`, Core Web Vitals budget |
| **Design a news/media site** | ISR or `use cache` with short lifetimes, breaking-news purge by tag, CDN `stale-while-revalidate`, AMP-free fast pages, ad/script strategy for INP, sitemap/news metadata, preview mode for editors |
| **Design a SaaS dashboard (multi-tenant)** | Subdomain rewrite to tenant, session + RBAC in a DAL, tenant scoping on every query and row-level security, streaming widgets, client query cache for live data, audit logs |
| **Design a docs site** | Static generation of MDX, search index at build, versioned routes, `generateStaticParams`, on-demand revalidation from the docs repo, i18n |
| **Design a social feed** | Server-rendered first page for SEO, cursor-paginated Route Handler for infinite scroll, optimistic likes with Actions, real-time via SSE/WebSocket service, image CDN, cache keyed by user |
| **Design the platform for 20 teams on one Next.js codebase** | Monorepo (Turborepo), shared design system, feature folders, ownership via CODEOWNERS, multi-zones for independent deploys, bundle budgets and lint rules in CI, preview environments |
| **Migrate a large Pages Router app** | Incremental coexistence, move leaf routes first, shared layouts, replace `getServerSideProps` with Server Components, regression tests first, measure bundle and vitals along the way |

See [Frontend System Design](/docs/system-design/hld/frontend-system-design) for the general framework.

---

## 6. Production Scenarios

| Scenario | Strong answer |
| --- | --- |
| Users see old content after publishing | Check webhook delivery, tag names match, shared cache across instances, CDN caching HTML, test with a production build; use `updateTag` for the actor, tag revalidation for others |
| Page is slow only for logged-in users | Dynamic rendering (cookies) bypasses static; add `Suspense` around personalized parts, cache shared data, parallelize fetches, check DB and region |
| TTFB spiked after a deploy | Cold caches and empty ISR store, new instances; warm critical routes, shared cache handler, check dynamic API accidentally added in a layout |
| Memory grows until the container restarts | Unbounded module-level caches, per-request data stored globally, large closures; heap snapshot, bound caches, check `sharp` and image optimizer load |
| Hydration errors in production only | Locale/time zone or extension differences, content from CMS with invalid HTML; reproduce with the same data, use `suppressHydrationWarning` narrowly, fix markup |
| Security scan flags Server Actions | Missing auth/authorization inside actions, no rate limit, verbose errors; add DAL checks, validation, throttling, generic messages |
| Build times exceed 30 minutes | Too many `generateStaticParams` paths, slow data source; prerender top N, on-demand for the rest, cache fetches, CI `.next/cache` |
| CSP breaks the site | Inline scripts without nonce, third-party domains missing; report-only first, nonce via `proxy.ts`, allowlist reviewed domains |
| Old clients error after deploy | Deployment skew; keep prior assets available, skew protection, backward-compatible APIs and Actions |
| SEO traffic dropped | Content rendered client-side only, missing metadata or canonical, broken sitemap, noindex from staging env var; inspect the rendered HTML, Search Console, and robots |

---

## 7. Cheat Sheets

### 7.1 Server or Client Component?

| Need | Use |
| --- | --- |
| Fetch data, access DB or secrets | Server |
| Static content, large libraries (markdown) | Server |
| `useState`, `useEffect`, event handlers | Client |
| Browser APIs (`localStorage`, `window`) | Client |
| Context providers | Client wrapper, children stay server |
| Third-party widget needing hooks | Client wrapper file |

### 7.2 Which data approach?

| Situation | Use |
| --- | --- |
| Initial page data | `await` in Server Component |
| Shared across components in one render | `React.cache` |
| Shared across requests | `"use cache"` with `cacheLife` and `cacheTag` |
| Mutation from your UI | Server Action then `updateTag`/`revalidateTag` |
| Public API, webhook, streaming | Route Handler |
| Live or polling data | Client library (TanStack Query) |

### 7.3 Which revalidation?

| Need | Use |
| --- | --- |
| Author must see their own change instantly | `updateTag(tag)` |
| Everyone else eventually | `revalidateTag(tag, 'max')` |
| A whole route | `revalidatePath(path)` |
| Refresh uncached data in place | `refresh()` / `router.refresh()` |
| Time-based | `cacheLife` or `revalidate` |

### 7.4 Version facts worth knowing

| Fact | Value |
| --- | --- |
| App Router stable | 13.4 |
| Server Actions stable | 14 |
| `fetch`/GET handlers uncached by default, async request APIs, React 19, Turbopack dev stable | 15 |
| Turbopack default for dev and build | 16 |
| `middleware.ts` renamed to `proxy.ts` (Node runtime) | 16 |
| Cache Components, `"use cache"`, `updateTag`, `refresh()` | 16 |
| `next lint` removed | 16 |
| React Compiler support | Stable in 16 (opt in) |
| Node.js minimum | 20.9+ |

---

## 8. Common Mistakes

| Mistake | Better |
| --- | --- |
| Marking everything `'use client'` | Server by default, small interactive leaves |
| Fetching in `useEffect` for page data | Fetch in a Server Component |
| Calling your own Route Handler from a Server Component | Call the underlying function directly |
| Auth only in `proxy.ts` or a layout | Enforce in the DAL, Actions, and Route Handlers |
| Forgetting revalidation after a mutation | `updateTag`/`revalidateTag`/`revalidatePath` in the action |
| `redirect()` inside `try/catch` | Call it outside, or rethrow |
| Putting secrets in `NEXT_PUBLIC_` | Server-only variables |
| Passing whole DB rows to Client Components | Pass minimal DTOs |
| Describing caching of Next 13 as current | Explain the shift to explicit caching |
| Assuming a page is static | Read the `next build` route table |
| Testing only in dev mode | Production build for performance, caching, and E2E |
| Ignoring Core Web Vitals | Name the metric, tool, and fix |

---

## 9. Study Plan

| Day | Focus | Do |
| --- | --- | --- |
| 1 | [Fundamentals](/docs/nextjs/nextjs-fundamentals) | Create an app; build layouts, a dynamic route, `loading`/`error`, metadata, `next/image`; read `next build` output |
| 2 | [Rendering and Server Components](/docs/nextjs/rendering-and-server-components) | Explain RSC vs SSR aloud in 3 minutes; build a Server page with a Client island; trigger and fix a hydration mismatch |
| 3 | [Routing](/docs/nextjs/routing-and-navigation) | Dynamic + catch-all routes, `generateStaticParams`, a modal with parallel and intercepting routes |
| 4 | [Data Fetching and Caching](/docs/nextjs/data-fetching-and-caching) | Turn on Cache Components; `use cache` with tags; remove a waterfall; draw the cache layers from memory |
| 5 | [Server Actions](/docs/nextjs/server-actions-and-route-handlers) and [Auth](/docs/nextjs/auth-security-and-proxy) | Form with `useActionState` and Zod; session cookie, `proxy.ts`, DAL; a Stripe-style webhook handler |
| 6 | [Performance](/docs/nextjs/performance-and-optimization) and [Testing and Deployment](/docs/nextjs/testing-deployment-and-operations) | Run the bundle analyzer and Lighthouse; write one Playwright test; build a standalone Docker image |
| 7 | This playbook | Answer the question bank aloud, do one machine coding task and one system design prompt timed |
