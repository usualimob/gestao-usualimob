import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tableNames } from "@/lib/team-permissions";

export const dynamic = "force-dynamic";

async function adminId() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: member } = await supabase.from("equipe_usuarios")
    .select("user_id").eq("user_id", user.id).eq("papel", "admin").eq("ativo", true).maybeSingle();
  return member?.user_id ?? null;
}

export async function POST(request: Request) {
  if (!await adminId()) return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const nome = String(input.nome ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const permissions = input.pode_editar;
  if (!nome || nome.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
    || !Array.isArray(permissions) || permissions.some((name) => typeof name !== "string" || !tableNames.includes(name))) {
    return NextResponse.json({ error: "Revise nome, e-mail e permissões." }, { status: 400 });
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name: nome }, redirectTo: new URL("/redefinir-senha", request.url).toString(),
    });
    if (error || !data.user) throw error ?? new Error("Convite não criado.");
    const { error: insertError } = await admin.from("equipe_usuarios").insert({
      user_id: data.user.id, nome, email, papel: "funcionario", ativo: true,
      pode_editar: [...new Set(permissions)],
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw insertError;
    }
    return NextResponse.json({ message: "Convite enviado por e-mail." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível convidar." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const currentId = await adminId();
  if (!currentId) return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const id = String(input.user_id ?? "");
  const permissions = input.pode_editar;
  if (!/^[0-9a-f-]{36}$/i.test(id) || id === currentId || typeof input.ativo !== "boolean"
    || !Array.isArray(permissions) || permissions.some((name) => typeof name !== "string" || !tableNames.includes(name))) {
    return NextResponse.json({ error: "Alteração inválida." }, { status: 400 });
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("equipe_usuarios").update({
      ativo: input.ativo, pode_editar: [...new Set(permissions)],
    }).eq("user_id", id).eq("papel", "funcionario").select("user_id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });
    return NextResponse.json({ message: "Acessos atualizados." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, { status: 400 });
  }
}
