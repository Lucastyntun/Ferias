/* =========================================================
   Gestão de Férias — Admin (RH) · Chefes de Departamento · Funcionários
   - Admin/RH cria departamentos, escolhe o chefe (papel RH),
     insere os funcionários em cada departamento
   - Cada funcionário tem uma quota de dias de férias definida pelo admin;
     o chefe pode pedir ao admin para aumentar essa quota
   - O chefe de departamento aprova/recusa os pedidos do seu dept.
   - As decisões do admin (RH) são FINAIS e aparecem como "marca d'água"
     (RH aprovou / RH recusou) sobre qualquer decisão anterior
   - Calendário mostra apenas as férias do departamento visível
   - Limite global de funcionários em férias no mesmo dia (definido pelo admin)
   - Login inicial: admin / admin123
   100% local (localStorage) — funciona abrindo o index.html no PC.
   ========================================================= */

// ---------- Chaves do localStorage ----------
const KEY_UTILIZADORES = "ferias_utilizadores";
const KEY_SESSAO       = "ferias_sessao";
const KEY_PEDIDOS      = "ferias_pedidos";
const KEY_CONFIG       = "ferias_config";
const KEY_DEPARTAMENTOS= "ferias_departamentos";
const KEY_SOLICITACOES = "ferias_solicitacoes";

// ---------- Estado ----------
let utilizadores   = JSON.parse(localStorage.getItem(KEY_UTILIZADORES) || "null");
let pedidos        = JSON.parse(localStorage.getItem(KEY_PEDIDOS) || "[]");
let departamentos  = JSON.parse(localStorage.getItem(KEY_DEPARTAMENTOS) || "[]");
let solicitacoes   = JSON.parse(localStorage.getItem(KEY_SOLICITACOES) || "[]");
let config         = JSON.parse(localStorage.getItem(KEY_CONFIG) || "null") || { limiteMaxGlobal: 3 };
let sessao         = JSON.parse(localStorage.getItem(KEY_SESSAO) || "null");

// Garante que existe sempre um administrador inicial
if (!utilizadores || !utilizadores.some(u => u.papel === "admin")) {
  utilizadores = [{
    username: "admin",
    nome: "Administração (RH)",
    pass: hashSenha("admin123"),
    papel: "admin",
    departamento: null,
    quotaDias: null,
    estado: "ativo"
  }];
  guardarUtilizadores();
}

// ---------- Referências ao DOM ----------
const $ = (id) => document.getElementById(id);

const loginScreen   = $("login-screen");
const appScreen     = $("app-screen");
const loginForm     = $("login-form");
const loginError    = $("login-error");
const loginHint     = $("login-hint");
const registerForm  = $("register-form");
const registerError = $("register-error");
const registerOk    = $("register-ok");

const logoutBtn   = $("logout-btn");
const welcomeUser = $("welcome-user");

const vacForm     = $("vacation-form");
const startInput  = $("start-date");
const endInput    = $("end-date");
const notesInput  = $("notes");
const formMessage = $("form-message");
const formError   = $("form-error");

const tbody    = $("vacation-tbody");
const emptyMsg = $("empty-msg");

const calTitle    = $("cal-title");
const calGrid     = $("cal-grid");
const calPrev     = $("cal-prev");
const calNext     = $("cal-next");
const calToday    = $("cal-today");
const calLegend   = $("cal-legend");
const calDeptSel  = $("cal-dept");
const limiteInput = $("limite-max");

const userTbody = $("user-tbody");

const quotaInfo = $("quota-info");

const deptTbody = $("dept-tbody");

const reqFilter = $("req-filter");

const MEOPCOES = ["Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro"];

// Mês actualmente visível no calendário
const hoje = new Date();
let calAno = hoje.getFullYear();
let calMes = hoje.getMonth(); // 0-11
let calDeptVisto = null;      // departamento mostrado no calendário

// Papel de acesso aos dados globais (admin + RH)
function isGestor(u) { return u && (u.papel === "admin" || u.papel === "rh"); }

// =========================================================
// Utilidades
// =========================================================
function guardarUtilizadores() { localStorage.setItem(KEY_UTILIZADORES, JSON.stringify(utilizadores)); }
function guardarPedidos()      { localStorage.setItem(KEY_PEDIDOS, JSON.stringify(pedidos)); }
function guardarConfig()       { localStorage.setItem(KEY_CONFIG, JSON.stringify(config)); }
function guardarDepartamentos(){ localStorage.setItem(KEY_DEPARTAMENTOS, JSON.stringify(departamentos)); }
function guardarSolicitacoes() { localStorage.setItem(KEY_SOLICITACOES, JSON.stringify(solicitacoes)); }
function guardarSessao()       { localStorage.setItem(KEY_SESSAO, JSON.stringify(sessao)); }

// "Hash" simples ( NÃO é seguro — apenas evita ler palavras-passe à vista ).
function hashSenha(senha) {
  const str = "ferias::" + senha;
  let h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
}

function formatarData(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-PT");
}

function isoDia(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + dia;
}

