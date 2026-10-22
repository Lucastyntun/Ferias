# 🗓️ Gestão de Férias dos Funcionários

Site (HTML + CSS + JavaScript puro) para organizar as férias, com **calendário mensal**, **limite máximo de funcionários em férias por dia** e sistema de **utilizadores com aprovação pelo admin**.

Funciona de duas formas:
- **Local:** basta abrir o ficheiro `index.html` no navegador (duplo clique).
- **Publicado na Vercel:** deploy estático automático (ver secção abaixo).

## 👤 Contas de acesso

| Conta | Utilizador | Palavra-passe | Como se obtém |
|---|---|---|---|
| Admin inicial | `admin` | `admin123` | Já existe à partida |
| Funcionários | à sua escolha | à sua escolha | O **admin cria** na secção "Administração" **OU** cada pessoa usa "Registar-se" no ecrã de login e o admin aprova |

> ⚠️ Altere a palavra-passe do admin antes de publicar: faça login como `admin`, apague a conta... (não é possível apagar o próprio admin) — em alternativa edite a linha `hashSenha("admin123")` em `app.js` para a sua nova palavra-passe, ou crie um novo admin e use-o.

## ✨ Funcionalidades

### Calendário
- Vista mensal com navegação ◀ Hoje ▶
- Cada dia mostra **quantos funcionários estão de férias** (ex.: 🏖️ 2/3) e os nomes
- Dias que atingiram o limite aparecem a **vermelho com ⛔** — os utilizadores veem logo onde podem ou não meter férias

### Limite máximo em simultâneo
- O **admin define** o limite máximo de funcionários em férias por dia (secção Administração)
- Ao preencher o pedido, uma **pré-visualização imediata** avisa se alguma data já está cheia
- O envio fica **bloqueado** se algum dia do período já tiver atingido o limite

### Utilizadores e papéis
- **Login / Registo / Logout** ("Terminar sessão")
- Registo público → conta fica **pendente** até o admin **aprovar** (pode também suspender/reactivar/apagar)
- O admin pode **criar utilizadores já aprovados** (funcionário ou admin)
- Funcionários só veem e gerem os **seus próprios pedidos**; o admin vê/tudo (aprovar/recusar/apagar)
- Impede férias sobrepostas do mesmo funcionário; conta dias úteis automaticamente

## 📁 Ficheiros
| Ficheiro | Descrição |
|---|---|
| `index.html` | Estrutura da página (login/registo + aplicação) |
| `style.css` | Estilos visuais (inclui calendário) |
| `app.js` | Toda a lógica (autenticação, pedidos, calendário, limites) |
| `vercel.json` | Configuração para publicação na Vercel |

## 🚀 Publicar na Vercel

**Opção A — Via GitHub (recomendado):**
1. Faça *push* destes ficheiros todos para um repositório no GitHub.
2. Vá a [vercel.com/new](https://vercel.com/new) e importe o repositório.
3. Framework preset: **Other**. Build command: vazio. Output directory: raiz.
4. Clique em **Deploy** → site online em `https://o-seu-projeto.vercel.app`.

**Opção B — Linha de comandos:**
```bash
npm i -g vercel
cd pasta-do-site
vercel --yes
```

## ⚠️ Limitação importante (dados partilhados)

Este site é **100% front-end**: os dados vivem no `localStorage` de **cada computador/navegador**. Na Vercel, qualquer pessoa consegue abrir o site e criar contas/pedidos, mas **cada visitante vê apenas os dados do dispositivo dele** — as férias NÃO são partilhadas entre pessoas nem sincronizadas.

Para ser um sistema real partilhado (todos veem o mesmo calendário), é preciso ligar a uma base de dados externa, por exemplo:
- **[Supabase](https://supabase.com)** (gratuito, com autenticação incluída) — combinação ideal com a Vercel
- Firebase (Google)

Posso fazer essa integração quando quiser — o interface atual mantém-se igual, apenas trocamos o `localStorage` pela base de dados.

Além disso, num site estático sem servidor a "autenticação" é simbólica (as palavras-passe ficam no browser de cada utilizador, com hash simples). Para segurança real, use Supabase Auth.
