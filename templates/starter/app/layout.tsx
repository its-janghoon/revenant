import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Amplify } from './amplify';
import { RvInspect } from './rv-inspect';

export const metadata: Metadata = { title: 'App' };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <Amplify />
        {process.env.NEXT_PUBLIC_RV_INSPECT === '1' && <RvInspect />}
        {children}
      </body>
    </html>
  );
}
