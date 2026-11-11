import type { Metadata } from "next";
import { SignIn } from "@/components/signin";
import "@/components/ui.css";

export const metadata: Metadata = { title: "Sign in · Revenant" };

export default function SignInPage() {
  return <SignIn />;
}
