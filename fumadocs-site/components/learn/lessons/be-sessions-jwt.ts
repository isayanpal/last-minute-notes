import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Follows the Authentication and Security notes: server-side sessions in an HttpOnly cookie,
 * CSRF defenses, JWT verification rules (pin alg, check exp, aud, iss) and refresh token rotation with reuse detection.
 */

type Beat = { msgs: SeqMessage[]; hold?: number; actors?: SeqActor[]; stats?: Stat[]; note?: SeqState['note'] };

function reveal(actors: SeqActor[], beats: Beat[]): Frame<SeqState>[] {
  const so: SeqMessage[] = [];
  return beats.map((b) => {
    so.push(...b.msgs);
    return { hold: b.hold ?? 1700, state: { actors: b.actors ?? actors, messages: [...so], fresh: b.msgs.length, stats: b.stats, note: b.note } };
  });
}

type Tone = 'ok' | 'bad' | 'accent';
const badge = (actors: SeqActor[], id: string, text: string, tone: Tone): SeqActor[] => actors.map((a) => (a.id === id ? { ...a, badge: { text, tone } } : a));

// Step 1: HTTP is stateless, so each request must prove who sent it.
const PROBLEM: SeqActor[] = [
  { id: 'b', label: 'Browser', kind: 'client' },
  { id: 'a', label: 'API', kind: 'service' },
];
const problemFrames = reveal(PROBLEM, [
  {
    msgs: [{ from: 'b', to: 'a', label: 'GET /orders' }, { from: 'a', to: 'b', label: '401 who are you?', dashed: true, tone: 'bad' }],
    hold: 2400,
    stats: [
      { label: 'HTTP', value: 'stateless' },
      { label: 'Each request', value: 'must prove who' },
      { label: 'Two answers', value: 'session, JWT' },
    ],
    note: { text: 'the server forgets the caller between requests', tone: 'accent' },
  },
]);

// Step 2: server-side session. The cookie holds only a random id.
const SESS: SeqActor[] = [
  { id: 'b', label: 'Browser', kind: 'client' },
  { id: 'a', label: 'API', kind: 'service' },
  { id: 'r', label: 'Session store', kind: 'cache' },
];
const sessStats: Stat[] = [
  { label: 'Cookie holds', value: 'random id' },
  { label: 'Revoke', value: 'delete row', tone: 'ok' },
  { label: 'Needs', value: 'shared store' },
];
const sessionFrames = reveal(SESS, [
  { msgs: [{ from: 'b', to: 'a', label: 'POST /login' }, { from: 'a', to: 'r', label: 'create session', tone: 'data' }], hold: 1800, stats: sessStats },
  { msgs: [{ from: 'a', to: 'b', label: 'Set-Cookie: sid=9f3a', dashed: true, tone: 'ok' }], hold: 1700, stats: sessStats, note: { text: 'HttpOnly; Secure; SameSite=Lax, id rotated at login', tone: 'ok' } },
  { msgs: [{ from: 'b', to: 'a', label: 'GET /orders + cookie' }, { from: 'a', to: 'r', label: 'lookup 9f3a' }, { from: 'r', to: 'a', label: 'user 42', dashed: true }], hold: 2800, stats: sessStats, note: { text: 'state lives on the server, so logout and revocation are immediate', tone: 'ok' } },
]);

// Step 3: CSRF. The browser attaches cookies to any request to your site.
const CSRF: SeqActor[] = [
  { id: 'e', label: 'Evil page', kind: 'external' },
  { id: 'b', label: 'Victim browser', kind: 'client' },
  { id: 'a', label: 'Your API', kind: 'service' },
];
const csrfFrames = reveal(CSRF, [
  { msgs: [{ from: 'e', to: 'b', label: 'hidden form to /transfer', tone: 'bad' }], hold: 1800, stats: [{ label: 'Attack', value: 'CSRF' }, { label: 'Why it works', value: 'auto cookies' }, { label: 'Fits', value: 'cookies' }] },
  { msgs: [{ from: 'b', to: 'a', label: 'POST /transfer + cookie', tone: 'bad' }], hold: 2000, stats: [{ label: 'Browser sends', value: 'cookie anyway', tone: 'bad' }, { label: 'Server sees', value: 'valid session', tone: 'bad' }, { label: 'Result', value: 'money moved', tone: 'bad' }], note: { text: 'the request really came from the victim browser', tone: 'bad' } },
  {
    msgs: [{ from: 'a', to: 'b', label: 'blocked: SameSite, token', dashed: true, tone: 'ok' }],
    hold: 3000,
    stats: [
      { label: 'SameSite', value: 'Lax or Strict', tone: 'ok' },
      { label: 'Also', value: 'CSRF token' },
      { label: 'And', value: 'check Origin' },
    ],
    note: { text: 'combine defenses, and never change state with GET', tone: 'ok' },
  },
]);

