# Modelo Front — Cadastro de Cliente e Produto

Front-end em **React + TypeScript** (com Vite), feito pra conversar com o back-end em **Java / Spring Boot / Spring Security**.

A tela tem dois blocos:

| Bloco   | Campos                                   | Botão              |
|---------|------------------------------------------|--------------------|
| Cliente | Nome do cliente, Telefone ou e-mail      | Cadastrar cliente  |
| Produto | Nome do produto, Código do produto       | Cadastrar produto  |

Cada botão faz um `POST` em JSON para o back-end. Ainda não tem listagem.

---

## Como rodar

Precisa do Node.js 18+ instalado.

```bash
npm install
npm run dev
```

Abra http://localhost:5173

---

## O que você precisa trocar

São só **4 lugares**. Todos têm um comentário `TODO` no código.

### 1. URL do back-end → `.env`

```env
VITE_API_URL=http://localhost:8080
```

Coloque a URL onde o Spring Boot está rodando. Se o `.env` não existir, copie o `.env.example`.
> Depois de mudar o `.env`, pare e rode `npm run dev` de novo.

### 2. Endpoints de cadastro → `src/config/api.ts`

```ts
export const ENDPOINTS = {
  cadastrarCliente: '/api/clientes',   // ← coloque seu endpoint de cadastro de cliente aqui
  cadastrarProduto: '/api/produtos',   // ← coloque seu endpoint de cadastro de produto aqui
};
```

Pegue os caminhos certos no Swagger do back-end:
`http://localhost:8080/swagger-ui/index.html`

### 3. Nomes dos campos (tem que bater com o DTO do Java) → `src/services/api.ts`

O front manda este JSON:

```json
// Cliente
{ "nome": "Maria", "contato": "maria@email.com" }

// Produto
{ "nome": "Teclado", "codigo": "PRD-001" }
```

Se o DTO no Java tiver outros nomes (ex.: `nomeCliente`, `email`, `telefone`, `codigoProduto`), troque nas interfaces `ClienteRequest` / `ProdutoRequest` em `src/services/api.ts` **e** no `App.tsx`, onde os objetos são montados:

```ts
// src/App.tsx
await cadastrarCliente({ nome: nomeCliente, contato: contatoCliente });
await cadastrarProduto({ nome: nomeProduto, codigo: codigoProduto });
```

Exemplo do DTO que esse JSON espera do lado do Java:

```java
public record ClienteRequest(String nome, String contato) {}
public record ProdutoRequest(String nome, String codigo) {}
```

### 4. Autenticação (Spring Security) → `src/services/api.ts`

Se o back exigir token, preencha a função `getAuthHeaders()`:

```ts
function getAuthHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}
```

Se os endpoints de cadastro estiverem liberados (`permitAll()`), deixe como está (`return {}`).

---

## Recado pro pessoal do back-end (CORS)

O front roda em `http://localhost:5173` e o back em `http://localhost:8080`. São origens diferentes, então **o back precisa liberar CORS**, senão o navegador bloqueia e aparece `Failed to fetch` na tela.

Com Spring Security, algo assim no `SecurityConfig`:

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .cors(Customizer.withDefaults())
        .csrf(csrf -> csrf.disable())
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
            .anyRequest().permitAll() // ajuste conforme a regra de vocês
        );
    return http.build();
}

@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("http://localhost:5173"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```

---

## Estrutura

```
src/
├── config/
│   └── api.ts        ← URL base + endpoints (TROCAR AQUI)
├── services/
│   └── api.ts        ← chamadas POST, formato do JSON, token
├── App.tsx           ← a tela (inputs e botões)
├── App.css           ← estilo
└── main.tsx          ← ponto de entrada
```

## Erros comuns

| Mensagem na tela          | Causa provável                                              |
|---------------------------|-------------------------------------------------------------|
| `Failed to fetch`         | Back-end desligado, URL errada no `.env` ou CORS bloqueado   |
| `Erro 404`                | Endpoint errado em `src/config/api.ts`                       |
| `Erro 400`                | Nome dos campos do JSON não bate com o DTO                   |
| `Erro 401` / `Erro 403`   | Spring Security bloqueando — falta token ou liberar a rota   |
