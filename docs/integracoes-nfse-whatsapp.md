# Integrações NFS-e e WhatsApp — preparação

Estado em 20/10/2026: **nenhuma nota é transmitida e nenhuma mensagem é enviada por este aplicativo**. A coluna `notas_fiscais.status` é apenas um controle interno. A ação de emissão na interface registra uma nota já emitida fora do sistema.

## Simulador implementado

Na área **Notas Fiscais**, o painel “Simulador · NFS-e e WhatsApp” permite escolher um registro `a emitir`, indicar o tomador e o serviço, simular uma referência claramente fictícia e pré-visualizar um aviso de WhatsApp após confirmar um consentimento também fictício. No modo de demonstração ele usa dados inventados; com Supabase configurado, usa os registros pendentes já carregados pela página. Nenhum resultado é salvo, nenhuma situação é alterada, nenhum documento fiscal é criado e não há chamadas de rede para governo ou Meta. Recarregar a página limpa a simulação.

O teste `npm run check:integrations` verifica valor, competência, situação, telefone e consentimento da simulação. Este teste **não** valida DPS, certificado, autorização fiscal, modelo aprovado na Meta nem entrega da mensagem.

## Fluxo atual encontrado

- `registrar_recebimento` em `supabase/sql-editor/05_operacoes.sql` cria uma linha em `notas_fiscais` para a competência, com valor igual à comissão calculada por `aluguel × pct_imob`.
- A linha não possui chave de acesso, número, XML, PDF, protocolo ou identificação do tomador. `atividade` assume `aluguel`; não usar esse texto como código fiscal nem concluir que o aluguel integral é a base do serviço.
- `contratos` guarda proprietário/inquilino como texto e vínculos opcionais por ID. `pessoas` guarda CPF, telefone e endereço, mas não há cadastro fiscal completo da prestadora, consentimento de WhatsApp nem histórico de mensagens.
- O aplicativo consulta o Supabase pelo cliente autenticado. Uma integração externa precisa ficar no servidor, com credenciais fora de `NEXT_PUBLIC_*`, autorização de equipe e registro auditável do resultado.

## Emissão fiscal: decisão e pré-requisitos

Escolha inicial a validar: **Emissor Público Nacional (SEFIN)**, pois há manual, ambiente de produção restrita e API pública documentados. A Prefeitura de Contagem também publica um novo ISS Digital com webservice alinhado ao padrão nacional. Confirmar com o contador/portal em que emissor o CNPJ da Usualimob está habilitado antes de fixar endpoint; o usuário aceita o que for mais simples, mas o emissor efetivamente permitido depende do cadastro e regime fiscal.

Antes de desenvolver a transmissão, obter sem colocar segredos no Git:

1. CNPJ, inscrição municipal, município do estabelecimento, regime tributário, certificado digital exigido e permissão para o ambiente de testes.
2. Serviço tributável correto (administração/intermediação), código de serviço/NBS, município de incidência, retenções, alíquotas e regras de IBS/CBS, validados pelo contador. A alíquota estimada hoje na tela não configura uma DPS.
3. Regra de quem é o tomador de cada serviço (proprietário, inquilino ou outro) e seus dados fiscais obrigatórios. Confirmar se a comissão calculada é a base correta em cada contrato.
4. Conferência dos registros existentes marcados `emitida` contra as notas reais; não retransmitir histórico sem deduplicação.

Implementação após esses dados: acrescentar campos de identificação fiscal e evidência da NFS-e em migração incremental do Supabase; montar e validar DPS contra o leiaute vigente; assinar/transmitir apenas no servidor; testar na produção restrita; persistir chave, número, protocolo, XML/artefato e erros; consultar o resultado antes de repetir requisições para evitar emissão duplicada. Só alterar `status` para `emitida` após confirmação do emissor. Cancelamento/substituição exigem fluxo próprio, não simples edição da linha.

## WhatsApp: decisão e pré-requisitos

Usar a **WhatsApp Business Platform Cloud API da Meta**, diretamente, sem fornecedor adicional por enquanto. O número já existe, mas ainda precisa ser associado/configurado para a API. Não presumir que o número do aplicativo Business já pode enviar pela Cloud API nem migrá-lo automaticamente.

1. Criar/configurar portfólio empresarial, aplicativo Meta, conta WhatsApp Business, número remetente, `phone_number_id`, token de produção e webhook. Guardar token apenas em segredo do ambiente do servidor.
2. Definir o evento que dispara o aviso (por exemplo, NFS-e confirmada), o destinatário correto e a mensagem exata. Não enviar automaticamente com base apenas no campo `telefone`.
3. Registrar consentimento válido e possibilidade de parar mensagens. Criar e aprovar modelo de mensagem apropriado para o aviso proativo; validar categoria e idioma na Meta.
4. Implementar envio individual no servidor após confirmação fiscal, com autorização, validação de telefone, deduplicação por nota/destinatário/modelo, log sem token, resposta da API, webhook de entrega/falha e opção de reenvio controlado. Um HTTP 200 de envio não comprova entrega.
5. Testar com número de teste e contatos autorizados antes de habilitar produção ou envio em lote.

## Ordem segura para executar

1. Confirmar emissor, dados fiscais, certificado, tomador e regra de cálculo com o contador.
2. Configurar Meta e aprovar um modelo de aviso; definir como será registrado o consentimento.
3. Aplicar uma migração incremental no Supabase de **destino** com RLS, histórico de tentativas e identificadores externos. Fazer backup e verificar a estrutura antes de aplicar; não executar o esquema inicial em banco preenchido.
4. Construir emissão em homologação, conferir XML/DANFSe e casos de erro/duplicidade com notas de teste.
5. Só então ligar o envio WhatsApp à confirmação de NFS-e, validar opt-in e liberar produção com operação manual supervisionada primeiro.

Fontes oficiais consultadas: [documentação atual da NFS-e](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual), [ambientes da API nacional](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao/apis-prod-restrita-e-producao), [portal NFS-e de Contagem](https://receita.contagem.mg.gov.br/nfe/) e [Developer Hub da WhatsApp Business Platform](https://whatsappbusiness.com/developers/developer-hub/).
