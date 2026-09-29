import type { Metadata } from "next";
import { DemoAuthForm } from "@/components/shared/demo-auth-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function CadastroPage() {
  return <DemoAuthForm mode="cadastro" />;
}
