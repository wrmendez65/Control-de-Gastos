(() => {
  "use strict";

  /* ---------- Constantes ---------- */
  const STORAGE_KEY = "controlGastosData.v1";
  const DEFAULT_EGRESOS = [
    ["Admón / Parqueadero", 212000],
    ["Coopcafam", 91000],
    ["Esposa", 150000],
    ["Celular", 53000],
    ["Agua", 90000],
    ["Luz", 150000],
    ["Gas", 20000],
    ["Parqueo moto", 42000],
    ["Crédito 1", 215000],
    ["Claro hogar", 60000],
    ["Gasolina", 250000],
    ["Verduras", 120000],
    ["Mercado", 200000],
    ["Carnes", 150000],
    ["Huevos", 34000],
    ["Almuerzo fin de semana", 150000],
    ["Transporte", 40000],
    ["Spotify", 10000],
    ["Otros varios", 220000],
    ["Cafam / citas", 80000],
    ["Deuda anterior", 0],
  ];
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const CHART_COLORS = ["#4f46e5", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#d97706", "#65a30d", "#059669", "#0891b2", "#2563eb", "#9333ea", "#c026d3", "#e11d48", "#0d9488", "#ca8a04", "#4338ca"];

  const numFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
  const money = (n) => (n < 0 ? "-$" : "$") + numFmt.format(Math.abs(Math.round(n || 0)));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const $ = (id) => document.getElementById(id);

  /* ---------- Inputs de dinero ---------- */
  function parseMoneyInput(str) {
    const digits = String(str ?? "").replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
  }
  function formatMoneyInput(n) {
    return n ? numFmt.format(n) : "";
  }
  function wireMoneyInput(input, value, onChange) {
    input.value = formatMoneyInput(value);
    input.addEventListener("focus", () => {
      const n = parseMoneyInput(input.value);
      input.value = n ? String(n) : "";
      requestAnimationFrame(() => { try { input.select(); } catch (e) { /* noop */ } });
    });
    input.addEventListener("input", () => onChange(parseMoneyInput(input.value)));
    input.addEventListener("blur", () => { input.value = formatMoneyInput(parseMoneyInput(input.value)); });
  }

  /* ---------- Estado ---------- */
  function defaultEgresos() {
    return DEFAULT_EGRESOS.map(([concepto, presupuestado]) => ({ id: uid(), concepto, presupuestado, real: 0, fijo: true }));
  }
  function newMonth() {
    return { ingresoReal: 0, egresos: defaultEgresos(), gastosHormiga: [] };
  }
  function isValidState(s) {
    return s && typeof s === "object" && s.months && typeof s.months === "object";
  }
  function normalizeMonth(m) {
    if (!m || typeof m !== "object") return newMonth();
    // compatibilidad: si ingresoReal llegó como arreglo, sumarlo
    if (Array.isArray(m.ingresoReal)) m.ingresoReal = m.ingresoReal.reduce((a, x) => a + (Number(x && x.real) || 0), 0);
    m.ingresoReal = Number(m.ingresoReal) || 0;
    m.egresos = Array.isArray(m.egresos) ? m.egresos.map((e) => ({
      id: e.id || uid(), concepto: String(e.concepto ?? ""), presupuestado: Number(e.presupuestado) || 0, real: Number(e.real) || 0, fijo: !!e.fijo,
    })) : defaultEgresos();
    m.gastosHormiga = Array.isArray(m.gastosHormiga) ? m.gastosHormiga.map((s) => ({
      id: s.id || uid(), nombre: String(s.nombre ?? ""),
      items: Array.isArray(s.items) ? s.items.map((it) => ({ id: it.id || uid(), nombre: String(it.nombre ?? ""), saldo: Number(it.saldo) || 0 })) : [],
    })) : [];
    return m;
  }
  function normalizeState(s) {
    const out = { months: {}, updatedAt: Number(s.updatedAt) || 0 };
    Object.keys(s.months).forEach((k) => { if (/^\d{4}-\d{2}$/.test(k)) out.months[k] = normalizeMonth(s.months[k]); });
    return out;
  }
  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidState(parsed)) return normalizeState(parsed);
      }
    } catch (e) { /* sin localStorage */ }
    return { months: {}, updatedAt: 0 };
  }

  let state = loadLocal();
  const today = new Date();
  let currentKey = keyOf(today.getFullYear(), today.getMonth() + 1);

  function keyOf(y, m) { return `${y}-${String(m).padStart(2, "0")}`; }
  function splitKey(k) { const [y, m] = k.split("-").map(Number); return { y, m }; }
  function shiftKey(k, delta) {
    const { y, m } = splitKey(k);
    const d = new Date(y, m - 1 + delta, 1);
    return keyOf(d.getFullYear(), d.getMonth() + 1);
  }
  function labelOf(k, short) {
    const { y, m } = splitKey(k);
    return short ? `${MESES_CORTOS[m - 1]} ${String(y).slice(2)}` : `${MESES[m - 1]} ${y}`;
  }
  function ensureMonth(k) {
    if (!state.months[k]) { state.months[k] = newMonth(); save(); }
    return state.months[k];
  }
  const cur = () => ensureMonth(currentKey);

  function monthTotals(month) {
    const ingresosReal = Number(month.ingresoReal) || 0;
    const egresosPresupuestado = month.egresos.reduce((a, e) => a + (e.presupuestado || 0), 0);
    const egresosRealTabla = month.egresos.reduce((a, e) => a + (e.real || 0), 0);
    const hormigaTotal = month.gastosHormiga.reduce((a, s) => a + seccionTotal(s), 0);
    const egresosReal = egresosRealTabla + hormigaTotal;
    return { ingresosReal, egresosPresupuestado, egresosRealTabla, hormigaTotal, egresosReal, saldo: ingresosReal - egresosReal };
  }
  function seccionTotal(s) { return s.items.reduce((a, it) => a + (it.saldo || 0), 0); }
  function ahorroAcumuladoHasta(key) {
    return Object.keys(state.months).filter((k) => k <= key).sort()
      .reduce((a, k) => a + monthTotals(state.months[k]).saldo, 0);
  }

  /* ---------- Persistencia (localStorage + cuenta) ---------- */
  let cloud = null; // { ref }
  let cloudTimer = null, cloudBusy = false, cloudDirty = false;

  function save() {
    state.updatedAt = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* noop */ }
    if (cloud) { cloudDirty = true; clearTimeout(cloudTimer); cloudTimer = setTimeout(flushCloud, 1200); }
  }
  async function flushCloud() {
    if (!cloud || cloudBusy || !cloudDirty) return;
    cloudBusy = true; cloudDirty = false;
    try {
      await cloud.ref.set({ state: JSON.parse(JSON.stringify(state)), updatedAt: state.updatedAt });
      setStatus("Guardado en tu cuenta · " + new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      if (e && e.code === "invalid_argument") { cloud = null; setStatus("Guardado solo en este navegador."); }
      else { cloudDirty = true; setStatus("No se pudo sincronizar; se reintentará."); }
    } finally {
      cloudBusy = false;
      if (cloudDirty && cloud) { clearTimeout(cloudTimer); cloudTimer = setTimeout(flushCloud, 3000); }
    }
  }
  async function initCloud() {
    if (!window.claude || typeof window.claude.use !== "function") { setStatus("Datos guardados en este navegador."); return; }
    try {
      const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
      if (!db || !user) { setStatus("Datos guardados en este navegador."); return; }
      const id = await user.id();
      if (!id) { setStatus("Datos guardados en este navegador."); return; }
      const ref = db.doc(`data/users/${id}/control-gastos`);
      const snap = await ref.get();
      const remote = snap.exists ? snap.data() : null;
      cloud = { ref };
      if (remote && isValidState(remote.state) && (Number(remote.updatedAt) || 0) > (state.updatedAt || 0)) {
        state = normalizeState(remote.state);
        state.updatedAt = Number(remote.updatedAt) || state.updatedAt;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* noop */ }
        renderAll();
        setStatus("Datos cargados desde tu cuenta.");
      } else if (Object.keys(state.months).length) {
        cloudDirty = true; flushCloud();
      } else {
        setStatus("Tus datos se guardan en tu cuenta.");
      }
    } catch (e) {
      setStatus("Datos guardados en este navegador.");
    }
  }

  /* ---------- UI: utilidades ---------- */
  function setStatus(t) { $("status").textContent = t; }
  let toastTimer = null;
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function confirmDialog(title, text, okLabel) {
    return new Promise((resolve) => {
      const modal = $("modal"), ok = $("modalOk"), cancel = $("modalCancel");
      $("modalTitle").textContent = title; $("modalText").textContent = text; ok.textContent = okLabel || "Aceptar";
      modal.hidden = false; ok.focus();
      const done = (v) => {
        modal.hidden = true;
        ok.removeEventListener("click", onOk); cancel.removeEventListener("click", onCancel);
        modal.removeEventListener("click", onBackdrop); document.removeEventListener("keydown", onKey);
        resolve(v);
      };
      const onOk = () => done(true), onCancel = () => done(false);
      const onBackdrop = (e) => { if (e.target === modal) done(false); };
      const onKey = (e) => { if (e.key === "Escape") done(false); };
      ok.addEventListener("click", onOk); cancel.addEventListener("click", onCancel);
      modal.addEventListener("click", onBackdrop); document.addEventListener("keydown", onKey);
    });
  }
  function signClass(el, n) { el.classList.toggle("pos", n > 0); el.classList.toggle("neg", n < 0); }
  function tpl(id) { return $(id).content.firstElementChild.cloneNode(true); }

  /* ---------- Selector de mes ---------- */
  function renderPicker() {
    const { y, m } = splitKey(currentKey);
    const ms = $("monthSelect"), ys = $("yearSelect");
    if (!ms.options.length) ms.innerHTML = MESES.map((n, i) => `<option value="${i + 1}">${n}</option>`).join("");
    const years = new Set();
    for (let i = today.getFullYear() - 5; i <= today.getFullYear() + 3; i++) years.add(i);
    Object.keys(state.months).forEach((k) => years.add(splitKey(k).y));
    years.add(y);
    ys.innerHTML = [...years].sort().map((v) => `<option value="${v}">${v}</option>`).join("");
    ms.value = String(m); ys.value = String(y);
  }
  function goTo(k) { currentKey = k; ensureMonth(k); renderAll(); }

  /* ---------- Render: gastos fijos ---------- */
  function renderEgresos() {
    const body = $("egresosBody");
    body.innerHTML = "";
    cur().egresos.forEach((e) => {
      const tr = tpl("tplEgreso");
      const concepto = tr.querySelector(".concepto");
      const dif = tr.querySelector(".diferencia");
      concepto.value = e.concepto;
      concepto.addEventListener("input", () => { e.concepto = concepto.value; save(); scheduleCharts(); });
      const updDif = () => { const d = (e.presupuestado || 0) - (e.real || 0); dif.textContent = money(d); signClass(dif, d); };
      wireMoneyInput(tr.querySelector(".presupuestado"), e.presupuestado, (v) => { e.presupuestado = v; updDif(); onDataChange(); });
      wireMoneyInput(tr.querySelector(".real"), e.real, (v) => { e.real = v; updDif(); onDataChange(); });
      updDif();
      if (!e.fijo) {
        const del = document.createElement("button");
        del.type = "button"; del.className = "icon-btn danger"; del.textContent = "✕";
        del.setAttribute("aria-label", "Eliminar fila"); del.title = "Eliminar fila";
        del.addEventListener("click", () => {
          const m = cur(); m.egresos = m.egresos.filter((x) => x.id !== e.id);
          save(); renderEgresos(); onDataChange();
        });
        tr.querySelector(".col-action").appendChild(del);
      }
      body.appendChild(tr);
    });
  }

  /* ---------- Render: gastos hormiga ---------- */
  function renderHormiga() {
    const list = $("hormigaList");
    list.innerHTML = "";
    const secciones = cur().gastosHormiga;
    $("hormigaEmpty").hidden = secciones.length > 0;
    secciones.forEach((s) => {
      const el = tpl("tplSeccion");
      const name = el.querySelector(".h-section-name");
      const totalEl = el.querySelector(".h-section-total");
      const tbody = el.querySelector(".h-items");
      name.value = s.nombre;
      name.addEventListener("input", () => { s.nombre = name.value; save(); scheduleCharts(); });
      const updTotal = () => { totalEl.textContent = money(seccionTotal(s)); };
      el.querySelector(".del-section").addEventListener("click", async () => {
        const ok = await confirmDialog("Eliminar sección", `¿Eliminar la sección “${s.nombre || "sin nombre"}” y sus sub-secciones?`, "Eliminar");
        if (!ok) return;
        const m = cur(); m.gastosHormiga = m.gastosHormiga.filter((x) => x.id !== s.id);
        save(); renderHormiga(); onDataChange();
      });
      const addItemRow = (it, focus) => {
        const tr = tpl("tplItem");
        const n = tr.querySelector(".item-name");
        n.value = it.nombre;
        n.addEventListener("input", () => { it.nombre = n.value; save(); scheduleCharts(); });
        wireMoneyInput(tr.querySelector(".item-saldo"), it.saldo, (v) => { it.saldo = v; updTotal(); onDataChange(); });
        tr.querySelector(".del-item").addEventListener("click", () => {
          s.items = s.items.filter((x) => x.id !== it.id);
          tr.remove(); updTotal(); save(); onDataChange();
        });
        tbody.appendChild(tr);
        if (focus) n.focus();
      };
      s.items.forEach((it) => addItemRow(it, false));
      el.querySelector(".add-item").addEventListener("click", () => {
        const it = { id: uid(), nombre: "", saldo: 0 };
        s.items.push(it); save(); addItemRow(it, true); onDataChange();
      });
      updTotal();
      list.appendChild(el);
    });
  }

  /* ---------- Render: totales ---------- */
  function renderTotals() {
    const m = cur();
    const t = monthTotals(m);
    $("totalGastos").textContent = money(t.egresosReal);
    $("gastosDetalle").textContent = `Fijos ${money(t.egresosRealTabla)} · Hormiga ${money(t.hormigaTotal)}`;
    $("saldoMes").textContent = money(t.saldo);
    $("cardSaldo").classList.toggle("negative", t.saldo < 0);
    const ahorro = ahorroAcumuladoHasta(currentKey);
    $("ahorroAcumulado").textContent = money(ahorro);
    $("totPresupuestado").textContent = money(t.egresosPresupuestado);
    $("totReal").textContent = money(t.egresosRealTabla);
    const dif = t.egresosPresupuestado - t.egresosRealTabla;
    const difEl = $("totDiferencia"); difEl.textContent = money(dif); signClass(difEl, dif);
    $("hormigaTotal").textContent = "Total " + money(t.hormigaTotal);
  }

  function renderIngreso() {
    const inp = $("ingresoReal");
    if (document.activeElement === inp) inp.blur();
    inp.value = formatMoneyInput(cur().ingresoReal);
  }

  /* ---------- Gráficos ---------- */
  let chartCat = null, chartHist = null, chartTimer = null;
  function scheduleCharts() { clearTimeout(chartTimer); chartTimer = setTimeout(renderCharts, 250); }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function renderCharts() {
    const msgCat = $("msgCategorias"), msgHist = $("msgHistorial");
    if (typeof window.Chart === "undefined") {
      [msgCat, msgHist].forEach((el) => { el.hidden = false; el.textContent = "Los gráficos no están disponibles (no se pudo cargar Chart.js; revisa tu conexión a internet)."; });
      document.querySelectorAll(".chart-box").forEach((b) => { b.hidden = true; });
      return;
    }
    const text = cssVar("--text") || "#1c1f2e";
    const muted = cssVar("--muted") || "#6b7088";
    const border = cssVar("--border") || "#e3e6f0";
    const surface = cssVar("--surface") || "#fff";
    const m = cur();

    // Dona: gastos por categoría
    const labels = [], data = [];
    m.egresos.forEach((e) => { if (e.real > 0) { labels.push(e.concepto || "Sin nombre"); data.push(e.real); } });
    m.gastosHormiga.forEach((s) => s.items.forEach((it) => {
      if (it.saldo > 0) { labels.push(`🐜 ${s.nombre || "Sección"} · ${it.nombre || "Sub-sección"}`); data.push(it.saldo); }
    }));
    const boxCat = $("chartCategorias").parentElement;
    if (!data.length) {
      if (chartCat) { chartCat.destroy(); chartCat = null; }
      boxCat.hidden = true; msgCat.hidden = false;
      msgCat.textContent = "Cuando registres gastos reales este mes, aquí verás su distribución.";
    } else {
      boxCat.hidden = false; msgCat.hidden = true;
      const colors = data.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
      if (chartCat) chartCat.destroy();
      chartCat = new Chart($("chartCategorias"), {
        type: "doughnut",
        data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: surface, borderWidth: 2 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: "58%",
          plugins: {
            legend: { position: window.innerWidth < 700 ? "bottom" : "right", labels: { color: text, boxWidth: 12, font: { family: "Inter", size: 12 } } },
            tooltip: { callbacks: { label: (c) => ` ${c.label}: ${money(c.parsed)}` } },
          },
        },
      });
    }

    // Barras: historial de saldo (últimos 12 meses)
    const keys = []; for (let i = 11; i >= 0; i--) keys.push(shiftKey(currentKey, -i));
    const saldos = keys.map((k) => (state.months[k] ? monthTotals(state.months[k]).saldo : 0));
    const income = cssVar("--income") || "#059669", expense = cssVar("--expense") || "#dc2626";
    msgHist.hidden = true; $("chartHistorial").parentElement.hidden = false;
    if (chartHist) chartHist.destroy();
    chartHist = new Chart($("chartHistorial"), {
      type: "bar",
      data: { labels: keys.map((k) => labelOf(k, true)), datasets: [{ label: "Saldo", data: saldos, backgroundColor: saldos.map((v) => (v >= 0 ? income : expense)), borderRadius: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => labelOf(keys[c[0].dataIndex]), label: (c) => ` Saldo: ${money(c.parsed.y)}` } } },
        scales: {
          x: { ticks: { color: muted, font: { family: "Inter", size: 11 } }, grid: { display: false } },
          y: { ticks: { color: muted, font: { family: "Inter", size: 11 }, callback: (v) => money(v) }, grid: { color: border } },
        },
      },
    });
  }

  /* ---------- Orquestación ---------- */
  function onDataChange() { save(); renderTotals(); scheduleCharts(); }
  function renderAll() {
    renderPicker();
    renderIngreso();
    renderEgresos();
    renderHormiga();
    renderTotals();
    renderCharts();
  }

  /* ---------- Descargas ---------- */
  async function offerDownload(filename, data, mime) {
    try {
      if (window.claude && typeof window.claude.use === "function") {
        const dl = await window.claude.use("downloads");
        if (dl) {
          try { await dl.save({ filename, data }); toast("Archivo listo: " + filename); return; }
          catch (e) {
            if (e && e.code === "declined") return;
            if (e && e.code === "rate_limited") { toast("Espera un momento e inténtalo de nuevo."); return; }
          }
        }
      }
    } catch (e) { /* usar método del navegador */ }
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function exportExcel() {
    if (typeof window.XLSX === "undefined") { toast("No se pudo cargar la librería de Excel (revisa tu conexión)."); return; }
    const m = cur();
    const t = monthTotals(m);
    const wb = XLSX.utils.book_new();
    const resumen = [
      ["Control de Gastos y Ahorro", labelOf(currentKey)],
      [],
      ["Concepto", "Valor"],
      ["Ingresos del mes", t.ingresosReal],
      ["Gastos del mes", t.egresosReal],
      ["  Gastos fijos", t.egresosRealTabla],
      ["  Gastos hormiga", t.hormigaTotal],
      ["Presupuesto gastos fijos", t.egresosPresupuestado],
      ["Saldo del mes", t.saldo],
      ["Ahorro acumulado", ahorroAcumuladoHasta(currentKey)],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(resumen); ws1["!cols"] = [{ wch: 28 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

    const gastos = [["Concepto", "Presupuestado", "Real", "Diferencia"]];
    m.egresos.forEach((e) => gastos.push([e.concepto, e.presupuestado, e.real, e.presupuestado - e.real]));
    gastos.push(["Total", t.egresosPresupuestado, t.egresosRealTabla, t.egresosPresupuestado - t.egresosRealTabla]);
    const ws2 = XLSX.utils.aoa_to_sheet(gastos); ws2["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Gastos");

    const hormigaRows = [];
    m.gastosHormiga.forEach((s) => s.items.forEach((it) => hormigaRows.push([s.nombre, it.nombre, it.saldo])));
    if (hormigaRows.length) {
      const ws3 = XLSX.utils.aoa_to_sheet([["Sección", "Sub-sección", "Saldo"], ...hormigaRows, ["Total", "", t.hormigaTotal]]);
      ws3["!cols"] = [{ wch: 22 }, { wch: 26 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws3, "Gastos Hormiga");
    }
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    offerDownload(`control-gastos-${currentKey}.xlsx`, new Uint8Array(buf), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  function exportJson() {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    offerDownload(`respaldo-control-gastos-${stamp}.json`, JSON.stringify(state, null, 2), "application/json");
  }

  async function importJson(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!isValidState(parsed)) throw new Error("formato");
      const n = Object.keys(parsed.months).length;
      const ok = await confirmDialog("Importar respaldo", `El respaldo tiene ${n} mes(es). Reemplazará todos los datos actuales. ¿Continuar?`, "Importar");
      if (!ok) return;
      state = normalizeState(parsed);
      save(); renderAll(); toast("Respaldo importado.");
    } catch (e) {
      toast("El archivo no es un respaldo válido.");
    }
  }

  /* ---------- Eventos ---------- */
  $("prevMonth").addEventListener("click", () => goTo(shiftKey(currentKey, -1)));
  $("nextMonth").addEventListener("click", () => goTo(shiftKey(currentKey, 1)));
  $("monthSelect").addEventListener("change", (e) => goTo(keyOf(splitKey(currentKey).y, Number(e.target.value))));
  $("yearSelect").addEventListener("change", (e) => goTo(keyOf(Number(e.target.value), splitKey(currentKey).m)));

  wireMoneyInput($("ingresoReal"), 0, (v) => { cur().ingresoReal = v; onDataChange(); });

  $("addEgreso").addEventListener("click", () => {
    cur().egresos.push({ id: uid(), concepto: "", presupuestado: 0, real: 0, fijo: false });
    save(); renderEgresos(); renderTotals();
    const rows = $("egresosBody").querySelectorAll(".concepto");
    rows[rows.length - 1].focus();
  });
  $("addSeccion").addEventListener("click", () => {
    cur().gastosHormiga.push({ id: uid(), nombre: "", items: [] });
    save(); renderHormiga(); renderTotals();
    const names = $("hormigaList").querySelectorAll(".h-section-name");
    names[names.length - 1].focus();
  });
  $("exportExcel").addEventListener("click", exportExcel);
  $("exportJson").addEventListener("click", exportJson);
  $("importJson").addEventListener("change", (e) => { importJson(e.target.files[0]); e.target.value = ""; });
  $("resetMonth").addEventListener("click", async () => {
    const ok = await confirmDialog("Vaciar mes actual", `Se borrarán todos los datos de ${labelOf(currentKey)} y se restaurarán los valores por defecto.`, "Vaciar");
    if (!ok) return;
    state.months[currentKey] = newMonth();
    save(); renderAll(); toast("Mes vaciado.");
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderCharts, 300); });
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", scheduleCharts);
  }
  new MutationObserver(scheduleCharts).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  /* ---------- Inicio ---------- */
  ensureMonth(currentKey);
  renderAll();
  initCloud();
})();
