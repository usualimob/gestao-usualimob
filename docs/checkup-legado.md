# Checkup do aplicativo legado e da conversão do banco

## Código: estado atual do `src`

As 11 áreas foram migradas para Next.js 16.3.6. Com credenciais do projeto de destino, o front usa Supabase Auth, RLS e as 14 tabelas. Sem credenciais, mantém a demonstração sintética. Os formulários e tabelas operacionais foram reconstruídos em React; o JavaScript legado permanece apenas como referência local.

| Área | Adaptação implementada | Verificação pendente |
|---|---|---|
| Dashboard | Oito indicadores legados, histórico mensal, comissão, proprietários e reajustes | Comparar totais com banco de destino |
| Controle | Agenda de vencimentos por grupo e listas operacionais | Conferir vencimentos em datas limite com dados reais |
| Lançamentos | Competência, filtros, colunas de valores calculados, receber, repassar, estornar, editar e excluir pendentes | Teste integrado com registros importados |
| Contratos | CRUD, vínculo de pessoas/imóveis, encerramento, propagação futura, Word por modelo privado | Revisão jurídica/visual dos DOCX finais |
| Cadastros | Pessoas, imóveis e clientes com campos legados | Conferir dados importados |
| IPTUs e condomínios | CRUD, saldo, parcelas, pagamento mensal ou avulso atômico e pendências | Conferir parcelamentos reais |
| Seguros | CRUD, pagamento mensal ou avulso e pendências | Conferir saldos reais |
| Notas fiscais | Lista completa, emissão, edição, alíquotas e imposto por nota | Conferir notas reais e alíquotas |
| Relatórios | Controle, despesas, pendências para impressão/PDF; conferência e TXT DIMOB | Validar TXT no PGD oficial |
| Manutenções | CRUD, datas e custos | Conferir dados reais |
| Despesas | CRUD, filtros, caixas e cópia de competência | Conferir cópias reais |

Diferenças conscientes da versão web: backup diário e janela PyWebView são locais e não entram no Next.js; modelos Word ficam em bucket privado; PDF é gerado pela impressão do navegador; número de contrato existente não é editável no formulário para evitar quebra de vínculos. A renumeração de contratos e a exclusão múltipla de lançamentos recebidos foram bloqueadas pela revisão automática por risco de perda de histórico. A exclusão individual de um lançamento recebido exige estorno.

Ainda não foi feita validação ponta a ponta no Supabase de destino, pois o projeto não tinha tabelas nem dados. O Python recuperado tem trechos incompletos; as regras centrais foram reconstruídas e testadas com dados sintéticos no PostgreSQL local.

## Banco: conferência antes dos dados

- `banco/gestao.db` e `banco/gestao.sql` concordam em 14 tabelas, colunas, chaves estrangeiras, contagens, conteúdo dos registros e contadores `AUTOINCREMENT`. O SQLite passou em `integrity_check` e `foreign_key_check`.
- `supabase/sql-editor/01_schema.sql` deriva do esquema **efetivo** do `.db`, inclusive colunas adicionadas depois da definição inicial do Python. Converte `INTEGER` em `BIGINT`, `REAL` em `NUMERIC` e mantém `TEXT` como texto para preservar datas vazias e formatos legados.
- O esquema preserva 14 chaves primárias, três restrições únicas compostas e a chave estrangeira declarada em `lancamentos`. Vínculos sem FK no SQLite continuam sem FK nesta conversão; acrescentá-las seria uma mudança de modelo.
- As 14 tabelas têm RLS habilitado e privilégios públicos revogados. O script `04_acesso_equipe.sql` cria políticas de acesso apenas para usuários autorizados em `equipe_usuarios`.
- `supabase/sql-editor/verificacao_estrutura.sql` compara as 14 tabelas, assinatura de colunas/tipos/nulidade/identidade, número de defaults, chaves, RLS e acesso público. Deve retornar `OK` em todas as linhas **antes** da carga.
- A carga `02_dados.sql` e a conferência `03_verificacao.sql` permanecem separadas. No teste local em Postgres, 536 registros, 8.860 valores de campos, 101 defaults e 11 sequências coincidiram com o SQLite, sem divergências. Esses arquivos devem ser regenerados se a fonte for atualizada; a carga ainda não foi feita no Supabase remoto.

## Ordem segura no projeto Supabase de destino

1. Executar `01_schema.sql` em um projeto sem essas tabelas.
2. Executar `verificacao_estrutura.sql` e confirmar 14 resultados `OK`.
3. Em etapa posterior, confirmar qual é o SQLite mais recente, regenerar os scripts e revisar a carga pessoal `02_dados.sql` antes de executá-la.
4. Após a carga, executar `03_verificacao.sql` para conferir contagens e próximos IDs.
5. Executar `04_acesso_equipe.sql`, `05_operacoes.sql`, `06_modelos_privados.sql` e `08_parcelas_avulsas.sql`. Depois, executar `07_verificacao_final.sql` e conferir 14 resultados `OK`. Criar usuários no Auth e incluir os UUIDs autorizados em `equipe_usuarios`.
6. Configurar as variáveis do projeto de destino e conferir cada tela com os dados importados.

Num projeto já configurado, rode somente `08_parcelas_avulsas.sql` e então `07_verificacao_final.sql`. O 08 é repetível e não altera dados ao ser instalado; os scripts de criação e carga inicial não devem ser repetidos em banco preenchido.
