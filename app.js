/* =========================================================
   Gestão de Férias dos Funcionários (multi-utilizador)
   - Login / Registo / Logout
   - Admin: aprovar contas, criar utilizadores, definir limite
     máximo de funcionários em férias por dia
   - Calendário mensal: mostra quem está de férias em cada dia
     e destaca os dias que já atingiram o limite
   - Pedidos de férias bloqueados se algum dia do período já
     estiver no limite
   - Sincronização entre separadores do mesmo browser (storage)

   ⚠️ IMPORTANTE: este site é 100% front-end. Os dados vivem no
   localStorage de CADA computador — um site público na Vercel
   serve para demonstração, mas para partilhar dados reais entre
   pessoas é preciso ligar a uma base de dados (ex.: Supabase).
   ========================================================= */

// ---------- Chaves do localStorage ----------
const KEY_UTILIZADORES = "ferias_utilizadores";
const KEY_SESSAO       = "ferias_sessao";
const KEY_PEDIDOS      = "ferias_pedidos";
const KEY_CONFIG       = "ferias_config";

// ---------- Estado ----------
let utilizadores = JSON.parse(localStorage.getItem(KEY_UTILIZADORES) || "null");
let pedidos      = JSON.parse(localStorage.getItem(KEY_PEDIDOS) || "[]");
let config       = JSON.parse(localStorage.getItem(KEY_CONFIG) || "null")
                 || { limiteMax: 3 };
let sessao       = JSON.parse(localStorage.getItem(KEY_SESSAO) || "null");

