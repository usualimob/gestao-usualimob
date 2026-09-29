export type DemoTable = {
  title: string;
  columns: string[];
  rows: string[][];
};

export type DemoSection = {
  path: string;
  label: string;
  heading: string;
  description: string;
  actions?: string[];
  cards?: { label: string; value: string; tone?: "green" | "orange" | "red" }[];
  tables: DemoTable[];
};

// Todos os registros abaixo são inventados para a demonstração. Nenhum dado vem de banco/.
export const sections: DemoSection[] = [
  {
    path: "dashboard", label: "Dashboard", heading: "Dashboard", description: "Visão geral da competência demonstrativa.",
    cards: [
      { label: "Previsto no mês", value: "R$ 8.450,00" },
      { label: "Recebido", value: "R$ 5.950,00", tone: "green" },
      { label: "Pendente", value: "R$ 2.500,00", tone: "orange" },
      { label: "Comissão prevista", value: "R$ 845,00" },
    ],
    tables: [
      { title: "Evolução mensal — previsto × recebido", columns: ["Mês", "Previsto", "Recebido"], rows: [["Julho", "R$ 7.800,00", "R$ 7.800,00"], ["Agosto", "R$ 8.100,00", "R$ 7.100,00"], ["Setembro", "R$ 8.450,00", "R$ 5.950,00"]] },
      { title: "Pendentes de recebimento", columns: ["Contrato", "Inquilino", "Vencimento", "Valor"], rows: [["DEMO-003", "Pessoa Exemplo C", "25/09/2026", "R$ 2.500,00"]] },
      { title: "Recebidos aguardando repasse", columns: ["Contrato", "Proprietário", "Valor"], rows: [["DEMO-002", "Pessoa Exemplo B", "R$ 1.780,00"]] },
      { title: "Reajustes deste mês", columns: ["Contrato", "Imóvel", "Mês"], rows: [["DEMO-001", "Imóvel Exemplo A", "Setembro"]] },
    ],
  },
  {
    path: "controle", label: "Controle", heading: "Controle", description: "Agenda e pendências operacionais.",
    cards: [{ label: "A receber", value: "2", tone: "orange" }, { label: "A repassar", value: "1" }, { label: "Manutenções abertas", value: "1" }],
    tables: [
      { title: "Recebimentos", columns: ["Prazo", "Referência", "Situação"], rows: [["25/09/2026", "Contrato DEMO-003", "Pendente"], ["28/09/2026", "Contrato DEMO-004", "Pendente"]] },
      { title: "Repasses", columns: ["Prazo", "Referência", "Situação"], rows: [["30/09/2026", "Contrato DEMO-002", "A repassar"]] },
      { title: "Outras pendências", columns: ["Tipo", "Descrição", "Situação"], rows: [["Manutenção", "Inspeção de exemplo", "Programada"]] },
    ],
  },
  {
    path: "lancamentos", label: "Mês", heading: "Lançamentos do mês", description: "Recebimentos e repasses da competência demonstrativa.",
    actions: ["Gerar mês", "Excluir selecionados"],
    cards: [{ label: "Total previsto", value: "R$ 8.450,00" }, { label: "Recebido", value: "R$ 5.950,00", tone: "green" }, { label: "A receber", value: "R$ 2.500,00", tone: "orange" }],
    tables: [{ title: "Lançamentos", columns: ["Contrato", "Inquilino", "Aluguel", "Vencimento", "Recebimento", "Repasse"], rows: [["DEMO-001", "Pessoa Exemplo A", "R$ 2.200,00", "10/09/2026", "Recebido", "Repassado"], ["DEMO-002", "Pessoa Exemplo B", "R$ 3.750,00", "15/09/2026", "Recebido", "Pendente"], ["DEMO-003", "Pessoa Exemplo C", "R$ 2.500,00", "25/09/2026", "Pendente", "—"]] }],
  },
  {
    path: "contratos", label: "Contratos", heading: "Contratos", description: "Contratos fictícios para avaliar a apresentação da lista.",
    actions: ["Gerar contrato (Word)", "Novo contrato"],
    tables: [{ title: "Contratos", columns: ["Nº", "Proprietário", "Inquilino", "Imóvel", "Aluguel", "Situação"], rows: [["DEMO-001", "Pessoa Exemplo D", "Pessoa Exemplo A", "Imóvel Exemplo A", "R$ 2.200,00", "Ativo"], ["DEMO-002", "Pessoa Exemplo E", "Pessoa Exemplo B", "Imóvel Exemplo B", "R$ 3.750,00", "Ativo"], ["DEMO-003", "Pessoa Exemplo F", "Pessoa Exemplo C", "Imóvel Exemplo C", "R$ 2.500,00", "Ativo"]] }],
  },
  {
    path: "cadastros", label: "Cadastros", heading: "Cadastros", description: "Pessoas, imóveis e clientes demonstrativos.",
    actions: ["Nova pessoa", "Novo imóvel", "Novo cliente"],
    tables: [
      { title: "Pessoas — inquilinos e proprietários", columns: ["Nome", "Tipo", "Contato"], rows: [["Pessoa Exemplo A", "Inquilino", "contato-a@example.com"], ["Pessoa Exemplo D", "Proprietário", "contato-d@example.com"]] },
      { title: "Imóveis", columns: ["Identificação", "Endereço", "IPTU", "Condomínio"], rows: [["Imóvel Exemplo A", "Endereço fictício A", "Sim", "Não"], ["Imóvel Exemplo B", "Endereço fictício B", "Sim", "Sim"]] },
      { title: "Clientes — comercial", columns: ["Nome", "Interesse", "Origem"], rows: [["Cliente Exemplo A", "Alugar", "Indicação fictícia"]] },
    ],
  },
  {
    path: "iptus", label: "IPTUs & Condomínios", heading: "IPTUs e condomínios", description: "Parcelamentos e repasses demonstrativos.",
    actions: ["Novo IPTU", "Novo condomínio"],
    tables: [
      { title: "IPTUs", columns: ["Responsável", "Contrato", "Parcela", "Pagas", "Situação"], rows: [["Pessoa Exemplo D", "DEMO-001", "R$ 120,00", "3 de 10", "Em andamento"]] },
      { title: "Condomínios", columns: ["Responsável", "Contrato", "Parcela", "Pagas", "Situação"], rows: [["Pessoa Exemplo E", "DEMO-002", "R$ 420,00", "2 de 12", "Em andamento"]] },
      { title: "Repasses pendentes", columns: ["Tipo", "Contrato", "Competência", "Valor"], rows: [["IPTU", "DEMO-001", "09/2026", "R$ 120,00"], ["Condomínio", "DEMO-002", "09/2026", "R$ 420,00"]] },
    ],
  },
  {
    path: "seguros", label: "Seguros", heading: "Seguros", description: "Seguros vinculados a contratos demonstrativos.",
    actions: ["Novo seguro"],
    tables: [
      { title: "Seguradoras vinculadas aos contratos", columns: ["Seguradora", "Contrato", "Parcela", "Pagas"], rows: [["Seguradora Exemplo", "DEMO-001", "R$ 95,00", "4 de 12"]] },
      { title: "Repasses pendentes às seguradoras", columns: ["Contrato", "Competência", "Valor", "Situação"], rows: [["DEMO-001", "09/2026", "R$ 95,00", "Pendente"]] },
    ],
  },
  {
    path: "notas", label: "Notas Fiscais", heading: "Notas fiscais", description: "Acompanhamento demonstrativo de emissão.",
    cards: [{ label: "Previsão de impostos", value: "R$ 84,00" }],
    tables: [{ title: "Notas fiscais", columns: ["Contrato", "Competência", "Valor", "Situação"], rows: [["DEMO-001", "09/2026", "R$ 220,00", "Emitida"], ["DEMO-002", "09/2026", "R$ 375,00", "A emitir"]] }],
  },
  {
    path: "relatorios", label: "Relatórios", heading: "Relatórios", description: "Documentos disponíveis após a integração de dados e geração de arquivos.",
    actions: ["Controle do mês (PDF)", "Despesas do mês (PDF)", "Pendências em aberto (PDF)", "Conferência DIMOB (PDF)", "Gerar DIMOB (.txt)", "Dados do declarante"],
    tables: [
      { title: "Relatórios em PDF", columns: ["Relatório", "Período", "Disponibilidade"], rows: [["Controle do mês", "Mensal", "Após integração"], ["Despesas", "Mensal", "Após integração"], ["Pendências", "Atual", "Após integração"]] },
      { title: "DIMOB — exportação anual", columns: ["Arquivo", "Período", "Disponibilidade"], rows: [["Conferência PDF", "Anual", "Após integração"], ["Arquivo TXT", "Anual", "Após integração"]] },
    ],
  },
  {
    path: "manutencoes", label: "Manutenções", heading: "Manutenções", description: "Chamados demonstrativos vinculados aos imóveis.",
    actions: ["Nova manutenção"],
    tables: [{ title: "Manutenções", columns: ["Solicitante", "Contrato", "Detalhes", "Abertura", "Situação"], rows: [["Pessoa Exemplo A", "DEMO-001", "Inspeção de exemplo", "12/09/2026", "Programada"], ["Pessoa Exemplo B", "DEMO-002", "Revisão de exemplo", "18/09/2026", "Pendente"]] }],
  },
  {
    path: "despesas", label: "Despesas", heading: "Despesas", description: "Despesas e caixas demonstrativos.",
    actions: ["Nova despesa", "Copiar mês"],
    cards: [{ label: "Total do mês", value: "R$ 1.180,00" }, { label: "Pago", value: "R$ 750,00", tone: "green" }, { label: "Pendente", value: "R$ 430,00", tone: "orange" }],
    tables: [
      { title: "Despesas", columns: ["Descrição", "Categoria", "Origem", "Valor", "Vencimento", "Situação"], rows: [["Despesa Exemplo A", "Ordinária", "Imobiliária", "R$ 750,00", "12/09/2026", "Pago"], ["Despesa Exemplo B", "Fixa", "Imobiliária", "R$ 430,00", "27/09/2026", "Pendente"]] },
      { title: "Caixas", columns: ["Caixa", "Saldo"], rows: [["Caixa demonstrativo", "R$ 2.000,00"]] },
    ],
  },
];