function listarDias(inicioISO, fimISO) {
  const dias = [];
  const d = new Date(inicioISO + "T00:00:00");
  const fim = new Date(fimISO + "T00:00:00");
  while (d <= fim) {
    dias.push(isoDia(d));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

function diasUteis(inicioISO, fimISO) {
  return listarDias(inicioISO, fimISO)
    .filter(iso => { const g = new Date(iso + "T00:00:00").getDay(); return g !== 0 && g !== 6; })
    .length;
}

function nomeDept(id) {
  const d = departamentos.find(x => x.id === id);
  return d ? d.nome : "—";
}

function userPorNome(username) {
  return utilizadores.find(u => u.username.toLowerCase() === String(username).toLowerCase());
}

// Contagem global por dia (apenas aprovados; RH conta sempre, chefe só se não houver decisão RH)
function contarEmFeriasNoDiaGlobal(iso) {
  const nomes = new Set();
  pedidos.forEach(p => {
    if (p.decisaoRH) {
      if (p.decisaoRH.estado === "Aprovado") nomes.add(p.funcionario);
    } else if (p.estado === "Aprovado") {
      nomes.add(p.funcionario);
    }
  });
  return nomes;
}

// Contagem por departamento
function contarEmFeriasNoDiaDept(iso, deptId) {
  const nomes = new Set();
  pedidos.forEach(p => {
    const u = userPorNome(p.funcionario);
    if (!u || u.departamento !== deptId) return;
    if (p.decisaoRH) {
      if (p.decisaoRH.estado === "Aprovado") nomes.add(p.funcionario);
    } else if (p.estado === "Aprovado") {
      nomes.add(p.funcionario);
    }
  });
  return nomes;
}

// Dias do período que já atingiram o limite global
function diasComLimiteAtingido(inicioISO, fimISO) {
  return listarDias(inicioISO, fimISO)
    .filter(iso => contarEmFeriasNoDiaGlobal(iso).size >= config.limiteMaxGlobal);
}

// Sobreposição do mesmo funcionário (pendentes + aprovados, excluindo um pedido)
function haSobreposicao(funcionario, inicioISO, fimISO, excluirId) {
  return pedidos.some(p =>
    p.id !== excluirId &&
    p.funcionario.toLowerCase() === String(funcionario).toLowerCase() &&
    p.estado !== "Recusado" && !(p.decisaoRH && p.decisaoRH.estado === "Recusado") &&
    inicioISO <= p.fim && fimISO >= p.inicio
  );
}

// Dias de quota já consumidos (contados após a data de referência `antes`, ou todos)
function diasConsumidos(username, antes) {
  let total = 0;
  pedidos.forEach(p => {
    if (p.funcionario.toLowerCase() !== String(username).toLowerCase()) return;
    const aprovado = p.decisaoRH ? p.decisaoRH.estado === "Aprovado" : p.estado === "Aprovado";
    if (!aprovado) return;
    listarDias(p.inicio, p.fim).forEach(iso => {
      const g = new Date(iso + "T00:00:00").getDay();
      if (g === 0 || g === 6) return;
      if (antes && iso >= antes) return;
      total++;
    });
  });
  return total;
}

function mostrarMsg(el, texto) {
  el.textContent = texto;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// =========================================================
// Login / Registo / Logout
// =========================================================
function entrarApp(user) {
  sessao = { username: user.username, papel: user.papel, departamento: user.departamento };
  guardarSessao();
  mostrarApp();
}

function mostrarApp() {
  if (!sessao) return;
  const u = userPorNome(sessao.username);
  if (!u || u.estado !== "ativo") { sair(); return; }
  sessao.papel = u.papel;
  sessao.departamento = u.departamento;

  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");

  const rotulo = u.papel === "admin" ? "Admin · RH" : u.papel === "rh" ? "Chefe RH" : "Chefe · " + nomeDept(u.departamento);
  welcomeUser.textContent = "Olá, " + (u.nome || u.username) + " (" + rotulo + ")";

  document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", !isGestor(u)));
  document.querySelectorAll(".gestor-only").forEach(el => el.classList.toggle("hidden", !isGestor(u)));
  document.querySelectorAll(".chefe-only").forEach(el => el.classList.toggle("hidden", !(u.papel === "chefe" || isGestor(u))));

  renderizarTudo();
}

function sair() {
  sessao = null;
  localStorage.removeItem(KEY_SESSAO);
  appScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  loginForm.reset();
  registerForm.reset();
  loginError.classList.add("hidden");
  registerError.classList.add("hidden");
  registerOk.classList.add("hidden");
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const user = $("username").value.trim().toLowerCase();
  const pass = $("password").value;
  const encontrado = utilizadores.find(u => u.username.toLowerCase() === user);

  if (!encontrado || hashSenha(pass) !== encontrado.pass) {
    loginError.textContent = "Utilizador ou palavra-passe incorretos.";
    loginError.classList.remove("hidden");
    return;
  }
  if (encontrado.estado === "pendente") {
    loginError.textContent = "A sua conta ainda está a aguardar aprovação do administrador.";
    loginError.classList.remove("hidden");
    return;
  }
  if (encontrado.estado === "suspenso") {
    loginError.textContent = "A sua conta foi suspensa. Contacte o administrador.";
    loginError.classList.remove("hidden");
    return;
  }
  loginError.classList.add("hidden");
  entrarApp(encontrado);
});

registerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const user = $("reg-username").value.trim().toLowerCase();
  const nome = $("reg-nome").value.trim();
  const pass = $("reg-password").value;
  const pass2 = $("reg-password2").value;

  if (user.length < 3) { erroRegisto("O utilizador deve ter pelo menos 3 caracteres."); return; }
  if (pass.length < 4) { erroRegisto("A palavra-passe deve ter pelo menos 4 caracteres."); return; }
  if (pass !== pass2) { erroRegisto("As palavras-passe não coincidem."); return; }
  if (utilizadores.some(u => u.username.toLowerCase() === user)) {
    erroRegisto("Esse utilizador já existe."); return;
  }

  utilizadores.push({
    username: user, nome: nome || user, pass: hashSenha(pass),
    papel: "funcionario", departamento: null, quotaDias: 22, estado: "pendente"
  });
  guardarUtilizadores();
  registerError.classList.add("hidden");
  registerForm.reset();
  mostrarMsg(registerOk, "✅ Conta criada! Aguarde que o administrador a coloque num departamento e aprove.");
});

function erroRegisto(msg) {
  registerError.textContent = msg;
  registerError.classList.remove("hidden");
}

logoutBtn.addEventListener("click", sair);

$("show-register").addEventListener("click", () => {
  loginForm.classList.toggle("hidden");
  registerForm.classList.toggle("hidden");
  loginHint.classList.toggle("hidden");
});
$("show-login").addEventListener("click", () => {
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
  loginHint.classList.remove("hidden");
});

