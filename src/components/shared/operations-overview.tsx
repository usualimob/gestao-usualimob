"use client";

type Row = Record<string, unknown>;
type Data = Record<string, Row[]>;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const amount = (value: unknown) => Number(value || 0);
const gross = (row: Row) => ["aluguel", "tx_incendio", "fianca", "condominio", "iptu", "agua_luz"].reduce((sum, key) => sum + amount(row[key]), 0);

export function DashboardPanels({ data, competencia, search = "" }: { data: Data; competencia: string; search?: string }) {
  const history = new Map<string, { expected: number; received: number; fee: number }>();
  for (const row of data.lancamentos ?? []) {
    const key = String(row.competencia);
    const item = history.get(key) ?? { expected: 0, received: 0, fee: 0 };
    item.expected += gross(row);
    if (row.recebido_em) item.received += gross(row);
    item.fee += amount(row.aluguel) * amount(row.pct_imob);
    history.set(key, item);
  }
  const months = [...history].sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  const max = Math.max(1, ...months.map(([, item]) => item.expected));
  const contracts = new Map((data.contratos ?? []).map((row) => [Number(row.numero), row]));
  const owners = new Map<string, { value: number; count: number }>();
  for (const row of (data.lancamentos ?? []).filter((item) => item.competencia === competencia)) {
    const name = String(contracts.get(Number(row.contrato_numero))?.proprietario ?? "Sem proprietário");
    const previous = owners.get(name) ?? { value: 0, count: 0 };
    owners.set(name, { value: previous.value + gross(row), count: previous.count + 1 });
  }
  const top = [...owners].sort((a, b) => b[1].value - a[1].value).slice(0, 8);
  const topMax = Math.max(1, ...top.map(([, item]) => item.value));
  const feeMax = Math.max(1, ...months.map(([, item]) => item.fee));
  const monthNumber = Number(competencia.slice(5));
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const adjusted = (data.contratos ?? []).filter((row) => {
    const month = String(row.mes_reajuste ?? "").toLocaleLowerCase("pt-BR");
    const names = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const matchesMonth = month === String(monthNumber) || month === String(monthNumber).padStart(2, "0") || month === names[monthNumber];
    const matchesSearch = !query || [row.numero, row.inquilino, row.proprietario, row.endereco].some((value) => String(value ?? "").toLocaleLowerCase("pt-BR").includes(query));
    return matchesMonth && matchesSearch;
  });
  return <div className="panel-grid overview-panels">
    <section className="panel"><h2>Evolução mensal · previsto × recebido</h2>
      {months.length ? months.map(([key, item]) => <div className="bar-row" key={key}>
        <span>{key}</span><div className="bar-track" aria-label={`Previsto ${money.format(item.expected)}; recebido ${money.format(item.received)}`}>
          <div className="bar-expected" style={{ width: `${100 * item.expected / max}%` }} />
          <div className="bar-received" style={{ width: `${100 * item.received / max}%` }} />
        </div><strong>{money.format(item.received)}</strong>
      </div>) : <p className="muted">Sem histórico.</p>}
    </section>
    <section className="panel"><h2>Comissão da imobiliária por mês</h2>
      {months.length ? months.map(([key, item]) => <div className="bar-row" key={key}><span>{key}</span>
        <div className="bar-track" aria-hidden="true"><div className="bar-expected fee-bar" style={{ width: `${100 * item.fee / feeMax}%` }} /></div>
        <strong>{money.format(item.fee)}</strong>
      </div>) : <p className="muted">Sem histórico.</p>}
    </section>
    <section className="panel"><h2>Histórico mensal</h2>
      <div className="table-scroll"><table><thead><tr><th scope="col">Mês</th><th scope="col" className="numeric">Bruto</th><th scope="col" className="numeric">Recebido</th><th scope="col" className="numeric">Comissão</th></tr></thead><tbody>
        {[...history].reverse().map(([key, item]) => <tr key={key}><td>{key}</td><td className="numeric">{money.format(item.expected)}</td><td className="numeric">{money.format(item.received)}</td><td className="numeric">{money.format(item.fee)}</td></tr>)}
      </tbody></table></div>
    </section>
    <section className="panel"><h2>Situação da competência</h2>
      {(() => {
        const monthRows = (data.lancamentos ?? []).filter((row) => row.competencia === competencia);
        const expected = monthRows.reduce((sum, row) => sum + gross(row), 0);
        const received = monthRows.filter((row) => row.recebido_em).reduce((sum, row) => sum + gross(row), 0);
        return <><div className="progress-track" role="progressbar" aria-label="Valor recebido" aria-valuemin={0} aria-valuemax={Math.max(expected, received, 1)} aria-valuenow={received} aria-valuetext={`${money.format(received)} de ${money.format(expected)} recebidos`}>
          <div style={{ width: `${expected ? Math.min(100, received / expected * 100) : 0}%` }} />
        </div><div className="progress-legend"><span>Recebido <strong>{money.format(received)}</strong></span><span>A receber <strong>{money.format(expected - received)}</strong></span></div></>;
      })()}
    </section>
    <section className="panel"><h2>Maiores proprietários do mês</h2>
      {top.length ? top.map(([name, item]) => <div className="owner-row" key={name}>
        <span title={name}>{name} <small>({item.count})</small></span>
        <div className="bar-track" aria-hidden="true"><div className="bar-expected fee-bar" style={{ width: `${100 * item.value / topMax}%` }} /></div>
        <strong>{money.format(item.value)}</strong>
      </div>) : <p className="muted">Nenhum proprietário nesta competência.</p>}
    </section>
    <section className="panel"><h2>Reajustes deste mês</h2>
      <div className="table-scroll"><table><thead><tr><th>Contrato</th><th>Inquilino</th><th>Proprietário</th></tr></thead><tbody>
        {adjusted.map((row) => <tr key={String(row.numero)}><td>{String(row.numero)}</td><td>{String(row.inquilino)}</td><td>{String(row.proprietario)}</td></tr>)}
      </tbody></table></div>
    </section>
  </div>;
}

