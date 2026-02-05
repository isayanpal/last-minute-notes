import type { ComponentType } from 'react';
import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getMDXComponents } from '@/mdx-components';
import { source } from '@/lib/source';
import DocFooter from '@/app/docs/DocFooter';

export default async function Page({
  params,
}: {
  params: { slug?: string[] } | Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;
  const page = source.getPage(resolvedParams.slug ?? []);

  if (!page) {
    notFound();
  }

  const data = page.data as unknown as {
    load?: () => Promise<{
      body: ComponentType<any>;
      toc?: any;
      title?: string;
      description?: string;
    }>;
    body?: ComponentType<any>;
    toc?: any;
    title?: string;
    description?: string;
  };

  const loaded = typeof data.load === 'function' ? await data.load() : data;
  const MdxContent = loaded.body;

  if (!MdxContent) {
    notFound();
  }

  return (
    <DocsPage
      toc={loaded.toc}
      footer={{
        component: <DocFooter />,
      }}
    >
      {loaded.title ? <DocsTitle>{loaded.title}</DocsTitle> : null}
      {loaded.description ? (
        <DocsDescription>{loaded.description}</DocsDescription>
      ) : null}
      <DocsBody>
        <MdxContent
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}