// =========================================================
// Departamentos (apenas gestor/admin)
// =========================================================
$("dept-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const nome = $("dept-nome").value.trim();
  if (!nome) return;
  if (departamentos.some(d => d.nome.toLowerCase() === nome.toLowerCase())) {
    alert("Já existe um departamento com esse nome."); return;
  }
  departamentos.push({ id: Date.now(), nome, chefe: null });
  guardarDepartamentos();
  e.target.reset();
  renderizarTudo();
});

function renderDepartamentos() {
  deptTbody.innerHTML = "";
  if (departamentos.length === 0) {
    deptTbody.innerHTML = '<tr><td colspan="5" class="muted">Ainda não existem departamentos.</td></tr>';
    return;
  }
  departamentos.forEach(d => {
    const tr = document.createElement("tr");
    const nFuncs = utilizadores.filter(u => u.departamento === d.id && u.papel !== "rh").length;
    const pendentes = pedidos.filter(p => {
      const u = userPorNome(p.funcionario);
      return u && u.departamento === d.id && p.estado === "Pendente" && !p.decisaoRH;
    }).length;

    // Nome + nº de funcionários
    const tdNome = document.createElement("td");
    tdNome.innerHTML = "<strong>" + escapeHtml(d.nome) + "</strong><br><span class='muted'>" + nFuncs + " funcionário(s)</span>";

    // Selector de chefe
    const tdChefe = document.createElement("td");
    const sel = document.createElement("select");
    const optNenhum = document.createElement("option");
    optNenhum.value = ""; optNenhum.textContent = "— sem chefe —";
    sel.appendChild(optNenhum);
    utilizadores
      .filter(u => u.departamento === d.id && u.papel === "funcionario" && u.estado === "ativo")
      .forEach(u => {
        const o = document.createElement("option");
        o.value = u.username;
        o.textContent = u.nome || u.username;
        sel.appendChild(o);
      });
    sel.value = d.chefe || "";
    sel.addEventListener("change", () => {
      const novo = sel.value || null;
      // remover chefe anterior do departamento (volta a funcionário)
      departamentos.forEach(x => { if (x.chefe === d.chefe && x.id === d.id) x.chefe = null; });
      d.chefe = novo;
      utilizadores.forEach(u => {
        if (u.username === novo) u.papel = "chefe";
      });
      // se havia chefe anterior, volta a funcionário
      const antigo = utilizadores.find(u => u.papel === "chefe" && u.username !== novo && u.departamento === d.id);
      if (antigo) antigo.papel = "funcionario";
      guardarDepartamentos(); guardarUtilizadores(); renderizarTudo();
    });
    tdChefe.appendChild(sel);
    if (d.chefe) {
      const tag = document.createElement("div");
      tag.className = "muted";
      tag.textContent = "actual: " + d.chefe;
      tdChefe.appendChild(tag);
    }

    // Pedentes
    const tdPend = document.createElement("td");
    tdPend.innerHTML = pendentes > 0 ? "<span class='badge badge-pendente'>" + pendentes + " pendente(s)</span>" : "—";

    // Ver calendário
    const tdVer = document.createElement("td");
    const btnCal = document.createElement("button");
    btnCal.className = "btn btn-secondary btn-small";
    btnCal.textContent = "📅 Calendário";
    btnCal.addEventListener("click", () => {
      calDeptVisto = d.id;
      calDeptSel.value = String(d.id);
      renderCalendario();
      $("cal-title").scrollIntoView({ behavior: "smooth" });
    });
    tdVer.appendChild(btnCal);

    // Apagar
    const tdAcc = document.createElement("td");
    const btnApagar = document.createElement("button");
    btnApagar.className = "btn btn-danger btn-small";
    btnApagar.textContent = "Apagar";
    btnApagar.addEventListener("click", () => {
      if (!confirm("Apagar o departamento \"" + d.nome + "\"? Os funcionários ficam sem departamento.")) return;
      departamentos = departamentos.filter(x => x.id !== d.id);
      utilizadores.forEach(u => { if (u.departamento === d.id && u.papel === "funcionario") u.papel = "funcionario"; u.departamento = null; });
      if (d.chefe) { const c = utilizadores.find(u => u.username === d.chefe); if (c) c.papel = "funcionario"; }
      guardarDepartamentos(); guardarUtilizadores(); renderizarTudo();
    });
    tdAcc.appendChild(btnApagar);

    tr.append(tdNome, tdChefe, tdPend, tdVer, tdAcc);
    deptTbody.appendChild(tr);
  });
}

// =========================================================
// Utilizadores (admin/gestor)
// =========================================================
function papelLabel(p) {
  return p === "admin" ? "Administrador (RH)" : p === "rh" ? "Chefe RH" : p === "chefe" ? "Chefe de dept." : "Funcionário";
}