type AgendaItem = { group: string; title: string; value: number; due: string; status: "hoje" | "proximos" | "atrasados" };
const dateString = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
export function ControlPanels({ data }: { data: Data }) {
  const today = new Date();
  const todayText = dateString(today);
  const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);
  const endText = dateString(horizon);
  const currentMonth = todayText.slice(0, 7);
  const contracts = new Map((data.contratos ?? []).map((row) => [Number(row.numero), row]));
  const items: AgendaItem[] = [];
  const add = (group: string, title: string, value: number, due: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due > endText) return;
    items.push({ group, title, value, due, status: due < todayText ? "atrasados" : due === todayText ? "hoje" : "proximos" });
  };
  const dueDay = (raw: unknown) => {
    const found = String(raw ?? "").match(/\d{1,2}/);
    const day = Number(found?.[0] ?? 0);
    if (day < 1 || day > 31) return "";
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return `${currentMonth}-${String(Math.min(day, last)).padStart(2, "0")}`;
  };
  for (const row of data.lancamentos ?? []) {
    if (row.competencia !== currentMonth || row.recebido_em) continue;
    const contract = contracts.get(Number(row.contrato_numero));
    add("Aluguéis", `Contrato ${row.contrato_numero} · ${contract?.inquilino ?? ""}`, gross(row), dueDay(row.vencimento_dia));
  }
  for (const row of data.despesas ?? []) {
    if (row.situacao !== "pago") add("Despesas", String(row.tipo), amount(row.valor), String(row.vencimento ?? ""));
  }
  for (const [table, title, label] of [["iptus", "IPTUs", "responsavel"], ["condominios", "Condomínios", "administradora"], ["seguros", "Seguros", "seguradora"]]) {
    for (const row of data[table] ?? []) {
      if (String(row.pago_ate ?? "") >= currentMonth) continue;
      add(title, String(row[label] || row.responsavel || ""), amount(row.valor_parcela), dueDay(row.vencimento));
    }
  }
  for (const row of data.lancamentos ?? []) {
    if (!row.recebido_em || row.repassado_em) continue;
    const contract = contracts.get(Number(row.contrato_numero));
    add("Repasses", `Contrato ${row.contrato_numero} · ${contract?.proprietario ?? ""}`,
      gross(row) - amount(row.aluguel) * amount(row.pct_imob), String(row.recebido_em));
  }
  for (const row of data.manutencoes ?? []) {
    if (row.situacao === "programada") add("Manutenções", String(row.detalhes), amount(row.valor_materiais) + amount(row.valor_mao_obra), String(row.data_programada));
  }
  const groups = ["Aluguéis", "Despesas", "IPTUs", "Condomínios", "Seguros", "Repasses", "Manutenções"];
  const statuses: { key: AgendaItem["status"]; title: string }[] = [
    { key: "hoje", title: "Hoje" }, { key: "proximos", title: "Próximos 5 dias" }, { key: "atrasados", title: "Atrasados" },
  ];
  return <div className="panel-stack">{groups.map((group) => <section className="panel" key={group}><h2>{group}</h2>
    <div className="control-columns">{statuses.map(({ key, title }) => <div className={`control-column is-${key}`} key={key}>
      <h3>{title}</h3><ul>{items.filter((item) => item.group === group && item.status === key).map((item, index) =>
        <li key={index}><span>{item.title}</span><small>{item.due} · {money.format(item.value)}</small></li>)}</ul>
      {!items.some((item) => item.group === group && item.status === key) && <p className="muted">Sem itens.</p>}
      <p className="control-total">Total ({items.filter((item) => item.group === group && item.status === key).length}): <strong>{money.format(items.filter((item) => item.group === group && item.status === key).reduce((sum, item) => sum + item.value, 0))}</strong></p>
    </div>)}</div>
  </section>)}</div>;
}

