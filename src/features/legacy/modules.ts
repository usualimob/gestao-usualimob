export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "month" | "checkbox" | "textarea" | "contract" | "person" | "property" | "select";
  options?: string[];
  required?: boolean;
};
export type Module = {
  table: string;
  title: string;
  key: string;
  fields: Field[];
  columns: string[];
  create?: boolean;
};
const field = (name: string, label: string, type: Field["type"] = "text", required = false): Field => ({ name, label, type, required });
const choice = (name: string, label: string, options: string[]): Field => ({ name, label, type: "select", options });
const money = (name: string, label: string): Field => field(name, label, "number");
const contract = field("contrato_numero", "Contrato", "contract");

export const modules: Record<string, Module> = {
  contratos: {
    table: "contratos", title: "Contratos", key: "numero", columns: ["numero", "proprietario", "inquilino", "endereco", "aluguel", "pct_imob", "vencimento_dia", "ativo"],
    fields: [
      field("numero", "Número", "number", true), field("proprietario", "Proprietário"), field("inquilino", "Inquilino"),
      field("endereco", "Endereço"), field("proprietario_id", "Vincular proprietário", "person"),
      field("inquilino_id", "Vincular inquilino", "person"), field("imovel_id", "Vincular imóvel", "property"),
      field("chave_pix", "Chave PIX / conta"), field("data_inicio", "Início do contrato", "date"), field("mes_reajuste", "Mês de reajuste"),
      money("aluguel", "Aluguel"), field("garantia", "Garantia"), money("caucao", "Caução"),
      money("adiantado", "Adiantado"), money("tx_incendio", "Taxa de incêndio"), money("fianca", "Fiança"),
      money("condominio", "Condomínio"), money("iptu", "IPTU"), money("agua_luz", "Água e luz"),
      money("pct_imob", "Comissão (fração, ex.: 0,1)"), field("vencimento_dia", "Dia do vencimento", "number"),
      field("ativo", "Ativo", "checkbox"), field("obs", "Observações", "textarea"),
    ],
  },
  lancamentos: {
    table: "lancamentos", title: "Lançamentos", key: "id", columns: ["contrato_numero", "competencia", "aluguel", "recebido_em", "via", "repassado_em"],
    create: false,
    fields: [
      money("aluguel", "Aluguel"), money("caucao", "Caução"), money("adiantado", "Adiantado"),
      money("tx_incendio", "Taxa de incêndio"), money("fianca", "Fiança"), money("condominio", "Condomínio"),
      money("iptu", "IPTU"), money("agua_luz", "Água e luz"), money("pct_imob", "Comissão (fração)"),
      field("vencimento_dia", "Dia do vencimento", "number"), field("recebido_em", "Recebido em", "date"),
      field("via", "Via de recebimento"), field("repassado_em", "Repassado em", "date"), field("obs", "Observações", "textarea"),
    ],
  },
  pessoas: {
    table: "pessoas", title: "Pessoas", key: "id", columns: ["nome", "tipo", "cpf", "telefone", "email"],
    fields: [
      choice("tipo", "Tipo", ["inquilino", "proprietario", "fiador"]), field("nome", "Nome", "text", true),
      field("cpf", "CPF"), field("rg", "RG"), field("endereco", "Endereço"), field("email", "E-mail"),
      field("telefone", "Telefone"), field("aniversario", "Aniversário"), field("forma_repasse", "Forma de repasse"),
      field("dados_bancarios", "Dados bancários", "textarea"), field("obs", "Observações", "textarea"),
    ],
  },
  imoveis: {
    table: "imoveis", title: "Imóveis", key: "id", columns: ["endereco", "tem_iptu", "tem_condominio", "relogio_agua", "relogio_luz"],
    fields: [
      field("endereco", "Endereço", "text", true), field("tem_iptu", "Tem IPTU", "checkbox"),
      field("tem_condominio", "Tem condomínio", "checkbox"), field("relogio_agua", "Relógio de água"),
      field("relogio_luz", "Relógio de luz"), field("obs", "Observações", "textarea"),
    ],
  },
  leads: {
    table: "leads", title: "Clientes comerciais", key: "id", columns: ["nome", "telefone", "interesse", "origem", "criado_em"],
    fields: [
      field("nome", "Nome", "text", true), field("telefone", "Telefone"), field("email", "E-mail"),
      field("origem", "Origem"), choice("interesse", "Interesse", ["alugar", "comprar", "vender"]),
      field("procura", "O que procura", "textarea"), field("obs", "Observações", "textarea"),
      field("criado_em", "Cadastrado em", "date"),
    ],
  },
  iptus: {
    table: "iptus", title: "IPTUs", key: "id", columns: ["responsavel", "contrato_numero", "valor_total", "valor_parcela", "parcelas", "parcelas_pagas", "pago_ate"],
    fields: [
      field("responsavel", "Responsável", "text", true), choice("responsabilidade", "Responsabilidade", ["Imobiliária", "Inquilino"]),
      contract, field("indice_cadastral", "Índice cadastral"), field("cpf_titular", "CPF do titular"),
      field("codigo_acesso", "Código de acesso"), money("valor_total", "Valor total"),
      money("valor_parcela", "Valor da parcela"), field("parcelas", "Parcelas", "number"),
      field("parcelas_pagas", "Parcelas pagas", "number"), field("vencimento", "Vencimento"),
      field("pago_ate", "Pago até", "month"),
    ],
  },
  condominios: {
    table: "condominios", title: "Condomínios", key: "id", columns: ["responsavel", "administradora", "contrato_numero", "valor_parcela", "parcelas_pagas", "pago_ate"],
    fields: [
      field("responsavel", "Responsável", "text", true), choice("responsabilidade", "Responsabilidade", ["Imobiliária", "Inquilino"]),
      contract, field("administradora", "Administradora"), money("valor_total", "Valor total"),
      money("valor_parcela", "Valor da parcela"), field("parcelas", "Parcelas", "number"),
      field("parcelas_pagas", "Parcelas pagas", "number"), field("vencimento", "Vencimento"),
      field("pago_ate", "Pago até", "month"),
    ],
  },
  seguros: {
    table: "seguros", title: "Seguros", key: "id", columns: ["seguradora", "contrato_numero", "valor_parcela", "parcelas", "parcelas_pagas", "pago_ate"],
    fields: [
      field("seguradora", "Seguradora", "text", true), contract, money("valor_parcela", "Valor da parcela"),
      field("vencimento", "Vencimento"), field("parcelas", "Parcelas", "number"),
      field("parcelas_pagas", "Parcelas pagas", "number"), field("pago_ate", "Pago até", "month"),
      field("obs", "Observações", "textarea"),
    ],
  },
  notas_fiscais: {
    table: "notas_fiscais", title: "Notas fiscais", key: "id", columns: ["contrato_numero", "competencia", "valor", "status", "emitida_em"],
    create: false,
    fields: [
      money("valor", "Valor"), choice("status", "Situação", ["a emitir", "emitida"]),
      field("emitida_em", "Emitida em", "date"), field("atividade", "Atividade"),
      field("obs", "Observações", "textarea"),
    ],
  },
  manutencoes: {
    table: "manutencoes", title: "Manutenções", key: "id", columns: ["solicitante", "contrato_numero", "detalhes", "situacao", "data_abertura", "data_programada"],
    fields: [
      field("solicitante", "Solicitante"), choice("origem", "Origem", ["WhatsApp", "Telefone", "E-mail", "Presencial"]),
      contract, field("detalhes", "Detalhes", "textarea"),
      choice("situacao", "Situação", ["pendente", "programada", "concluida"]),
      field("data_abertura", "Abertura", "date"), field("data_programada", "Programada para", "date"),
      field("concluida_por", "Concluída por"), field("data_conclusao", "Conclusão", "date"),
      money("valor_materiais", "Materiais"), money("valor_mao_obra", "Mão de obra"),
    ],
  },
  despesas: {
    table: "despesas", title: "Despesas", key: "id", columns: ["tipo", "categoria", "origem", "valor", "vencimento", "situacao"],
    fields: [
      field("tipo", "Descrição", "text", true), choice("categoria", "Categoria", ["indispensável", "ordinária", "fatura"]),
      choice("origem", "Origem", ["Imobiliária", "Proprietário", "Inquilino"]), money("valor", "Valor"),
      field("vencimento", "Vencimento", "date"), choice("situacao", "Situação", ["pendente", "pago"]),
      field("competencia", "Competência", "month"),
    ],
  },
  caixas: {
    table: "caixas", title: "Caixas", key: "nome", columns: ["nome", "valor"],
    create: false, fields: [money("valor", "Saldo")],
  },
  pendencias: {
    table: "pendencias", title: "Repasses pendentes", key: "id", columns: ["tipo", "descricao", "contrato_numero", "competencia", "valor", "repassado_em"],
    create: false, fields: [field("repassado_em", "Repassado em", "date")],
  },
};

export const sectionModules: Record<string, string[]> = {
  dashboard: [], controle: ["pendencias"], lancamentos: ["lancamentos"],
  contratos: ["contratos"], cadastros: ["pessoas", "imoveis", "leads"],
  iptus: ["iptus", "condominios", "pendencias"], seguros: ["seguros", "pendencias"],
  notas: ["notas_fiscais"], relatorios: [], manutencoes: ["manutencoes"],
  despesas: ["despesas", "caixas"],
};

