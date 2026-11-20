import type { ReactNode } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: 'Last Minute Notes',
        url: '/',
      }}
      themeSwitch={{ enabled: false }}
      links={[
        {
          text: 'Learn',
          url: '/learn',
        },
        {
          text: 'Github',
          url: 'https://github.com/isayanpal/last-minute-notes',
          external: true,
        },
      ]}
    >
      {children}
    </DocsLayout>
  );
}
