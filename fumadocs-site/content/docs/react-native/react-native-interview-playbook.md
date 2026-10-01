---
title: "React Native Interview Playbook"
description: "React Native interview rehearsal: what each level is expected to know, a 50-question bank with strong-answer checklists, predict-the-behavior puzzles, machine coding tasks, mobile system design prompts, production scenarios, cheat sheets, common mistakes, and a 7-day study plan."
---

# 📘 React Native Interview Playbook

The other pages teach the material.
This page is for rehearsal: a question bank with what a strong answer contains, predict-the-behavior puzzles, machine coding tasks that come up in live rounds, mobile system design prompts, and a study plan.

## Table of Contents

1. [What Interviewers Look For](#1-what-interviewers-look-for)
2. [Question Bank](#2-question-bank)
3. [Predict the Behavior](#3-predict-the-behavior)
4. [Machine Coding Tasks](#4-machine-coding-tasks)
5. [Mobile System Design Prompts](#5-mobile-system-design-prompts)
6. [Production Scenarios](#6-production-scenarios)
7. [Cheat Sheets](#7-cheat-sheets)
8. [Common Mistakes](#8-common-mistakes)
9. [Study Plan](#9-study-plan)

---

## 1. What Interviewers Look For

| Level | Expected |
| --- | --- |
| **Junior** | React fundamentals, core components, Flexbox defaults, `Text` rules, `FlatList` basics, navigation stacks and tabs, fetching data, platform differences |
| **Mid** | List performance, state management choices, TanStack Query, storage options, auth flows and deep links, Reanimated basics, permissions, push notifications, testing with RNTL, release builds |
| **Senior** | New Architecture internals (JSI, Fabric, Turbo Modules), profiling and startup optimization, native modules, offline-first sync, OTA strategy and runtime versions, CI/CD, crash monitoring, security |
| **Staff / platform** | Architecture for many teams (monorepos, shared design systems), brownfield integration, upgrade strategy, build infrastructure, performance budgets and regression tracking, web and native code sharing |

Signals that raise your rating:

- Naming the **thread** a problem lives on (JS vs UI) and how you measured it.
- Mentioning **both platforms** (Android back, edge-to-edge, permissions differences) without being asked.
- Knowing what is **current** (New Architecture only, Hermes, React Native DevTools, Expo with CNG, CodePush retired).
- Separating server state from client state.
- Thinking about **old app versions in the wild** when designing APIs and releases.

---

## 2. Question Bank

### 2.1 Fundamentals (10)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 1 | How does React Native render UI? | Native views, not a web view; React reconciler plus Fabric; Hermes | [Fundamentals](/docs/react-native/react-native-fundamentals) |
| 2 | React vs React Native? | Same React core, different host components, styling, tooling | [Fundamentals](/docs/react-native/react-native-fundamentals) |
| 3 | React Native vs Flutter vs native? | Native views vs own renderer vs platform code; team skills, OTA, code sharing | [Fundamentals](/docs/react-native/react-native-fundamentals) |
| 4 | Expo vs bare RN? | Recommended framework, dev builds, CNG and config plugins, EAS | [Fundamentals](/docs/react-native/react-native-fundamentals) |
| 5 | Flexbox differences from the web? | `column` default, `flexShrink: 0`, no cascade, unitless dp | [Fundamentals](/docs/react-native/react-native-fundamentals) |
| 6 | Why must text be inside `Text`? | Text maps to native text views; `{0 && ...}` crash | [Fundamentals](/docs/react-native/react-native-fundamentals) |
| 7 | Platform-specific code? | `Platform.OS`, `Platform.select`, `.ios.tsx` / `.android.tsx` | [Fundamentals](/docs/react-native/react-native-fundamentals) |
| 8 | Safe areas and dimensions? | `react-native-safe-area-context`, `useWindowDimensions`, edge-to-edge | [Fundamentals](/docs/react-native/react-native-fundamentals) |
| 9 | Keyboard handling? | `KeyboardAvoidingView`, `keyboardShouldPersistTaps`, keyboard-controller | [Fundamentals](/docs/react-native/react-native-fundamentals) |
| 10 | Styling options? | `StyleSheet`, NativeWind, Unistyles, Tamagui; trade-offs | [Fundamentals](/docs/react-native/react-native-fundamentals) |

### 2.2 Architecture (10)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 11 | Explain the RN architecture | Threads, JSI, Fabric render / commit / mount, Turbo Modules | [Architecture](/docs/react-native/architecture-and-internals) |
| 12 | Problems with the old bridge? | Async JSON, serialization, congestion, eager init, no sync calls | [Architecture](/docs/react-native/architecture-and-internals) |
| 13 | What is JSI? | C++ host objects and functions callable from JS, sync capable | [Architecture](/docs/react-native/architecture-and-internals) |
| 14 | What does Fabric improve? | Sync layout reads, concurrent React, immutable shadow tree, view flattening | [Architecture](/docs/react-native/architecture-and-internals) |
| 15 | Turbo Modules vs legacy modules? | Lazy init, Codegen types, sync or async via JSI | [Architecture](/docs/react-native/architecture-and-internals) |
| 16 | What is Codegen? | Generates native interfaces from typed specs, compile-time safety | [Architecture](/docs/react-native/architecture-and-internals) |
| 17 | Why Hermes? | Bytecode precompilation, mmap, low memory, GC, DevTools | [Architecture](/docs/react-native/architecture-and-internals) |
| 18 | What runs on which thread? | JS thread for React, UI thread for views and gestures, background for layout | [Architecture](/docs/react-native/architecture-and-internals) |
| 19 | Bridgeless mode and interop layer? | Bridge removed; old libraries run through interop | [Architecture](/docs/react-native/architecture-and-internals) |
| 20 | Concurrent React on RN? | Transitions, `useDeferredValue`, Suspense possible because of Fabric | [Architecture](/docs/react-native/architecture-and-internals) |

### 2.3 Navigation, lists, and data (12)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 21 | Native stack vs JS stack? | Platform primitives vs JS transitions, `react-native-screens` | [Navigation](/docs/react-native/navigation-and-routing) |
| 22 | Implement auth flow navigation | Conditional screens on auth state, splash while reading token | [Navigation](/docs/react-native/navigation-and-routing) |
| 23 | Deep links vs universal links? | Custom scheme vs verified HTTPS, AASA and assetlinks, validation | [Navigation](/docs/react-native/navigation-and-routing) |
| 24 | Why do screens stay mounted? | Stack model; focus events instead of mount effects | [Navigation](/docs/react-native/navigation-and-routing) |
| 25 | Expo Router vs React Navigation? | File-based routes, URLs everywhere, typed routes, built on RN Navigation | [Navigation](/docs/react-native/navigation-and-routing) |
| 26 | ScrollView vs FlatList? | All children vs virtualization window | [Lists and Data](/docs/react-native/lists-state-and-data) |
| 27 | Optimize a slow FlatList | Memo rows, stable `renderItem`, `getItemLayout`, `windowSize`, images | [Lists and Data](/docs/react-native/lists-state-and-data) |
| 28 | FlashList vs FlatList? | Recycling, fewer blank areas, row-state gotcha | [Lists and Data](/docs/react-native/lists-state-and-data) |
| 29 | State management choice? | Server vs client state, Query plus Zustand / RTK, Context limits | [Lists and Data](/docs/react-native/lists-state-and-data) |
| 30 | Storage options? | AsyncStorage, MMKV, SecureStore, SQLite; what goes where | [Lists and Data](/docs/react-native/lists-state-and-data) |
| 31 | Design offline-first | Local DB as source of truth, outbox, sync cursor, conflicts | [Lists and Data](/docs/react-native/lists-state-and-data) |
| 32 | Token refresh | Interceptor, deduped refresh, secure storage, logout on failure | [Lists and Data](/docs/react-native/lists-state-and-data) |

### 2.4 Animation and native (9)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 33 | Why do JS animations jank? | Per-frame dependency on the JS thread | [Animations](/docs/react-native/animations-and-gestures) |
| 34 | Native driver limits? | Only opacity and transforms, no layout props | [Animations](/docs/react-native/animations-and-gestures) |
| 35 | Shared values and worklets? | UI-thread runtime, no re-render, `runOnJS` | [Animations](/docs/react-native/animations-and-gestures) |
| 36 | Build swipe-to-dismiss | Pan gesture, velocity, spring or decay, layout animation | [Animations](/docs/react-native/animations-and-gestures) |
| 37 | Write a native module | Spec, Codegen, Kotlin and Obj-C++ / Swift, or Expo Modules | [Native](/docs/react-native/native-modules-and-platform) |
| 38 | Native UI component | `codegenNativeComponent`, props, events, commands | [Native](/docs/react-native/native-modules-and-platform) |
| 39 | Push notifications end to end | APNs / FCM tokens, backend, foreground / background / cold start | [Native](/docs/react-native/native-modules-and-platform) |
| 40 | Permissions best practice | In-context requests, denied states, Settings, usage strings | [Native](/docs/react-native/native-modules-and-platform) |
| 41 | Config plugins and CNG | Generated native folders, declarative native config | [Native](/docs/react-native/native-modules-and-platform) |

### 2.5 Performance and shipping (9)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 42 | The app is slow, what do you do? | Release build, low-end device, identify thread, profile, fix, re-measure | [Performance](/docs/react-native/performance-and-debugging) |
| 43 | Improve cold start | Hermes, lazy imports, no top-level work, cache-first, defer SDKs | [Performance](/docs/react-native/performance-and-debugging) |
| 44 | React Compiler impact | Auto memoization, Rules of React, fewer manual hooks | [Performance](/docs/react-native/performance-and-debugging) |
| 45 | Finding memory leaks | Listeners, timers, images; heap snapshots, Instruments, LeakCanary | [Performance](/docs/react-native/performance-and-debugging) |
| 46 | Debugging tools today | React Native DevTools, perf monitor, native profilers, Flipper removed | [Performance](/docs/react-native/performance-and-debugging) |
| 47 | Testing strategy | Jest, RNTL, Maestro / Detox, release builds | [Release](/docs/react-native/testing-build-and-release) |
| 48 | OTA updates: rules and risks | JS-only, runtime version, channels, staged rollout, store policy | [Release](/docs/react-native/testing-build-and-release) |
| 49 | Mobile security basics | No secrets in bundle, Keychain / Keystore, pinning, integrity APIs | [Release](/docs/react-native/testing-build-and-release) |
| 50 | Supporting old app versions | API versioning, minimum version check, feature flags | [Release](/docs/react-native/testing-build-and-release) |

---

## 3. Predict the Behavior

**3.1**

```tsx
function Badge({ count }: { count: number }) {
  return <View>{count && <Text>{count} new</Text>}</View>;
}
<Badge count={0} />
```

**Answer:** crash with "Text strings must be rendered within a `<Text>` component".
`0 && ...` evaluates to `0`, which React renders as a raw string inside a `View`.
Use `count > 0 && ...`.

**3.2**

```tsx
<View style={{ flexDirection: 'row' }}>
  <Image source={avatar} style={{ width: 40, height: 40 }} />
  <Text>{veryLongName}</Text>
</View>
```

**Answer:** the text overflows off the screen instead of wrapping, because `flexShrink` defaults to `0` in RN.
Add `flexShrink: 1` (or `flex: 1`) to the `Text`.

**3.3**

```tsx
function Screen() {
  useEffect(() => {
    loadData();
  }, []);
  ...
}
// User opens Screen, pushes Details, then goes back.
```

**Answer:** `loadData` runs once.
Going back does not remount `Screen`, because it stayed mounted under `Details`.
Use `useFocusEffect` to refresh on return.

**3.4**

```tsx
Animated.timing(height, { toValue: 200, duration: 300, useNativeDriver: true }).start();
```

**Answer:** error: `height` is not supported by the native animated module.
The native driver only supports non-layout properties such as `opacity` and `transform`.
Use `transform: scale`, `useNativeDriver: false` (JS-driven), or Reanimated.

**3.5**

```tsx
const offset = useSharedValue(0);
console.log('render');
const onPress = () => { offset.value = withSpring(offset.value + 50); };
```

**Answer:** pressing does not log `render`.
Shared value changes update animated styles on the UI thread without re-rendering the component.

**3.6**

```tsx
<ScrollView>
  <Header />
  <FlatList data={thousandItems} renderItem={renderItem} />
</ScrollView>
```

**Answer:** works but renders all 1000 items and logs a warning about nesting virtualized lists inside plain ScrollViews with the same orientation.
The outer ScrollView gives the list unlimited height, so virtualization is lost.
Use `ListHeaderComponent` instead.

**3.7**

```tsx
// FlashList row
function Row({ item }) {
  const [expanded, setExpanded] = useState(false);
  ...
}
```

**Answer:** after the user expands a row and scrolls, a different item may appear already expanded.
FlashList recycles the component instance, so its local state carries over to the new item.
Store expansion in data keyed by ID, or reset state when `item.id` changes.

**3.8**

```tsx
const [query, setQuery] = useState('');
const results = useMemo(() => heavyFilter(items, query), [items, query]);
<TextInput value={query} onChangeText={setQuery} />
```

**Answer:** typing feels laggy on low-end devices, because every keystroke synchronously re-filters before the input re-renders.
Use `useDeferredValue(query)` for the filter (Fabric supports concurrent rendering), or debounce.

---

## 4. Machine Coding Tasks

Typical 60 to 90 minute live tasks, with what to show:

| Task | Show |
| --- | --- |
| **Infinite feed** with pull-to-refresh | `useInfiniteQuery`, cursor pagination, FlashList, loading / empty / error states, memoized rows, image sizing |
| **Search with autocomplete** | Debounce or `useDeferredValue`, cancel stale requests (`AbortController`), keyboard handling, empty state |
| **Login flow** | Form validation, secure token storage, conditional navigation, splash during token check |
| **Image gallery** with full-screen viewer | Grid with `numColumns`, `expo-image`, pinch-to-zoom with Gesture Handler and Reanimated, shared element feel |
| **Chat screen** | Inverted list, optimistic send, pending / failed states, keyboard-aware input, new message scroll behavior |
| **Swipeable cards** (Tinder style) | Pan gesture, rotation interpolation, velocity threshold, dismissal callback, stack rendering |
| **Todo with offline sync** | Local persistence (MMKV / SQLite), outbox, retry on reconnect with NetInfo |
| **Bottom sheet** | Snap points, pan gesture, backdrop, keyboard interaction, or explain library choice |

Structure your solution like production code: typed props, small components, a data hook per feature, and a short note on what you would test.

---

## 5. Mobile System Design Prompts

Frame every answer with: requirements (offline? real-time? scale?), client architecture, data flow, API contract, caching and persistence, performance, release and monitoring.

| Prompt | Key points |
| --- | --- |
| **Design an Instagram-like feed** | Cursor pagination, FlashList, image CDN with size params, prefetch next images, cache last feed for instant start, optimistic likes, video autoplay only when visible |
| **Design WhatsApp-like chat** | WebSocket with reconnect and backoff, local SQLite as source of truth, outbox with client IDs, delivery and read receipts, push for background, media upload with resumable background sessions |
| **Design an offline-first notes app** | Local DB, sync protocol with cursors, conflict resolution, background sync tasks, encryption at rest |
| **Design a ride-hailing driver app** | Background location with battery trade-offs, foreground service on Android, map rendering, real-time updates, state machine for trip lifecycle, poor network handling |
| **Design an e-commerce app** | Product listing and search, cart persistence, checkout security (server-side pricing, payment SDKs), deep links from campaigns, A/B testing with feature flags |
| **Design the release process for a 50-engineer RN app** | Monorepo, CI with fingerprints, preview builds per PR, OTA channels, staged rollouts, crash and performance gates, release trains |

See [Frontend System Design](/docs/system-design/hld/frontend-system-design) for the general framework and [Server-Driven UI](/docs/sdui) for config-driven screens in RN.

---

## 6. Production Scenarios

| Scenario | Strong answer |
| --- | --- |
| Crash rate spikes after a release | Check if it is OTA or binary; roll back the OTA or halt the staged rollout; read symbolicated traces by version and update ID; hotfix |
| Android users report the app "freezes" on launch | ANRs from main-thread work at startup (SDK init, sync disk I/O); move to background, defer, verify with Play vitals |
| Feed scroll is janky only on Android | Overdraw, shadows, large images, heavy rows; profile with Perfetto; flatten views, resize images, FlashList |
| Memory grows until the OS kills the app | Heap snapshots over a session; leaked listeners, unbounded image cache, screens never popped |
| Users stuck on an old version calling a removed API | Restore compatibility, add minimum version check and update prompt, version APIs going forward |
| A deep link opens a blank screen | Link handled before auth or data ready; queue the link, validate params, add a not-found screen |
| OTA update crashes old binaries | Native mismatch; enforce runtime versions (fingerprint policy), roll back the update |
| Push notifications stopped on iOS | Expired APNs key or certificate, environment mismatch (sandbox vs production), stale tokens; check provider responses |

---

## 7. Cheat Sheets

### 7.1 Which list?

| Situation | Use |
| --- | --- |
| Under about 30 static items | `ScrollView` or `map` |
| Long list, simple rows | `FlatList` with tuning |
| Grouped with headers | `SectionList` or FlashList with sticky headers |
| Long, heavy, or mixed rows | **FlashList** |
| Chat / bidirectional | Inverted list, Legend List, or `maintainVisibleContentPosition` |

### 7.2 Which storage?

| Data | Use |
| --- | --- |
| Tokens, credentials | SecureStore / Keychain / Keystore |
| Settings, flags, small persisted state | MMKV |
| Large or relational data | SQLite (expo-sqlite, op-sqlite) with Drizzle or WatermelonDB |
| Files and media | File system |
| Server data cache | TanStack Query persisted cache |

### 7.3 Which animation tool?

| Need | Use |
| --- | --- |
| Opacity / transform, no extra dependency | `Animated` + `useNativeDriver` |
| State-driven transitions | Reanimated CSS transitions |
| Gesture-driven | Gesture Handler + Reanimated |
| Mount / unmount / reorder | Reanimated entering, exiting, layout |
| Custom drawing | Skia |

### 7.4 Version facts worth knowing

| Fact | Value |
| --- | --- |
| Hermes default | 0.70 |
| New Architecture default | 0.76 (Oct 2024) |
| New Architecture only, legacy removed | 0.82 |
| Flipper removed from template | 0.74 |
| React 19 in RN | 0.78 |
| CodePush / App Center retired | March 2025 |

---

## 8. Common Mistakes

| Mistake | Better |
| --- | --- |
| Talking only about iOS | Cover Android back, permissions, edge-to-edge, performance on low-end devices |
| "I would use Redux for everything" | Server state in a query library, small client store, local state where possible |
| Measuring performance in debug mode | Release builds on a low-end device |
| Animating with `setState` | Reanimated or the native driver |
| Storing tokens in AsyncStorage | Keychain / Keystore |
| Shipping secrets in env variables | Inlined in the bundle and public; keep on server |
| "We'll fix it with an OTA update" for native changes | Native changes need a store build; runtime versions block mismatches |
| Describing the bridge as current | New Architecture is the only architecture now |
| `useEffect` to refresh on screen return | `useFocusEffect` |
| Ignoring accessibility | Roles, labels, font scaling, screen reader testing |

---

## 9. Study Plan

| Day | Focus | Do |
| --- | --- | --- |
| 1 | [Fundamentals](/docs/react-native/react-native-fundamentals) | Build a small screen with Flexbox, Pressable, TextInput, safe areas |
| 2 | [Architecture](/docs/react-native/architecture-and-internals) | Explain the threads and New Architecture aloud in 3 minutes |
| 3 | [Navigation](/docs/react-native/navigation-and-routing) | Auth flow, tabs inside a stack, a deep link |
| 4 | [Lists, State, and Data](/docs/react-native/lists-state-and-data) | Infinite feed with TanStack Query and FlashList, MMKV persistence |
| 5 | [Animations](/docs/react-native/animations-and-gestures) and [Native](/docs/react-native/native-modules-and-platform) | Swipe-to-dismiss card; read one Expo Module and one Turbo Module |
| 6 | [Performance](/docs/react-native/performance-and-debugging) and [Release](/docs/react-native/testing-build-and-release) | Profile a list, write one RNTL test and one Maestro flow, explain OTA rules |
| 7 | This playbook | Answer the question bank aloud, do one machine coding task and one system design prompt timed |