function renderUtilizadores() {
  userTbody.innerHTML = "";
  const ordenados = utilizadores.slice().sort((a, b) => {
    const da = a.departamento ? nomeDept(a.departamento) : "zzz", db = b.departamento ? nomeDept(b.departamento) : "zzz";
    return da.localeCompare(db) || a.username.localeCompare(b.username);
  });
  ordenados.forEach(u => {
    const tr = document.createElement("tr");

    const tdUser = document.createElement("td");
    tdUser.innerHTML = "<strong>" + escapeHtml(u.nome || u.username) + "</strong><br><span class='muted'>" + escapeHtml(u.username) + "</span>";

    const tdPapel = document.createElement("td");
    tdPapel.textContent = papelLabel(u.papel);

    // Departamento (selector editável pelo admin)
    const tdDept = document.createElement("td");
    if (u.papel === "admin" || u.papel === "rh") {
      tdDept.textContent = "—";
    } else {
      const sel = document.createElement("select");
      const optNenhum = document.createElement("option");
      optNenhum.value = ""; optNenhum.textContent = "— sem —";
      sel.appendChild(optNenhum);
      departamentos.forEach(d => {
        const o = document.createElement("option");
        o.value = String(d.id); o.textContent = d.nome;
        sel.appendChild(o);
      });
      sel.value = u.departamento != null ? String(u.departamento) : "";
      sel.addEventListener("change", () => {
        u.departamento = sel.value ? Number(sel.value) : null;
        guardarUtilizadores(); renderizarTudo();
      });
      tdDept.appendChild(sel);
    }

    // Quota de dias
    const tdQuota = document.createElement("td");
    if (u.papel === "funcionario" || u.papel === "chefe") {
      const inp = document.createElement("input");
      inp.type = "number"; inp.min = "0"; inp.max = "60"; inp.value = u.quotaDias != null ? u.quotaDias : 22;
      inp.style.width = "70px";
      inp.addEventListener("change", () => {
        const v = parseInt(inp.value, 10);
        if (isNaN(v) || v < 0) { inp.value = u.quotaDias; return; }
        u.quotaDias = v; guardarUtilizadores(); renderizarTudo();
      });
      const usados = diasConsumidos(u.username, null);
      tdQuota.appendChild(inp);
      const info = document.createElement("div");
      info.className = "muted";
      info.textContent = usados + "/" + (u.quotaDias != null ? u.quotaDias : 22) + " dias usados";
      tdQuota.appendChild(info);
    } else {
      tdQuota.textContent = "—";
    }

    // Estado
    const tdEstado = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge badge-" + (u.estado === "ativo" ? "aprovado" : u.estado === "pendente" ? "pendente" : "recusado");
    badge.textContent = u.estado.charAt(0).toUpperCase() + u.estado.slice(1);
    tdEstado.appendChild(badge);

    // Ações
    const tdAcoes = document.createElement("td");
    if (u.papel !== "admin") {
      if (u.estado === "pendente") {
        const bApr = document.createElement("button");
        bApr.className = "btn btn-success btn-small"; bApr.textContent = "Aprovar"; bApr.style.marginRight = "6px";
        bApr.addEventListener("click", () => { u.estado = "ativo"; guardarUtilizadores(); renderizarTudo(); });
        const bSus = document.createElement("button");
        bSus.className = "btn btn-secondary btn-small"; bSus.textContent = "Suspender";
        bSus.addEventListener("click", () => { u.estado = "suspenso"; guardarUtilizadores(); renderizarTudo(); });
        tdAcoes.append(bApr, bSus);
      } else if (u.estado === "ativo") {
        const bSus = document.createElement("button");
        bSus.className = "btn btn-secondary btn-small"; bSus.textContent = "Suspender"; bSus.style.marginRight = "6px";
        bSus.addEventListener("click", () => {
          if (u.papel === "chefe") {
            const d = departamentos.find(x => x.chefe === u.username);
            if (d) d.chefe = null;
            guardarDepartamentos();
          }
          u.estado = "suspenso"; u.papel = "funcionario";
          guardarUtilizadores(); renderizarTudo();
        });
        tdAcoes.appendChild(bSus);
      } else {
        const bAtv = document.createElement("button");
        bAtv.className = "btn btn-success btn-small"; bAtv.textContent = "Reativar"; bAtv.style.marginRight = "6px";
        bAtv.addEventListener("click", () => { u.estado = "ativo"; guardarUtilizadores(); renderizarTudo(); });
        tdAcoes.appendChild(bAtv);
      }

      const bApagar = document.createElement("button");
      bApagar.className = "btn btn-danger btn-small"; bApagar.textContent = "Apagar";
      bApagar.addEventListener("click", () => {
        if (!confirm("Apagar o utilizador \"" + u.username + "\"? Os pedidos dele também serão apagados.")) return;
        if (u.papel === "chefe") {
          const d = departamentos.find(x => x.chefe === u.username);
          if (d) d.chefe = null;
          guardarDepartamentos();
        }
        utilizadores = utilizadores.filter(x => x !== u);
        pedidos = pedidos.filter(p => p.funcionario.toLowerCase() !== u.username.toLowerCase());
        guardarUtilizadores(); guardarPedidos(); renderizarTudo();
      });
      tdAcoes.appendChild(bApagar);
    } else {
      tdAcoes.textContent = "—";
    }

    tr.append(tdUser, tdPapel, tdDept, tdQuota, tdEstado, tdAcoes);
    userTbody.appendChild(tr);
  });
}

// Criar utilizador directamente pelo admin (já activo)
function renderDropdownNewDept() {
  const sel = $("new-dept");
  if (!sel) return;
  const actual = sel.value;
  sel.innerHTML = '<option value="">— departamento —</option>';
  departamentos.slice().sort((a, b) => a.nome.localeCompare(b.nome)).forEach(d => {
    const o = document.createElement("option");
    o.value = String(d.id); o.textContent = d.nome;
    sel.appendChild(o);
  });
  if (actual && departamentos.some(d => String(d.id) === actual)) sel.value = actual;
}

$("admin-create-user-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const user = $("new-username").value.trim().toLowerCase();
  const nome = $("new-nome").value.trim();
  const pass = $("new-password").value;
  const papel = $("new-role").value;
  const deptVal = $("new-dept").value;
  const quota = parseInt($("new-quota").value, 10);

  if (user.length < 3) { alert("O utilizador deve ter pelo menos 3 caracteres."); return; }
  if (pass.length < 4) { alert("A palavra-passe deve ter pelo menos 4 caracteres."); return; }
  if (utilizadores.some(u => u.username.toLowerCase() === user)) { alert("Esse utilizador já existe."); return; }
  if ((papel === "funcionario" || papel === "chefe") && !deptVal) {
    alert("Indique o departamento (crie primeiro um departamento na secção acima)."); return;
  }

  const departamento = deptVal ? Number(deptVal) : null;
  utilizadores.push({
    username: user, nome: nome || user, pass: hashSenha(pass),
    papel, departamento,
    quotaDias: (papel === "funcionario" || papel === "chefe") ? (isNaN(quota) ? 22 : quota) : null,
    estado: "ativo"
  });

  if (papel === "chefe" && departamento != null) {
    const d = departamentos.find(x => x.id === departamento);
    if (d) {
      if (d.chefe) { const ant = utilizadores.find(u => u.username === d.chefe); if (ant) ant.papel = "funcionario"; }
      d.chefe = user;
      guardarDepartamentos();
    }
  }

  guardarUtilizadores();
  e.target.reset();
  renderizarTudo();
});

