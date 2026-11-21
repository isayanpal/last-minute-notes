import { defineLesson } from '../define';
import type { GraphEdge, GraphNode, GraphState } from '../engines/graph';

/*
 * The graph here is the accessibility tree a screen reader sees, not the DOM.
 * Labels stay under 7 characters (the box is small), the role or name goes in the tag below.
 */

const box = (id: string, label: string, x: number, y: number, tag?: string, state: GraphNode['state'] = 'normal'): GraphNode => ({ id, label, x, y, tag, state, shape: 'box' });
const edges = (...pairs: [string, string][]): GraphEdge[] => pairs.map(([from, to]) => ({ from, to }));

// Step 1: div soup. The tree exists, but says nothing.
const SOUP: GraphState = {
  nodes: [
    box('r', 'page', 5, 0.3, undefined, 'visited'),
    box('a', 'div', 1.8, 2.1, 'no role', 'bad'),
    box('b', 'div', 5, 2.1, 'no role', 'bad'),
    box('c', 'div', 8.2, 2.1, 'no role', 'bad'),
    box('a1', 'div', 0.9, 4.2, 'click only', 'bad'),
    box('a2', 'div', 2.8, 4.2, 'click only', 'bad'),
    box('c1', 'div', 8.2, 4.2, 'no name', 'bad'),
  ],
  edges: edges(['r', 'a'], ['r', 'b'], ['r', 'c'], ['a', 'a1'], ['a', 'a2'], ['c', 'c1']),
  pointers: [{ node: 'r', label: 'screen reader', tone: 'bad', up: false }],
  stats: [
    { label: 'Landmarks', value: '0', tone: 'bad' },
    { label: 'Keyboard', value: 'clicks only', tone: 'bad' },
    { label: 'Names', value: 'missing', tone: 'bad' },
  ],
  note: { text: 'looks fine on screen, says nothing to assistive tech', tone: 'bad' },
};

// Step 2: semantics first. Native elements bring role, keyboard and focus.
const SEMANTIC: GraphState = {
  nodes: [
    box('r', 'html', 5, 0.3, 'lang="en"', 'visited'),
    box('n', 'nav', 1.8, 2.1, 'navigation', 'done'),
    box('m', 'main', 5, 2.1, 'main', 'done'),
    box('f', 'footer', 8.2, 2.1, 'contentinfo', 'done'),
    box('h', 'h1', 3.6, 4.2, 'heading 1', 'done'),
    box('b', 'button', 6.4, 4.2, 'button, Tab + Enter', 'done'),
  ],
  edges: edges(['r', 'n'], ['r', 'm'], ['r', 'f'], ['m', 'h'], ['m', 'b']),
  stats: [
    { label: 'Roles', value: 'free', tone: 'ok' },
    { label: 'Keyboard', value: 'free', tone: 'ok' },
    { label: 'ARIA needed', value: 'no', tone: 'ok' },
  ],
  note: { text: 'button, a, nav, main, h1, label: use them before ARIA', tone: 'ok' },
};

// Step 3: every control needs an accessible name.
const names = (fixed: boolean): GraphState => ({
  nodes: [
    box('f', 'form', 5, 0.3, undefined, 'visited'),
    box('i', 'input', 2, 2.4, fixed ? 'label: Email' : 'name: (none)', fixed ? 'done' : 'bad'),
    box('b', 'button', 5, 2.4, fixed ? 'aria-label: Close' : 'name: (none)', fixed ? 'done' : 'bad'),
    box('g', 'img', 8, 2.4, fixed ? 'alt="" decorative' : 'alt missing', fixed ? 'done' : 'bad'),
    box('e', 'error', 3.5, 4.5, fixed ? 'aria-describedby' : 'colour only', fixed ? 'done' : 'bad'),
  ],
  edges: edges(['f', 'i'], ['f', 'b'], ['f', 'g'], ['i', 'e']),
  stats: [
    { label: 'Named controls', value: fixed ? '3 / 3' : '0 / 3', tone: fixed ? 'ok' : 'bad' },
    { label: 'Contrast', value: '4.5:1 text' },
    { label: 'State', value: 'not by colour' },
  ],
  note: fixed ? { text: 'visible label, aria-label or aria-labelledby for each control', tone: 'ok' } : { text: 'a screen reader announces just "button"', tone: 'bad' },
});

