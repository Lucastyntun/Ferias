# 🗓️ Gestão de Férias — Departamentos (Admin/RH · Chefes · Funcionários)

Site (HTML + CSS + JavaScript puro) para organizar as férias **por departamentos**, com
**calendário mensal por departamento**, **quota de dias por funcionário definida pelo admin**,
**aprovação pelo chefe de departamento** e **decisão final do RH sempre por cima** (com marca
"RH aprovou/recusou").

Funciona de duas formas:
- **Local:** basta abrir o ficheiro `index.html` no navegador (duplo clique). Os dados ficam no `localStorage` **do computador/navegador onde abriu** — cada PC tem os seus dados.
- **Publicado na Vercel/GitHub Pages:** todos usam a mesma página, **mas continuam a ser dados locais de cada navegador** (o localStorage não é partilhado entre utilizadores). Para dados realmente partilhados entre PCs é preciso ligar a uma base de dados (ex.: Supabase — ver `supabase-schema.sql`).

## 👤 Contas de acesso

| Conta | Utilizador | Palavra-passe | Como se obtém |
|---|---|---|---|
| Admin inicial (RH) | `admin` | `admin123` | Já existe à partida |
| Chefe de departamento | à sua escolha | à sua escolha | O **admin cria** (papel "Chefe de departamento") **ou** escolhe um funcionário existente no selector "Chefe" da tabela de departamentos |
| Funcionários | à sua escolha | à sua escolha | O **admin cria** dentro de um departamento **ou** registam-se e o admin coloca-os no departamento e aprova |
| Papel RH extra | à sua escolha | à sua escolha | O admin pode criar contas com papel "RH" que vêem tudo e têm decisão final como o admin |

> ⚠️ Altere a palavra-passe do admin antes de publicar (edite `hashSenha("admin123")` em `app.js` ou crie outro gestor).

## ✨ Funcionalidades

### Papéis e fluxo de aprovação
- **Admin/RH**: cria departamentos, escolhe o **chefe de cada departamento**, insere os
  funcionários nos departamentos, define a **quota de dias de férias de cada funcionário**
  e o **limite máximo global** de pessoas em férias no mesmo dia. As suas decisões são **finais**.
- **Chefe de departamento**: aprova/recusa os pedidos dos funcionários do seu departamento;
  pode **solicitar ao admin o aumento da quota** de um funcionário (pedido com mês, nº de dias e motivo).
- **Funcionário**: pede férias; vê apenas os próprios pedidos e o calendário do seu departamento.
- Se o **RH aprovar ou recusar** um pedido, aparece uma **marca d'água** ("💮 RH aprovou" /
  "💮 RH recusou" + data) por cima de qualquer decisão anterior do chefe. O RH pode reverter a sua decisão.

### Quota de dias por funcionário
- Cada funcionário tem uma quota anual (ex.: 22 dias úteis) definida pelo admin.
- Ao pedir férias, o sistema bloqueia pedidos que excedam a quota.
- O chefe faz o pedido de aumento ao admin; quando o admin **aprova**, a quota sobe automaticamente.

### Calendário por departamento
- Cada departamento mostra **apenas as férias dos seus elementos**.
- O RH/admin pode alternar entre departamentos num selector.
- Dias cheios (limite global atingido) ficam marcados com ⛔; contagem local + global visível.

### Outras regras
- Registo público → conta **pendente** até o admin aprovar (e colocar num departamento).
- Impede férias sobrepostas do mesmo funcionário; conta dias úteis automaticamente.
- Contas suspensas não conseguem entrar; chefes suspensos perdem o papel.

## 📁 Ficheiros
| Ficheiro | Descrição |
|---|---|
| `index.html` | Estrutura da página (login/registo + aplicação) |
| `app.js` | Toda a lógica (utilizadores, departamentos, pedidos, quotas, calendário) |
| `style.css` | Estilos (inclui a marca d'água das decisões RH) |
| `supabase-schema.sql` | (Opcional) tabelas para ligar a uma base de dados real |
| `vercel.json` | Configuração de deploy estático na Vercel |

## 🚀 Publicar no GitHub / Vercel
1. Substitua os ficheiros `index.html`, `app.js` e `style.css` no repositório (commit + push).
2. A Vercel volta a fazer o deploy automaticamente (projeto já ligado ao repositório).
3. Não precisa de mudar nada mais — o site funciona sem configuração adicional.

## 🔒 Aviso
Este projeto guarda tudo no navegador (localStorage) e usa um "hash" simples das palavras-passe —
é adequado para testar a ideia. Para uso real numa empresa (vários PCs a ver os mesmos dados),
o próximo passo é integrar Supabase (o schema já está incluído).
