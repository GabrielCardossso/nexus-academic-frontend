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

Aplicação com **menu lateral** (que pode ser recolhido para mostrar só os ícones) e quatro telas:

| Grupo | Tela | O que faz |
|---|---|---|
| Cadastros | **Clientes** | Cadastra cliente (nome ou razão social, CNPJ, telefone, e-mail, categoria **Normal** ou **VIP** e limite de crédito) e lista os clientes cadastrados. |
| Cadastros | **Produtos** | Cadastra produto (nome, descrição, estoque, preço de venda, preço de aluguel por mês e status **Disponível**, **Indisponível** ou **Desativado**) e lista os produtos cadastrados. |
| Vendas | **Pedidos** | Monta um pedido de **venda** ou de **aluguel** (cliente, produtos e quantidades, forma de pagamento), mostra a prévia com subtotal, desconto e total, lista os pedidos realizados e permite **devolver** os aluguéis. |
| Gestão | **Colaboradores** | Escolhe o colaborador atual e **aprova ou rejeita** as solicitações de desconto pendentes. |

### Regras de negócio dos pedidos

As regras ficam em funções puras no arquivo `src/regras.ts`, usadas tanto pela prévia na tela quanto pelos dados locais:

- **Produtos:** só entram no pedido produtos com status *Disponível* e estoque maior que zero. A quantidade não pode passar do estoque, e o estoque é baixado quando o pedido é feito (venda ou aluguel).
- **Tipo do pedido:** *Venda* usa o preço de venda do produto. *Aluguel* usa o preço de aluguel **por mês**.
- **Aluguel:** o cliente informa a duração em **meses**. O início é a data do pedido e o fim do aluguel é calculado pela quantidade de meses. O valor é **preço por mês × meses × quantidade**. Na **devolução**, o estoque volta.
- **Cliente VIP:** recebe **5% de desconto automático**, em qualquer forma de pagamento.
- **Cliente Normal:** pode **solicitar** 5% ou 10% de desconto. O desconto só é aplicado depois que um colaborador **aprova** a solicitação; se for rejeitada, o pedido segue sem desconto.
- **Formas de pagamento:** PIX, à vista ou a prazo (valem para venda e aluguel).
  - PIX e à vista: o pedido já fica **Pago**, a não ser que exista uma solicitação de desconto ainda pendente.
  - A prazo: o pedido fica **Pendente** e o total não pode ultrapassar o **limite de crédito** do cliente. Na venda o vencimento é em **30 dias**; no aluguel, é o fim do aluguel.
- **Limite de crédito:** todo pedido a prazo (venda ou aluguel) **desconta o total do limite do cliente** assim que é criado. Se o desconto de um pedido a prazo for aprovado, a diferença volta para o limite. O crédito **não volta** na devolução nem existe ainda a função de pagar o pedido.
- Subtotal, desconto, total e status do pedido **não são salvos**: são sempre calculados a partir dos itens, da categoria do cliente, da forma de pagamento, da duração (aluguel) e da solicitação.

### Dados locais (sem back-end)

Por enquanto o front funciona sozinho. Em `src/config/api.ts` a constante `USAR_DADOS_LOCAIS` está como `true`, e então tudo é salvo e lido do **localStorage** do navegador por `src/services/dadosLocais.ts`, que faz o papel do back-end:

- Gera os IDs sozinho (maior ID atual + 1).
- Valida o **CNPJ** (dígitos verificadores, aceitando também o CNPJ alfanumérico) e não deixa cadastrar dois clientes com o mesmo e-mail.
- Usa **3 colaboradores fictícios** (Ana Souza, Carlos Lima e Beatriz Rocha), porque ainda não existe cadastro de colaborador.
- Guarda os dados nas chaves `nexus:v3:clientes`, `nexus:v3:produtos` e `nexus:v3:pedidos`. Para limpar, abra o navegador em **F12 > Application > Local Storage** e apague as chaves `nexus:*`.

Para usar o back-end real, troque para `USAR_DADOS_LOCAIS = false` em `src/config/api.ts`. Nesse modo, **clientes e produtos** (cadastro e listagem) chamam a API. **Pedidos (venda e aluguel), descontos, devolução e colaboradores** ainda não têm endpoint no back-end e **só funcionam no modo local**: com a flag desligada essas telas mostram o erro "ainda não têm endpoint no back-end".

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

Pedidos (venda e aluguel), descontos, devolução e colaboradores ainda não têm endpoint definido.

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
└── icons/              # ícones SVG do menu lateral
src/
├── main.tsx            # ponto de entrada da aplicação
├── App.tsx             # layout: menu lateral + troca de telas
├── App.css             # estilos
├── types.ts            # tipos dos DTOs (Cliente, Produto, Pedido, Desconto...)
├── regras.ts           # regras de pedido e desconto (funções puras)
├── utils.ts            # formatação de moeda e datas, helper de formulário
├── config/
│   └── api.ts          # URL base, caminhos dos endpoints e flag USAR_DADOS_LOCAIS
├── services/
│   ├── api.ts          # chamadas HTTP ao back-end
│   └── dadosLocais.ts  # back-end "de mentira" no localStorage
├── components/
│   └── ListaCard.tsx   # card de listagem reutilizado
└── telas/
    ├── ClientesTela.tsx
    ├── ProdutosTela.tsx
    ├── PedidosTela.tsx
    └── ColaboradoresTela.tsx
```

## Próximos passos

- [ ] Integrar com o back-end real e validar os campos
- [ ] Endpoints de pedidos (venda e aluguel), descontos, devolução e colaboradores no back-end
- [ ] Função de pagar o pedido (devolver o crédito ao cliente)
- [ ] Editar e excluir registros
- [ ] Validação de formulário campo a campo
- [ ] Autenticação (se exigida pelo back)

## Equipe

- Front-end: Gabriel ([@GabrielCardossso](https://github.com/GabrielCardossso))
- Back-end: Lucas ([@LionT750](https://github.com/LionT750))
- Tech lead: Rafael ([@confeyte ](https://github.com/confeyte))
- QA: João ([@CoruJa1m  ](https://github.com/CoruJa1m))