// Step 4: focus management around a modal dialog.
const modal = (phase: 'closed' | 'open' | 'returned'): GraphState => {
  const open = phase === 'open';
  return {
    nodes: [
      box('p', 'page', 5, 0.3, undefined, 'visited'),
      box('m', 'main', 2.2, 2.4, open ? 'inert' : undefined, open ? 'dim' : 'done'),
      box('t', 'open', 2.2, 4.5, 'trigger button', open ? 'dim' : 'active'),
      box('d', 'dialog', 7.2, 2.4, 'aria-labelledby', open ? 'active' : 'dim'),
      box('ok', 'save', 6.0, 4.5, 'first control', open ? 'found' : 'dim'),
      box('x', 'close', 8.4, 4.5, 'Esc also closes', open ? 'done' : 'dim'),
    ],
    edges: edges(['p', 'm'], ['p', 'd'], ['m', 't'], ['d', 'ok'], ['d', 'x']),
    pointers: [{ node: open ? 'ok' : 't', label: 'focus', tone: 'accent', up: true }],
    stats: [
      { label: 'Dialog', value: open ? 'showModal()' : 'closed', tone: open ? 'ok' : 'neutral' },
      { label: 'Background', value: open ? 'inert' : 'active' },
      { label: 'Focus', value: phase === 'open' ? 'inside' : 'on trigger', tone: 'ok' },
    ],
    note: open ? { text: 'focus moves in, cannot escape, background is inert', tone: 'ok' } : phase === 'returned' ? { text: 'on close, focus returns to the trigger', tone: 'ok' } : { text: 'native dialog gives focus trap, Esc and backdrop', tone: 'accent' },
  };
};

// Step 5: a combobox, the typeahead pattern.
const combo = (active: number | null, expanded: boolean): GraphState => ({
  nodes: [
    box('i', 'input', 5, 0.5, expanded ? 'combobox, expanded' : 'combobox, collapsed', 'active'),
    ...(expanded
      ? [
          box('l', 'list', 5, 2.4, 'listbox', 'visited'),
          box('o1', 'opt', 2.6, 4.5, 'option', active === 0 ? 'found' : 'normal'),
          box('o2', 'opt', 5, 4.5, 'option', active === 1 ? 'found' : 'normal'),
          box('o3', 'opt', 7.4, 4.5, 'option', active === 2 ? 'found' : 'normal'),
        ]
      : []),
  ],
  edges: expanded ? edges(['i', 'l'], ['l', 'o1'], ['l', 'o2'], ['l', 'o3']) : [],
  pointers: [{ node: 'i', label: 'focus stays here', tone: 'accent', up: true }, ...(active !== null ? [{ node: `o${active + 1}`, label: 'activedescendant', tone: 'ok' as const, up: true }] : [])],
  stats: [
    { label: 'aria-expanded', value: expanded ? 'true' : 'false', tone: expanded ? 'ok' : 'neutral' },
    { label: 'Keys', value: 'arrows, Enter' },
    { label: 'Live region', value: expanded ? '3 results' : '-' },
  ],
  note: { text: 'focus never leaves the input, so typing continues', tone: 'accent' },
});

// Step 6: i18n. Plural rules differ by language, so a message is a tree of cases.
const plural = (lang: 'en' | 'pl' | 'ar'): GraphState => {
  const cases: Record<'en' | 'pl' | 'ar', [string, string][]> = {
    en: [['one', '1 item'], ['other', '5 items']],
    pl: [['one', '1'], ['few', '2 to 4'], ['many', '5+'], ['other', '1.5']],
    ar: [['zero', '0'], ['one', '1'], ['two', '2'], ['few', '3 to 10'], ['many', '11+'], ['other', '100']],
  };
  const list = cases[lang];
  const xs = list.map((_, i) => (list.length === 1 ? 5 : 0.8 + (i * 8.4) / (list.length - 1)));
  return {
    nodes: [box('c', 'count', 5, 0.6, 'plural rules', 'active'), ...list.map(([k, tag], i) => box(`k${i}`, k, xs[i], 3.6, tag, 'done'))],
    edges: list.map((_, i) => ({ from: 'c', to: `k${i}` })),
    stats: [
      { label: 'Language', value: lang === 'en' ? 'English' : lang === 'pl' ? 'Polish' : 'Arabic' },
      { label: 'Plural forms', value: String(list.length), tone: list.length > 2 ? 'bad' : 'ok' },
      { label: 'API', value: 'Intl.Plural', tone: 'ok' },
    ],
    note: lang === 'en' ? { text: '{count, plural, one {# item} other {# items}}', tone: 'accent' } : { text: 'more forms than English: never concatenate strings', tone: 'bad' },
  };
};

