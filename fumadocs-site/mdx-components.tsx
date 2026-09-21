import type { MDXComponents } from 'mdx/types';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Mermaid } from '@/components/Mermaid';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...defaultMdxComponents, Mermaid, ...components };
}

export function getMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...defaultMdxComponents, Mermaid, ...components };
}
