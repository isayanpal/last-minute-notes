import type { MDXComponents } from 'mdx/types';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Mermaid } from '@/components/Mermaid';
import { FlowAnimation } from '@/components/FlowAnimation';
import { TopicTree } from '@/components/TopicTree';
import { SectionHub } from '@/components/SectionHub';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...defaultMdxComponents, Mermaid, FlowAnimation, TopicTree, SectionHub, ...components };
}

export function getMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...defaultMdxComponents, Mermaid, FlowAnimation, TopicTree, SectionHub, ...components };
}