export default defineLesson('graph', {
  slug: 'fe-accessibility-i18n',
  objectives: [
    { text: 'Why native semantics beat ARIA', step: 2 },
    { text: 'Accessible names, contrast and not relying on colour', step: 3 },
    { text: 'Focus management for modals', step: 4 },
    { text: 'The combobox keyboard and ARIA model', step: 5 },
    { text: 'Why i18n is more than translating strings', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'It looks right, it reads as nothing',
      tag: 'problem',
      body: ['Assistive tech reads an **accessibility tree** built from your DOM. A page of plain `div` elements gives that tree no roles, no names and no keyboard behavior.', 'Accessibility means people with disabilities can perceive, operate and understand the product. The target is usually **WCAG 2.2 AA**.'],
      keyIdea: 'WCAG is organized by POUR: Perceivable, Operable, Understandable, Robust.',
      frames: [{ state: SOUP, hold: 3200 }],
    },
    {
      label: 'Semantics',
      title: 'Native elements first',
      tag: 'technique',
      body: ['Use `button`, `a`, `nav`, `main`, `h1`, `ul`, `label` and `table` before reaching for ARIA. They bring role, keyboard and focus for free.', 'Set `lang` on the `html` element. Add a skip link to the main content.'],
      keyIdea: '"No ARIA is better than bad ARIA." A `div role="button"` needs all the keyboard handling a `button` gives you.',
      frames: [{ state: SEMANTIC, hold: 3200 }],
    },
    {
      label: 'Names',
      title: 'Every control needs a name',
      tag: 'technique',
      body: ['Controls get a name from a visible `label`, `aria-label` or `aria-labelledby`. Images get meaningful `alt`, or empty `alt` when decorative.', 'Link errors with `aria-describedby`, and never use colour alone to convey state. Text needs 4.5:1 contrast.'],
      keyIdea: 'Announce dynamic updates with live regions: `polite` for status, `role="alert"` for urgent errors.',
      frames: [{ state: names(false), hold: 2400 }, { state: names(true), hold: 3200 }],
    },
    {
      label: 'Focus',
      title: 'Move focus on purpose',
      tag: 'technique',
      body: ['Use the native `dialog` with `showModal()`: it traps focus, handles `Esc`, draws the backdrop and makes the background inert.', 'Focus goes into the dialog on open and returns to the trigger on close. After a route change, move focus to the heading.'],
      keyIdea: 'Never remove the focus outline without a replacement, and never create a keyboard trap.',
      frames: [{ state: modal('closed'), hold: 1800 }, { state: modal('open'), hold: 2800 }, { state: modal('returned'), hold: 2400 }],
    },
    {
      label: 'Combobox',
      title: 'A typeahead, announced properly',
      tag: 'in practice',
      body: ['The input has `role="combobox"` with `aria-expanded`, `aria-controls` and `aria-activedescendant`. Options use `role="option"` and `aria-selected`.', 'Arrow keys move the highlight, `Enter` selects, `Esc` closes. A live region announces the result count.'],
      keyIdea: 'Focus stays in the input. The highlight is a pointer, not real focus.',
      frames: [{ state: combo(null, false), hold: 1400 }, { state: combo(0, true), hold: 1500 }, { state: combo(1, true), hold: 1500 }, { state: combo(2, true), hold: 2400 }],
    },
    {
      label: 'i18n',
      title: 'Language is more than words',
      tag: 'trade-off',
      body: ['Externalize strings and use ICU MessageFormat. English has two plural forms, Polish has four and Arabic six, so never build sentences by concatenation.', 'Also: `Intl` for dates, numbers and currency, logical CSS for RTL, and room for text 30 to 40 percent longer.'],
      keyIdea: 'Store time in UTC, show it in the user\'s zone, and test with pseudo-localization before real translations exist.',
      frames: [{ state: plural('en'), hold: 1800 }, { state: plural('pl'), hold: 2200 }, { state: plural('ar'), hold: 2600 }],
    },
    {
      label: 'Recap',
      title: 'Build it in, do not bolt it on',
      tag: 'recap',
      body: [
        '- **Semantics first,** ARIA only when no native element exists.',
        '- **Keyboard:** everything operable, visible focus, logical order, no traps.',
        '- **Names and contrast:** a name for every control, 4.5:1 text, not colour alone.',
        '- **Test:** axe in CI (about a third of issues), keyboard pass, screen reader pass.',
        '- **i18n:** ICU messages, `Intl`, logical CSS, `hreflang`, pseudo-localization.',
      ],
      keyIdea: 'Fold a11y and i18n into the component design and the design system\'s definition of done.',
      frames: [{ state: SEMANTIC, hold: 3200 }],
    },
  ],
});