// Step 4: JWT. The token carries signed claims, so the API verifies without a lookup.
const JWT: SeqActor[] = [
  { id: 'b', label: 'Client', kind: 'client' },
  { id: 'i', label: 'Auth server', kind: 'gateway' },
  { id: 'a', label: 'API', kind: 'service' },
];
const jwtStats: Stat[] = [
  { label: 'Token', value: 'h.p.sig' },
  { label: 'Payload', value: 'readable', tone: 'bad' },
  { label: 'Verify', value: 'no lookup', tone: 'ok' },
];
const jwtFrames = reveal(JWT, [
  { msgs: [{ from: 'b', to: 'i', label: 'login' }, { from: 'i', to: 'b', label: 'signed JWT, exp 15 min', dashed: true, tone: 'ok' }], hold: 2200, stats: jwtStats, note: { text: 'claims: sub, iss, aud, exp, scope', tone: 'accent' } },
  {
    msgs: [{ from: 'b', to: 'a', label: 'Authorization: Bearer' }, { from: 'a', to: 'a', label: 'verify', tone: 'ok' }],
    hold: 2800,
    stats: jwtStats,
    note: { text: 'encoded, not encrypted: never put secrets in the payload', tone: 'accent' },
  },
]);

// Step 5: classic attacks and the verifier rules that stop them.
const ATK: SeqActor[] = [
  { id: 'x', label: 'Attacker', kind: 'external' },
  { id: 'a', label: 'API verifier', kind: 'service' },
];
const attack = (msg: string, why: string, rule: string): Beat => ({
  msgs: [{ from: 'x', to: 'a', label: msg, tone: 'bad' }, { from: 'a', to: 'x', label: why, dashed: true, tone: 'ok' }],
  hold: 2400,
  stats: [
    { label: 'Rule', value: rule, tone: 'ok' },
    { label: 'Always check', value: 'exp, iss, aud' },
    { label: 'Never trust', value: 'alg header' },
  ],
});
const attackFrames = reveal(ATK, [
  attack('role=admin, old sig', 'REJECTED: bad signature', 'check HMAC'),
  attack('alg: none, no sig', 'REJECTED: wrong alg', 'pin alg'),
  attack('expired token', 'REJECTED: expired', 'check exp'),
  attack('token for billing-api', 'REJECTED: wrong aud', 'check aud'),
]);

// Step 6: short access tokens plus rotating refresh tokens, with reuse detection.
const ROT: SeqActor[] = [
  { id: 'c', label: 'Client', kind: 'client' },
  { id: 's', label: 'Auth server', kind: 'gateway' },
  { id: 'x', label: 'Attacker', kind: 'external' },
];
const rotStats = (a: string, b: string): Stat[] => [
  { label: 'Access token', value: '5 to 15 min' },
  { label: 'Refresh', value: 'single use', tone: 'ok' },
  { label: a, value: b, tone: b === 'revoked' ? 'ok' : 'neutral' },
];
const rotFrames = reveal(ROT, [
  { msgs: [{ from: 'c', to: 's', label: 'refresh with R1' }, { from: 's', to: 'c', label: 'new access + R2', dashed: true, tone: 'ok' }], hold: 2200, stats: rotStats('R1', 'used') },
  { msgs: [{ from: 'x', to: 's', label: 'replay stolen R1', tone: 'bad' }], hold: 1700, stats: rotStats('R1', 'used again'), note: { text: 'an old refresh token can only mean theft', tone: 'bad' } },
  { msgs: [{ from: 's', to: 'x', label: 'reuse: revoke family', dashed: true, tone: 'ok' }, { from: 's', to: 'c', label: 'login again', dashed: true }], hold: 3000, stats: rotStats('Family', 'revoked'), note: { text: 'the whole chain dies, the user signs in again', tone: 'ok' } },
]);

