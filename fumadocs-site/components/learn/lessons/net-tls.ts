import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Follows the notes: TLS 1.3 is a 1-RTT handshake with ECDHE (X25519), forward secrecy is mandatory,
 * the server proves identity with Certificate + CertificateVerify, the client validates chain, dates and hostname.
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
const duo = (c?: string, s?: string, cTone: Tone = 'accent', sTone: Tone = 'accent'): SeqActor[] => [
  { id: 'c', label: 'Browser', kind: 'client', badge: c ? { text: c, tone: cTone } : undefined },
  { id: 's', label: 'Server', kind: 'service', badge: s ? { text: s, tone: sTone } : undefined },
];

// Step 1: on plain HTTP anyone on the path reads and edits everything.
const WIRE: SeqActor[] = [
  { id: 'c', label: 'Browser', kind: 'client' },
  { id: 'm', label: 'On-path attacker', kind: 'external' },
  { id: 's', label: 'Server', kind: 'service' },
];
const problemFrames = reveal(WIRE, [
  {
    msgs: [{ from: 'c', to: 's', label: 'POST /login pw=hunter2' }, { from: 'm', to: 'm', label: 'reads the password', tone: 'bad' }],
    hold: 2200,
    stats: [
      { label: 'Plain HTTP', value: 'readable', tone: 'bad' },
      { label: 'Tampering', value: 'undetected', tone: 'bad' },
      { label: 'Server identity', value: 'unproven', tone: 'bad' },
    ],
  },
  {
    msgs: [{ from: 'm', to: 'c', label: 'forged page', tone: 'bad', dashed: true }],
    hold: 2400,
    stats: [
      { label: 'Goal 1', value: 'secrecy' },
      { label: 'Goal 2', value: 'integrity' },
      { label: 'Goal 3', value: 'authentication' },
    ],
    note: { text: 'TLS adds all three on top of TCP or QUIC', tone: 'accent' },
  },
]);

// Step 2: key exchange derives a shared secret that is never sent.
const kxStats: Stat[] = [
  { label: 'Key exchange', value: 'ECDHE X25519' },
  { label: 'Secret', value: 'never sent', tone: 'ok' },
  { label: 'Bulk cipher', value: 'AES, ChaCha20' },
];
const kxFrames = reveal(duo(), [
  { msgs: [{ from: 'c', to: 's', label: 'my public key share' }], hold: 1700, stats: kxStats },
  { msgs: [{ from: 's', to: 'c', label: 'my public key share', dashed: true }], hold: 1700, stats: kxStats },
  {
    msgs: [{ from: 'c', to: 'c', label: 'both derive a secret', tone: 'data' }],
    actors: duo('same keys', 'same keys', 'ok', 'ok'),
    hold: 2800,
    stats: kxStats,
    note: { text: 'ephemeral keys per session: a stolen server key cannot decrypt past traffic', tone: 'ok' },
  },
]);

// Step 3: the TLS 1.3 handshake, one round trip.
const hsStats = (rtt: string): Stat[] => [
  { label: 'Round trips', value: rtt, tone: 'ok' },
  { label: 'TLS 1.2', value: '2 RTT' },
  { label: 'After hello', value: 'encrypted' },
];
const handshakeFrames = reveal(duo(), [
  { msgs: [{ from: 'c', to: 's', label: 'ClientHello + key share' }], hold: 1900, stats: hsStats('0 so far'), note: { text: 'also sends SNI, ALPN and supported suites', tone: 'accent' } },
  { msgs: [{ from: 's', to: 'c', label: 'ServerHello + key share', dashed: true }], actors: duo('keys derived', 'keys derived', 'ok', 'ok'), hold: 1900, stats: hsStats('1'), note: { text: 'both sides now hold handshake keys', tone: 'ok' } },
  { msgs: [{ from: 's', to: 'c', label: 'Cert, Verify, Finished', dashed: true }], actors: duo('keys derived', 'keys derived', 'ok', 'ok'), hold: 1900, stats: hsStats('1') },
  { msgs: [{ from: 'c', to: 'c', label: 'validate chain + name', tone: 'data' }], actors: duo('keys derived', 'keys derived', 'ok', 'ok'), hold: 1700, stats: hsStats('1') },
  {
    msgs: [{ from: 'c', to: 's', label: 'Finished + GET /', tone: 'ok' }],
    actors: duo('encrypted', 'encrypted', 'ok', 'ok'),
    hold: 2800,
    stats: hsStats('1'),
    note: { text: 'the first request rides with the Finished message', tone: 'ok' },
  },
]);

