(() => {
  "use strict";

  const STORAGE_KEY = "controlGastosData.v1";

  const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const DEFAULT_EGRESOS = [
    { concepto: "Admón / Parqueadero", presupuestado: 212000 },
    { concepto: "Coopcafam", presupuestado: 91000 },
    { concepto: "Esposa", presupuestado: 150000 },
    { concepto: "Celular", presupuestado: 53000 },
    { concepto: "Agua", presupuestado: 90000 },
    { concepto: "Luz", presupuestado: 150000 },
    { concepto: "Gas", presupuestado: 20000 },
    { concepto: "Parqueo moto", presupuestado: 42000 },
    { concepto: "Crédito 1", presupuestado: 215000 },
    { concepto: "Claro hogar", presupuestado: 60000 },
    { concepto: "Gasolina", presupuestado: 250000 },
    { concepto: "Verduras", presupuestado: 120000 },
    { concepto: "Mercado", presupuestado: 200000 },
    { concepto: "Carnes", presupuestado: 150000 },
    { concepto: "Huevos", presupuestado: 34000 },
    { concepto: "Almuerzo fin de semana", presupuestado: 150000 },
    { concepto: "Transporte", presupuestado: 40000 },
    { concepto: "Spotify", presupuestado: 10000 },
    { concepto: "Otros varios", presupuestado: 220000 },
    { concepto: "Cafam / citas", presupuestado: 80000 },
    { concepto: "Deuda anterior", presupuestado: 0 }
  ];

  const fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const money = (n) => fmt.format(Math.round(n || 0));
  const numFmt = new Intl.NumberFormat("es-CO");

  // Los montos se escriben a la colombiana (punto = separador de miles), así
  // que estos campos son texto: se parsean quitando todo lo que no sea dígito.
  function parseMoneyInput(str) {
    const digits = String(str || "").replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
  }

  function formatMoneyInput(n) {
    return n ? numFmt.format(n) : "";
  }

  function wireMoneyInput(input, onChange) {
    input.addEventListener("focus", () => {
      const raw = parseMoneyInput(input.value);
      input.value = raw || "";
    });
    input.addEventListener("input", () => {
      onChange(parseMoneyInput(input.value));
    });
    input.addEventListener("blur", () => {
      input.value = formatMoneyInput(parseMoneyInput(input.value));
    });
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { months: {} };
      const parsed = JSON.parse(raw);
      if (!parsed.months) return { months: {} };
      return parsed;
    } catch (e) {
      console.warn("No se pudo leer el almacenamiento local", e);
      return { months: {} };
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("No se pudo guardar el almacenamiento local", e);
    }
  }

  let state = loadData();

  function monthKey(year, monthIndex) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  }

  function makeRow(concepto, presupuestado) {
    return { id: uid(), concepto, presupuestado: presupuestado || 0, real: 0 };
  }

  function ensureMonth(key) {
    if (!state.months[key]) {
      state.months[key] = {
        ingresoReal: 0,
        egresos: DEFAULT_EGRESOS.map((e) => makeRow(e.concepto, e.presupuestado)),
        gastosHormiga: []
      };
      saveData();
    }
    const month = state.months[key];
    if (!month.gastosHormiga) month.gastosHormiga = [];
    return month;
  }

  function seccionHormigaTotal(seccion) {
    return (seccion.items || []).reduce((s, it) => s + (it.saldo || 0), 0);
  }

  function gastosHormigaTotal(month) {
    return (month.gastosHormiga || []).reduce((s, seccion) => s + seccionHormigaTotal(seccion), 0);
  }

  function monthTotals(month) {
    const ingresosReal = month.ingresoReal || 0;
    const egresosPresupuestado = month.egresos.reduce((s, r) => s + (r.presupuestado || 0), 0);
    const egresosRealTabla = month.egresos.reduce((s, r) => s + (r.real || 0), 0);
    const hormigaTotal = gastosHormigaTotal(month);
    const egresosReal = egresosRealTabla + hormigaTotal;
    return {
      ingresosReal,
      egresosPresupuestado,
      egresosReal,
      egresosRealTabla,
      hormigaTotal,
      saldo: ingresosReal - egresosReal
    };
  }

  function ahorroAcumuladoHasta(key) {
    const sortedKeys = Object.keys(state.months).sort();
    let acumulado = 0;
    for (const k of sortedKeys) {
      if (k > key) break;
      acumulado += monthTotals(state.months[k]).saldo;
    }
    return acumulado;
  }

  const now = new Date();
  let currentYear = now.getFullYear();
  let currentMonth = now.getMonth();

  const monthSelect = document.getElementById("monthSelect");
  const yearInput = document.getElementById("yearInput");
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");

  MESES.forEach((m, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = m;
    monthSelect.appendChild(opt);
  });

  function syncPickerUI() {
    monthSelect.value = String(currentMonth);
    yearInput.value = String(currentYear);
  }

  function changeMonth(delta) {
    let m = currentMonth + delta;
    let y = currentYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    currentMonth = m;
    currentYear = y;
    syncPickerUI();
    render();
  }

  prevMonthBtn.addEventListener("click", () => changeMonth(-1));
  nextMonthBtn.addEventListener("click", () => changeMonth(1));
  monthSelect.addEventListener("change", () => {
    currentMonth = Number(monthSelect.value);
    render();
  });
  yearInput.addEventListener("change", () => {
    const y = Number(yearInput.value);
    if (Number.isFinite(y) && y >= 2000 && y <= 2100) {
      currentYear = y;
      render();
    }
  });

  const tablaEgresosBody = document.querySelector("#tablaEgresos tbody");
  const rowEgresoTemplate = document.getElementById("rowEgresoTemplate");
  const ingresoInput = document.getElementById("ingresoInput");

  wireMoneyInput(ingresoInput, (value) => {
    const month = ensureMonth(monthKey(currentYear, currentMonth));
    month.ingresoReal = value;
    saveData();
    renderSummaryAndCharts();
  });

  function buildEgresoRow(data) {
    const frag = rowEgresoTemplate.content.cloneNode(true);
    const tr = frag.querySelector("tr");
    tr.dataset.id = data.id;
    const conceptInput = tr.querySelector(".concept-input");
    const budgetInput = tr.querySelector(".budget-input");
    const actualInput = tr.querySelector(".actual-input");
    const diffCell = tr.querySelector(".diff-cell");

    function refreshDiff() {
      const diff = (data.presupuestado || 0) - (data.real || 0);
      diffCell.textContent = money(diff);
      diffCell.classList.remove("over", "under");
      if (diff < 0) diffCell.classList.add("over");
      else if (diff > 0) diffCell.classList.add("under");
    }

    conceptInput.value = data.concepto;
    budgetInput.value = formatMoneyInput(data.presupuestado);
    actualInput.value = formatMoneyInput(data.real);
    refreshDiff();

    conceptInput.addEventListener("input", () => {
      data.concepto = conceptInput.value;
      saveData();
      renderSummaryAndCharts();
    });
    wireMoneyInput(budgetInput, (value) => {
      data.presupuestado = value;
      refreshDiff();
      saveData();
      renderSummaryAndCharts();
    });
    wireMoneyInput(actualInput, (value) => {
      data.real = value;
      refreshDiff();
      saveData();
      renderSummaryAndCharts();
    });
    return tr;
  }

  document.getElementById("addEgreso").addEventListener("click", () => {
    const month = ensureMonth(monthKey(currentYear, currentMonth));
    month.egresos.push(makeRow(""));
    saveData();
    render();
  });

  const hormigaContainer = document.getElementById("hormigaContainer");
  const seccionHormigaTemplate = document.getElementById("seccionHormigaTemplate");
  const itemHormigaTemplate = document.getElementById("itemHormigaTemplate");

  function makeHormigaItem(nombre) {
    return { id: uid(), nombre: nombre || "", saldo: 0 };
  }

  function buildItemHormigaRow(seccion, item, onSaldoChange) {
    const frag = itemHormigaTemplate.content.cloneNode(true);
    const tr = frag.querySelector("tr");
    const nameInput = tr.querySelector(".hormiga-item-name");
    const saldoInput = tr.querySelector(".hormiga-item-saldo");
    const delBtn = tr.querySelector(".del-item-btn");

    nameInput.value = item.nombre;
    saldoInput.value = formatMoneyInput(item.saldo);

    nameInput.addEventListener("input", () => {
      item.nombre = nameInput.value;
      saveData();
    });
    wireMoneyInput(saldoInput, (value) => {
      item.saldo = value;
      saveData();
      onSaldoChange();
    });
    delBtn.addEventListener("click", () => {
      seccion.items = seccion.items.filter((it) => it.id !== item.id);
      saveData();
      renderHormiga();
    });
    return tr;
  }

  function buildSeccionHormiga(seccion) {
    const frag = seccionHormigaTemplate.content.cloneNode(true);
    const wrap = frag.querySelector(".hormiga-seccion");
    const nameInput = wrap.querySelector(".hormiga-seccion-name");
    const totalEl = wrap.querySelector(".hormiga-seccion-total");
    const addItemBtn = wrap.querySelector(".add-item-btn");
    const delSeccionBtn = wrap.querySelector(".del-seccion-btn");
    const itemsBody = wrap.querySelector(".hormiga-items-table tbody");

    function refreshTotal() {
      totalEl.textContent = money(seccionHormigaTotal(seccion));
    }

    nameInput.value = seccion.nombre;
    refreshTotal();

    nameInput.addEventListener("input", () => {
      seccion.nombre = nameInput.value;
      saveData();
    });

    function renderItems() {
      itemsBody.innerHTML = "";
      (seccion.items || []).forEach((item) => {
        itemsBody.appendChild(buildItemHormigaRow(seccion, item, () => {
          refreshTotal();
          renderSummaryAndCharts();
        }));
      });
    }
    renderItems();

    addItemBtn.addEventListener("click", () => {
      seccion.items.push(makeHormigaItem(""));
      saveData();
      renderItems();
    });

    delSeccionBtn.addEventListener("click", () => {
      const month = ensureMonth(monthKey(currentYear, currentMonth));
      month.gastosHormiga = month.gastosHormiga.filter((s) => s.id !== seccion.id);
      saveData();
      renderHormiga();
    });

    return wrap;
  }

  function renderHormiga() {
    const month = ensureMonth(monthKey(currentYear, currentMonth));
    hormigaContainer.innerHTML = "";
    month.gastosHormiga.forEach((seccion) => {
      hormigaContainer.appendChild(buildSeccionHormiga(seccion));
    });
    renderSummaryAndCharts();
  }

  document.getElementById("addSeccionHormiga").addEventListener("click", () => {
    const month = ensureMonth(monthKey(currentYear, currentMonth));
    month.gastosHormiga.push({ id: uid(), nombre: "", items: [] });
    saveData();
    renderHormiga();
  });

  document.getElementById("resetMonthBtn").addEventListener("click", () => {
    const key = monthKey(currentYear, currentMonth);
    if (!confirm(`¿Vaciar todos los valores de ${MESES[currentMonth]} ${currentYear}? Esta acción no se puede deshacer.`)) return;
    delete state.months[key];
    ensureMonth(key);
    saveData();
    render();
  });

  function slugify(text) {
    return text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
  }

  function applyCurrencyFormat(ws) {
    if (!ws["!ref"]) return;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && typeof cell.v === "number") {
          cell.z = '"$"#,##0';
        }
      }
    }
  }

  document.getElementById("exportExcelBtn").addEventListener("click", () => {
    if (typeof XLSX === "undefined") {
      alert("No se pudo cargar la librería de exportación a Excel. Verifica tu conexión a internet e inténtalo de nuevo.");
      return;
    }
    const key = monthKey(currentYear, currentMonth);
    const month = ensureMonth(key);
    const mesNombre = MESES[currentMonth];
    const totals = monthTotals(month);
    const ahorroAcumulado = ahorroAcumuladoHasta(key);

    const wb = XLSX.utils.book_new();

    const resumenAOA = [
      ["Control de Gastos y Ahorro"],
      [`${mesNombre} ${currentYear}`],
      [],
      ["Concepto", "Valor"],
      ["Ingresos del mes", totals.ingresosReal],
      ["Gastos del mes", totals.egresosReal],
      ["  · Gastos fijos", totals.egresosRealTabla],
      ["  · Gastos hormiga", totals.hormigaTotal],
      ["Saldo del mes", totals.saldo],
      ["Ahorro acumulado", ahorroAcumulado]
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenAOA);
    wsResumen["!cols"] = [{ wch: 22 }, { wch: 16 }];
    applyCurrencyFormat(wsResumen);
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

    const egresosAOA = [["Concepto", "Presupuestado", "Real", "Diferencia"]];
    month.egresos.forEach((r) => {
      const presu = r.presupuestado || 0;
      const real = r.real || 0;
      egresosAOA.push([r.concepto || "(sin nombre)", presu, real, presu - real]);
    });
    egresosAOA.push(["Total", totals.egresosPresupuestado, totals.egresosReal, totals.egresosPresupuestado - totals.egresosReal]);
    const wsEgresos = XLSX.utils.aoa_to_sheet(egresosAOA);
    wsEgresos["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    applyCurrencyFormat(wsEgresos);
    XLSX.utils.book_append_sheet(wb, wsEgresos, "Gastos");

    const hormigaAOA = [["Sección", "Sub-sección", "Saldo"]];
    month.gastosHormiga.forEach((seccion) => {
      (seccion.items || []).forEach((item) => {
        hormigaAOA.push([seccion.nombre || "(sin nombre)", item.nombre || "(sin nombre)", item.saldo || 0]);
      });
    });
    if (hormigaAOA.length > 1) {
      hormigaAOA.push(["Total", "", totals.hormigaTotal]);
      const wsHormiga = XLSX.utils.aoa_to_sheet(hormigaAOA);
      wsHormiga["!cols"] = [{ wch: 20 }, { wch: 24 }, { wch: 16 }];
      applyCurrencyFormat(wsHormiga);
      XLSX.utils.book_append_sheet(wb, wsHormiga, "Gastos Hormiga");
    }

    XLSX.writeFile(wb, `presupuesto-${slugify(mesNombre)}-${currentYear}.xlsx`);
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `respaldo-control-gastos-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.months) throw new Error("Formato inválido");
        state = parsed;
        saveData();
        render();
        alert("Respaldo importado correctamente.");
      } catch (err) {
        alert("No se pudo importar el archivo: formato inválido.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  let chartEgresos = null;
  let chartHistorial = null;

  function renderSummaryAndCharts() {
    const key = monthKey(currentYear, currentMonth);
    const month = ensureMonth(key);

    const totals = monthTotals(month);
    const { egresosReal: totalEgresosReal, saldo } = totals;

    document.getElementById("sumEgresos").textContent = money(totalEgresosReal);
    const saldoEl = document.getElementById("sumSaldo");
    saldoEl.textContent = money(saldo);
    const balanceCard = document.getElementById("balanceCard");
    balanceCard.classList.remove("positive", "negative");
    balanceCard.classList.add(saldo >= 0 ? "positive" : "negative");

    const sortedKeys = Object.keys(state.months).sort();
    let acumulado = 0;
    const historyPoints = [];
    sortedKeys.forEach((k) => {
      const t = monthTotals(state.months[k]);
      acumulado += t.saldo;
      if (k <= key) {
        historyPoints.push({ key: k, acumulado, saldo: t.saldo });
      }
    });
    const ahorroAcumulado = historyPoints.length ? historyPoints[historyPoints.length - 1].acumulado : 0;
    document.getElementById("sumAhorro").textContent = money(ahorroAcumulado);

    const categorias = month.egresos
      .filter((r) => (r.real || 0) > 0)
      .map((r) => ({ label: r.concepto || "(sin nombre)", value: r.real }))
      .concat(
        month.gastosHormiga.flatMap((seccion) =>
          (seccion.items || [])
            .filter((it) => (it.saldo || 0) > 0)
            .map((it) => ({
              label: `${seccion.nombre || "Hormiga"}: ${it.nombre || "(sin nombre)"}`,
              value: it.saldo
            }))
        )
      );

    const chartCanvas = document.getElementById("chartEgresos");
    const emptyHint = document.getElementById("chartEmptyHint");
    const chartsAvailable = typeof Chart !== "undefined";
    if (!chartsAvailable) {
      emptyHint.textContent = "Los gráficos no se pudieron cargar (sin conexión a internet).";
      emptyHint.style.display = "flex";
      chartCanvas.style.display = "none";
      document.getElementById("chartHistorial").style.display = "none";
      return;
    }
    if (categorias.length === 0) {
      emptyHint.style.display = "flex";
      chartCanvas.style.display = "none";
      if (chartEgresos) { chartEgresos.destroy(); chartEgresos = null; }
    } else {
      emptyHint.style.display = "none";
      chartCanvas.style.display = "block";
      const palette = ["#4f46e5", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];
      const data = {
        labels: categorias.map((c) => c.label),
        datasets: [{
          data: categorias.map((c) => c.value),
          backgroundColor: categorias.map((_, i) => palette[i % palette.length]),
          borderWidth: 0
        }]
      };
      if (chartEgresos) {
        chartEgresos.data = data;
        chartEgresos.update();
      } else {
        chartEgresos = new Chart(chartCanvas, {
          type: "doughnut",
          data,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "right", labels: { boxWidth: 12, font: { size: 11 } } }
            }
          }
        });
      }
    }

    const histLabels = historyPoints.slice(-12).map((p) => {
      const [y, m2] = p.key.split("-");
      return `${MESES[Number(m2) - 1].slice(0, 3)} ${y}`;
    });
    const histValues = historyPoints.slice(-12).map((p) => p.saldo);
    const histCanvas = document.getElementById("chartHistorial");
    const histData = {
      labels: histLabels,
      datasets: [{
        label: "Saldo mensual",
        data: histValues,
        backgroundColor: histValues.map((v) => (v >= 0 ? "#10b981" : "#ef4444")),
        borderRadius: 4
      }]
    };
    if (chartHistorial) {
      chartHistorial.data = histData;
      chartHistorial.update();
    } else {
      chartHistorial = new Chart(histCanvas, {
        type: "bar",
        data: histData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { ticks: { callback: (v) => money(v) } }
          }
        }
      });
    }
  }

  function buildEmptyRow(colspan, text) {
    const tr = document.createElement("tr");
    tr.className = "empty-row";
    const td = document.createElement("td");
    td.colSpan = colspan;
    td.textContent = text;
    tr.appendChild(td);
    return tr;
  }

  function render() {
    const key = monthKey(currentYear, currentMonth);
    const month = ensureMonth(key);
    syncPickerUI();

    ingresoInput.value = formatMoneyInput(month.ingresoReal);

    tablaEgresosBody.innerHTML = "";
    if (month.egresos.length === 0) {
      tablaEgresosBody.appendChild(buildEmptyRow(4, "Aún no hay conceptos. Usa \"+ Agregar\" para añadir uno."));
    } else {
      month.egresos.forEach((r) => tablaEgresosBody.appendChild(buildEgresoRow(r)));
    }

    renderHormiga();
  }

  render();
})();
