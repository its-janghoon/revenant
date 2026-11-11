import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Amplify } from './amplify';

export const metadata: Metadata = { title: 'App' };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <Amplify />
        {children}
      </body>
    </html>
  );
}