// Limite máximo global de funcionários em férias no mesmo dia
limiteInput.value = config.limiteMaxGlobal;
limiteInput.addEventListener("change", () => {
  const v = parseInt(limiteInput.value, 10);
  if (!v || v < 1) { limiteInput.value = config.limiteMaxGlobal; return; }
  config.limiteMaxGlobal = v;
  guardarConfig();
  renderizarTudo();
});

// =========================================================
// Formulário de pedidos (funcionário/chefe pede por si próprio)
// =========================================================
function renderDropdownDepartamentos() {
  calDeptSel.innerHTML = "";
  const lista = departamentos.slice().sort((a, b) => a.nome.localeCompare(b.nome));
  lista.forEach(d => {
    const o = document.createElement("option");
    o.value = String(d.id); o.textContent = d.nome;
    calDeptSel.appendChild(o);
  });
  const u = userPorNome(sessao.username);
  if (u && u.departamento != null && lista.some(d => d.id === u.departamento)) {
    calDeptVisto = u.departamento;
  } else if (calDeptVisto == null || !lista.some(d => d.id === calDeptVisto)) {
    calDeptVisto = lista.length ? lista[0].id : null;
  }
  calDeptSel.value = calDeptVisto != null ? String(calDeptVisto) : "";
}

function atualizarInfoQuota() {
  const u = userPorNome(sessao.username);
  if (!u || (u.papel !== "funcionario" && u.papel !== "chefe")) { quotaInfo.classList.add("hidden"); return; }
  const quota = u.quotaDias != null ? u.quotaDias : 22;
  const usados = diasConsumidos(u.username, null);
  const restantes = Math.max(0, quota - usados);
  quotaInfo.classList.remove("hidden");
  quotaInfo.innerHTML = "👤 <strong>" + escapeHtml(u.nome || u.username) + "</strong> · " +
    "Departamento: <strong>" + escapeHtml(nomeDept(u.departamento)) + "</strong> · " +
    "Quota anual: <strong>" + quota + "</strong> dias úteis · Usados: <strong>" + usados +
    "</strong> · Restantes: <strong>" + restantes + "</strong>" +
    (restantes === 0 ? " ⚠️ sem dias disponíveis" : "");
}

vacForm.addEventListener("submit", (e) => {
  e.preventDefault();
  formError.classList.add("hidden");

  const u = userPorNome(sessao.username);
  const funcionario = u.username;
  const inicio = startInput.value;
  const fim = endInput.value;
  const notas = notesInput.value.trim();

  if (!inicio || !fim) { erroForm("Preencha as datas."); return; }
  if (fim < inicio) { erroForm("A data de fim não pode ser anterior à data de início."); return; }
  if (u.departamento == null) { erroForm("Não está integrado em nenhum departamento. Contacte o administrador (RH)."); return; }
  if (haSobreposicao(funcionario, inicio, fim)) { erroForm("Você já tem férias pedidas nesse período."); return; }

  const dias = diasUteis(inicio, fim);
  if (dias === 0) { erroForm("O período não contém dias úteis."); return; }

  // Quota: dias úteis que CAEM DENTRO do ano civil do início
  const ano = inicio.slice(0, 4);
  const dentroDoAno = listarDias(inicio, fim).filter(iso => iso.slice(0, 4) === ano)
    .filter(iso => { const g = new Date(iso + "T00:00:00").getDay(); return g !== 0 && g !== 6; }).length;
  const usadosAntes = diasConsumidos(funcionario, null) - diasConsumidos(funcionario, ano + "-01-01");
  const usadosDepois = diasConsumidos(funcionario, ano + "-12-31");
  const usadosNoAno = Math.max(0, usadosAntes) + Math.max(0, usadosDepois);
  const quota = u.quotaDias != null ? u.quotaDias : 22;
  if (usadosNoAno + dentroDoAno > quota) {
    erroForm("⚠️ Excede a sua quota de " + quota + " dias de férias (" + usadosNoAno + " já usados/planificados + " + dentroDoAno + " deste pedido). Se precisar de mais dias, peça um aumento ao seu chefe de departamento.");
    return;
  }

  // Limite global diário
  const excedidos = diasComLimiteAtingido(inicio, fim);
  if (excedidos.length > 0) {
    const amostra = excedidos.slice(0, 5).map(formatarData).join(", ") + (excedidos.length > 5 ? "…" : "");
    erroForm("⛔ Limite máximo de " + config.limiteMaxGlobal + " funcionários em férias atingido em " +
      excedidos.length + " dia(s): " + amostra + ". Escolha outras datas (veja o calendário).");
    return;
  }

  pedidos.push({
    id: Date.now(), funcionario, nome: u.nome || u.username, departamento: u.departamento,
    inicio, fim, dias, estado: "Pendente", decisaoRH: null, notas, criadoEm: new Date().toISOString()
  });
  guardarPedidos();
  vacForm.reset();
  mostrarMsg(formMessage, "Pedido enviado! Ficou pendente de aprovação do seu chefe de departamento.");
  renderizarTudo();
});

function erroForm(msg) {
  formError.textContent = msg;
  formError.classList.remove("hidden");
}

// Pré-visualização em tempo real durante a escolha de datas
[startInput, endInput].forEach(inp => inp.addEventListener("change", atualizarPrevisaoLimite));