// Step 4: how the browser decides to trust the certificate.
const TRUST: SeqActor[] = [
  { id: 'b', label: 'Browser', kind: 'client' },
  { id: 's', label: 'Server', kind: 'service' },
  { id: 't', label: 'Trust store', kind: 'db' },
];
const checkStats = (n: number): Stat[] => [
  { label: 'Checks done', value: `${n} of 4`, tone: n === 4 ? 'ok' : 'neutral' },
  { label: 'Chain', value: 'leaf to root' },
  { label: 'Hostname', value: 'must be in SAN' },
];
const trustFrames = reveal(TRUST, [
  { msgs: [{ from: 's', to: 'b', label: 'leaf + intermediate', dashed: true }], hold: 1800, stats: checkStats(0), note: { text: 'the server must send the intermediates', tone: 'accent' } },
  { msgs: [{ from: 'b', to: 't', label: 'chain ends at a root?' }, { from: 't', to: 'b', label: 'root is trusted', dashed: true, tone: 'ok' }], hold: 2000, stats: checkStats(1) },
  { msgs: [{ from: 'b', to: 'b', label: 'signatures + dates ok', tone: 'ok' }], hold: 1600, stats: checkStats(2) },
  { msgs: [{ from: 'b', to: 'b', label: 'hostname in SAN', tone: 'ok' }, { from: 'b', to: 's', label: 'CertificateVerify ok', tone: 'ok' }], hold: 2800, stats: checkStats(4), note: { text: 'the signature proves the server owns the key, not just a copy of the cert', tone: 'ok' } },
]);

// Step 5: mutual TLS. The client also proves who it is.
const SVC: SeqActor[] = [
  { id: 'a', label: 'Service A', kind: 'service' },
  { id: 'b', label: 'Service B', kind: 'service' },
];
const mtlsStats: Stat[] = [
  { label: 'Both sides', value: 'present certs' },
  { label: 'Issued by', value: 'private CA' },
  { label: 'Used for', value: 'zero trust' },
];
const mtlsFrames = reveal(SVC, [
  { msgs: [{ from: 'a', to: 'b', label: 'ClientHello' }, { from: 'b', to: 'a', label: 'server cert + request', dashed: true }], hold: 2000, stats: mtlsStats },
  { msgs: [{ from: 'a', to: 'b', label: 'client cert + Finished' }, { from: 'b', to: 'b', label: 'verify', tone: 'ok' }], hold: 2800, stats: mtlsStats, note: { text: 'service meshes (Istio, Linkerd) automate this', tone: 'ok' } },
]);

// Step 6: the usual failures, and what they mean.
const failFrames = (
  err: string,
  cause: string,
  fix: string,
): Frame<SeqState> => ({
  hold: 3000,
  state: {
    actors: duo('handshake failed', undefined, 'bad'),
    messages: [
      { from: 'c', to: 's', label: 'ClientHello' },
      { from: 's', to: 'c', label: 'Cert, Verify, Finished', dashed: true },
      { from: 'c', to: 'c', label: err, tone: 'bad' },
    ],
    fresh: 1,
    stats: [
      { label: 'Cause', value: cause },
      { label: 'Fix', value: fix, tone: 'ok' },
      { label: 'Debug', value: 's_client' },
    ],
    note: { text: 'curl -v and SSL Labs show the chain the server really sends', tone: 'accent' },
  },
});

