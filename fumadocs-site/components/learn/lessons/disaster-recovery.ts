import { defineLesson } from '../define';
import type { TimelineState } from '../engines/timeline';

const base = (over: Partial<TimelineState>): TimelineState => ({
  from: -6,
  to: 6,
  unit: 'h',
  ticks: [-6, -4, -2, 0, 2, 4, 6],
  lanes: [],
  ...over,
});

const backup = { id: 'b', from: -4.2, to: -4, label: 'last backup', tone: 'ok' as const };

export default defineLesson('timeline', {
  slug: 'disaster-recovery',
  objectives: [
    { text: 'RPO: how much data you can lose', step: 2 },
    { text: 'RTO: how long you can be down', step: 3 },
    { text: 'Match a recovery strategy to the targets', step: 4 },
    { text: 'Why untested backups are only hypotheses', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Something big will fail',
      tag: 'problem',
      body: ['A region goes down, a bad migration corrupts data, or ransomware encrypts everything.', 'Two numbers drive every recovery plan: how much data you can lose, and how long you can be down.'],
      keyIdea: 'Decide the targets first. Then pick the cheapest strategy that meets them.',
      frames: [{ state: base({ lanes: [{ label: 'service', bars: [{ id: 'up', from: -6, to: 0, label: 'running', tone: 'ok' }, { id: 'down', from: 0, to: 6, label: 'disaster', tone: 'bad' }] }], markers: [{ at: 0, label: 'disaster', tone: 'bad' }] }) }],
    },
    {
      label: 'RPO',
      title: 'Recovery Point Objective',
      tag: 'concept',
      body: ['**RPO** is how far back in time you may lose data. It is the gap between the last good backup and the disaster.', 'Nightly backups mean up to a day of lost writes. Continuous log archiving shrinks the gap to seconds.'],
      keyIdea: 'RPO is set by backup frequency. Smaller RPO means more backup cost.',
      frames: [{ state: base({ lanes: [{ label: 'data', bars: [{ id: 'safe', from: -6, to: -4, label: 'safe', tone: 'ok' }, { id: 'lost', from: -4, to: 0, label: 'lost: RPO = 4h', tone: 'bad' }] }, { label: 'backups', bars: [backup] }], markers: [{ at: -4, label: 'last backup', tone: 'ok' }, { at: 0, label: 'disaster', tone: 'bad' }] }) }],
    },
    {
      label: 'RTO',
      title: 'Recovery Time Objective',
      tag: 'concept',
      body: ['**RTO** is how long the service may stay down. It is the time from the disaster until users are served again.', 'It depends on how much has to be rebuilt: servers, data, DNS, secrets, and people deciding to fail over.'],
      keyIdea: 'RTO is set by how ready the standby is. Smaller RTO means paying for a warmer standby.',
      frames: [{ state: base({ lanes: [{ label: 'data', bars: [{ id: 'safe', from: -6, to: -4, label: 'safe', tone: 'ok' }, { id: 'lost', from: -4, to: 0, label: 'RPO 4h', tone: 'bad' }] }, { label: 'service', bars: [{ id: 'up', from: -6, to: 0, tone: 'ok' }, { id: 'down', from: 0, to: 2, label: 'down: RTO = 2h', tone: 'bad' }, { id: 'back', from: 2, to: 6, label: 'restored', tone: 'ok' }] }], markers: [{ at: 0, label: 'disaster', tone: 'bad' }, { at: 2, label: 'recovered', tone: 'ok' }] }) }],
    },
    {
      label: 'Strategies',
      title: 'Slower and cheaper, or faster and dearer',
      tag: 'trade-off',
      body: ['Strategies ladder up: **backup and restore**, **pilot light**, **warm standby**, **active-active**.', 'Each step costs more and shortens the downtime. Bars below are illustrative, not measured.'],
      keyIdea: 'Match strategy to targets. A 99.99% service cannot rely on restoring from tape.',
      frames: [{ state: base({ from: 0, to: 10, unit: '', ticks: [0, 2, 4, 6, 8, 10], lanes: [{ label: 'backup+restore', bars: [{ id: 's1', from: 0, to: 9, label: 'longest downtime', tone: 'bad' }] }, { label: 'pilot light', bars: [{ id: 's2', from: 0, to: 6, label: 'core only, scale up', tone: 'data' }] }, { label: 'warm standby', bars: [{ id: 's3', from: 0, to: 3, label: 'scaled-down copy', tone: 'info' }] }, { label: 'active-active', bars: [{ id: 's4', from: 0, to: 0.6, label: 'near zero', tone: 'ok' }] }], note: { text: 'cost rises as downtime falls (illustrative)', tone: 'accent' } }) }],
    },
    {
      label: 'Safe copies',
      title: 'The 3-2-1 rule',
      tag: 'technique',
      body: ['Keep **3** copies, on **2** kinds of media, with **1** offsite in another account and region.', 'Make backups immutable and access-separated, so ransomware or a compromised admin cannot delete them. Add point-in-time recovery for databases.'],
      keyIdea: 'Point-in-time recovery is a base backup plus a continuous log archive, so you can restore to just before the mistake.',
      frames: [{ state: base({ lanes: [{ label: 'primary', bars: [{ id: 'c1', from: -6, to: 6, label: 'copy 1: live data', tone: 'info' }] }, { label: 'local backup', bars: [{ id: 'c2', from: -6, to: 6, label: 'copy 2: other media', tone: 'ok' }] }, { label: 'offsite', bars: [{ id: 'c3', from: -6, to: 6, label: 'copy 3: other region, immutable', tone: 'violet' }] }, { label: 'WAL archive', bars: [{ id: 'c4', from: -6, to: 6, label: 'continuous log for PITR', tone: 'data' }] }], note: { text: 'one failure cannot take every copy', tone: 'ok' } }) }],
    },
    {
      label: 'Recap',
      title: 'Test your restores',
      tag: 'recap',
      body: [
        '- **RPO** is data you can lose. **RTO** is time you can be down.',
        '- **3-2-1** copies, immutable, offsite, with point-in-time recovery.',
        '- **Test restores.** A backup you have not restored is a hypothesis. Measure real RTO and RPO.',
        '- **Game days:** kill instances, add latency, fail a zone, and check alerts and runbooks.',
        '- **Evacuation runbook:** DNS, secrets, config, data residency, and who decides to fail over.',
      ],
      keyIdea: 'Practice recovery before you need it. The first restore should never be during the real incident.',
      frames: [{ state: base({ lanes: [{ label: 'quarterly test', bars: [{ id: 't', from: -6, to: -4, label: 'restore drill', tone: 'ok' }, { id: 'm', from: -4, to: -3, label: 'measured', tone: 'info' }] }, { label: 'real disaster', bars: [{ id: 'r', from: 0, to: 1.2, label: 'known RTO', tone: 'ok' }] }], markers: [{ at: 0, label: 'disaster', tone: 'bad' }] }) }],
    },
  ],
});
