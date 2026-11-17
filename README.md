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

Em **Clientes**, **Produtos**, **Pedidos** e **Colaboradores**, a lista ocupa a tela e carrega sozinha. Cada uma tem um campo de **busca**; Produtos e Pedidos também têm um **filtro**, por status. O botão **+ Novo** no topo abre o formulário de cadastro num **popup**, que fecha com Esc, com o "×" ou clicando fora. Mensagens de sucesso e erro aparecem num aviso no canto da tela, que some sozinho. As caixas de seleção são um componente próprio (`Selecao`), com a lista estilizada e funcionando por teclado (setas, Enter, Esc e a letra inicial da opção).

| Grupo | Tela | O que faz |
|---|---|---|
| Cadastros | **Clientes** | Cadastra cliente (nome ou razão social, CNPJ, telefone, e-mail, categoria **Normal** ou **VIP** e limite de crédito) e lista os clientes cadastrados, com a situação (**em dia** ou **inadimplente**). |
| Cadastros | **Produtos** | Cadastra produto (nome, descrição, estoque, preço de venda, preço de aluguel por mês e status **Disponível**, **Indisponível** ou **Desativado**) e lista os produtos cadastrados. |
| Vendas | **Pedidos** | Monta um pedido de **venda** ou de **aluguel** (cliente, produtos e quantidades, forma de pagamento) e mostra a prévia com subtotal, desconto e total. Os produtos entram um por vez: **+ Selecionar produto** abre uma lista com busca; depois de escolher e informar a quantidade, o botão aparece de novo para o próximo. A lista de pedidos mostra um resumo de cada um (cliente, itens, total, status do pedido e do pagamento), e **Ver detalhes** abre todos os dados em grade. Permite **confirmar** o pedido, **registrar o pagamento** dos pedidos a prazo e **devolver** os aluguéis. |
| Gestão | **Colaboradores** | Cadastra colaborador (nome, **CPF** e e-mail) e lista os colaboradores, com quantas solicitações de desconto cada um já decidiu. O CPF é validado, e CPF e e-mail não podem se repetir. |
| Gestão | **Descontos** | Escolhe quem está aprovando (**Aprovando como**) e mostra as solicitações de desconto em duas abas: **Pendentes**, com os botões **Aprovar** e **Rejeitar** e o total antes e depois do desconto, e **Decididas**, com quem aprovou ou rejeitou. O menu mostra quantas estão pendentes. |

Os selos de status (pedido, pagamento, categoria, situação do cliente, status do produto) usam cores sólidas com texto branco: verde para concluído, pago, em dia, disponível e aprovado; laranja para pendente e indisponível; vermelho para vencido, inadimplente e rejeitado; roxo para VIP; cinza para os neutros.

### Regras de negócio dos pedidos

As regras ficam em funções puras no arquivo `src/regras.ts`, usadas tanto pela prévia na tela quanto pelos dados locais:

- **Produtos:** só entram no pedido produtos com status *Disponível* e estoque maior que zero. A quantidade não pode passar do estoque, e o estoque é baixado quando o pedido é feito (venda ou aluguel).
- **Tipo do pedido:** *Venda* usa o preço de venda do produto. *Aluguel* usa o preço de aluguel **por mês**.
- **Aluguel:** o cliente informa a duração em **meses**. O início é a data do pedido e o fim do aluguel é calculado pela quantidade de meses. O valor é **preço por mês × meses × quantidade**.
- **Formas de pagamento:** PIX, à vista ou a prazo (valem para venda e aluguel).
  - PIX e à vista: o pagamento já fica **Pago**, a não ser que exista uma solicitação de desconto ainda pendente (aí fica pago quando o colaborador decide).
  - A prazo: o pagamento fica **Pendente** até alguém clicar em **Registrar pagamento**, e o total não pode ultrapassar o **limite de crédito** do cliente. Na venda o vencimento é em **30 dias**; no aluguel, é o fim do aluguel.
- **Limite de crédito:** todo pedido a prazo (venda ou aluguel) **reserva o total no limite do cliente** assim que é criado. Se o desconto de um pedido a prazo for aprovado, a diferença volta para o limite. Ao **registrar o pagamento**, o valor reservado volta inteiro para o limite. Na devolução do aluguel o crédito não volta (só o estoque).

#### Descontos

O cliente digita o percentual (número inteiro) que quer solicitar. Toda solicitação depende de um colaborador **aprovar**; se for rejeitada, vale o desconto que o cliente já teria sem ela.

| Cliente | Desconto automático | Pode solicitar |
|---|---|---|
| **Normal** | — | de **1% a 10%** |
| **VIP** em dia | **5%**, em qualquer forma de pagamento | de **10% a 15%**. Se aprovado, **substitui** os 5% (não soma): passa de 5% para 12%, por exemplo. |
| **VIP inadimplente** | — (perde os 5%) | de **1% a 15%** |
| **Normal inadimplente** | — | de **1% a 10%** |

#### Cliente inadimplente

