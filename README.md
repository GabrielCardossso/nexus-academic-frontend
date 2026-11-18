# nexus-academic-frontend

Front-end do sistema **Nexus**, desenvolvido como **projeto acadêmico no SENAC**.

Este repositório guarda **apenas a parte do front**. O sistema completo é dividido em três repositórios:

| Repositório | O que contém | Link |
|---|---|---|
| **nexus-academic-frontend** (este) | Interface web (React + TypeScript) | https://github.com/GabrielCardossso/nexus-academic-frontend |
| Back-end do Nexus | API (Java / Spring Boot), mantida por ([@LionT750](https://github.com/LionT750))| https://github.com/LionT750/Nexus |
| Repositório do tech lead | Junta front + back para integração e testes | _adicionar link_ |

> Este projeto tem fins exclusivamente educacionais.

## O que o front faz hoje

Aplicação com **menu lateral** (que pode ser recolhido para mostrar só os ícones) e cinco telas.

Em **Clientes**, **Produtos**, **Pedidos** e **Colaboradores**, a lista ocupa a tela e carrega sozinha. Não há busca nem filtro: o back-end ainda não oferece isso, então o front mostra a lista completa que a API devolve. O botão **+ Novo** no topo abre o formulário de cadastro num **popup**, que fecha com Esc, com o "×" ou clicando fora. Mensagens de sucesso e erro aparecem num aviso no canto da tela, que some sozinho. As caixas de seleção são um componente próprio (`Selecao`), com a lista estilizada e funcionando por teclado (setas, Enter, Esc e a letra inicial da opção).

| Grupo | Tela | O que faz |
|---|---|---|
| Cadastros | **Clientes** | Cadastra, **edita** e **desativa/reativa** cliente (nome ou razão social, CNPJ, telefone, e-mail, categoria **Normal** ou **VIP** e limite de crédito) e lista os clientes cadastrados, com a situação (**em dia** ou **inadimplente**). |
| Cadastros | **Produtos** | Cadastra, **edita** (nome, descrição, preços e status), **repõe estoque** e **desativa/reativa** produto, e lista os produtos com o status (**Disponível**, **Indisponível** ou **Desativado**). O cadastro não pede status, igual ao back: produto novo entra como disponível. |
| Vendas | **Pedidos** | Monta um pedido de **venda** ou de **aluguel** (cliente, produtos e quantidades, forma de pagamento) e mostra a prévia com subtotal, desconto e total. Os produtos entram um por vez: **+ Selecionar produto** abre a lista de produtos disponíveis; depois de escolher e informar a quantidade, o botão aparece de novo para o próximo. A lista de pedidos mostra um resumo de cada um (cliente, itens, total, status do pedido e do pagamento), e **Ver detalhes** abre todos os dados em grade. Permite **editar** o pedido enquanto não foi pago, **confirmar** o pedido, **registrar o pagamento** dos pedidos a prazo e **devolver** os aluguéis. |
| Gestão | **Colaboradores** | Cadastra, **edita** e **desativa/reativa** colaborador (nome, **CPF** e e-mail) e lista os colaboradores, com quantas solicitações de desconto cada um já decidiu. O CPF é validado, e CPF e e-mail não podem se repetir. |
| Gestão | **Descontos** | Escolhe quem está aprovando (**Aprovando como**, só colaboradores ativos) e mostra as solicitações de desconto em duas abas: **Pendentes**, com os botões **Aprovar** e **Rejeitar** e o total antes e depois do desconto, e **Decididas**, com quem aprovou ou rejeitou. O menu mostra quantas estão pendentes. |

**Nada é excluído de verdade.** O "excluir" de clientes, produtos e colaboradores é **Desativar** (com popup de confirmação), e o cadastro pode ser **Reativado**. Cliente desativado não aparece para pedido novo; produto desativado não entra em pedido; colaborador desativado não decide descontos. Os pedidos e decisões antigos continuam como estavam (guardam o nome, a categoria e o preço do momento).

Os selos de status (pedido, pagamento, categoria, situação do cliente, status do produto) usam cores sólidas com texto branco: verde para concluído, pago, em dia, disponível e aprovado; laranja para pendente e indisponível; vermelho para vencido, inadimplente e rejeitado; roxo para VIP; cinza para os neutros.

### Regras de negócio dos pedidos

As regras ficam em funções puras no arquivo `src/regras.ts`, usadas tanto pela prévia na tela quanto pelos dados locais:

- **Produtos:** só entram no pedido produtos com status *Disponível* e estoque maior que zero. A quantidade não pode passar do estoque, e o estoque é baixado quando o pedido é feito (venda ou aluguel).
- **Tipo do pedido:** *Venda* usa o preço de venda do produto. *Aluguel* usa o preço de aluguel **por mês**.
- **Aluguel:** o cliente informa a duração em **meses**. O início é a data do pedido e o fim do aluguel é calculado pela quantidade de meses. O valor é **preço por mês × meses × quantidade**.
- **Formas de pagamento:** PIX, à vista ou a prazo (valem para venda e aluguel).
  - PIX e à vista: o pagamento já fica **Pago**, a não ser que exista uma solicitação de desconto ainda pendente (aí fica pago quando o colaborador decide).
  - A prazo: o pagamento fica **Pendente** até alguém clicar em **Registrar pagamento**, e o total não pode ultrapassar o **limite de crédito** do cliente. A **data de vencimento** é escolhida no pedido: obrigatória e precisa ser depois de hoje (igual ao `@Future` do back). O pedido também tem um campo opcional de **descrição**.
- **Limite de crédito:** todo pedido a prazo (venda ou aluguel) **reserva o total no limite do cliente** assim que é criado. Se o desconto de um pedido a prazo for aprovado, a diferença volta para o limite. Ao **registrar o pagamento**, o valor reservado volta inteiro para o limite. Na devolução do aluguel o crédito não volta (só o estoque).
- **Repor estoque:** o botão **Repor estoque** do produto **soma** a quantidade informada (inteira, maior que zero) ao estoque atual. Não muda o status do produto.
- **Editar pedido:** o botão **Editar** aparece enquanto o pedido **não foi pago**, inclusive se já foi confirmado. Dá para mudar praticamente tudo (tipo, cliente, produtos, quantidades, meses, pagamento, vencimento, desconto e descrição).
  - A prazo: só até **Registrar pagamento**. PIX e à vista já nascem pagos, então só editam enquanto o desconto aguarda decisão. Aluguel devolvido não edita.
  - Na edição, o pedido antigo é desfeito (o estoque e o crédito reservado voltam) e o novo passa pelas mesmas validações do cadastro, com os preços atuais dos produtos.
  - Mantendo o mesmo cliente e o mesmo percentual, a solicitação de desconto (e a decisão já tomada) continua. Mudando o percentual, vira uma nova solicitação pendente.
  - Se a edição trocar para PIX ou à vista (sem desconto pendente), o pedido fica **Pago** na hora.

#### Descontos

O cliente digita o percentual (número inteiro) que quer solicitar. Toda solicitação depende de um colaborador **aprovar**; se for rejeitada, vale o desconto que o cliente já teria sem ela.

| Cliente | Desconto automático | Pode solicitar |
|---|---|---|
| **Normal** | — | de **1% a 10%** |
| **VIP** em dia | **5%**, em qualquer forma de pagamento | de **10% a 15%**. Se aprovado, **substitui** os 5% (não soma): passa de 5% para 12%, por exemplo. |
| **Inadimplente** (Normal ou VIP) | — (VIP perde os 5%) | **Não pode solicitar.** Fica sem desconto nenhum, nem com aprovação de colaborador. |

#### Cliente inadimplente

- O cliente é **inadimplente** quando tem pelo menos um **pedido a prazo vencido e não pago**. Não é um campo do cadastro: é calculado a partir dos pedidos. Ao registrar o pagamento dos pedidos vencidos, ele volta a ficar em dia.
- Inadimplente **não pode fazer pedido a prazo**: o pedido é bloqueado antes de ser criado. Pode comprar com **PIX** ou **à vista**.
- Inadimplente **fica sem desconto nenhum**: o VIP perde os 5% automáticos, ninguém pode solicitar desconto, e nem uma solicitação aprovada vale.
- A perda do desconto vale para os pedidos do cliente **ainda não pagos**, inclusive os antigos. Os pedidos já pagos ficam com o valor do momento do pagamento.
- Solicitação que ficou pendente de antes de o cliente virar inadimplente só pode ser **rejeitada** (o botão Aprovar fica bloqueado na tela de Descontos).
- Editar o próprio pedido vencido: como o cliente está inadimplente, ele não pode continuar a prazo; trocando para PIX ou à vista, o pedido fica pago e o cliente volta a ficar em dia (se não tiver outro vencido).
- Na tela de pedidos, o inadimplente aparece marcado na lista de clientes, a opção *A prazo* e o campo de desconto ficam bloqueados. Pedido a prazo vencido ganha o selo **Vencido**.

#### Status do pedido e status do pagamento

Cada pedido tem **dois status independentes**, mostrados como selos na lista:

| Status do pedido | Quando |
|---|---|
| **Pendente** | Todo pedido nasce assim. Nenhum pedido conclui sozinho (nem de cliente VIP, nem com desconto aprovado). |
| **Concluído** | Depois que alguém clica em **Confirmar pedido**. O botão fica bloqueado enquanto houver solicitação de desconto aguardando decisão. |
| **Devolvido** | Só aluguel: depois da devolução. |

| Status do pagamento | Quando |
|---|---|
| **Pago** | PIX ou à vista sem desconto aguardando aprovação, ou a prazo depois de **Registrar pagamento**. |
| **Pendente** | A prazo ainda não pago, ou PIX/à vista com desconto aguardando aprovação. |

- **Registrar pagamento:** aparece nos pedidos a prazo ainda não pagos (bloqueado enquanto houver desconto aguardando decisão). Marca o pagamento como *Pago* e devolve ao limite o crédito reservado.

- **Devolução:** só um aluguel **Concluído** pode ser devolvido. O botão **Devolver** abre um popup de confirmação; ao confirmar, os itens voltam ao estoque e o pedido passa para *Devolvido* (não dá para desfazer).
- Subtotal, desconto, total e os dois status **não são salvos**: são sempre calculados a partir dos itens, da categoria e da situação do cliente, da forma de pagamento, da duração (aluguel), da solicitação e das datas de confirmação (`concluidoEm`), pagamento (`pagoEm`) e devolução (`devolvidoEm`).

### Dados locais (sem back-end)

Por enquanto o front funciona sozinho. Em `src/config/api.ts` a constante `USAR_DADOS_LOCAIS` está como `true`, e então tudo é salvo e lido do **localStorage** do navegador por `src/services/dadosLocais.ts`, que faz o papel do back-end:

- Gera os IDs sozinho (maior ID atual + 1).
- Valida o **CNPJ** (dígitos verificadores, aceitando também o CNPJ alfanumérico) e não deixa cadastrar dois clientes com o mesmo e-mail.
- Valida o **CPF** do colaborador e não deixa repetir CPF nem e-mail.
- Guarda os dados nas chaves `nexus:v7:clientes`, `nexus:v7:produtos`, `nexus:v7:pedidos` e `nexus:v7:colaboradores`. Para limpar, abra o navegador em **F12 > Application > Local Storage** e apague as chaves `nexus:*`.
- **Dados de exemplo:** com `CARREGAR_MOCKS = true` (em `src/config/api.ts`), na primeira vez que o app abre com o localStorage vazio ele grava os dados de `src/services/mocks.ts`: 6 clientes, 9 produtos, 3 colaboradores (Ana Souza, Carlos Lima e Beatriz Rocha) e 15 pedidos que cobrem todos os cenários da tela (desconto pendente, aprovado e rejeitado, VIP pedindo de 10% a 15%, venda e aluguel a prazo, pedido a prazo já pago, aluguel para devolver e aluguel já devolvido). A **Tech Solutions Informática** (VIP) vem **inadimplente**, por uma venda a prazo vencida e não paga. Estoque e limite de crédito já vêm coerentes com esses pedidos. Para recomeçar do zero, apague as chaves `nexus:*` e recarregue a página.

Para usar o back-end real, troque para `USAR_DADOS_LOCAIS = false` em `src/config/api.ts`. Nesse modo, **clientes, produtos e colaboradores** (cadastro e listagem) chamam a API. **Pedidos, descontos, pagamento e devolução** continuam **só no modo local**: o back já tem essas rotas, mas as regras ainda estão sendo alinhadas (o Lucas está terminando inadimplente e faixas de desconto). Com a flag desligada, essas telas mostram o erro "ainda não estão ligados ao back-end".

## Tecnologias

- [React 18](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org/) 18 ou superior.

```bash
# 1. Clonar o repositório
git clone https://github.com/GabrielCardossso/nexus-academic-frontend.git
cd nexus-academic-frontend

# 2. Instalar as dependências
npm install

# 3. Criar o arquivo de ambiente (veja a seção abaixo)
cp .env.example .env

# 4. Rodar em modo de desenvolvimento
npm run dev
```

O front sobe em **http://localhost:5173**.

Outros comandos:

```bash
npm run build     # confere os tipos (tsc) e gera a versão de produção na pasta dist/
npm run preview   # serve localmente a versão gerada pelo build
```

## Configuração do back-end

A URL do back-end é definida no arquivo `.env` (que **não vai para o Git**):

```env
VITE_API_URL=http://localhost:8080
```

Se o `.env` não existir, o front usa `http://localhost:8080` (porta padrão do Spring Boot). Use o `.env.example` como modelo. Essa URL só é usada com `USAR_DADOS_LOCAIS = false`.

> Nunca suba o `.env` para o repositório. Ele já está no `.gitignore`.

### Endpoints usados

O back usa o prefixo **`/api/v1`** (context-path no `application.yml`). Os caminhos ficam em `src/config/api.ts`:

| Ação | Método | Caminho |
|---|---|---|
| Cadastrar / listar clientes | `POST` / `GET` | `/api/v1/clientes` |
| Cadastrar / listar produtos | `POST` / `GET` | `/api/v1/produtos` |
| Cadastrar / listar colaboradores | `POST` / `GET` | `/api/v1/colaboradores` |

O back também já tem rotas de pedido (`/api/v1/pedidos`, `/{id}`, `/vencidosEmAberto`, `/solicitacoesDescontoEmAberto`, `/cliente`, `/{id}/desconto`, `/{id}/finalizar`, `/{id}/devolucao`) e `/api/v1/produtos/listarAlugados`. O front ainda não usa essas rotas porque as regras de pedido estão sendo alinhadas.

O front usa nomes próprios por dentro (`categoria`, `limiteCredito`, `nome`), e `src/services/api.ts` converte para os nomes do back ao enviar e receber:

```json
// POST /api/v1/clientes
{
  "name": "Maria Souza",
  "telefone": "11999999999",
  "cnpj": "11222333000181",
  "email": "maria@email.com",
  "limiteDeCredito": 5000,
  "classificacao": "NORMAL"
}

// POST /api/v1/produtos (sem status: o back não recebe)
{
  "nome": "Furadeira de Impacto 650W",
  "descricao": "Furadeira profissional com maleta",
  "estoque": 25,
  "precoVenda": 389.9,
  "precoAluguel": 45.0
}

// POST /api/v1/colaboradores
{
  "name": "Ana Souza",
  "cpf": "12345678909",
  "email": "ana.souza@nexus.com.br"
}
```

Os erros do back vêm no formato `ProblemDetail` do Spring (`detail` e `errors`), e o front mostra essas mensagens no aviso.

> **Ainda falta no back para a integração completa:**
> - As listagens de clientes, produtos e colaboradores não devolvem o `id`, e a de clientes também não devolve o `cnpj`. O pedido precisa do `id` do produto e do `cnpj` do cliente, e a aprovação de desconto precisa do `idColaborador`. Enquanto isso, o front usa um id provisório (negativo) só para mostrar a lista.
> - A listagem de produtos devolve um campo `preco` que não existe na entidade, e não devolve `precoVenda`, `precoAluguel` nem o status.
> - O cadastro de produto não define o status (fica nulo).
> - Não há liberação de CORS para `http://localhost:5173`.
> - Não há rotas de **editar**, **desativar/reativar** nem **repor estoque**. Essas ações só funcionam com os dados locais; com `USAR_DADOS_LOCAIS = false` elas mostram o erro "ainda não existe no back-end". Também falta no back a regra nova do inadimplente (sem desconto e sem poder solicitar).

## Integração com o back-end

Para casar o front com a API real:

1. **`USAR_DADOS_LOCAIS = false`** em `src/config/api.ts`, para o front parar de usar o localStorage.
2. **Caminhos** em `src/config/api.ts` (Swagger do back: `http://localhost:8080/api/v1/swagger-ui/index.html`).
3. **Conversão de campos** em `src/services/api.ts` (tipos `ClienteBack*`, `ProdutoBack*` e `ColaboradorBack`), se o back mudar algum nome.
4. **Autenticação:** hoje o back libera tudo (`permitAll`). Se passar a exigir token, ajustar `getAuthHeaders()` em `src/services/api.ts`.
5. **Pedidos e descontos:** quando as regras estiverem iguais nos dois lados, trocar `exigirModoLocal()` pelas chamadas às rotas de `/pedidos` em `src/services/api.ts`.
6. **CORS:** o back precisa liberar a origem `http://localhost:5173`. Se aparecer `Failed to fetch` no front e erro de CORS no console do navegador (F12), o ajuste é feito no Spring.

## Estrutura do projeto

```
public/
└── icons/              # ícones SVG do menu lateral (inclui percent.svg, de Descontos)
src/
├── main.tsx            # ponto de entrada da aplicação
├── App.tsx             # layout: menu lateral + troca de telas
├── App.css             # estilos
├── types.ts            # tipos dos DTOs (Cliente, Produto, Pedido, Desconto...)
├── regras.ts           # regras de pedido e desconto (funções puras)
├── utils.ts            # formatação de moeda, datas e CPF, helper de formulário
├── config/
│   └── api.ts          # URL base, caminhos dos endpoints e flags USAR_DADOS_LOCAIS e CARREGAR_MOCKS
├── services/
│   ├── api.ts          # chamadas HTTP ao back-end
│   ├── dadosLocais.ts  # back-end "de mentira" no localStorage
│   └── mocks.ts        # dados de exemplo carregados na primeira execução
├── components/
│   ├── Modal.tsx           # popup genérico (formulários de cadastro e novo pedido)
│   ├── ConfirmarModal.tsx  # popup de confirmação (usado na devolução)
│   ├── Aviso.tsx           # aviso flutuante de sucesso/erro
│   ├── Selecao.tsx         # caixa de seleção própria (substitui o <select> nativo)
│   ├── NovoPedidoForm.tsx  # formulário de novo pedido com o seletor de produtos
│   └── PedidoCard.tsx      # card do pedido (resumo + detalhes)
└── telas/
    ├── ClientesTela.tsx
    ├── ProdutosTela.tsx
    ├── PedidosTela.tsx
    ├── ColaboradoresTela.tsx
    └── DescontosTela.tsx
```

## Próximos passos

- [x] Caminhos `/api/v1` e nomes de campos do back (clientes, produtos e colaboradores)
- [x] Função de pagar o pedido (devolver o crédito ao cliente)
- [ ] Back: devolver `id` (e `cnpj` do cliente) nas listagens, preços e status na listagem de produtos, liberar CORS
- [ ] Back: inadimplente e faixas de desconto (em andamento com o Lucas)
- [ ] Ligar pedidos e descontos às rotas `/pedidos` do back quando as regras estiverem iguais
- [x] Editar e desativar/reativar registros (só nos dados locais)
- [ ] Back: rotas de editar, desativar/reativar e repor estoque (clientes, produtos, colaboradores e pedidos)
- [ ] Validação de formulário campo a campo
- [ ] Autenticação (se exigida pelo back)

## Equipe

- Front-end: Gabriel ([@GabrielCardossso](https://github.com/GabrielCardossso))
- Back-end: Lucas ([@LionT750](https://github.com/LionT750))
- Tech lead: Rafael ([@confeyte ](https://github.com/confeyte))
- QA: João ([@CoruJa1m  ](https://github.com/CoruJa1m))
