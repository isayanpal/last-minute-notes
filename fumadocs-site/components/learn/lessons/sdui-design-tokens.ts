import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the SDUI notes on design tokens: a payload that names a token ("spacing: medium") lets the client theme decide the value per platform, while raw
 * values (padding: 17, fontSize: 19) turn the backend into a remote CSS engine. The theme values are EXAMPLES. The token resolution, the count of distinct
 * values, and the number of components changed by one theme edit are computed from real data.
 */

type Platform = 'web' | 'ios';
const THEME: Record<Platform, { spacing: Record<string, number>; radius: Record<string, number> }> = {
  web: { spacing: { small: 8, medium: 16, large: 24 }, radius: { small: 4, medium: 8, large: 12 } },
  ios: { spacing: { small: 8, medium: 16, large: 24 }, radius: { small: 4, medium: 10, large: 16 } },
};
const resolve = (p: Platform, kind: 'spacing' | 'radius', token: string) => THEME[p][kind][token];
const TOKENS = ['small', 'medium', 'large'];

const RAW = [{ padding: 17 }, { margin: 23 }, { borderRadius: 9 }, { fontSize: 19 }];
const RAW_VALUES = RAW.map((r) => Object.values(r)[0]);
const RAW_DISTINCT = new Set(RAW_VALUES).size;

// 60 components in a screen tree, each using one spacing token
const COMPONENTS = Array.from({ length: 60 }, (_, i) => ({ id: i, spacing: TOKENS[i % 3] }));
const usingMedium = COMPONENTS.filter((c) => c.spacing === 'medium').length;
const mediumNow = resolve('web', 'spacing', 'medium');
const mediumAfter = 18; // a rebrand changes one theme value

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const raw = (): ArrayState => ({
  rows: [{ label: 'raw value', cells: RAW_VALUES, states: paint(4, () => 'bad'), pointers: [{ i: 0, label: 'padding' }, { i: 1, label: 'margin' }, { i: 2, label: 'radius' }, { i: 3, label: 'font' }], showIndex: false }],
  stats: [
    { label: 'Raw payload', value: '4 properties' },
    { label: 'Distinct values', value: String(RAW_DISTINCT), tone: 'bad' },
    { label: 'Consistent', value: 'no', tone: 'bad' },
  ],
  note: { text: '17, 23, 9, 19: every number is a one-off, a sign you built a remote CSS engine by accident', tone: 'bad' },
});

const tokens = (): ArrayState => ({
  rows: [{ label: 'spacing', cells: TOKENS.map((t) => resolve('web', 'spacing', t)), states: paint(3, () => 'found'), pointers: TOKENS.map((t, i) => ({ i, label: t })), showIndex: false }],
  stats: [
    { label: 'Payload says', value: 'medium' },
    { label: 'Values allowed', value: '3', tone: 'ok' },
    { label: 'Raw values', value: 'none', tone: 'ok' },
  ],
  note: { text: 'the payload names a token and the theme decides the number: only three spacings exist', tone: 'ok' },
});

const platforms = (): ArrayState => ({
  rows: [
    { label: 'web px', cells: TOKENS.map((t) => resolve('web', 'radius', t)), states: paint(3, () => 'visited'), pointers: TOKENS.map((t, i) => ({ i, label: t })), showIndex: false },
    { label: 'ios pt', cells: TOKENS.map((t) => resolve('ios', 'radius', t)), states: paint(3, (i) => (resolve('ios', 'radius', TOKENS[i]) !== resolve('web', 'radius', TOKENS[i]) ? 'swap' : 'visited')), showIndex: false },
  ],
  stats: [
    { label: 'Token', value: 'radius: large' },
    { label: 'Web resolves', value: `${resolve('web', 'radius', 'large')} px` },
    { label: 'iOS resolves', value: `${resolve('ios', 'radius', 'large')} pt`, tone: 'ok' },
  ],
  note: { text: 'the same token resolves differently per platform, so one payload fits both', tone: 'ok' },
});

const retheme = (after: boolean): ArrayState => ({
  rows: [{ label: 'medium', cells: [after ? mediumAfter : mediumNow], states: { 0: after ? 'swap' : 'visited' }, showIndex: false }, { label: 'updated', cells: [after ? usingMedium : 0], states: { 0: after ? 'found' : 'dim' }, showIndex: false }],
  stats: [
    { label: 'Theme edits', value: after ? '1' : '0' },
    { label: 'Components', value: after ? `${usingMedium} updated` : `${usingMedium} use it`, tone: after ? 'ok' : 'neutral' },
    { label: 'Payload edits', value: '0', tone: 'ok' },
  ],
  note: after ? { text: `one theme value changed 16 to ${mediumAfter} and ${usingMedium} components followed, with no payload change`, tone: 'ok' } : { text: `${usingMedium} of ${COMPONENTS.length} components use the medium spacing token`, tone: 'accent' },
});

export default defineLesson('array', {
  slug: 'sdui-design-tokens',
  objectives: [
    { text: 'Why raw style values are a trap', step: 1 },
    { text: 'What a token gives you', step: 2 },
    { text: 'How one token resolves per platform', step: 3 },
    { text: 'How one theme edit changes many components', step: 4 },
  ],
  steps: [
    {
      label: 'Raw styles',
      title: 'padding: 17',
      tag: 'problem',
      body: ['If the payload carries `padding: 17`, `margin: 23`, `borderRadius: 9` and `fontSize: 19`, every screen invents its own numbers.', 'The backend team ends up specifying shadows and font sizes per component.'],
      keyIdea: 'That is a remote CSS engine built by accident.',
      frames: [{ state: raw(), hold: 4400 }],
    },
    {
      label: 'Tokens',
      title: 'Name, do not number',
      tag: 'concept',
      body: ['Send `spacing: "medium"`, `radius: "large"`, `textStyle: "heading2"`. The client theme resolves them.', 'Only a handful of values can ever appear on screen.'],
      keyIdea: 'Prefer predefined layouts and components over arbitrary styling.',
      frames: [{ state: tokens(), hold: 4200 }],
    },
    {
      label: 'Per platform',
      title: 'One name, several values',
      tag: 'technique',
      body: ['The theme decides what `large` means on each platform. Here the radius is 12 on web and 16 on iOS.', 'The payload stays the same for both.'],
      keyIdea: 'The schema expresses intent, the platform picks the pixels.',
      frames: [{ state: platforms(), hold: 4400 }],
    },
    {
      label: 'Rebrand',
      title: 'One edit, everywhere',
      tag: 'in practice',
      body: ['A rebrand changes the `medium` spacing from 16 to 18 in the theme.', 'Every component that uses the token follows, with no payload change and no server deploy.'],
      keyIdea: 'Tokens turn a global change into a single edit.',
      frames: [{ state: retheme(false), hold: 2800 }, { state: retheme(true), hold: 4200 }],
    },
    {
      label: 'Recap',
      title: 'Design tokens',
      tag: 'recap',
      body: [
        '- **Raw values:** inconsistent, a remote CSS engine.',
        '- **Tokens:** names the client resolves.',
        '- **Platforms:** one token, different values.',
        '- **Theme edit:** changes every user of a token.',
        '- **Layouts:** keep the layout language bounded.',
      ],
      keyIdea: 'The registry plus tokens is your design system, made executable.',
      frames: [{ state: tokens() }],
    },
  ],
});
