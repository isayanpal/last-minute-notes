import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';

const seq = (actors: SeqActor[], messages: SeqMessage[], stats: SeqState['stats'], note?: SeqState['note'], fresh = 1): SeqState => ({ actors, messages, stats, note, fresh });

// Step 1: a request with no authorization check.
const A1: SeqActor[] = [
  { id: 'b', label: 'User B', kind: 'client' },
  { id: 'api', label: 'Orders API', kind: 'service' },
  { id: 'db', label: 'Database', kind: 'db' },
];
const noCheck: SeqMessage[] = [
  { from: 'b', to: 'api', label: 'GET /orders/7 (A\'s)' },
  { from: 'api', to: 'db', label: 'SELECT order 7' },
  { from: 'db', to: 'api', label: 'order 7', dashed: true },
  { from: 'api', to: 'b', label: '200 order of user A', dashed: true, tone: 'bad' },
];

// Step 2: authorization code flow with PKCE.
const A2: SeqActor[] = [
  { id: 'app', label: 'App', kind: 'client' },
  { id: 'idp', label: 'Identity provider', kind: 'gateway' },
  { id: 'api', label: 'Resource API', kind: 'service' },
];
const pkce: SeqMessage[] = [
  { from: 'app', to: 'idp', label: 'login + code_challenge', tone: 'accent' },
  { from: 'idp', to: 'app', label: 'authorization code', dashed: true },
  { from: 'app', to: 'idp', label: 'code + code_verifier', tone: 'accent' },
  { from: 'idp', to: 'app', label: 'access + refresh tokens', dashed: true, tone: 'ok' },
  { from: 'app', to: 'api', label: 'Bearer access token' },
  { from: 'api', to: 'app', label: 'protected data', dashed: true, tone: 'ok' },
];

// Step 3: validating tokens.
const A3: SeqActor[] = [
  { id: 'x', label: 'Attacker', kind: 'external' },
  { id: 'app', label: 'App', kind: 'client' },
  { id: 'api', label: 'Resource API', kind: 'service' },
  { id: 'idp', label: 'Identity provider', kind: 'gateway' },
];
const tokens: SeqMessage[] = [
  { from: 'app', to: 'api', label: 'valid token' },
  { from: 'api', to: 'app', label: '200 (all checks pass)', dashed: true, tone: 'ok' },
  { from: 'x', to: 'api', label: 'forged token alg=none', tone: 'bad' },
  { from: 'api', to: 'x', label: '401 reject algorithm', dashed: true, tone: 'bad' },
  { from: 'x', to: 'api', label: 'stolen token, 2 days old', tone: 'bad' },
  { from: 'api', to: 'x', label: '401 expired (10 min life)', dashed: true, tone: 'bad' },
  { from: 'app', to: 'idp', label: 'refresh token (rotating)', tone: 'accent' },
  { from: 'idp', to: 'app', label: 'new access + refresh', dashed: true, tone: 'ok' },
];

// Step 4: authorization on the server, every time.
const A4: SeqActor[] = [
  { id: 'b', label: 'User B', kind: 'client' },
  { id: 'api', label: 'Orders API', kind: 'service' },
  { id: 'pol', label: 'Policy layer', kind: 'gateway' },
  { id: 'db', label: 'Database', kind: 'db' },
];
const authz: SeqMessage[] = [
  { from: 'b', to: 'api', label: 'GET /orders/7 (A\'s)' },
  { from: 'api', to: 'pol', label: 'may B read order 7?' },
  { from: 'pol', to: 'api', label: 'deny: owner is A', dashed: true, tone: 'bad' },
  { from: 'api', to: 'b', label: '403 Forbidden', dashed: true, tone: 'bad' },
];
const authzOk: SeqMessage[] = [
  ...authz,
  { from: 'b', to: 'api', label: 'GET /orders/9 (B\'s)' },
  { from: 'api', to: 'pol', label: 'may B read order 9?' },
  { from: 'pol', to: 'api', label: 'allow: owner is B', dashed: true, tone: 'ok' },
  { from: 'api', to: 'db', label: 'SELECT 9 WHERE owner=B' },
  { from: 'api', to: 'b', label: '200 order 9', dashed: true, tone: 'ok' },
];

