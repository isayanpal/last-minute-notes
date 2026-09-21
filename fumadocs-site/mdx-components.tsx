import type { MDXComponents } from 'mdx/types';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Mermaid } from '@/components/Mermaid';
import { TopicTree } from '@/components/TopicTree';
import { SectionHub } from '@/components/SectionHub';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...defaultMdxComponents, Mermaid, TopicTree, SectionHub, ...components };
}

export function getMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...defaultMdxComponents, Mermaid, TopicTree, SectionHub, ...components };
}
