import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let isAdmin = false;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims) redirect("/login");
    const { data: membership, error } = await supabase.from("equipe_usuarios").select("user_id,papel,ativo").eq("user_id", claims.sub).maybeSingle();
    if (error || !membership?.ativo) redirect("/aguardando-acesso");
    isAdmin = membership.papel === "admin";
  }
  return <AppShell isAdmin={isAdmin}>{children}</AppShell>;
}
