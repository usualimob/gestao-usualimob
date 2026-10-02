# Gestão Imobiliária — Next.js + Supabase

Aplicação Next.js 16.3.6 com App Router. As 11 áreas do sistema local foram adaptadas para navegação web, autenticação da equipe e operações no projeto Supabase **de destino**. Sem variáveis de ambiente, o site abre a demonstração com dados fictícios. Nenhum dado de `banco/` ou modelo de `codigo/` é publicado.

## Executar

Requer Node.js 20.9 ou superior.

```bash
npm ci
npm run dev
```

Para conectar ao projeto de destino, copie `.env.example` para `.env.local` e preencha a URL e a **publishable key** desse projeto. Não use a service role nem o projeto Supabase vinculado ao Codex. Reinicie o servidor após configurar. O acesso aos dados exige conta no Auth e inclusão manual na equipe.

```bash
npm run typecheck
npm run build
npm run check:sql
npm run check:dimob
npm run check:docx
npm run check:legacy
```

O teste Word usa dados fictícios e também verifica os cinco modelos locais quando `codigo/modelos/` existe. Os testes SQL rodam num PostgreSQL em memória; não alteram o projeto remoto.

## Preparar o Supabase de destino

1. Em um projeto sem as tabelas, execute `supabase/sql-editor/01_schema.sql` e depois `verificacao_estrutura.sql`. Confira 14 linhas `OK`.
2. Confirme qual SQLite é o snapshot mais recente. Rode `python scripts/export_sqlite_to_supabase.py` e `python scripts/check_supabase_export.py`. Quando decidir importar, execute `02_dados.sql` **uma vez** e depois `03_verificacao.sql`; confira contagens e sequências.
3. Execute `04_acesso_equipe.sql`, `05_operacoes.sql`, `06_modelos_privados.sql` e `08_parcelas_avulsas.sql`, nessa ordem. O arquivo 05 acrescenta `contratos.data_inicio` (vazio nos dados antigos), regras transacionais e funções chamadas pelo front. O arquivo 08 acrescenta o pagamento de uma parcela avulsa.
4. Crie ou confirme os usuários em Authentication. Copie o UUID de cada membro autorizado e inclua-o com `INSERT INTO public.equipe_usuarios (user_id) VALUES ('UUID');`. O cadastro público cria apenas uma conta pendente, sem acesso aos dados.
5. Depois dos scripts, execute `07_verificacao_final.sql` e confira 14 linhas `OK`. A verificação antiga é válida apenas antes das permissões e da coluna `data_inicio`.
6. Na tela Contratos, envie os modelos DOCX revisados ao bucket privado e preencha vínculos e data de início dos contratos antes de gerar documentos ou DIMOB.

Se o projeto de destino **já recebeu `01_schema.sql` e o `02_dados.sql` anterior**, faça um backup do projeto e execute `supabase/sql-editor/09_atualizacao_dados.sql` no SQL Editor **uma vez**. Esse arquivo é gerado localmente por `python scripts/update_existing_supabase.py`, contém dados pessoais e fica fora do Git. Ele confere integralmente o snapshot anterior antes de alterar registros; se houver qualquer divergência, a transação falha sem aplicar a atualização. Não repita `01_schema.sql` nem `02_dados.sql` em um banco preenchido. Depois execute `03_verificacao.sql` (contagens e sequências) e `07_verificacao_final.sql` (estrutura e acesso), conferindo `OK` em todas as linhas. Execute `08_parcelas_avulsas.sql` antes da verificação final se ainda não o fez.

O banco permanece protegido por RLS. `anon` não recebe acesso; `authenticated` só acessa as 14 tabelas quando consta em `equipe_usuarios`. Os modelos Word originais têm identificadores e contatos embutidos e continuam apenas em `codigo/`, fora do Git. Revise-os antes de enviá-los ao bucket privado.

## O que funciona e o que conferir

- Cadastros, contratos, IPTU, condomínio, seguros, manutenções, notas, despesas, caixas e pendências usam tabelas reais quando há Supabase configurado.
- Competência, recebimento/estorno, parcela mensal ou avulsa, cópia de despesas e atualização/encerramento de contratos têm funções transacionais no SQL. Receber cria nota e pendências uma vez; o estorno bloqueia nota emitida ou repasse concluído.
- Dashboard e Controle mostram histórico, reajustes, vencimentos e pendências. Relatórios mensais, despesas e pendências podem ser impressos ou salvos como PDF pelo navegador.
- A DIMOB gera prévia e TXT usando a **data de recebimento**. Exige dados do declarante, CPF/CNPJ dos envolvidos e data real de início. Importe o TXT no PGD da Receita e confira todos os campos antes do envio.
- Contratos Word usam modelos privados do Supabase Storage. A geração foi testada com dados sintéticos nos cinco modelos locais, mas o documento final deve ser conferido antes da assinatura.

