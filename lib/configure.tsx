"use client";
// Configures Amplify in the browser once (auth tokens in cookies for SSR).
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";

Amplify.configure(outputs, { ssr: true });

export function Configure() {
  return null;
}
