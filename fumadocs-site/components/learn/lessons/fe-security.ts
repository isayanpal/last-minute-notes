import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame } from '../types';

const ACTORS: SeqActor[] = [
  { id: 'v', label: 'Victim browser', kind: 'client' },
  { id: 's', label: 'Your site', kind: 'service' },
  { id: 'e', label: 'evil.example', kind: 'external' },
];

const seq = (messages: SeqMessage[], stats: SeqState['stats'], note?: SeqState['note'], actors: SeqActor[] = ACTORS): SeqState => ({
  actors,
  messages,
  stats,
  note,
  fresh: messages.length - 1,
});

const reveal = (messages: SeqMessage[], statsAt: (n: number) => SeqState['stats'], noteAt: (n: number) => SeqState['note'], hold = 1000, actors: SeqActor[] = ACTORS): Frame<SeqState>[] =>
  messages.map((_, i) => ({ hold: i === messages.length - 1 ? 2600 : hold, state: seq(messages.slice(0, i + 1), statsAt(i + 1), noteAt(i + 1), actors) }));

// Step 1: the same-origin policy blocks reads, not sends.
const SOP: SeqMessage[] = [
  { from: 'v', to: 'e', label: 'open evil.example' },
  { from: 'e', to: 'v', label: 'page with script', dashed: true },
  { from: 'v', to: 's', label: 'fetch(your-site/api), sent', tone: 'data' },
  { from: 's', to: 'v', label: '200 + private data', dashed: true, tone: 'data' },
  { from: 'v', to: 'e', label: 'script cannot read it (SOP)', tone: 'ok', lost: true },
];

// Step 2: stored XSS. Attacker input runs in your origin.
const XSS_ACTORS: SeqActor[] = [
  { id: 'a', label: 'Attacker', kind: 'external' },
  { id: 's', label: 'Your site', kind: 'service' },
  { id: 'v', label: 'Victim browser', kind: 'client' },
];
const XSS: SeqMessage[] = [
  { from: 'a', to: 's', label: 'comment: <script>x()</script>', tone: 'bad' },
  { from: 's', to: 'a', label: 'saved as-is', dashed: true },
  { from: 'v', to: 's', label: 'open the page' },
  { from: 's', to: 'v', label: 'page + comment, unescaped', dashed: true, tone: 'bad' },
  { from: 'v', to: 'a', label: 'token + cookies sent out', tone: 'bad' },
];

// Step 3: defenses. Escape, sanitize and CSP stop it.
const CSP: SeqMessage[] = [
  { from: 'a', to: 's', label: 'comment: <script>x()</script>' },
  { from: 's', to: 'v', label: 'page, comment escaped as text', dashed: true, tone: 'ok' },
  { from: 's', to: 'v', label: 'CSP: script-src nonce-r4nd0m', dashed: true, tone: 'accent' },
];
const CSP_BLOCK: SeqMessage[] = [
  ...CSP,
  { from: 'v', to: 's', label: 'no nonce: script blocked', tone: 'ok', lost: true },
  { from: 'v', to: 's', label: 'violation report (report-to)', tone: 'accent' },
];

// Step 4: CSRF. The browser attaches cookies by itself.
const CSRF_BAD: SeqMessage[] = [
  { from: 'v', to: 'e', label: 'visit evil.example while logged in' },
  { from: 'e', to: 'v', label: 'hidden form: POST /transfer', dashed: true, tone: 'bad' },
  { from: 'v', to: 's', label: 'POST /transfer + cookie', tone: 'bad' },
  { from: 's', to: 'v', label: '200 money moved', dashed: true, tone: 'bad' },
];
const CSRF_GOOD: SeqMessage[] = [
  { from: 'v', to: 'e', label: 'visit evil.example while logged in' },
  { from: 'e', to: 'v', label: 'hidden form: POST /transfer', dashed: true, tone: 'bad' },
  { from: 'v', to: 's', label: 'POST /transfer, no cookie', tone: 'ok' },
  { from: 's', to: 'v', label: '401 / token missing', dashed: true, tone: 'ok' },
];

// Step 5: where tokens live.
const TOKEN_ACTORS: SeqActor[] = [
  { id: 'x', label: 'Injected script', kind: 'external' },
  { id: 'v', label: 'Browser storage', kind: 'storage' },
  { id: 's', label: 'API', kind: 'service' },
];
const LOCAL: SeqMessage[] = [
  { from: 'x', to: 'v', label: 'localStorage.token' },
  { from: 'v', to: 'x', label: 'token: readable', dashed: true, tone: 'bad' },
  { from: 'x', to: 's', label: 'attacker calls API anywhere', tone: 'bad' },
];
const HTTPONLY: SeqMessage[] = [
  { from: 'x', to: 'v', label: 'document.cookie' },
  { from: 'v', to: 'x', label: 'HttpOnly: hidden from script', dashed: true, tone: 'ok' },
  { from: 'x', to: 's', label: 'can still act as the user, in page', tone: 'data' },
];