- O cliente é **inadimplente** quando tem pelo menos um **pedido a prazo vencido e não pago**. Não é um campo do cadastro: é calculado a partir dos pedidos. Ao registrar o pagamento dos pedidos vencidos, ele volta a ficar em dia.
- Inadimplente **não pode fazer pedido a prazo**, só **PIX** ou **à vista**.
- Inadimplente **VIP perde os 5% automáticos**. O desconto só vem por solicitação aprovada por um colaborador (veja a tabela acima).
- A perda dos 5% vale para os pedidos do cliente **ainda não pagos**, inclusive os antigos. Os pedidos já pagos ficam com o valor do momento do pagamento.
- Na tela de pedidos, o inadimplente aparece marcado na lista de clientes e a opção *A prazo* fica bloqueada. Pedido a prazo vencido ganha o selo **Vencido**.

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
- Guarda os dados nas chaves `nexus:v6:clientes`, `nexus:v6:produtos`, `nexus:v6:pedidos` e `nexus:v6:colaboradores`. Para limpar, abra o navegador em **F12 > Application > Local Storage** e apague as chaves `nexus:*`.
- **Dados de exemplo:** com `CARREGAR_MOCKS = true` (em `src/config/api.ts`), na primeira vez que o app abre com o localStorage vazio ele grava os dados de `src/services/mocks.ts`: 6 clientes, 9 produtos, 3 colaboradores (Ana Souza, Carlos Lima e Beatriz Rocha) e 15 pedidos que cobrem todos os cenários da tela (desconto pendente, aprovado e rejeitado, VIP pedindo de 10% a 15%, venda e aluguel a prazo, pedido a prazo já pago, aluguel para devolver e aluguel já devolvido). A **Tech Solutions Informática** (VIP) vem **inadimplente**, por uma venda a prazo vencida e não paga. Estoque e limite de crédito já vêm coerentes com esses pedidos. Para recomeçar do zero, apague as chaves `nexus:*` e recarregue a página.

Para usar o back-end real, troque para `USAR_DADOS_LOCAIS = false` em `src/config/api.ts`. Nesse modo, **clientes e produtos** (cadastro e listagem) chamam a API. **Pedidos (venda e aluguel), descontos, pagamento, devolução, situação do cliente (inadimplente) e colaboradores** ainda não têm endpoint no back-end e **só funcionam no modo local**: com a flag desligada essas telas mostram o erro "ainda não têm endpoint no back-end".

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

### Endpoints esperados

Os caminhos ficam centralizados em `src/config/api.ts`:

| Ação | Método | Caminho |
|---|---|---|
| Cadastrar cliente | `POST` | `/api/clientes` |
| Listar clientes | `GET` | `/api/clientes` |
| Cadastrar produto | `POST` | `/api/produtos` |
| Listar produtos | `GET` | `/api/produtos` |

Pedidos (venda e aluguel), descontos, pagamento, devolução, situação do cliente (inadimplente) e colaboradores ainda não têm endpoint definido.

Formato dos dados enviados (os tipos completos, de envio e de resposta, estão em `src/types.ts`):

```json
// POST /api/clientes
{
  "name": "Maria Souza",
  "telefone": "11999999999",
  "cnpj": "11222333000181",
  "email": "maria@email.com",
  "categoria": "NORMAL",
  "limiteCredito": 5000
}

// POST /api/produtos
{
  "nome": "Cera automotiva",
  "descricao": "Cera líquida 500 ml",
  "estoque": 20,
  "precoVenda": 39.9,
  "precoAluguel": 12.5,
  "status": "DISPONIVEL"
}
```

Valores aceitos: `categoria` = `NORMAL` ou `VIP`; `status` do produto = `DISPONIVEL`, `INDISPONIVEL` ou `DESATIVADO`.

Na listagem, o front aceita tanto uma lista simples (`[ {...} ]`) quanto a paginação do Spring (`{ "content": [ {...} ] }`). O `id` de cada item é necessário, porque é por ele que cliente e produto são escolhidos no pedido.

> **Atenção:** os nomes dos campos acima seguem o que o front espera, mas podem não bater com os DTOs do back-end. Os campos `cnpj`, `limiteCredito` e `status`, o `id` nas listagens e tudo de pedido, desconto e aluguel (tipo, meses e devolução) ainda não existem nos records do back e precisam ser alinhados quando forem criados.

## Integração com o back-end

Para casar o front com a API real, ajuste:

1. **`USAR_DADOS_LOCAIS = false`** em `src/config/api.ts`, para o front parar de usar o localStorage.
2. **Caminhos dos endpoints** em `src/config/api.ts` (confira no Swagger do back: `http://localhost:8080/swagger-ui/index.html`).
3. **Nomes dos campos** em `src/types.ts` (`ClienteCriarRequest`, `ClienteCriarResponse`, `ClienteListarResponse`, `ProdutoCriarRequest` e os demais) para bater com os DTOs do Java.
4. **Autenticação**, se o Spring Security exigir token, na função `getAuthHeaders()` em `src/services/api.ts`.
5. **Pedidos, descontos, devolução e colaboradores:** quando o back criar os endpoints, trocar `exigirModoLocal()` pelo mesmo padrão de clientes e produtos (`post`/`get` + `ENDPOINTS`) em `src/services/api.ts`.
6. **CORS:** o back-end precisa liberar a origem `http://localhost:5173`. Se aparecer `Failed to fetch` no front e erro de CORS no console do navegador (F12), o ajuste é feito no Spring.

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
├── utils.ts            # formatação de moeda e datas, busca sem acento, helper de formulário
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

- [ ] Integrar com o back-end real e validar os campos
- [ ] Endpoints de pedidos (venda e aluguel), descontos, devolução e colaboradores no back-end
- [x] Função de pagar o pedido (devolver o crédito ao cliente)
- [ ] Endpoints de pagamento e da situação do cliente (inadimplente) no back-end
- [ ] Editar e excluir registros
- [ ] Validação de formulário campo a campo
- [ ] Autenticação (se exigida pelo back)

## Equipe

- Front-end: Gabriel ([@GabrielCardossso](https://github.com/GabrielCardossso))
- Back-end: Lucas ([@LionT750](https://github.com/LionT750))
- Tech lead: Rafael ([@confeyte ](https://github.com/confeyte))
- QA: João ([@CoruJa1m  ](https://github.com/CoruJa1m))
