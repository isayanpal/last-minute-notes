import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import type * as PageTree from 'fumadocs-core/page-tree';
import { source } from '@/lib/source';

export type TreeItem = {
  id: string;
  title: string;
  description?: string;
  url?: string;
  icon?: string;
  pages: number;
  children?: TreeItem[];
};

// Curated order and short blurbs for the top-level branches. Anything not listed is appended.
const TOPICS: { slug: string; blurb: string }[] = [
  { slug: 'javascript', blurb: 'Async, event loop, closures, and tricky output questions.' },
  { slug: 'typescript', blurb: 'Advanced types, generics, utility types, and design patterns.' },
  { slug: 'react', blurb: 'Hooks, rendering, patterns, and performance.' },
  { slug: 'redux', blurb: 'Redux Toolkit, RTK Query, async flows, and state patterns.' },
  { slug: 'sdui', blurb: 'Architecture, component registries, versioning, React Native.' },
  { slug: 'sdlc', blurb: 'Process models, Agile, Scrum, Kanban, DevOps, and CI/CD.' },
  { slug: 'java', blurb: 'Core language, collections, streams, concurrency, and JVM.' },
  { slug: 'oops', blurb: 'Four pillars, SOLID principles, and design patterns.' },
  { slug: 'dsa', blurb: '14 interview patterns with templates and a playbook.' },
  { slug: 'backend', blurb: 'HTTP, APIs, auth, security, caching, queues, architecture, and deployment.' },
  { slug: 'databases', blurb: 'SQL, indexing, transactions, internals, NoSQL, sharding, and data modeling.' },
  { slug: 'system-design', blurb: 'HLD, LLD, case studies, machine coding, AI and frontend.' },
];

const asText = (node: ReactNode): string | undefined => (typeof node === 'string' ? node : undefined);

function build(node: PageTree.Node): TreeItem | null {
  if (node.type === 'page') {
    return {
      id: node.url,
      title: asText(node.name) ?? node.url,
      description: asText(node.description),
      url: node.url,
      pages: 1,
    };
  }
  if (node.type !== 'folder') return null;

  const title = asText(node.name) ?? '';
  const children = node.children.map(build).filter((c): c is TreeItem => c !== null);
  const index = node.index ? { url: node.index.url, description: asText(node.index.description) } : undefined;

  return {
    id: index?.url ?? title,
    title,
    description: index?.description ?? asText(node.description),
    url: index?.url,
    pages: children.reduce((sum, c) => sum + c.pages, 0),
    children: children.length ? children : undefined,
  };
}

/** Top-level topics in curated order, with page counts and sub-pages taken from the page tree. */
export function getTopics(): TreeItem[] {
  const rank = (url?: string) => {
    const i = TOPICS.findIndex((t) => `/docs/${t.slug}` === url);
    return i === -1 ? TOPICS.length : i;
  };

  return source.pageTree.children
    .filter((n): n is PageTree.Folder => n.type === 'folder')
    .map(build)
    .filter((t): t is TreeItem => t !== null)
    .sort((a, b) => rank(a.url) - rank(b.url))
    .map((t) => {
      const slug = t.url?.replace('/docs/', '') ?? '';
      const blurb = TOPICS.find((x) => x.slug === slug)?.blurb;
      return { ...t, icon: slug, description: blurb ?? t.description };
    });
}

/** Number of mermaid diagrams across all docs, counted at build time. */
export function countDiagrams(): number {
  const dir = join(process.cwd(), 'content', 'docs');
  let total = 0;
  for (const file of readdirSync(dir, { recursive: true }) as string[]) {
    if (!/\.mdx?$/.test(file)) continue;
    total += readFileSync(join(dir, file), 'utf8').match(/^```mermaid/gm)?.length ?? 0;
  }
  return total;
}

export type HubItem = {
  id: string;
  title: string;
  description?: string;
  url?: string;
  pages: number;
  /** Level-2 headings of a page, used as jump links. Only set on leaf pages. */
  sections?: { title: string; url: string }[];
  children?: HubItem[];
};

function toText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return toText((node as { props?: { children?: unknown } }).props?.children);
  }
  return '';
}

function sectionsOf(url: string): HubItem['sections'] {
  const page = source.getPage(url.replace(/^\/docs\/?/, '').split('/').filter(Boolean));
  const toc = (page?.data as { toc?: { title: unknown; url: string; depth: number }[] } | undefined)?.toc ?? [];
  const seen = new Set<string>();
  const out: NonNullable<HubItem['sections']> = [];
  for (const h of toc) {
    if (h.depth !== 2) continue;
    const title = toText(h.title).trim();
    if (!title || seen.has(title)) continue;
    seen.add(title);
    out.push({ title, url: `${url}${h.url}` });
  }
  return out;
}

function toHub(item: TreeItem): HubItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    url: item.url,
    pages: item.pages,
    sections: item.children ? undefined : item.url ? sectionsOf(item.url) : undefined,
    children: item.children?.map(toHub),
  };
}

function find(items: TreeItem[], url: string): TreeItem | undefined {
  for (const item of items) {
    if (item.url === url && item.children) return item;
    const hit = item.children && find(item.children, url);
    if (hit) return hit;
  }
  return undefined;
}

/** Pages of one section (for example "java" or "system-design/hld") shaped for the section hub. */
export function getHub(path: string): HubItem[] {
  const section = find(getTopics(), `/docs/${path}`);
  if (section) return section.children!.map(toHub);

  // Single-page sections have no children in the tree, so read the page itself.
  const solo = getTopics().find((t) => t.url === `/docs/${path}`);
  return solo ? [toHub(solo)] : [];
}
