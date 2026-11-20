# Interactive lessons

Each lesson is one file in `lessons/` that exports `defineLesson(engine, {...})` as default.
The player (`LessonPlayer.tsx`) handles steps, frames, keyboard, replay and pause.
Metadata (title, section, notes link, step count) lives in `lib/learn/catalog.ts`.
`loaders.ts` maps each slug to its file so every lesson is its own chunk.

Reference lessons: `lessons/load-balancing.ts` (flow) and `lessons/sliding-window.ts` (array).

## Adding a lesson

1. Add an entry to `lib/learn/catalog.ts` (the notes `href` must match a real heading anchor).
2. Create `lessons/<slug>.ts` with `export default defineLesson('<engine>', { slug, objectives, steps })`.
3. Add `'<slug>': () => import('./lessons/<slug>')` to `loaders.ts`.
4. The number of steps must equal `steps` in the catalog.

## Steps and frames

- A step has `label` (1 to 3 words, shown under the step dot), `title`, `tag`, `body`, `keyIdea`, `frames`.
- `tag` is one of `problem`, `concept`, `technique`, `trade-off`, `in practice`, `recap`.
- Start with a `problem` step and end with a `recap` step whose body is all `- ` bullets.
- `body` is 1 to 3 short paragraphs, supports `**bold**` and `` `code` ``.
  Aim for under 60 words per step. The diagram carries the explanation, the text frames it.
- `keyIdea` is one or two sentences: the line a reader should remember.
- `frames` is a list of `{ state, hold? }`. The player shows each frame for `hold` ms (default 1500), then moves on, and stops on the last one.
  Use 1 to 6 frames per step. Hold long enough for packets and animations to finish.
- Every state accepts `stats` (up to 3 chips above the stage) and `note` (a pill at the bottom).
  Keep stat values short: under 14 characters.
- Prefer generating frames by running the real algorithm in the file (see `sliding-window.ts`), so numbers stay correct.
- Copy must come from the notes linked in the catalog. Do not invent facts the notes do not support.
- Never use the em dash. Use a plain dash or rewrite the sentence.

## Engines

All engines draw into a 640 x 420 stage. Types live in `engines/*.tsx`.

| Engine | Use for | Key fields |
| --- | --- | --- |
| `flow` | Architecture: clients, LBs, caches, DBs, queues | `nodes` (x 0..6, y 0..3.5), `links`, `packets`, `groups` |
| `sequence` | Protocols and message exchanges over time | `actors`, `messages` (all so far), `fresh` |
| `array` | Arrays, strings, pointers, windows, bars | `rows` (1 to 3), `panels` |
| `graph` | Trees, linked lists, graphs, tries | `nodes` (x 0..10, y 0..6), `edges`, `pointers`, `panels` |
| `grid` | DP tables, matrices, bitmasks, inverted indexes | `cells`, `states` keyed `"r,c"`, `arrows`, `pointers` |
| `timeline` | Intervals, latency, deploy phases, budgets | `from`, `to`, `lanes`, `markers` |

Shared visual states for cells and nodes: `normal`, `active`, `visited`, `done`, `found`, `bad`, `dim`, `swap`, `path`.
Paint tones for packets, pointers and bars: `req`, `res`, `data`, `ok`, `bad`, `accent`, `info`, `neutral`, `violet`, `pink`.

Helpers in `engines/layouts.ts`: `treeLayout`, `listLayout`, `circleLayout`, `patch`.

### Layout rules

- `flow`: keep 2 to 9 nodes. Leave at least 1.1 units between node centres horizontally and 0.9 vertically, or labels collide.
  Node labels are short (under 16 chars), `sub` under 20 chars, item chips under 9 chars.
  A packet takes about 0.6 s; chain hops with `delay` so the second hop starts when the first lands.
- `sequence`: 2 to 5 actors, at most 9 messages visible (older ones scroll off). Labels under 26 chars.
- `array`: up to about 12 cells per row. Use `bars: true` for sorting or growth curves.
- `graph`: up to about 15 nodes. Keep 1.2 units apart. Panels take the right 170 px, so lay nodes out in x 0..10 anyway, the engine squeezes.
- `grid`: up to about 10 x 10. Headers are optional.
- `timeline`: up to 8 lanes. Bar labels under 18 chars.