// Step 6: third-party scripts and supply chain.
const SRI_ACTORS: SeqActor[] = [
  { id: 'v', label: 'Browser', kind: 'client' },
  { id: 'c', label: 'Third-party CDN', kind: 'cdn' },
];
const SRI: SeqMessage[] = [
  { from: 'v', to: 'c', label: 'GET widget.js (integrity=sha384-...)' },
  { from: 'c', to: 'v', label: 'file was tampered with', dashed: true, tone: 'bad' },
  { from: 'v', to: 'c', label: 'hash mismatch: not executed', tone: 'ok', lost: true },
];

export default defineLesson('sequence', {
  slug: 'fe-security',
  objectives: [
    { text: 'What the same-origin policy and CORS do and do not protect', step: 1 },
    { text: 'How stored XSS runs attacker code in your origin', step: 2 },
    { text: 'Layered XSS defenses: escape, sanitize, CSP', step: 3 },
    { text: 'How CSRF works and why SameSite helps', step: 4 },
    { text: 'Where to keep tokens, and third-party risk', step: 5 },
  ],
  steps: [
    {
      label: 'Browser model',
      title: 'Reads are blocked, sends are not',
      tag: 'concept',
      body: ['The **same-origin policy** stops a page from reading responses from another origin. It does **not** stop it from sending requests.', '**CORS** is a server opt-in that lets chosen origins read its responses. It protects reads in the browser, not the server.'],
      keyIdea: 'CORS is not authentication, and `curl` ignores it. "Simple" cross-origin requests go out without preflight, which is why CSRF defenses exist.',
      frames: reveal(
        SOP,
        (n) => [{ label: 'Request sent', value: n > 2 ? 'yes' : '-', tone: n > 2 ? 'bad' : 'neutral' }, { label: 'Response read', value: n > 4 ? 'blocked' : '-', tone: n > 4 ? 'ok' : 'neutral' }, { label: 'Origin', value: 'scheme+host' }],
        (n) => (n > 4 ? { text: 'SOP blocks the read, the side effect may still happen', tone: 'accent' } : undefined),
      ),
    },
    {
      label: 'XSS',
      title: 'Attacker script in your origin',
      tag: 'problem',
      body: ['**XSS** runs attacker-controlled script as your site. It can read tokens, call your APIs as the user and rewrite the page.', 'Stored XSS saves the input for others. Reflected echoes it from a URL. DOM-based writes it into sinks like `innerHTML`.'],
      keyIdea: 'Once script runs in your origin, the browser treats it as you. Everything after that is damage control.',
      frames: reveal(
        XSS,
        (n) => [{ label: 'Type', value: 'stored' }, { label: 'Runs as', value: n > 3 ? 'your origin' : '-', tone: n > 3 ? 'bad' : 'neutral' }, { label: 'Stolen', value: n > 4 ? 'tokens' : '-', tone: n > 4 ? 'bad' : 'neutral' }],
        (n) => (n > 4 ? { text: 'stored XSS: one comment, every viewer', tone: 'bad' } : undefined),
        900,
        XSS_ACTORS,
      ),
    },
    {
      label: 'Defenses',
      title: 'Escape, sanitize, then CSP',
      tag: 'technique',
      body: ['**Escape output by context.** Frameworks escape text by default, so avoid `dangerouslySetInnerHTML`, `v-html` and `innerHTML`. Sanitize any HTML you must render with an allowlist (DOMPurify).', '**CSP** is defense in depth: a `nonce` or hash on `script-src` lets only your scripts run.'],
      keyIdea: 'A nonce must be fresh per response, so HTML cannot be cached identically for everyone. Hash-based CSP works with static output.',
      frames: reveal(
        CSP_BLOCK,
        (n) => [{ label: 'Escaped', value: n > 1 ? 'yes' : '-', tone: n > 1 ? 'ok' : 'neutral' }, { label: 'Inline script', value: n > 3 ? 'blocked' : '-', tone: n > 3 ? 'ok' : 'neutral' }, { label: 'Rollout', value: 'Report-Only' }],
        (n) => (n > 3 ? { text: 'two layers: output escaping and CSP', tone: 'ok' } : undefined),
        1000,
        XSS_ACTORS,
      ),
    },
    {
      label: 'CSRF',
      title: 'The browser sends cookies for you',
      tag: 'problem',
      body: ['**CSRF** makes a logged-in browser send an unwanted request, because cookies attach automatically.', '`SameSite=Lax` (the modern default) withholds cookies on cross-site POSTs. Add CSRF tokens, Origin or `Sec-Fetch-Site` checks, and re-auth for sensitive actions.'],
      keyIdea: 'Layer them: SameSite cookies, a CSRF token or custom header, and server-side Origin checks.',
      frames: [
        { hold: 2400, state: seq(CSRF_BAD, [{ label: 'Cookie sent', value: 'automatically', tone: 'bad' }, { label: 'Result', value: 'money moved', tone: 'bad' }, { label: 'Defense', value: 'none' }], { text: 'no SameSite, no token: the forged request works', tone: 'bad' }) },
        { hold: 2800, state: seq(CSRF_GOOD, [{ label: 'Cookie sent', value: 'withheld', tone: 'ok' }, { label: 'Result', value: 'rejected', tone: 'ok' }, { label: 'Defense', value: 'SameSite' }], { text: 'cross-site request carries no session', tone: 'ok' }) },
      ],
    },
    {
      label: 'Tokens',
      title: 'Where a token can hide',
      tag: 'trade-off',
      body: ['`localStorage` is readable by any injected script. An `HttpOnly; Secure; SameSite` cookie is not readable, though injected script can still make requests as the user.', 'A robust pattern: short-lived access token in memory plus a rotating refresh token in an `HttpOnly` cookie. A BFF keeps tokens server-side.'],
      keyIdea: 'HttpOnly limits what leaks, but it does not make XSS harmless.',
      frames: [
        { hold: 2800, state: seq(LOCAL, [{ label: 'Storage', value: 'localStorage', tone: 'bad' }, { label: 'Script can read', value: 'yes', tone: 'bad' }, { label: 'Lifetime', value: 'long-lived' }], { text: 'any injected script can steal it and use it elsewhere', tone: 'bad' }, TOKEN_ACTORS) },
        { hold: 3000, state: seq(HTTPONLY, [{ label: 'Storage', value: 'HttpOnly', tone: 'ok' }, { label: 'Script can read', value: 'no', tone: 'ok' }, { label: 'Still', value: 'acts in page', tone: 'bad' }], { text: 'prefer HttpOnly, but still prevent XSS', tone: 'accent' }, TOKEN_ACTORS) },
      ],
    },
    {
      label: 'Third parties',
      title: 'Code you did not write',
      tag: 'in practice',
      body: ['Third-party scripts and npm packages run with your page\'s power. Use **Subresource Integrity** for static files, a CSP allowlist, and sandboxed iframes.', 'For packages: lockfiles, pinned versions, `npm audit`, provenance and `ignore-scripts`.'],
      keyIdea: 'Fewer tags, fewer dependencies, and no secrets in the bundle or public source maps.',
      frames: reveal(
        SRI,
        (n) => [{ label: 'Integrity', value: n > 2 ? 'mismatch' : 'checked', tone: n > 2 ? 'bad' : 'neutral' }, { label: 'Executed', value: n > 2 ? 'no' : '-', tone: n > 2 ? 'ok' : 'neutral' }, { label: 'Also', value: 'lock + pin' }],
        (n) => (n > 2 ? { text: 'a tampered file never runs', tone: 'ok' } : undefined),
        1000,
        SRI_ACTORS,
      ),
    },
    {
      label: 'Recap',
      title: 'A layered checklist',
      tag: 'recap',
      body: [
        '- **SOP and CORS:** reads are blocked, sends are not. CORS is not auth.',
        '- **XSS:** escape by context, sanitize, CSP with nonce or hash, Trusted Types.',
        '- **CSRF:** SameSite cookies, tokens or custom headers, Origin checks.',
        '- **Tokens:** HttpOnly cookie or in-memory access token, avoid `localStorage`.',
        '- **Supply chain:** SRI, lockfiles, pinned versions, minimal dependencies.',
      ],
      keyIdea: 'Defense in depth: assume one layer will fail and say what catches it next.',
      frames: [{ state: seq(CSP_BLOCK, [{ label: 'XSS', value: 'escape + CSP', tone: 'ok' }, { label: 'CSRF', value: 'SameSite', tone: 'ok' }, { label: 'Tokens', value: 'HttpOnly', tone: 'ok' }], { text: 'layers, not a single fix', tone: 'accent' }, XSS_ACTORS) }],
    },
  ],
});