export default defineLesson('sequence', {
  slug: 'be-sessions-jwt',
  objectives: [
    { text: 'Why every request must carry proof of identity', step: 1 },
    { text: 'How cookie sessions work and why they revoke instantly', step: 2 },
    { text: 'How CSRF abuses cookies and how to block it', step: 3 },
    { text: 'What a JWT contains and how an API verifies it', step: 4 },
    { text: 'The classic JWT attacks and the verifier rules against them', step: 5 },
    { text: 'Short access tokens with rotating refresh tokens', step: 6 },
  ],
  steps: [
    {
      label: 'Problem',
      title: 'HTTP forgets who you are',
      tag: 'problem',
      body: ['HTTP is stateless, so every request must prove who sent it. There are two main answers: a **server-side session** or a **signed token**.', 'Both carry a credential on each call. They differ in where the truth lives.'],
      keyIdea: 'Sessions keep state on the server. Tokens move the state into the client and sign it.',
      frames: problemFrames,
    },
    {
      label: 'Sessions',
      title: 'A cookie that is only an id',
      tag: 'concept',
      body: ['After login the server stores the session and sets a random id in an `HttpOnly; Secure; SameSite=Lax` cookie. Each request is a lookup.', 'Rotate the id at login to prevent fixation, and use idle and absolute timeouts.'],
      keyIdea: 'For a first-party web app this is still a great default: simple, revocable, safe from XSS token theft.',
      frames: sessionFrames,
    },
    {
      label: 'CSRF',
      title: 'The browser sends cookies for you',
      tag: 'trade-off',
      body: ['An attacker page makes the victim browser call your site, and the browser attaches the cookie. The server cannot tell it from a real click.', 'Defend with `SameSite`, anti-CSRF tokens, `Origin` checks and a custom header or JSON content type.'],
      keyIdea: 'Tokens sent in an explicit header are not vulnerable to CSRF. Cookies are.',
      frames: csrfFrames,
    },
    {
      label: 'JWT',
      title: 'Signed claims, no lookup',
      tag: 'concept',
      body: ['A **JWT** is `header.payload.signature`. The API verifies the signature and claims, so it needs no session store and scales easily.', 'Use HS256 for one service, or an asymmetric algorithm (ES256, EdDSA) with a JWKS endpoint when many services verify.'],
      keyIdea: 'The payload is Base64URL, not encrypted. Anyone can read it.',
      frames: jwtFrames,
    },
    {
      label: 'Attacks',
      title: 'Verify like you do not trust it',
      tag: 'technique',
      body: ['Tampered payloads fail the signature. `alg: none` and key-confusion attacks work only if you trust the header, so **pin the algorithm**.', 'Always check `exp`, `iss` and `aud`. A token for another API must be rejected.'],
      keyIdea: 'Verification is a checklist: algorithm, signature, expiry, issuer, audience.',
      frames: attackFrames,
    },
    {
      label: 'Refresh',
      title: 'Revoking what cannot be revoked',
      tag: 'technique',
      body: ['A self-contained JWT cannot be revoked before it expires, so keep **access tokens short** (5 to 15 minutes) and pair them with **rotating refresh tokens**.', 'Each refresh token is single use. Seeing an old one again signals theft, so the server revokes the whole family.'],
      keyIdea: 'Emergency kill switch: a deny list keyed by `jti`, or opaque tokens with introspection.',
      frames: rotFrames,
    },
    {
      label: 'Recap',
      title: 'Session or token?',
      tag: 'recap',
      body: [
        '- **Session cookie:** first-party web apps, instant revocation, needs CSRF defenses.',
        '- **JWT:** APIs, mobile, service-to-service, stateless verification.',
        '- **Verify:** pin alg, check signature, exp, iss, aud.',
        '- **Revoke:** short access tokens, rotating refresh tokens, `jti` deny list.',
        '- **Browser storage:** avoid `localStorage`, prefer `HttpOnly` cookies.',
      ],
      keyIdea: 'JWT as a session store for everything is often more complex and less safe than a plain session.',
      frames: [jwtFrames[jwtFrames.length - 1]],
    },
  ],
});
