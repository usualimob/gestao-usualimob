import type { Metadata } from "next";
import { DemoAuthForm } from "@/components/shared/demo-auth-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return <DemoAuthForm mode="login" />;
}
