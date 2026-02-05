import './global.css';
import type { ReactNode } from 'react';
import { RootProvider } from 'fumadocs-ui/provider/next';

export const metadata = {
  title: 'Last Minute Notes',
  description: 'Interview and system design notes.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