// Garante que existe sempre um administrador inicial
if (!utilizadores || !utilizadores.some(u => u.papel === "admin")) {
  utilizadores = [{
    username: "admin",
    pass: hashSenha("admin123"),
    papel: "admin",
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
const empSelect   = $("emp-name");
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
const limiteInput = $("limite-max");
const limiteLabel = $("limite-label");

const userTbody = $("user-tbody");

// Mês actualmente visível no calendário
const hoje = new Date();
let calAno  = hoje.getFullYear();
let calMes  = hoje.getMonth(); // 0-11

// =========================================================
// Utilidades
// =========================================================
function guardarUtilizadores() { localStorage.setItem(KEY_UTILIZADORES, JSON.stringify(utilizadores)); }
function guardarPedidos()      { localStorage.setItem(KEY_PEDIDOS, JSON.stringify(pedidos)); }
function guardarConfig()       { localStorage.setItem(KEY_CONFIG, JSON.stringify(config)); }
function guardarSessao()       { localStorage.setItem(KEY_SESSAO, JSON.stringify(sessao)); }

// "Hash" simples ( NÃO é seguro — apenas evita ler palavras-passe à vista ).
// Para produção com dados reais use um backend com bcrypt/argon2.
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

// Lista todas as datas (ISO) entre inicio e fim, inclusive
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

// Dias úteis (segunda a sexta) entre duas datas, inclusive
function diasUteis(inicioISO, fimISO) {
  return listarDias(inicioISO, fimISO)
    .filter(iso => { const g = new Date(iso + "T00:00:00").getDay(); return g !== 0 && g !== 6; })
    .length;
}

// Quantos funcionários estão de férias num dia (pendentes + aprovados)
function contarEmFeriasNoDia(iso) {
  const nomes = new Set();
  pedidos.forEach(p => {
    if (p.estado !== "Recusado" && p.inicio <= iso && p.fim >= iso) nomes.add(p.funcionario);
  });
  return nomes;
}

// Verifica se algum dia do período já atingiu o limite máximo
function diasComLimiteAtingido(inicioISO, fimISO) {
  return listarDias(inicioISO, fimISO).filter(iso => contarEmFeriasNoDia(iso).size >= config.limiteMax);
}

// Sobreposição do mesmo funcionário
function haSobreposicao(funcionario, inicioISO, fimISO) {
  return pedidos.some(p =>
    p.funcionario === funcionario &&
    p.estado !== "Recusado" &&
    inicioISO <= p.fim && fimISO >= p.inicio
  );
}

function mostrarMsg(el, texto) {
  el.textContent = texto;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}

// =========================================================
// Login / Registo / Logout
// =========================================================
function entrarApp(user) {
  sessao = { username: user.username, papel: user.papel };
  guardarSessao();
  mostrarApp();
}

function mostrarApp() {
  if (!sessao) return;
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  welcomeUser.textContent = "Olá, " + sessao.username + (sessao.papel === "admin" ? " (Admin)" : "");

  const esAdmin = sessao.papel === "admin";
  document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", !esAdmin));

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
    loginError.textContent = "A sua conta ainda está aguarda aprovação do administrador.";
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
  const pass = $("reg-password").value;
  const pass2 = $("reg-password2").value;

  if (user.length < 3) { erroRegisto("O utilizador deve ter pelo menos 3 caracteres."); return; }
  if (pass.length < 4) { erroRegisto("A palavra-passe deve ter pelo menos 4 caracteres."); return; }
  if (pass !== pass2) { erroRegisto("As palavras-passe não coincidem."); return; }
  if (utilizadores.some(u => u.username.toLowerCase() === user)) {
    erroRegisto("Esse utilizador já existe."); return;
  }

  utilizadores.push({ username: user, pass: hashSenha(pass), papel: "funcionario", estado: "pendente" });
  guardarUtilizadores();
  registerError.classList.add("hidden");
  registerForm.reset();
  mostrarMsg(registerOk, "✅ Conta criada! Aguarde a aprovação do administrador para iniciar sessão.");
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
// Administração de utilizadores (apenas admin)
// =========================================================
function renderUtilizadores() {
  userTbody.innerHTML = "";
  utilizadores.slice().sort((a, b) => a.username.localeCompare(b.username)).forEach(u => {
    const tr = document.createElement("tr");

    const tdUser = document.createElement("td"); tdUser.textContent = u.username;
    const tdPapel = document.createElement("td"); tdPapel.textContent = u.papel === "admin" ? "Administrador" : "Funcionário";
    const tdEstado = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge badge-" + (u.estado === "ativo" ? "aprovado" : u.estado === "pendente" ? "pendente" : "recusado");
    badge.textContent = u.estado.charAt(0).toUpperCase() + u.estado.slice(1);
    tdEstado.appendChild(badge);

    const tdAcc = document.createElement("td");
    const btnCriar = document.createElement("button");
    btnCriar.className = "btn btn-secondary btn-small";
    btnCriar.textContent = "Criar pedido";
    btnCriar.style.marginRight = "6px";
    btnCriar.addEventListener("click", () => {
      empSelect.value = u.username;
      vacForm.scrollIntoView({ behavior: "smooth" });
    });
    tdAcc.appendChild(btnCriar);

    const tdAcoes = document.createElement("td");
    if (u.papel !== "admin") {
      if (u.estado === "pendente") {
        const btnAprovar = document.createElement("button");
        btnAprovar.className = "btn btn-success btn-small";
        btnAprovar.textContent = "Aprovar";
        btnAprovar.style.marginRight = "6px";
        btnAprovar.addEventListener("click", () => { u.estado = "ativo"; guardarUtilizadores(); renderizarTudo(); });
        tdAcoes.appendChild(btnAprovar);

        const btnRecusar = document.createElement("button");
        btnRecusar.className = "btn btn-danger btn-small";
        btnRecusar.textContent = "Suspender";
        btnRecusar.addEventListener("click", () => { u.estado = "suspenso"; guardarUtilizadores(); renderizarTudo(); });
        tdAcoes.appendChild(btnRecusar);
      } else if (u.estado === "ativo") {
        const btnSusp = document.createElement("button");
        btnSusp.className = "btn btn-secondary btn-small";
        btnSusp.textContent = "Suspender";
        btnSusp.style.marginRight = "6px";
        btnSusp.addEventListener("click", () => { u.estado = "suspenso"; guardarUtilizadores(); renderizarTudo(); });
        tdAcoes.appendChild(btnSusp);
      } else {
        const btnAtivar = document.createElement("button");
        btnAtivar.className = "btn btn-success btn-small";
        btnAtivar.textContent = "Reativar";
        btnAtivar.style.marginRight = "6px";
        btnAtivar.addEventListener("click", () => { u.estado = "ativo"; guardarUtilizadores(); renderizarTudo(); });
        tdAcoes.appendChild(btnAtivar);
      }

      const btnApagar = document.createElement("button");
      btnApagar.className = "btn btn-danger btn-small";
      btnApagar.textContent = "Apagar";
      btnApagar.addEventListener("click", () => {
        if (confirm("Apagar o utilizador \"" + u.username + "\"? Os pedidos dele também serão apagados.")) {
          utilizadores = utilizadores.filter(x => x !== u);
          pedidos = pedidos.filter(p => p.funcionario !== u.username);
          guardarUtilizadores(); guardarPedidos(); renderizarTudo();
        }
      });
      tdAcoes.appendChild(btnApagar);
    } else {
      tdAcoes.textContent = "—";
    }

    tr.append(tdUser, tdPapel, tdEstado, tdAcc, tdAcoes);
    userTbody.appendChild(tr);
  });
}

// Criar utilizador directamente pelo admin (já activo)
$("admin-create-user-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const user = $("new-username").value.trim().toLowerCase();
  const pass = $("new-password").value;
  const papel = $("new-role").value;
  if (user.length < 3) { alert("O utilizador deve ter pelo menos 3 caracteres."); return; }
  if (pass.length < 4) { alert("A palavra-passe deve ter pelo menos 4 caracteres."); return; }
  if (utilizadores.some(u => u.username.toLowerCase() === user)) { alert("Esse utilizador já existe."); return; }
  utilizadores.push({ username: user, pass: hashSenha(pass), papel, estado: "ativo" });
  guardarUtilizadores();
  e.target.reset();
  renderizarTudo();
});

// Limite máximo de funcionários em simultâneo
limiteInput.value = config.limiteMax;
limiteInput.addEventListener("change", () => {
  const v = parseInt(limiteInput.value, 10);
  if (!v || v < 1) { limiteInput.value = config.limiteMax; return; }
  config.limiteMax = v;
  guardarConfig();
  renderizarTudo();
});

// =========================================================
// Formulário de pedidos
// =========================================================
function renderDropdownFuncionarios() {
  empSelect.innerHTML = "";
  const ativos = utilizadores
    .filter(u => u.estado === "ativo")
    .sort((a, b) => a.username.localeCompare(b.username));
  ativos.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.username;
    opt.textContent = u.username;
    empSelect.appendChild(opt);
  });
  // Admin pode pedir em nome de qualquer funcionário activo
  if (sessao && sessao.papel !== "admin" && ativos.some(u => u.username === sessao.username)) {
    empSelect.value = sessao.username;
  }
  // Esconder o selector se não for admin (pede sempre por si próprio)
  const wrapper = empSelect.closest("div");
  if (wrapper) wrapper.classList.toggle("hidden", !(sessao && sessao.papel === "admin"));
}

vacForm.addEventListener("submit", (e) => {
  e.preventDefault();
  formError.classList.add("hidden");

  const funcionario = (sessao && sessao.papel === "admin") ? empSelect.value : sessao.username;
  const inicio = startInput.value;
  const fim = endInput.value;
  const notas = notesInput.value.trim();

  if (!funcionario || !inicio || !fim) { erroForm("Preencha o funcionário e as datas."); return; }
  if (fim < inicio) { erroForm("A data de fim não pode ser anterior à data de início."); return; }
  if (haSobreposicao(funcionario, inicio, fim)) { erroForm("Este funcionário já tem férias pedidas nesse período."); return; }

  const excedidos = diasComLimiteAtingido(inicio, fim);
  if (excedidos.length > 0) {
    const amostra = excedidos.slice(0, 5).map(formatarData).join(", ") + (excedidos.length > 5 ? "…" : "");
    erroForm("⛔ Limite máximo de " + config.limiteMax + " funcionários em férias atingido em " +
      excedidos.length + " dia(s): " + amostra + ". Escolha outras datas (veja o calendário).");
    return;
  }

  pedidos.push({ id: Date.now(), funcionario, inicio, fim, estado: "Pendente", notas });
  guardarPedidos();
  vacForm.reset();
  mostrarMsg(formMessage, "Pedido enviado com sucesso! Ficou pendente de aprovação.");
  renderizarTudo();
});

function erroForm(msg) {
  formError.textContent = msg;
  formError.classList.remove("hidden");
}

// Pré-visualização em tempo real do limite durante a escolha de datas
[startInput, endInput].forEach(inp => inp.addEventListener("change", atualizarPrevisaoLimite));

function atualizarPrevisaoLimite() {
  const el = $("previsao-limite");
  const inicio = startInput.value, fim = endInput.value;
  if (!inicio || !fim || fim < inicio) { el.classList.add("hidden"); return; }
  const excedidos = diasComLimiteAtingido(inicio, fim);
  el.classList.remove("hidden");
  if (excedidos.length > 0) {
    el.className = "previsao previsao-cheio";
    el.textContent = "⛔ " + excedidos.length + " dia(s) deste período já atingem o limite de " +
      config.limiteMax + " funcionários. O pedido será bloqueado.";
  } else {
    el.className = "previsao previsao-ok";
    el.textContent = "✅ Todos os dias deste período têm vagas disponíveis.";
  }
}

// =========================================================
// Lista de pedidos
// =========================================================
function renderPedidos() {
  tbody.innerHTML = "";
  const esAdmin = sessao && sessao.papel === "admin";

  const lista = pedidos
    .filter(p => esAdmin || p.funcionario === sessao.username)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  emptyMsg.classList.toggle("hidden", lista.length > 0);

  lista.forEach(p => {
    const tr = document.createElement("tr");

    const tdFunc = document.createElement("td"); tdFunc.textContent = p.funcionario;
    const tdIni = document.createElement("td"); tdIni.textContent = formatarData(p.inicio);
    const tdFim = document.createElement("td"); tdFim.textContent = formatarData(p.fim);
    const tdDias = document.createElement("td"); tdDias.textContent = diasUteis(p.inicio, p.fim);

    const tdEstado = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge badge-" + p.estado.toLowerCase();
    badge.textContent = p.estado;
    tdEstado.appendChild(badge);

    const tdNotas = document.createElement("td"); tdNotas.textContent = p.notas || "-";

    const tdAcc = document.createElement("td");
    if (esAdmin) {
      const btnAprovar = document.createElement("button");
      btnAprovar.className = "btn btn-success btn-small";
      btnAprovar.textContent = "Aprovar";
      btnAprovar.style.marginRight = "6px";
      btnAprovar.addEventListener("click", () => { p.estado = "Aprovado"; guardarPedidos(); renderizarTudo(); });

      const btnRecusar = document.createElement("button");
      btnRecusar.className = "btn btn-secondary btn-small";
      btnRecusar.textContent = "Recusar";
      btnRecusar.style.marginRight = "6px";
      btnRecusar.addEventListener("click", () => { p.estado = "Recusado"; guardarPedidos(); renderizarTudo(); });

      const btnApagar = document.createElement("button");
      btnApagar.className = "btn btn-danger btn-small";
      btnApagar.textContent = "Apagar";
      btnApagar.addEventListener("click", () => {
        if (confirm("Apagar este pedido de " + p.funcionario + "?")) {
          pedidos = pedidos.filter(x => x.id !== p.id);
          guardarPedidos(); renderizarTudo();
        }
      });
      tdAcc.append(btnAprovar, btnRecusar, btnApagar);
    } else {
      const dono = pedidos.find(x => x.id === p.id && x.funcionario === sessao.username);
      if (dono && dono.estado === "Pendente") {
        const btnCancelar = document.createElement("button");
        btnCancelar.className = "btn btn-danger btn-small";
        btnCancelar.textContent = "Cancelar pedido";
        btnCancelar.addEventListener("click", () => {
          if (confirm("Cancelar este pedido?")) {
            pedidos = pedidos.filter(x => x.id !== p.id);
            guardarPedidos(); renderizarTudo();
          }
        });
        tdAcc.appendChild(btnCancelar);
      } else {
        tdAcc.textContent = "—";
      }
    }

    tr.append(tdFunc, tdIni, tdFim, tdDias, tdEstado, tdNotas, tdAcc);
    tbody.appendChild(tr);
  });
}

// =========================================================
// Calendário mensal
// =========================================================
const NOMES_MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                     "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const NOMES_DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function renderCalendario() {
  calTitle.textContent = NOMES_MESES[calMes] + " " + calAno;
  calGrid.innerHTML = "";

  // Cabeçalho dos dias da semana
  NOMES_DIAS.forEach(n => {
    const c = document.createElement("div");
    c.className = "cal-cell cal-weekday";
    c.textContent = n;
    calGrid.appendChild(c);
  });

  const primeiroDia = new Date(calAno, calMes, 1);
  // offset segunda=0 ... domingo=6
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

    const emFerias = contarEmFeriasNoDia(iso);
    const count = emFerias.size;

    if (count > 0) {
      const contador = document.createElement("div");
      contador.className = "cal-count";
      if (count >= config.limiteMax) {
        celula.classList.add("cal-cheio");
        contador.textContent = "⛔ " + count + "/" + config.limiteMax;
      } else {
        celula.classList.add("cal-com-ferias");
        contador.textContent = "🏖️ " + count + "/" + config.limiteMax;
      }
      celula.appendChild(contador);

      const nomes = Array.from(emFerias).sort((a, b) => a.localeCompare(b, "pt"));
      const lista = document.createElement("div");
      lista.className = "cal-names";
      nomes.forEach(n => {
        const chip = document.createElement("span");
        chip.className = "cal-chip";
        chip.textContent = n;
        lista.appendChild(chip);
      });
      celula.appendChild(lista);
    }

    celula.title = count + " funcionário(s) em férias · limite " + config.limiteMax;
    calGrid.appendChild(celula);
  }

  calLegend.innerHTML =
    '<span class="leg-item leg-ok">🏖️ com férias (vagas)</span>' +
    '<span class="leg-item leg-full">⛔ limite atingido (' + config.limiteMax + ')</span>' +
    '<span class="leg-item leg-today">hoje</span>';

  limiteLabel.textContent = "(máx. atuais: " + config.limiteMax + ")";
}

calPrev.addEventListener("click", () => { calMes--; if (calMes < 0) { calMes = 11; calAno--; } renderCalendario(); });
calNext.addEventListener("click", () => { calMes++; if (calMes > 11) { calMes = 0; calAno++; } renderCalendario(); });
calToday.addEventListener("click", () => { const h = new Date(); calAno = h.getFullYear(); calMes = h.getMonth(); renderCalendario(); });

// =========================================================
// Render global + sincronização entre separadores
// =========================================================
function renderizarTudo() {
  renderDropdownFuncionarios();
  renderPedidos();
  renderCalendario();
  if (sessao && sessao.papel === "admin") renderUtilizadores();
}

window.addEventListener("storage", () => {
  // Outro separador alterou os dados -> recarrega estado
  utilizadores = JSON.parse(localStorage.getItem(KEY_UTILIZADORES) || "[]");
  pedidos = JSON.parse(localStorage.getItem(KEY_PEDIDOS) || "[]");
  config = JSON.parse(localStorage.getItem(KEY_CONFIG) || '{"limiteMax":3}');
  sessao = JSON.parse(localStorage.getItem(KEY_SESSAO) || "null");
  if (sessao) mostrarApp(); else sair();
});

// ---------- Arranque ----------
mostrarApp();
