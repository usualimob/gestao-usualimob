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
    const modelName = String(values.modelo ?? "");
    const months = Number(values.prazo_meses);
    const guarantorIds = Array.isArray(values.fiadores) ? values.fiadores.map(Number) : [];
    const purpose = String(values.finalidade ?? "Residencial").trim();
    const waterLight = String(values.agua_luz ?? "Por conta do locatário").trim();
    const fillMode = String(values.preencher ?? "ambos");
    const ownerId = Number(values.proprietario_id);
    const tenantId = Number(values.inquilino_id);
    const propertyId = Number(values.imovel_id);
    const amount = Number(values.valor);
    const start = String(values.inicio ?? "");
    const condominium = Number(values.condominio_valor ?? 0);
    const iptu = Number(values.iptu_valor ?? 0);
    const insurance = Number(values.seguro_valor ?? 0);
    const insurer = String(values.seguro_seguradora ?? "").trim();
    if (!/^[A-Za-z0-9_-]{1,60}\.docx$/.test(modelName)
      || !Number.isInteger(months) || months < 1 || months > 600
      || guarantorIds.length > 2 || guarantorIds.some((id) => !Number.isSafeInteger(id) || id < 1)
      || !["ambos", "inquilino", "proprietario"].includes(fillMode)
      || (fillMode !== "inquilino" && (!Number.isSafeInteger(ownerId) || ownerId < 1))
      || (fillMode !== "proprietario" && (!Number.isSafeInteger(tenantId) || tenantId < 1))
      || !Number.isSafeInteger(propertyId) || propertyId < 1
      || values.valor === "" || values.valor == null || !Number.isFinite(amount) || amount < 0 || amount >= 1e9
      || !/^\d{4}-\d{2}-\d{2}$/.test(start)
      || [condominium, iptu, insurance].some((value) => !Number.isFinite(value) || value < 0 || value >= 1e9)
      || !purpose || purpose.length > 100 || !waterLight || waterLight.length > 100 || insurer.length > 100) {
      throw new Error("Revise partes, imóvel, valores, início, modelo e prazo.");
    }

    const [ownerResult, tenantResult, propertyResult, modelResult] = await Promise.all([
      ownerId > 0 ? supabase.from("pessoas").select("*").eq("id", ownerId).eq("tipo", "proprietario").single() : Promise.resolve({ data: {}, error: null }),
      tenantId > 0 ? supabase.from("pessoas").select("*").eq("id", tenantId).eq("tipo", "inquilino").single() : Promise.resolve({ data: {}, error: null }),
      supabase.from("imoveis").select("*").eq("id", propertyId).single(),
      supabase.storage.from("modelos-contrato").download(modelName),
    ]);
    if (ownerResult.error || tenantResult.error || propertyResult.error || modelResult.error
      || !ownerResult.data || !tenantResult.data || !propertyResult.data || !modelResult.data) {
      throw new Error("Partes, imóvel ou modelo indisponíveis.");
    }
    const guarantors = await Promise.all(guarantorIds.map(async (id) => {
      const { data, error } = await supabase.from("pessoas").select("*").eq("id", id).eq("tipo", "fiador").single();
      if (error || !data) throw new Error("Fiador não encontrado no cadastro.");
      return data;
    }));
    const file = await fillContractModel(new Uint8Array(await modelResult.data.arrayBuffer()), {
      owner: ownerResult.data,
      tenant: tenantResult.data,
      property: propertyResult.data,
      guarantors,
      amount,
      months,
      start,
      waterLight,
      purpose,
      condominium,
      iptu,
      insurance,
      insurer,
      fillMode: fillMode as "ambos" | "inquilino" | "proprietario",
    });
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="minuta-contrato.docx"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar o contrato." }, { status: 400 });
  }
}