export default defineLesson('sequence', {
  slug: 'net-tls',
  objectives: [
    { text: 'The three guarantees TLS adds to a connection', step: 1 },
    { text: 'How ECDHE derives a shared key without sending it', step: 2 },
    { text: 'The TLS 1.3 handshake in one round trip', step: 3 },
    { text: 'How a browser validates a certificate chain', step: 4 },
    { text: 'What mutual TLS adds for service-to-service calls', step: 5 },
    { text: 'The common handshake errors and their causes', step: 6 },
  ],
  steps: [
    {
      label: 'Problem',
      title: 'Plain HTTP is an open postcard',
      tag: 'problem',
      body: ['Anyone on the path can read and change plain traffic, and the client cannot tell the real server from a fake one.', 'TLS adds **confidentiality** (encryption), **integrity** (tamper detection) and **authentication** (a certificate).'],
      keyIdea: 'TLS is a layer between the transport and HTTP: the same HTTP, now safe on the wire.',
      frames: problemFrames,
    },
    {
      label: 'Key exchange',
      title: 'A shared secret nobody sends',
      tag: 'concept',
      body: ['Both sides send a public key share. With **ECDHE** each combines its own private value with the other share and derives the same secret.', 'That secret feeds fast symmetric encryption (AES-GCM, ChaCha20-Poly1305). Keys are ephemeral, which gives **forward secrecy**.'],
      keyIdea: 'Browsers now default to hybrid X25519MLKEM768 so today traffic is safe against future quantum decryption.',
      frames: kxFrames,
    },
    {
      label: 'Handshake',
      title: 'TLS 1.3 in one round trip',
      tag: 'technique',
      body: ['The client guesses the key exchange group and sends its key share in the first message, so the server can answer with keys, certificate and Finished in one flight.', 'TLS 1.2 needed 2 round trips and could use RSA key transport without forward secrecy.'],
      keyIdea: 'Resumption skips certificate work, and 0-RTT sends the request in the first flight at the price of replayability.',
      frames: handshakeFrames,
    },
    {
      label: 'Trust',
      title: 'Why the certificate is believed',
      tag: 'technique',
      body: ['A certificate binds a public key to names, signed by a CA. The client checks the chain up to a **root in its trust store**, the signatures, the dates and that the hostname is in the SAN list.', 'Wildcards cover one label: `*.example.com` matches `a.example.com`, not `a.b.example.com`.'],
      keyIdea: '**CertificateVerify** signs the handshake transcript with the private key, proving the server owns the cert.',
      frames: trustFrames,
    },
    {
      label: 'mTLS',
      title: 'Both sides prove who they are',
      tag: 'in practice',
      body: ['In **mutual TLS** the client also presents a certificate, usually issued by a private CA.', 'It is the standard way to authenticate services to each other in a zero-trust network.'],
      keyIdea: 'SNI puts the hostname in the ClientHello so one IP can serve many certificates. ECH is rolling out to encrypt it.',
      frames: mtlsFrames,
    },
    {
      label: 'Errors',
      title: 'Reading handshake failures',
      tag: 'in practice',
      body: ['`certificate has expired` means renewal failed. `unable to get local issuer certificate` usually means the server did not send the intermediate.', '`hostname mismatch` is a name not in the SAN or the wrong SNI. Expired certificates are a top cause of outages.'],
      keyIdea: 'Automate renewal with ACME and alert well before expiry. Public certificates are heading to 47-day lifetimes.',
      frames: [
        failFrames('certificate has expired', 'renewal failed', 'automate ACME'),
        failFrames('no local issuer cert', 'chain gap', 'full chain'),
        failFrames('hostname mismatch', 'not in SAN', 'fix SAN, SNI'),
      ],
    },
    {
      label: 'Recap',
      title: 'TLS in one page',
      tag: 'recap',
      body: [
        '- **Goals:** confidentiality, integrity, authentication.',
        '- **Key exchange:** ECDHE, ephemeral, forward secrecy.',
        '- **Handshake:** TLS 1.3 takes 1 RTT, 0-RTT is replayable.',
        '- **Trust:** chain to a root, dates, hostname in SAN.',
        '- **Operate:** automate renewals, terminate at the LB or CDN, use HSTS.',
      ],
      keyIdea: 'Most TLS incidents are operational (expiry, missing intermediate), not cryptographic.',
      frames: [handshakeFrames[handshakeFrames.length - 1]],
    },
  ],
});