function atualizarPrevisaoLimite() {
  const el = $("previsao-limite");
  const inicio = startInput.value, fim = endInput.value;
  if (!inicio || !fim || fim < inicio) { el.classList.add("hidden"); return; }
  const excedidos = diasComLimiteAtingido(inicio, fim);
  const dias = diasUteis(inicio, fim);
  el.classList.remove("hidden");
  const partes = ["📊 " + dias + " dia(s) úteis"];
  if (excedidos.length > 0) {
    el.className = "previsao previsao-cheio";
    partes.push("⛔ " + excedidos.length + " dia(s) já atingem o limite global de " + config.limiteMaxGlobal + " funcionários — o pedido será bloqueado");
  } else {
    partes.push("✅ todos os dias têm vagas");
    el.className = "previsao previsao-ok";
  }
  el.textContent = partes.join(" · ");
}

// =========================================================
// Lista de pedidos + aprovações
// =========================================================
function estadoFinalDe(p) {
  return p.decisaoRH ? p.decisaoRH.estado : p.estado;
}

function renderPedidos() {
  tbody.innerHTML = "";
  const u = userPorNome(sessao.username);
  const esGestor = isGestor(u);
  const esChefe = u.papel === "chefe";

  const lista = pedidos
    .filter(p => {
      if (esGestor) return true;
      if (esChefe) {
        const pu = userPorNome(p.funcionario);
        return pu && pu.departamento === u.departamento;
      }
      return p.funcionario.toLowerCase() === u.username.toLowerCase();
    })
    .sort((a, b) => b.id - a.id);

  emptyMsg.classList.toggle("hidden", lista.length > 0);

  reqFilter.innerHTML = "";
  const optTodos = document.createElement("option");
  optTodos.value = ""; optTodos.textContent = "Todos os estados";
  reqFilter.appendChild(optTodos);
  ["Pendente", "Aprovado", "Recusado"].forEach(e => {
    const o = document.createElement("option"); o.value = e; o.textContent = e;
    reqFilter.appendChild(o);
  });
  reqFilter.classList.remove("hidden");
  const filtrada = reqFilter.value ? lista.filter(p => estadoFinalDe(p) === reqFilter.value) : lista;

  filtrada.forEach(p => {
    const tr = document.createElement("tr");

    const pu = userPorNome(p.funcionario);
    const tdFunc = document.createElement("td");
    tdFunc.innerHTML = "<strong>" + escapeHtml(p.nome || p.funcionario) + "</strong><br><span class='muted'>" + escapeHtml(nomeDept(pu ? pu.departamento : null)) + "</span>";

    const tdIni = document.createElement("td"); tdIni.textContent = formatarData(p.inicio);
    const tdFim = document.createElement("td"); tdFim.textContent = formatarData(p.fim);
    const tdDias = document.createElement("td"); tdDias.textContent = p.dias != null ? p.dias : diasUteis(p.inicio, p.fim);

    const tdEstado = document.createElement("td");
    const final = estadoFinalDe(p);
    const badge = document.createElement("span");
    badge.className = "badge badge-" + final.toLowerCase();
    badge.textContent = final;
    tdEstado.appendChild(badge);
    if (p.decisaoRH) {
      const marca = document.createElement("div");
      marca.className = "marca-agua marca-rh-" + p.decisaoRH.estado.toLowerCase();
      marca.textContent = "💮 RH " + (p.decisaoRH.estado === "Aprovado" ? "aprovou" : "recusou") +
        " · " + formatarData(p.decisaoRH.data.slice(0, 10));
      tdEstado.appendChild(marca);
    }

    const tdNotas = document.createElement("td"); tdNotas.textContent = p.notas || "-";

    const tdAcc = document.createElement("td");
    const ehDono = p.funcionario.toLowerCase() === u.username.toLowerCase();

    if (esGestor) {
      // Admin/RH: decisão FINAL
      if (!p.decisaoRH) {
        const bApr = document.createElement("button");
        bApr.className = "btn btn-success btn-small"; bApr.textContent = "RH Aprovar"; bApr.style.marginRight = "6px";
        bApr.addEventListener("click", () => {
          p.decisaoRH = { estado: "Aprovado", data: new Date().toISOString(), por: u.username };
          p.estado = "Aprovado";
          guardarPedidos(); renderizarTudo();
        });
        const bRec = document.createElement("button");
        bRec.className = "btn btn-danger btn-small"; bRec.textContent = "RH Recusar"; bRec.style.marginRight = "6px";
        bRec.addEventListener("click", () => {
          p.decisaoRH = { estado: "Recusado", data: new Date().toISOString(), por: u.username };
          p.estado = "Recusado";
          guardarPedidos(); renderizarTudo();
        });
        tdAcc.append(bApr, bRec);
      } else {
        const bRev = document.createElement("button");
        bRev.className = "btn btn-secondary btn-small"; bRev.textContent = "Reverter decisão RH";
        bRev.addEventListener("click", () => {
          if (!confirm("Reverter a decisão do RH? O pedido volta para o fluxo normal.")) return;
          p.decisaoRH = null; p.estado = "Pendente";
          guardarPedidos(); renderizarTudo();
        });
        tdAcc.appendChild(bRev);
      }
      const bDel = document.createElement("button");
      bDel.className = "btn btn-danger btn-small"; bDel.textContent = "Apagar"; bDel.style.marginLeft = "6px";
      bDel.addEventListener("click", () => {
        if (!confirm("Apagar este pedido de " + (p.nome || p.funcionario) + "?")) return;
        pedidos = pedidos.filter(x => x.id !== p.id);
        guardarPedidos(); renderizarTudo();
      });
      tdAcc.appendChild(bDel);
    } else if (esChefe && pu && pu.departamento === u.departamento && !p.decisaoRH) {
      if (p.estado === "Pendente") {
        const bApr = document.createElement("button");
        bApr.className = "btn btn-success btn-small"; bApr.textContent = "Aprovar"; bApr.style.marginRight = "6px";
        bApr.addEventListener("click", () => { p.estado = "Aprovado"; p.decisaoChefe = { data: new Date().toISOString() }; guardarPedidos(); renderizarTudo(); });
        const bRec = document.createElement("button");
        bRec.className = "btn btn-danger btn-small"; bRec.textContent = "Recusar";
        bRec.addEventListener("click", () => { p.estado = "Recusado"; p.decisaoChefe = { data: new Date().toISOString() }; guardarPedidos(); renderizarTudo(); });
        tdAcc.append(bApr, bRec);
      } else {
        tdAcc.innerHTML = "<span class='muted'>decisão do chefe registada</span>";
      }
    } else if (ehDono && p.estado === "Pendente" && !p.decisaoRH) {
      const bCanc = document.createElement("button");
      bCanc.className = "btn btn-danger btn-small"; bCanc.textContent = "Cancelar pedido";
      bCanc.addEventListener("click", () => {
        if (!confirm("Cancelar este pedido?")) return;
        pedidos = pedidos.filter(x => x.id !== p.id);
        guardarPedidos(); renderizarTudo();
      });
      tdAcc.appendChild(bCanc);
    } else {
      tdAcc.textContent = "—";
    }

    tr.append(tdFunc, tdIni, tdFim, tdDias, tdEstado, tdNotas, tdAcc);
    tbody.appendChild(tr);
  });
}