Ainda não houve conexão ou teste ponta a ponta no projeto Supabase de destino, nem importação dos registros reais. A equipe deve validar os resultados fiscais e documentos contra o sistema antigo e o programa oficial. A renumeração de contratos e a exclusão múltipla de lançamentos recebidos ficaram pendentes por alterarem ou removerem histórico; a exclusão individual exige estorno prévio.

## Publicar na Vercel

Importe este repositório com a raiz como diretório de trabalho e Next.js como framework. Configure as duas variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` do projeto de destino, depois execute o build. `.gitignore` e `.vercelignore` excluem `banco/`, `codigo/`, `.env.local`, `02_dados.sql` e `09_atualizacao_dados.sql`. Não carregue dumps, CSVs, DOCX privados ou chaves secretas no repositório.

## Referência extraída do aplicativo anterior

### Banco e código extraídos

## Resultado

O aplicativo é um sistema local em Python 3.11, com FastAPI, SQLite, HTML, CSS e JavaScript. O executável foi empacotado com PyInstaller e abre a interface em uma janela PyWebView.

## Onde está cada parte

- `banco/gestao.db`: cópia íntegra do banco SQLite original.
- `banco/gestao.sql`: exportação SQL completa, incluindo estrutura e dados.
- `banco/csv/`: uma planilha CSV por tabela, em UTF-8 com BOM.
- `banco/resumo.json`: tabelas, colunas e quantidade de registros.
- `codigo/static/`: frontend original em HTML, CSS e JavaScript.
- `codigo/decompiled/`: tentativa de recuperação legível dos módulos Python.
- `codigo/bytecode/`: bytecodes Python originais recuperados do executável.
- `codigo/modelos/`: modelos DOCX usados na geração de contratos.

## Banco de dados

O banco possui 14 tabelas de negócio:

| Tabela | Registros | Finalidade principal |
|---|---:|---|
| `contratos` | 157 | Contratos, valores e vínculos |
| `lancamentos` | 332 | Recebimentos e repasses mensais |
| `despesas` | 77 | Despesas e situação de pagamento |
| `notas_fiscais` | 71 | Pedidos e emissão de notas |
| `pessoas` | 18 | Proprietários e inquilinos |
| `iptus` | 9 | Parcelamentos de IPTU |
| `manutencoes` | 10 | Chamados de manutenção |
| `config` | 7 | Dados do declarante DIMOB |
| `caixas` | 5 | Saldos dos caixas internos |
| `imoveis` | 8 | Cadastro de imóveis |
| `seguros` | 4 | Seguros vinculados |
| `condominios` | 0 | Parcelamentos de condomínio |
| `pendencias` | 2 | Repasses pendentes |
| `leads` | 0 | Prospecções comerciais |

Para visualizar diretamente, abra `banco/gestao.db` com DB Browser for SQLite. Para trabalhar no Excel, use os arquivos em `banco/csv/`. Para recriar o banco, importe `banco/gestao.sql` em um banco SQLite vazio.

## Arquitetura recuperada

1. `codigo/decompiled/run.py` inicia o FastAPI em `0.0.0.0:8020`, cria o backup diário e abre a janela PyWebView em `127.0.0.1:8020`.
2. `codigo/decompiled/app.py` define o esquema SQLite, migrações e endpoints REST.
3. `codigo/static/app.js` implementa toda a interface e consome `/api/*`.
4. `codigo/decompiled/documentos.py` preenche os modelos DOCX.
5. `codigo/decompiled/relatorios.py` gera PDFs e arquivos de relatório.

Entre as rotas recuperadas estão contratos, lançamentos, IPTU, condomínios, despesas, caixas, pessoas, imóveis, seguros, manutenções, leads, pendências, notas fiscais, dashboard, agenda, DIMOB e relatórios PDF.

## Limite da recuperação do código

O frontend foi recuperado integralmente porque já estava armazenado como texto. Os módulos Python estavam compilados em bytecode 3.11. A decompilação recuperou nomes, modelos, consultas SQL, rotas e a maior parte da lógica, mas alguns blocos complexos ficaram incompletos e os arquivos `.py` não devem ser tratados como código pronto para execução.

Os arquivos `.pyasm` contêm a desmontagem completa, e `codigo/bytecode/` preserva os `.pyc` originais. Eles permitem reconstrução manual fiel dos trechos que o decompilador não conseguiu converter.

## Segurança e privacidade

- O servidor escuta em `0.0.0.0:8020`, ficando acessível a outros dispositivos da rede local quando o firewall permite.
- Não foi encontrada autenticação ativa; a inicialização remove antigas chaves de usuário, senha e segredo da tabela `config`.
- As rotas permitem leitura e alteração dos dados sem controle de acesso aparente.
- CPF, RG, dados bancários, chaves PIX, endereços e dados DIMOB ficam em texto puro no SQLite e também nas exportações.
- Os backups são cópias diretas do arquivo SQLite; para maior consistência durante gravações, prefira a API de backup do próprio SQLite.

Mantenha esta pasta restrita e não envie o banco, os CSVs ou o SQL por canais públicos.
