'use client';

import { Amplify as Client } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';

// amplify_outputs.json is written by the Amplify build for the branch being deployed.
Client.configure(outputs, { ssr: true });

export function Amplify() {
  return null;
}
