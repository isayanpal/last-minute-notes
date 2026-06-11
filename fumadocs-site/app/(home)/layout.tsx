import type { ReactNode } from 'react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';

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
          text: 'GitHub',
          url: 'https://github.com/isayanpal/last-minute-notes',
          external: true,
        },
        {
          text: 'Docs',
          url: '/docs',
        },
      ]}
    >
      {children}
    </HomeLayout>
  );
}