reqFilter.addEventListener("change", renderPedidos);

// =========================================================
// Solicitações de aumento de quota (chefe -> admin)
// =========================================================
function renderSolicitacoes() {
  const wrap = $("solicitar-wrap");
  const u = userPorNome(sessao.username);
  const esChefe = u.papel === "chefe";
  wrap.classList.toggle("hidden", !(esChefe || isGestor(u)));

  const selUser = $("sol-user"), selMes = $("sol-mes");
  if (esChefe) {
    selUser.innerHTML = "";
    utilizadores
      .filter(x => x.departamento === u.departamento && (x.papel === "funcionario" || x.papel === "chefe") && x.estado === "ativo")
      .forEach(x => {
        const o = document.createElement("option");
        o.value = x.username; o.textContent = (x.nome || x.username) + " (quota " + (x.quotaDias != null ? x.quotaDias : 22) + ")";
        selUser.appendChild(o);
      });
  } else {
    selUser.innerHTML = '<option value="">— (apenas chefes podem solicitar) —</option>';
  }

  if (selMes.options.length === 0) {
    MEOPCOES.forEach(m => {
      const o = document.createElement("option"); o.value = m; o.textContent = m;
      selMes.appendChild(o);
    });
  }

  const tbodySol = $("sol-tbody");
  tbodySol.innerHTML = "";
  const visiveis = solicitacoes.filter(s => {
    if (isGestor(u)) return true;
    if (esChefe) { const su = userPorNome(s.username); return su && su.departamento === u.departamento; }
    return false;
  });
  if (visiveis.length === 0) {
    tbodySol.innerHTML = '<tr><td colspan="7" class="muted">Sem solicitações.</td></tr>';
    return;
  }
  visiveis.sort((a, b) => b.id - a.id).forEach(s => {
    const tr = document.createElement("tr");
    const alvo = userPorNome(s.username);
    tr.innerHTML =
      "<td><strong>" + escapeHtml(alvo ? (alvo.nome || alvo.username) : s.username) + "</strong><br><span class='muted'>" + escapeHtml(nomeDept(alvo ? alvo.departamento : null)) + "</span></td>" +
      "<td>" + escapeHtml(s.mes) + "</td>" +
      "<td>" + s.dias + " dia(s)</td>" +
      "<td>" + escapeHtml(s.motivo || "-") + "</td>" +
      "<td>" + escapeHtml(s.pedidoPor) + "</td>" +
      "<td><span class='badge badge-" + (s.estado === "Aprovado" ? "aprovado" : s.estado === "Recusado" ? "recusado" : "pendente") + "'>" + s.estado + "</span></td>";

    const tdAcc = document.createElement("td");
    if (isGestor(u) && s.estado === "Pendente") {
      const bApr = document.createElement("button");
      bApr.className = "btn btn-success btn-small"; bApr.textContent = "Aprovar"; bApr.style.marginRight = "6px";
      bApr.addEventListener("click", () => {
        s.estado = "Aprovado";
        const alvoU = userPorNome(s.username);
        if (alvoU) { alvoU.quotaDias = (alvoU.quotaDias != null ? alvoU.quotaDias : 22) + s.dias; guardarUtilizadores(); }
        guardarSolicitacoes(); renderizarTudo();
      });
      const bRec = document.createElement("button");
      bRec.className = "btn btn-danger btn-small"; bRec.textContent = "Recusar";
      bRec.addEventListener("click", () => { s.estado = "Recusado"; guardarSolicitacoes(); renderizarTudo(); });
      tdAcc.append(bApr, bRec);
    } else if (s.estado !== "Pendente") {
      tdAcc.textContent = "—";
    } else {
      tdAcc.textContent = "aguarda RH";
    }
    tr.appendChild(tdAcc);
    tbodySol.appendChild(tr);
  });
}

$("sol-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const u = userPorNome(sessao.username);
  if (u.papel !== "chefe") { alert("Apenas chefes de departamento podem solicitar aumentos."); return; }
  const alvo = userPorNome($("sol-user").value);
  const mes = $("sol-mes").value;
  const dias = parseInt($("sol-dias").value, 10);
  const motivo = $("sol-motivo").value.trim();
  if (!alvo || alvo.departamento !== u.departamento) { alert("Escolha um funcionário do seu departamento."); return; }
  if (!mes) { alert("Escolha o mês."); return; }
  if (!dias || dias < 1) { alert("Indique quantos dias pretende acrescentar."); return; }

  solicitacoes.push({
    id: Date.now(), username: alvo.username, mes, dias, motivo,
    pedidoPor: u.nome || u.username, estado: "Pendente", criadoEm: new Date().toISOString()
  });
  guardarSolicitacoes();
  e.target.reset();
  renderizarTudo();
  mostrarMsg($("sol-ok"), "✅ Pedido enviado ao administrador (RH). A decisão final é dele.");
});

