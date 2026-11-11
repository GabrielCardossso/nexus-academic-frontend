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

Versão inicial, com uma tela única dividida em duas colunas:

- **Cadastro:** formulários de **Cliente** (nome e contato) e **Produto** (nome e código).
- **Listagem:** botões para **listar clientes** e **listar produtos**, exibindo o que o back-end devolve.

O front se comunica com o back-end por requisições HTTP (JSON). A lista é atualizada automaticamente quando um novo registro é cadastrado.

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
npm run build     # gera a versão de produção na pasta dist/
npm run preview   # serve localmente a versão gerada pelo build
```

## Configuração do back-end

A URL do back-end é definida no arquivo `.env` (que **não vai para o Git**):

```env
VITE_API_URL=http://localhost:8080
```

Se o `.env` não existir, o front usa `http://localhost:8080` (porta padrão do Spring Boot). Use o `.env.example` como modelo.

> Nunca suba o `.env` para o repositório. Ele já está no `.gitignore`.

### Endpoints esperados

Os caminhos ficam centralizados em `src/config/api.ts`:

| Ação | Método | Caminho |
|---|---|---|
| Cadastrar cliente | `POST` | `/api/clientes` |
| Listar clientes | `GET` | `/api/clientes` |
| Cadastrar produto | `POST` | `/api/produtos` |
| Listar produtos | `GET` | `/api/produtos` |

Formato dos dados enviados:

```json
// POST /api/clientes
{ "nome": "Maria", "contato": "maria@email.com" }

// POST /api/produtos
{ "nome": "Cera automotiva", "codigo": "CER-001" }
```

Na listagem, o front aceita tanto uma lista simples (`[ {...} ]`) quanto a paginação do Spring (`{ "content": [ {...} ] }`).

## Integração com o back-end

Para casar o front com a API real, ajuste:

1. **Caminhos dos endpoints** em `src/config/api.ts` (confira no Swagger do back: `http://localhost:8080/swagger-ui/index.html`).
2. **Nomes dos campos** em `src/services/api.ts` (`ClienteRequest`, `ProdutoRequest`, `ClienteResponse`, `ProdutoResponse`) para bater com os DTOs do Java.
3. **Autenticação**, se o Spring Security exigir token, na função `getAuthHeaders()` em `src/services/api.ts`.
4. **CORS:** o back-end precisa liberar a origem `http://localhost:5173`. Se aparecer `Failed to fetch` no front e erro de CORS no console do navegador (F12), o ajuste é feito no Spring.

## Estrutura do projeto

```
src/
├── main.tsx          # ponto de entrada da aplicação
├── App.tsx           # tela principal (cadastro + listagem)
├── App.css           # estilos
├── config/
│   └── api.ts        # URL base e caminhos dos endpoints
└── services/
    └── api.ts        # tipos e chamadas HTTP ao back-end
```

## Próximos passos

- [ ] Integrar com o back-end real e validar os campos
- [ ] Editar e excluir registros
- [ ] Validação de formulário campo a campo
- [ ] Autenticação (se exigida pelo back)
- [ ] Múltiplas telas e navegação

## Equipe

- Front-end: Gabriel ([@GabrielCardossso](https://github.com/GabrielCardossso))
- Back-end: Lucas ([@LionT750](https://github.com/LionT750))
- Tech lead: Rafael ([@confeyte ](https://github.com/confeyte))
- QA: João ([@CoruJa1m  ](https://github.com/CoruJa1m))