// Step 5: service to service, secrets and data at rest.
const A5: SeqActor[] = [
  { id: 'api', label: 'API', kind: 'service' },
  { id: 'ord', label: 'Orders svc', kind: 'service' },
  { id: 'kms', label: 'KMS', kind: 'monitor' },
  { id: 'db', label: 'Database', kind: 'db' },
];
const inside: SeqMessage[] = [
  { from: 'api', to: 'ord', label: 'mTLS: cert = api (1 h)', tone: 'accent' },
  { from: 'ord', to: 'api', label: 'identity verified', dashed: true, tone: 'ok' },
  { from: 'ord', to: 'kms', label: 'decrypt data key' },
  { from: 'kms', to: 'ord', label: 'data key (audited)', dashed: true, tone: 'ok' },
  { from: 'ord', to: 'db', label: 'ciphertext only' },
];

// Step 6: STRIDE walk, shown as a sequence of questions asked at each entry point.
const A6: SeqActor[] = [
  { id: 'edge', label: 'Edge', kind: 'cdn' },
  { id: 'svc', label: 'Service', kind: 'service' },
  { id: 'data', label: 'Data store', kind: 'db' },
];
const stride: SeqMessage[] = [
  { from: 'edge', to: 'svc', label: 'S: is caller who it says?' },
  { from: 'edge', to: 'svc', label: 'T: can it be altered?' },
  { from: 'svc', to: 'data', label: 'R: is the action logged?' },
  { from: 'data', to: 'svc', label: 'I: what could leak?', dashed: true },
  { from: 'edge', to: 'svc', label: 'D: what if 10x floods it?' },
  { from: 'svc', to: 'data', label: 'E: least privilege held?' },
];

