import type { ReactNode } from 'react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { XLink } from '@/components/XLink';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout
      nav={{
        title: 'Last Minute Notes',
        url: '/',
      }}
      themeSwitch={{ enabled: false }}
      links={[
        {
          text: 'Github',
          url: 'https://github.com/isayanpal/last-minute-notes',
          external: true,
        },
        {
          text: 'Docs',
          url: '/docs',
        },
        {
          text: 'Learn',
          url: '/learn',
        },
        {
          type: 'custom',
          secondary: true,
          children: <XLink />,
        },
      ]}
    >
      {children}
    </HomeLayout>
  );
}
