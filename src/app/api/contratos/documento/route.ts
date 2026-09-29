import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fillContractModel } from "@/features/legacy/contract-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const { data: member } = await supabase.from("equipe_usuarios").select("user_id").eq("user_id", userId).maybeSingle();
  if (!member) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Dados inválidos.");
    const values = body as Record<string, unknown>;
    const number = Number(values.numero);
    const modelName = String(values.modelo ?? "");
    const months = Number(values.prazo_meses);
    const guarantorIds = Array.isArray(values.fiadores) ? values.fiadores.map(Number) : [];
    const purpose = String(values.finalidade ?? "Residencial").trim();
    const waterLight = String(values.agua_luz ?? "Por conta do locatário").trim();
    if (!Number.isSafeInteger(number) || number < 1 || !/^[A-Za-z0-9_-]{1,60}\.docx$/.test(modelName)
      || !Number.isInteger(months) || months < 1 || months > 600
      || guarantorIds.length > 2 || guarantorIds.some((id) => !Number.isSafeInteger(id) || id < 1)
      || !purpose || purpose.length > 100 || !waterLight || waterLight.length > 100) {
      throw new Error("Contrato, modelo, prazo ou fiadores inválidos.");
    }

    const { data: contract, error: contractError } = await supabase.from("contratos").select("*").eq("numero", number).single();
    if (contractError || !contract) throw new Error("Contrato não encontrado.");
    if (!contract.proprietario_id || !contract.inquilino_id || !contract.imovel_id || !contract.data_inicio) {
      throw new Error("Vincule proprietário, inquilino, imóvel e data de início ao contrato.");
    }
    const [ownerResult, tenantResult, propertyResult, insuranceResult, modelResult] = await Promise.all([
      supabase.from("pessoas").select("*").eq("id", contract.proprietario_id).single(),
      supabase.from("pessoas").select("*").eq("id", contract.inquilino_id).single(),
      supabase.from("imoveis").select("*").eq("id", contract.imovel_id).single(),
      supabase.from("seguros").select("*").eq("contrato_numero", number).limit(1),
      supabase.storage.from("modelos-contrato").download(modelName),
    ]);
    if (ownerResult.error || tenantResult.error || propertyResult.error || insuranceResult.error || modelResult.error
      || !ownerResult.data || !tenantResult.data || !propertyResult.data || !modelResult.data) {
      throw new Error("Dados vinculados ou modelo indisponíveis.");
    }
    const guarantors = await Promise.all(guarantorIds.map(async (id) => {
      const { data, error } = await supabase.from("pessoas").select("*").eq("id", id).eq("tipo", "fiador").single();
      if (error || !data) throw new Error("Fiador não encontrado no cadastro.");
      return data;
    }));
    const insurance = insuranceResult.data?.[0];
    const file = await fillContractModel(new Uint8Array(await modelResult.data.arrayBuffer()), {
      owner: ownerResult.data,
      tenant: tenantResult.data,
      property: propertyResult.data,
      guarantors,
      amount: Number(contract.aluguel || 0),
      months,
      start: String(contract.data_inicio),
      waterLight,
      purpose,
      condominium: Number(contract.condominio || 0),
      iptu: Number(contract.iptu || 0),
      insurance: Number(insurance?.valor_parcela || 0),
      insurer: String(insurance?.seguradora || ""),
    });
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="minuta-contrato-${number}.docx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar o contrato." }, { status: 400 });
  }
}

