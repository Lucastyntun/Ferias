# 🗓️ Gestão de Férias dos Funcionários

Site (HTML + CSS + JavaScript puro) para organizar as férias, com **calendário mensal**,
**limite máximo de funcionários em férias por dia**, **utilizadores com aprovação pelo admin**
e **dados partilhados na nuvem via Supabase** (todos os PCs veem as mesmas férias, em tempo real).

## 🚀 Como colocar a funcionar (uma única vez)

1. **Projeto Supabase** — já criado: `https://tbdwpvavrrhlhmxjksug.supabase.co` ✅
2. **Esquema da base de dados**: abra o *SQL Editor* no painel do Supabase, cole todo o
   conteúdo de [`supabase-schema.sql`](supabase-schema.sql) e clique **RUN**.
3. **Criar o admin inicial**:
   - Authentication → Users → **Add user**: email `admin@ferias.local`, password `admin123`
     (deixe "Auto-confirmed password" marcado);
   - Copie o **ID (UUID)** desse utilizador e execute no SQL Editor:
     ```sql
     insert into public.profiles (id, username, role, estado)
     values ('COLE_O_UUID_AQUI', 'admin', 'admin', 'ativo');
     ```
4. **Desligar confirmação de email** (para o registo/criação de contas funcionar):
   Authentication → Sign In / Up → Email → desative **Confirm email**.
5. **Publicar na Vercel**: importe este repositório (deploy estático, sem variáveis).

## 👤 Contas de acesso

| Conta | Utilizador | Palavra-passe | Como se obtém |
|---|---|---|---|
| Admin inicial | `admin` | `admin123` | Criada nos passos 3 acima |
| Funcionários | à escolha | à escolha | O **admin cria** em "Administração" **OU** cada pessoa usa "Registar-se" (fica pendente até o admin aprovar) |

> No campo de utilizador pode escrever apenas `admin` — o site acrescenta `@ferias.local` automaticamente.
> ⚠️ Altere a palavra-passe do admin depois do primeiro login (Authentication → Users → Edit).

## ✨ Funcionalidades

### Calendário
- Vista mensal com navegação ◀ Hoje ▶
- Cada dia mostra **quantos funcionários estão de férias** (ex.: 🏖️ 2/3) e os nomes
- Dias que atingiram o limite aparecem a **vermelho com ⛔**

### Limite máximo em simultâneo
- O **admin define** o limite (guardado na nuvem — igual para todos)
- **Pré-visualização imediata** ao preencher o pedido; envio **bloqueado** se algum dia estiver cheio

### Utilizadores e papéis
- **Login / Registo / Logout** com autenticação Supabase (palavras-passe cifradas na nuvem)
- Registo público → conta **pendente** até o admin **aprovar** (pode suspender/reactivar/apagar)
- O admin pode **criar utilizadores já aprovados** (funcionário ou admin)
- Funcionários só veem/gere os **seus próprios pedidos**; o admin vê tudo (aprovar/recusar/apagar)
- Impede férias sobrepostas do mesmo funcionário; conta dias úteis automaticamente

### Dados partilhados + tempo real
- Tudo é guardado no **Supabase** (PostgreSQL), não no navegador
- Quando um utilizador envia/aprova um pedido, **os outros veem a alteração sozinhos**
  (subscrição em tempo real) — basta ter o separador aberto

## 🔐 Segurança
- As regras **RLS** (Row Level Security) em `supabase-schema.sql` garantem que:
  - qualquer pessoa autenticada lê pedidos/perfis e cria pedidos;
  - só o dono cancela pedidos pendentes seus;
  - só administradores alteram pedidos, perfis e definições.
- A chave *anon* incluída em `app.js` é **pública por design**; a proteção vem das RLS.
- **Nunca** coloque a `service_role key` no código do site.

## 📁 Ficheiros
| Ficheiro | Descrição |
|---|---|
| `index.html` | Estrutura da página (login/registo + aplicação) |
| `style.css` | Estilos |
| `app.js` | Lógica da aplicação + ligação ao Supabase |
| `supabase-schema.sql` | Esquema da base de dados + políticas RLS (colar no SQL Editor) |
| `vercel.json` | Configuração de deploy estático na Vercel |
| `LEIAME.md` | Instruções detalhadas (versão anterior, local) |