export default defineLesson('sequence', {
  slug: 'security-architecture',
  objectives: [
    { text: 'Authentication vs authorization, and why both are needed', step: 1 },
    { text: 'The OAuth authorization code flow with PKCE', step: 2 },
    { text: 'How to validate and limit tokens', step: 3 },
    { text: 'Defence in depth: policy, mTLS, envelope encryption, STRIDE', step: 4 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Logged in is not allowed',
      tag: 'problem',
      body: [
        '**Authentication** says who you are. **Authorization** says what you may do. The API here knows the caller but never checks whether order 7 is theirs.',
        'This broken object-level authorization is among the most common real vulnerabilities.',
      ],
      keyIdea: 'Check permission on the server for every request. Client-side checks are only user experience.',
      frames: [{ state: seq(A1, noCheck, [{ label: 'Authenticated', value: 'yes', tone: 'ok' }, { label: 'Authorized', value: 'never checked', tone: 'bad' }, { label: 'Leak', value: "A's order", tone: 'bad' }], { text: 'a valid login exposed another user\'s data', tone: 'bad' }, 4) }],
    },
    {
      label: 'OAuth + PKCE',
      title: 'Delegate login safely',
      tag: 'technique',
      body: [
        'For browser and mobile apps use the **authorization code flow with PKCE**. The app proves it started the flow with a one-time verifier, so a stolen code is useless.',
        '**OAuth 2.0** delegates access. **OpenID Connect** adds identity on top as an ID token.',
      ],
      keyIdea: 'Never put the password in your app. The identity provider authenticates, your API only sees tokens.',
      frames: [2, 4, 6].map((n) => ({ state: seq(A2, pkce.slice(0, n), [{ label: 'Flow', value: 'code + PKCE' }, { label: 'Tokens', value: n >= 4 ? 'issued' : 'pending', tone: n >= 4 ? 'ok' : 'neutral' }, { label: 'API sees', value: n >= 6 ? 'Bearer token' : '-' }], undefined, 2), hold: 2300 })),
    },
    {
      label: 'Tokens',
      title: 'Validate every time, keep them short',
      tag: 'technique',
      body: [
        'A **JWT** cannot be revoked before it expires, so keep access tokens short-lived and rotate refresh tokens.',
        'Validate signature, algorithm, issuer, audience and expiry on every call. Never accept `alg: none`. The payload is only encoded, so keep secrets out of it.',
      ],
      keyIdea: 'Short lifetime limits what a stolen token can do. Rotation limits the refresh token.',
      frames: [2, 4, 6, 8].map((n) => ({ state: seq(A3, tokens.slice(0, n), [{ label: 'Access token', value: '10 min' }, { label: 'Forged', value: n >= 4 ? 'rejected' : '-', tone: n >= 4 ? 'ok' : 'neutral' }, { label: 'Stolen', value: n >= 6 ? 'expired' : '-', tone: n >= 6 ? 'ok' : 'neutral' }], undefined, 2), hold: 2200 })),
    },
    {
      label: 'Authorize',
      title: 'A policy decision per request',
      tag: 'technique',
      body: [
        'Choose a model: **RBAC** (roles), **ABAC** (attributes and policy) or **ReBAC** (relationships, as in Zanzibar style systems).',
        'Enforce it in a central policy layer and again at the data layer, for example `WHERE owner = caller`. Two layers survive one bug.',
      ],
      keyIdea: 'Deny by default. The API asks "may this caller do this to that object?" before touching data.',
      frames: [{ state: seq(A4, authz, [{ label: 'Model', value: 'ReBAC / ABAC' }, { label: 'Decision', value: 'deny', tone: 'bad' }, { label: 'Data touched', value: 'none', tone: 'ok' }], undefined, 4), hold: 2600 }, { state: seq(A4, authzOk, [{ label: 'Model', value: 'ReBAC / ABAC' }, { label: 'Decision', value: 'allow', tone: 'ok' }, { label: 'Query', value: 'owner scoped', tone: 'ok' }], undefined, 5) }],
    },
    {
      label: 'Inside',
      title: 'Trust no network position',
      tag: 'technique',
      body: [
        'Services prove who they are with **mTLS** and short-lived certificates, from a service mesh or SPIFFE. Give each service the least IAM it needs.',
        'Encrypt data in transit and at rest. **Envelope encryption** keeps data keys in a KMS, so the database only ever holds ciphertext. Secrets live in a vault, never in code or images.',
      ],
      keyIdea: 'Assume an attacker gets inside the network. Identity and encryption must not depend on where a packet came from.',
      frames: [2, 5].map((n) => ({ state: seq(A5, inside.slice(0, n), [{ label: 'Transport', value: 'mTLS', tone: 'ok' }, { label: 'Cert life', value: '1 hour' }, { label: 'At rest', value: n >= 5 ? 'envelope' : '-', tone: n >= 5 ? 'ok' : 'neutral' }], undefined, n === 2 ? 2 : 3), hold: 2600 })),
    },
    {
      label: 'Threat model',
      title: 'Ask STRIDE at every entry point',
      tag: 'in practice',
      body: [
        'For each entry point and data store walk the six questions: spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege.',
        'For each, name the control that exists. A gap is a design bug, found cheaply.',
      ],
      keyIdea: 'Layered controls: edge (WAF, rate limits), network, service identity, data encryption, audit logs, privacy limits.',
      frames: [2, 4, 6].map((n) => ({ state: seq(A6, stride.slice(0, n), [{ label: 'Method', value: 'STRIDE' }, { label: 'Asked', value: `${n} of 6` }, { label: 'Output', value: 'gaps found' }], undefined, 2), hold: 2200 })),
    },
    {
      label: 'Recap',
      title: 'Defence in depth',
      tag: 'recap',
      body: [
        '- **AuthN vs AuthZ:** who you are, then what you may do. Check both on the server.',
        '- **Login:** authorization code flow with PKCE via an identity provider.',
        '- **Tokens:** short-lived, validated fully on every call, refresh tokens rotated.',
        '- **Permissions:** deny by default, central policy plus a data-layer check.',
        '- **Services and data:** mTLS, least-privilege IAM, envelope encryption, secrets in a vault.',
        '- **Always:** edge protection, immutable audit logs, STRIDE per entry point, privacy limits.',
      ],
      keyIdea: 'No single control is enough. Layers make one mistake survivable.',
      frames: [{ state: seq(A4, authzOk, [], undefined, 5) }],
    },
  ],
});