// =========================================================
// Calendário mensal (por departamento)
// =========================================================
const NOMES_MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                     "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const NOMES_DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function renderCalendario() {
  const u = userPorNome(sessao.username);
  const esGestor = isGestor(u);

  // Depto visível
  if (!esGestor) calDeptVisto = u.departamento;
  if (calDeptVisto == null && esGestor && departamentos.length) calDeptVisto = departamentos[0].id;

  const dept = departamentos.find(d => d.id === calDeptVisto);
  calTitle.textContent = (NOMES_MESES[calMes] + " " + calAno) + (dept ? " — " + dept.nome : " — sem departamento");

  calGrid.innerHTML = "";
  NOMES_DIAS.forEach(n => {
    const c = document.createElement("div");
    c.className = "cal-cell cal-weekday";
    c.textContent = n;
    calGrid.appendChild(c);
  });

  if (calDeptVisto == null) {
    const vazio = document.createElement("div");
    vazio.className = "cal-empty full-row";
    vazio.style.gridColumn = "1 / -1";
    vazio.textContent = "Não há departamento para mostrar. O administrador deve criar departamentos.";
    calGrid.appendChild(vazio);
    return;
  }

  const primeiroDia = new Date(calAno, calMes, 1);
  let offset = (primeiroDia.getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) {
    const vazio = document.createElement("div");
    vazio.className = "cal-cell cal-empty";
    calGrid.appendChild(vazio);
  }

  const ultimoDia = new Date(calAno, calMes + 1, 0).getDate();
  const hojeISO = isoDia(new Date());

  for (let d = 1; d <= ultimoDia; d++) {
    const data = new Date(calAno, calMes, d);
    const iso = isoDia(data);
    const celula = document.createElement("div");
    celula.className = "cal-cell";

    const dow = data.getDay();
    if (dow === 0 || dow === 6) celula.classList.add("cal-fimde-semana");
    if (iso === hojeISO) celula.classList.add("cal-hoje");

    const numero = document.createElement("div");
    numero.className = "cal-num";
    numero.textContent = d;
    celula.appendChild(numero);

    const emDept = contarEmFeriasNoDiaDept(iso, calDeptVisto);
    const count = emDept.size;
    const globais = contarEmFeriasNoDiaGlobal(iso).size;

    if (count > 0) {
      const contador = document.createElement("div");
      contador.className = "cal-count";
      if (globais >= config.limiteMaxGlobal) {
        celula.classList.add("cal-cheio");
        contador.textContent = "⛔ " + count + " neste dept. (" + globais + "/" + config.limiteMaxGlobal + " global)";
      } else {
        celula.classList.add("cal-com-ferias");
        contador.textContent = "🏖️ " + count + " (" + globais + "/" + config.limiteMaxGlobal + " global)";
      }
      celula.appendChild(contador);

      const lista = document.createElement("div");
      lista.className = "cal-names";
      Array.from(emDept).sort((a, b) => a.localeCompare(b, "pt")).forEach(n => {
        const chip = document.createElement("span");
        chip.className = "cal-chip";
        chip.textContent = n;
        lista.appendChild(chip);
      });
      celula.appendChild(lista);
    } else if (globais >= config.limiteMaxGlobal) {
      celula.classList.add("cal-cheio");
      const aviso = document.createElement("div");
      aviso.className = "cal-count";
      aviso.textContent = "⛔ cheio (" + globais + "/" + config.limiteMaxGlobal + ")";
      celula.appendChild(aviso);
    }

    celula.title = count + " funcionário(s) deste departamento em férias · " + globais + " no total · limite global " + config.limiteMaxGlobal;
    calGrid.appendChild(celula);
  }

  calLegend.innerHTML =
    '<span class="leg-item leg-ok">🏖️ férias no departamento</span>' +
    '<span class="leg-item leg-full">⛔ limite global atingido (' + config.limiteMaxGlobal + ')</span>' +
    '<span class="leg-item leg-today">hoje</span>';
}

calPrev.addEventListener("click", () => { calMes--; if (calMes < 0) { calMes = 11; calAno--; } renderCalendario(); });
calNext.addEventListener("click", () => { calMes++; if (calMes > 11) { calMes = 0; calAno++; } renderCalendario(); });
calToday.addEventListener("click", () => { const h = new Date(); calAno = h.getFullYear(); calMes = h.getMonth(); renderCalendario(); });
calDeptSel.addEventListener("change", () => { calDeptVisto = calDeptSel.value ? Number(calDeptSel.value) : null; renderCalendario(); });

// =========================================================
// Render global + sincronização entre separadores
// =========================================================
function renderizarTudo() {
  if (!sessao) return;
  const u = userPorNome(sessao.username);
  if (!u) return;

  renderDropdownDepartamentos();
  renderDropdownNewDept();
  atualizarInfoQuota();
  renderPedidos();
  renderCalendario();
  renderSolicitacoes();
  if (isGestor(u)) { renderUtilizadores(); renderDepartamentos(); }

  limiteInput.value = config.limiteMaxGlobal;
}

window.addEventListener("storage", () => {
  utilizadores   = JSON.parse(localStorage.getItem(KEY_UTILIZADORES) || "[]");
  pedidos        = JSON.parse(localStorage.getItem(KEY_PEDIDOS) || "[]");
  departamentos  = JSON.parse(localStorage.getItem(KEY_DEPARTAMENTOS) || "[]");
  solicitacoes   = JSON.parse(localStorage.getItem(KEY_SOLICITACOES) || "[]");
  config         = JSON.parse(localStorage.getItem(KEY_CONFIG) || '{"limiteMaxGlobal":3}');
  sessao         = JSON.parse(localStorage.getItem(KEY_SESSAO) || "null");
  if (sessao) mostrarApp(); else sair();
});

// ---------- Arranque ----------
mostrarApp();
