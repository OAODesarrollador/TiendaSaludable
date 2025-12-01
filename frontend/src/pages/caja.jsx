import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Button,
  Table,
  Form,
  Row,
  Col,
  Alert,
  Modal,
  Spinner,
} from "react-bootstrap";
import jsPDF from "jspdf";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import { getCurrentARDate, getCurrentARTimestamp } from "../config/timezoneF";


const Caja = () => {
  const [session, setSession] = useState(null);
  const [pending, setPending] = useState(false);
  const [report, setReport] = useState({ sessions: [], movements: [] });
  const [period, setPeriod] = useState("today");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [type, setType] = useState("ingreso");
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [closingSummary, setClosingSummary] = useState(null); // 🔹 nuevo
  const [selectedDate, setSelectedDate] = useState("");
  const [confirmDate, setConfirmDate] = useState(""); // 🔹 para confirmar fecha en cierre
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [showPDFPreview, setShowPDFPreview] = useState(false);


  const token = localStorage.getItem("token");
  const api = axios.create({
    baseURL: "/api/cash",
    headers: { Authorization: `Bearer ${token}` },
  });
  const fetchSession = async () => {
  try {
    const res = await api.get("/session");
    setSession(res.data.session);
    // Solo inicializar si está vacío (no pisar la elección del usuario)
    if (!selectedDate) {
      setSelectedDate(getCurrentARDate());
    }
  } catch (err) {
    console.error(err);
  }
};

  const fetchPending = async () => {
    try {
      const res = await api.get("/pending-close");
      setPending(res.data.pending);
    } catch (err) {
      console.error(err);
    }
  };
      const fetchReport = async () => {
  try {
    const hoyAR = getCurrentARDate(); // ← fecha local Argentina (yyyy-mm-dd)

    let qs = "";
    if (period === "today") {
      // “Hoy” SIEMPRE es hoy en AR
      qs = `period=custom&start_date=${hoyAR}&end_date=${hoyAR}`;
    } else if (period === "custom") {
      // Fecha elegida por el usuario; si está vacía, usar hoy AR
      const d = selectedDate || hoyAR;
      qs = `period=custom&start_date=${d}&end_date=${d}`;
    } else {
      // week | month | year
      qs = `period=${period}`;
    }

    const res = await api.get(`/report?${qs}`);
    setReport(res.data);
  } catch (err) {
    console.error(err);
  }
};


  // 🔹 Abrir caja
  const handleOpenCaja = async () => {
  setLoading(true);
  try {
    // 🕒 Si el usuario no elige una fecha, usar la actual en horario argentino
    const fecha = selectedDate || getCurrentARDate();

    await api.post("/register", { 
      opening_amount: parseFloat(amount),
      date: fecha
    });

    setMessage(`✅ Caja abierta correctamente para el día ${fecha}`);
    setShowMessageModal(true);
    setShowOpenModal(false);
    setAmount("");
    fetchSession();
    fetchReport();
  } catch (err) {
    setMessage(err.response?.data?.error || "Error al abrir la caja");
    setShowMessageModal(true);
  } finally {
    setLoading(false);
  }
};

  // 🔹 Calcular resumen previo al cierre (usando la fecha de la sesión abierta)
    const handlePreviewClose = async () => {
      try {
        if (!session) {
          setMessage("No hay caja abierta para cerrar.");
          setShowMessageModal(true);
          return;
        }
        // Usar la fecha de la sesión (si no es hoy, traer ese día)
        const target = session.date || new Date().toISOString().slice(0, 10);
        const qs = `period=custom&start_date=${target}&end_date=${target}`;
        const res = await api.get(`/report?${qs}`);

        const todayData = res.data.sessions?.find(s => s.date === target);
        if (!todayData) {
          setMessage(`No hay datos de caja para la fecha ${target}`);
          setShowMessageModal(true);
          return;
        }

// 🔥 Usar SIEMPRE res.data (solo datos del día de cierre)
const sesiones = res.data.sessions || [];
const movimientos = res.data.movements || [];
const ventasTickets = res.data.sales || [];
const creditNotesTotal = res.data.creditNotesTotal || 0;

// Apertura (suma de todas las aperturas del día)
const apertura = sesiones.reduce(
  (acc, s) => acc + Number(s.opening || s.opening_amount || 0),
  0
);

// Ingresos (solo movimientos tipo ingreso)
const ingresos = movimientos
  .filter(m => m.type === "ingreso")
  .reduce((acc, m) => acc + Number(m.amount || 0), 0);

// Ventas reales (solo tickets de venta)
const ventas = ventasTickets
  .filter(s => (s.type || "").toLowerCase() === "venta")
  .reduce((acc, s) => acc + Number(s.amount ?? s.total ?? 0), 0);

// Egresos manuales (movimientos tipo egreso, sin comisiones)
const egresosManuales = movimientos
  .filter(m => m.type === "egreso" && !String(m.concept || "").startsWith("Comisión"))
  .reduce((acc, m) => acc + Number(m.amount || 0), 0);

// Comisiones del día
const comisiones = movimientos
  .filter(m => m.type === "commission")
  .reduce((acc, m) => acc + Math.abs(Number(m.amount || 0)), 0);

// 🔥 Egresos totales como en el Resumen Consolidado:
// egresos manuales + notas de crédito (del backend) + comisiones
const egresos = egresosManuales + creditNotesTotal + comisiones;

// Total final del día (mismo criterio que totalGeneral del consolidado)
const cierre = apertura + ingresos + ventas - egresos;

setClosingSummary({
  apertura,
  ingresos,
  egresos,
  cierre,
});
        
        setShowCloseModal(true);
      } catch (err) {
        setMessage("Error al obtener resumen de cierre");
        setShowMessageModal(true);
      }
    };

  // 🔹 Confirmar cierre definitivo// 🔹 Confirmar cierre definitivo (validando fecha si es de otro día)
    const handleCloseCaja = async () => {
      try {
        if (!session) {
          setMessage("No hay caja abierta para cerrar.");
          setShowMessageModal(true);
          return;
        }

        const hoy = new Date().toISOString().slice(0, 10);
        if (session.date !== hoy) {
          if (!confirmDate) {
            setMessage("Debes ingresar la fecha de cierre para confirmar.");
            setShowMessageModal(true);
            return;
          }
          if (confirmDate !== session.date) {
            setMessage(`❌ La fecha ingresada (${confirmDate}) no coincide con la caja abierta (${session.date}).`);
            setShowMessageModal(true);
            return;
          }
        }

        setLoading(true);
        await api.post("/close");
        setMessage("✅ Caja cerrada correctamente");
        setShowMessageModal(true);
        setShowCloseModal(false);
        setConfirmDate("");
        fetchSession();
        fetchReport();
      } catch (err) {
        setMessage(err.response?.data?.error || "Error al cerrar la caja");
        setShowMessageModal(true);
      } finally {
        setLoading(false);
      }
    };

  // 🔹 Registrar movimiento manual
  const handleAddMovement = async (e) => {
    e.preventDefault();
    try {
      if (!session || session.closed) {
        setMessage("⚠️ No hay caja abierta para registrar movimientos.");
        setShowMessageModal(true);
        return;
      }

      await api.post("/movement", { type, concept, amount });
      setConcept("");
      setAmount("");
      setMessage("✅ Movimiento registrado");
      setShowMessageModal(true);
      fetchReport();
    } catch (err) {
      setMessage(err.response?.data?.error || "Error al registrar movimiento");
      setShowMessageModal(true);
    }
  };

  

// 🧾 Exportar resumen de sesiones a PDF (robusto para Vite)
const handleExportPDF = async () => {
  try {
    const doc = new jsPDF("p", "mm", "a4");
    const fechaActual = getCurrentARTimestamp();
    const fechaCaja = session?.date || getCurrentARDate();
    const estadoCaja = session?.closed ? "CERRADA" : "ABIERTA";

    // === Encabezado ===
    doc.setFontSize(14);
    doc.text("Resumen de Caja - Tienda Natural", 105, 15, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Generado: ${fechaActual}`, 14, 25);
    doc.text(`Caja del ${fechaCaja} | Estado: ${estadoCaja}`, 14, 31);

    // === Datos base ===
    const sesiones = report?.sessions || [];
    const movimientos = report?.movements || [];
    const ventasTickets = report?.sales || [];

    const totalApertura = sesiones.reduce(
      (a, r) => a + Number(r.opening || r.opening_amount || 0),
      0
    );

    const ingresosPorConcepto = {};
    movimientos
      .filter((m) => m.type === "ingreso")
      .forEach((m) => {
        const key = (m.concept || "Ingreso").trim();
        ingresosPorConcepto[key] =
          (ingresosPorConcepto[key] || 0) + Number(m.amount || 0);
      });

    const ventasPorMetodo = {};
    sesiones.forEach((s) => {
      const vm = s.salesByMethod || {};
      Object.keys(vm).forEach((met) => {
        if (met !== "total") {
          ventasPorMetodo[met] =
            (ventasPorMetodo[met] || 0) + Number(vm[met] || 0);
        }
      });
    });

    const egresosPorConcepto = {};
    movimientos
      .filter((m) => m.type === "egreso")
      .forEach((m) => {
        const key = (m.concept || "Egreso").trim();
        egresosPorConcepto[key] =
          (egresosPorConcepto[key] || 0) + Number(m.amount || 0);
      });

    const totalNotasCredito = ventasTickets
      .filter((s) => (s.type || "").toLowerCase() === "nota_credito")
      .reduce((acc, s) => acc + Math.abs(Number(s.amount ?? s.total ?? 0)), 0);

    // === Formato base ===
    const startX = 14;
    let y = 40;
    const lineHeight = 7;
    const colWidth = [70, 25, 25, 25, 25, 25]; // Descripción + 5 columnas
    const headers = ["Descripción", "Apertura", "Ingresos", "Ventas", "Egresos", "Total"];

    const drawRow = (data, isHeader = false, bold = false, fill = false) => {
      let x = startX;
      if (fill) {
        doc.setFillColor(230, 255, 230);
        doc.rect(x, y - 5, colWidth.reduce((a, b) => a + b, 0), lineHeight, "F");
      }
      doc.setFont(undefined, bold ? "bold" : "normal");
      data.forEach((text, i) => {
        const val = text || "";
        doc.text(String(val), x + 2, y);
        x += colWidth[i];
      });
      y += lineHeight;
    };

    // === Tabla ===
    drawRow(headers, true, true, true);

    const addSection = (titulo, rows) => {
      doc.setTextColor(0, 128, 0);
      doc.setFontSize(11);
      doc.text(titulo, startX, y + 3);
      y += lineHeight;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      rows.forEach((r) => drawRow(r));
      y += 2;
    };

    // Secciones
    if (totalApertura > 0)
      addSection("Apertura", [
        ["Apertura de caja", totalApertura.toFixed(2), "", "", "", ""],
      ]);

    const filasIngresos = Object.entries(ingresosPorConcepto).map(([c, m]) => [
      c,
      "",
      m.toFixed(2),
      "",
      "",
      ""
    ]);
    if (filasIngresos.length > 0) addSection("Ingresos", filasIngresos);

    const filasVentas = Object.entries(ventasPorMetodo).map(([m, v]) => [
      `Venta - ${m}`,
      "",
      "",
      v.toFixed(2),
      "",
      "",
    ]);
    if (filasVentas.length > 0) addSection("Ventas", filasVentas);

    const filasEgresos = Object.entries(egresosPorConcepto).map(([c, m]) => [
      c,
      "",
      "",
      "",
      m.toFixed(2),
      "",
    ]);
    if (filasEgresos.length > 0) addSection("Egresos", filasEgresos);

    if (totalNotasCredito > 0)
      addSection("Notas de Crédito", [
        ["Notas de crédito", "", "", "", totalNotasCredito.toFixed(2), ""],
      ]);

    // Totales
    const totalIngresos = Object.values(ingresosPorConcepto).reduce((a, b) => a + b, 0);
    const totalVentas = Object.values(ventasPorMetodo).reduce((a, b) => a + b, 0);
    const totalEgresos =
      Object.values(egresosPorConcepto).reduce((a, b) => a + b, 0) + totalNotasCredito;
    const totalGeneral = totalApertura + totalIngresos + totalVentas - totalEgresos;

    // === COMISIONES DEL PERÍODO ===
const commissions = (report.movements || []).filter(m => m.type === "commission");

const commissionsByMethod = commissions.reduce((acc, m) => {
  if (!acc[m.payment_method]) acc[m.payment_method] = 0;
  acc[m.payment_method] += Math.abs(Number(m.amount || 0));
  return acc;
}, {});

const totalComisionesPDF = Object.values(commissionsByMethod).reduce((a, b) => a + b, 0);
const netoRealPDF = totalGeneral - totalComisionesPDF;

    drawRow(
      [
        "Totales generales",
        totalApertura.toFixed(2),
        totalIngresos.toFixed(2),
        totalVentas.toFixed(2),
        totalEgresos.toFixed(2),
        totalGeneral.toFixed(2),
      ],
      false,
      true,
      true
    );

    // === SECCIÓN: COMISIONES ====================================
if (totalComisionesPDF > 0) {
  y += 5;
  doc.setTextColor(200, 0, 0);
  doc.setFontSize(11);
  doc.text("Comisiones por método", startX, y);
  y += lineHeight;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);

  Object.entries(commissionsByMethod).forEach(([method, amount]) => {
    drawRow([
  `Comisión ${method.toUpperCase()}`,
  "",
  "",
  "",
  amount.toFixed(2),
  ""
]);

  });

  // Total comisiones
  drawRow(
    ["Total comisiones", "", "", "", totalComisionesPDF.toFixed(2), ""],
    false,
    true,
    true
  );

  // Neto real del comercio
  drawRow(
    ["Neto real del comercio", "", "", "", "", netoRealPDF.toFixed(2)],
    false,
    true,
    true
  );
}


    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(
      "Nota: Los egresos incluyen las notas de crédito.",
      startX,
      y,
      { maxWidth: 180 }
    );

    // === Previsualizar ===
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url);
  } catch (err) {
    console.error("Error al exportar PDF:", err);
    alert("Error al exportar PDF. Revisa la consola.");
  }
};

const handleExportExcel = async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Resumen Caja");

    // ====== Encabezado ======
    worksheet.mergeCells("A1:F1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "Resumen de Caja - Tienda Natural";
    titleCell.font = { bold: true, size: 16, color: { argb: "003300" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "E6FFE6" }
    };

    // 💥 Reforzar alineación sobre el rango completo
    worksheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

    const fechaReporte = getCurrentARTimestamp();
    const fechaCaja = session?.date || getCurrentARDate();
    const estadoCaja = session?.closed ? "CERRADA" : "ABIERTA";

    worksheet.mergeCells("A2:F2");
    const subCell = worksheet.getCell("A2");
    subCell.value = `Generado: ${fechaReporte} | Caja del ${fechaCaja} | Estado: ${estadoCaja}`;
    subCell.font = { italic: true, color: { argb: "555555" } };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
    subCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "F2FFF2" }
    };

    // 💥 Igual para la fila 2 completa
    worksheet.getRow(2).alignment = { horizontal: "center", vertical: "middle" };


    // ====== Encabezados de tabla ======
    worksheet.addRow(["Descripción", "Apertura", "Ingresos", "Ventas", "Egresos", "Total"]);
    // ====== TAMAÑO ESPECÍFICO DE COLUMNAS ======
    
    worksheet.getColumn(1).width = 52; // Descripción (larga, para conceptos contables)
    worksheet.getColumn(2).width = 18; // Apertura
    worksheet.getColumn(3).width = 18; // Ingresos
    worksheet.getColumn(4).width = 18; // Ventas
    worksheet.getColumn(5).width = 18; // Egresos
    worksheet.getColumn(6).width = 18; // Total

    // Montos alineados a la derecha (como exige AFIP)
    worksheet.getColumn(2).alignment = { horizontal: "right" };
    worksheet.getColumn(3).alignment = { horizontal: "right" };
    worksheet.getColumn(4).alignment = { horizontal: "right" };
    worksheet.getColumn(5).alignment = { horizontal: "right" };
    worksheet.getColumn(6).alignment = { horizontal: "right" };

    // Descripción alineada a la izquierda
    worksheet.getColumn(1).alignment = { horizontal: "left" };


    worksheet.getRow(3).font = { bold: true, size: 12 };
    worksheet.getRow(3).alignment = { horizontal: "center" };
    worksheet.getRow(3).eachCell((c) => {
      c.border = {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" }
      };
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "CCFFCC" },
      };
    });


    // ====== Agregaciones para el período ======
    const sesiones = report?.sessions || [];
    const movimientos = report?.movements || [];
    const ventasTickets = report?.sales || [];

    // -- Apertura (suma de todas las aperturas del período)
    const totalApertura = sesiones.reduce((a, r) => a + Number(r.opening || r.opening_amount || 0), 0);

    // -- Ingresos agrupados por concepto
    const ingresosPorConcepto = {};
    movimientos
      .filter((m) => m.type === "ingreso")
      .forEach((m) => {
        const key = (m.concept || "Ingreso").trim();
        ingresosPorConcepto[key] = (ingresosPorConcepto[key] || 0) + Number(m.amount || 0);
      });

    // -- Ventas por método (acumuladas desde salesByMethod de cada sesión)
    // ✔️ SOLO ventas reales (SIN notas de crédito)
    const ventasPorMetodo = (report?.sales || [])
      .filter(s => (s.type || "").toLowerCase() === "venta") // ← solo ventas
      .reduce((acc, s) => {
        const metodo = s.payment_method || "otros";
        acc[metodo] = (acc[metodo] || 0) + Number(s.amount ?? s.total ?? 0);
        return acc;
      }, {});


    // -- Egresos agrupados por concepto
    const egresosPorConcepto = {};
    movimientos
      .filter((m) => m.type === "egreso")
      .forEach((m) => {
        const key = (m.concept || "Egreso").trim();
        egresosPorConcepto[key] = (egresosPorConcepto[key] || 0) + Number(m.amount || 0);
      });

    // -- Notas de crédito como egreso (una sola fila)
    const totalNotasCredito = ventasTickets
      .filter((s) => (s.type || "").toLowerCase() === "nota_credito")
      .reduce((acc, s) => acc + Math.abs(Number(s.amount ?? s.total ?? 0)), 0);

    // === COMISIONES ===
    const commissionsXLS = (report.movements || []).filter(m => m.type === "commission");

    const commissionsByMethodXLS = commissionsXLS.reduce((acc, m) => {
      if (!acc[m.payment_method]) acc[m.payment_method] = 0;
      acc[m.payment_method] += Math.abs(Number(m.amount || 0));
      return acc;
    }, {});

    const totalComisionesXLS = Object.values(commissionsByMethodXLS).reduce((a, b) => a + b, 0);

    // ====== FILAS EXACTAMENTE COMO LA TABLA RESUMEN CONSOLIDADO ======

    const addRow = (descripcion, apertura = "", ingreso = "", venta = "", egreso = "") => {
      const row = worksheet.addRow([
        descripcion,
        apertura !== "" ? Number(apertura).toFixed(2) : "",
        ingreso !== "" ? Number(ingreso).toFixed(2) : "",
        venta !== "" ? Number(venta).toFixed(2) : "",
        egreso !== "" ? Number(egreso).toFixed(2) : "",
        ""
      ]);

      // Bordes y alineación
    row.eachCell((c, colNumber) => {
      // ===== Bordes =====
      c.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      };

      // ===== Columna 1 (Descripción): Izquierda =====
      if (colNumber === 1) {
        c.alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true
        };
        return;
      }

      // ===== Otras columnas: Formato CONTABLE AFIP =====
      c.alignment = { horizontal: "right", vertical: "middle" };

      // Si la celda tiene número → aplicar formato contable
      if (!isNaN(Number(c.value)) && c.value !== "") {
        c.numFmt = '"$" #,##0.00';   // ← FORMATO CONTABLE ARGENTINO
      }
    });


      // Colorear según tipo
      if (descripcion.toLowerCase().includes("comisión") ||
          descripcion.toLowerCase().includes("nota de crédito")) {
        row.eachCell((c) => {
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF0F0" } // rojo suave
          };
        });
      }
    };


    // 1) Apertura
    addRow("Apertura de caja", totalApertura, "", "", "");

    // 2) Ingresos por concepto
    Object.entries(ingresosPorConcepto).forEach(([concepto, monto]) => {
      addRow(concepto, "", monto, "", "");
    });

    // 3) Ventas por método
    Object.entries(ventasPorMetodo)
      .filter(([metodo, monto]) => typeof monto === "number" && metodo !== "total")
      .forEach(([metodo, monto]) => {
        addRow(`Venta - ${metodo}`, "", "", monto, "");
      });

    // 4) Egresos por concepto
    Object.entries(egresosPorConcepto).forEach(([concepto, monto]) => {
      addRow(concepto, "", "", "", monto);
    });

    // 5) Notas de crédito
    if (totalNotasCredito > 0) {
      addRow("Notas de crédito", "", "", "", totalNotasCredito);
    }

    // 6) Comisiones por método (igual a tabla consolidada)
    Object.entries(commissionsByMethodFooter)
      .filter(([metodo, monto]) => typeof monto === "number" && monto !== 0)
      .forEach(([metodo, monto]) => {
        addRow(`Comisión ${metodo.toUpperCase()}`, "", "", "", monto);
      });

    // ====== TOTALES (IGUAL A LA TABLA) ======
    const totalRow = worksheet.addRow([
      "Totales",
      totalApertura.toFixed(2),
      totalIngresos.toFixed(2),
      totalVentas.toFixed(2),
      totalEgresosConComisiones.toFixed(2),
      totalGeneral.toFixed(2)
    ]);
    totalRow.font = { bold: true };
    totalRow.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D4FFD4" } };
      c.border = {
        top: { style: "medium" },
        bottom: { style: "medium" },
        left: { style: "thin" },
        right: { style: "thin" }
      };
    });

    // ====== NETO REAL DEL COMERCIO ======
    const netoRow = worksheet.addRow([
      "Neto real del comercio",
      "",
      "",
      "",
      "",
      totalGeneral.toFixed(2)
    ]);
    netoRow.font = { bold: true };
    netoRow.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "CCE5FF" } };
      c.border = {
        top: { style: "medium" },
        bottom: { style: "medium" },
        left: { style: "thin" },
        right: { style: "thin" }
      };
    });


      // Comentario aclaratorio
      const infoRow = worksheet.addRow([
        "Nota: Los egresos incluyen las notas de crédito del período",
      ]);
      infoRow.font = { italic: true, color: { argb: "777777" } };
      infoRow.alignment = { horizontal: "left" };

      infoRow.getCell(1).alignment = { wrapText: true };
      worksheet.mergeCells(`A${infoRow.number}:F${infoRow.number}`);

      // ====== Descargar XLSX ======




      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Resumen_Caja_${getCurrentARDate()}.xlsx`);
    } catch (err) {
      console.error("Error al exportar Excel:", err);
      alert("Error al exportar Excel. Revisa la consola.");
    }
  };

const handlePreview = () => {
  if (!report?.sessions || report.sessions.length === 0) {
    alert("No hay datos para previsualizar.");
    return;
  }
  setPreviewData(report.sessions);
  setShowPreview(true);
};


// ==========================================================
// 🔥 Renderizado del componente
// ==========================================================

  useEffect(() => {
  const init = async () => {
    try {
      await fetchSession();
      await fetchPending();
      
    } catch (error) {
      console.error("Error inicializando caja:", error);
    }
  };
  init();
}, []); // si aún NO agregaste selectedDate, dejalo solo con [period]



// 🧮 Construye filas a mostrar: Aperturas (por sesión) + Movimientos
const displayRows = React.useMemo(() => {
  const rows = [];

  // 1) Filas de Apertura (una por cada sesión del período)
  if (report?.sessions?.length) {
    for (const s of report.sessions) {
      rows.push({
        _kind: "apertura",
        date: s.date,
        type: "apertura",
        concept: "Apertura de caja",
        amount: Number(s.opening || s.opening_amount || 0),
        payment_method: "—",
      });
    }
  }

  // 2) Filas de movimientos
  if (report?.movements?.length) {
    for (const m of report.movements) {
      rows.push({
  _kind: "mov",
  date: m.date,

  // ✔ Si es una nota de crédito, convertirlo explícitamente
  type: m.concept.startsWith("Nota de crédito")
        ? "nota_credito"
        : m.type,

  concept: m.concept,
  amount: Number(m.amount || 0),
  payment_method: m.payment_method || "—",
});

    }
  }

  // 3) Filas de Tickets de Venta
if (report?.sales?.length) {
  for (const s of report.sales) {
    if ((s.type || "").toLowerCase() === "nota_credito") continue; // ← ya está en movimientos
    rows.push({
      _kind: "venta",
      date: s.date.slice(0, 10),
      type: s.type || "venta",
      concept: `Ticket #${s.id} (${s.payment_method || "—"})`,
      amount: Number(s.amount || s.total || 0),
      payment_method: s.payment_method || "—",
    });
  }
}


  // 4) Orden simple por fecha 
rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
// 🧮 COMISIONES: egresos cuyo concepto empieza por "Comisión ..."
const commissionMovements =
  report?.movements?.filter((m) => {
    const concept = String(m.concept || "").trim().toLowerCase();
    return m.type === "egreso" && concept.startsWith("comisión");
  }) || [];


// Agrupar comisiones por método
const commissionsByMethod = commissionMovements.reduce((acc, mov) => {
  const method = mov.payment_method || "desconocido";
  acc[method] = (acc[method] || 0) + Math.abs(Number(mov.amount || 0));
  return acc;
}, {});

// Total general de comisiones
const totalCommissions = Object.values(commissionsByMethod).reduce(
  (a, b) => a + b,
  0
);

// Neto real del comercio = total sesiones - comisiones
const netoReal =
  report.sessions.reduce((a, r) => a + Number(r.total || 0), 0) -
  totalCommissions;
 

   return rows;
}, [report]);
// 🔒 Bloquear funciones si hay pendiente y caja abierta
const lock = pending && session && !session.closed;
// === COMISIONES (para footer y resumen general) ===
// 🔥 SI LA CAJA ESTÁ ABIERTA → traer comisiones desde sale_commissions (dinámicas)
let commissionsByMethodFooter = {};
let totalCommissions = 0;

if (session && session.closed === 0) {
  // Caja abierta → usar comisiones dinámicas
  commissionsByMethodFooter = report.commissionsOpenByMethod 
                           || report.commissionsDynamic 
                           || {};

  totalCommissions = report.commissionsOpenTotal 
                  || report.commissionsDynamicTotal 
                  || 0;

} else {
  // Caja cerrada → usar comisiones reales de cash_movements
  const commissionMovementsFooter =
    report?.movements?.filter((m) => {
      const concept = String(m.concept || "").trim().toLowerCase();
      return m.type === "egreso" && concept.startsWith("comisión");
    }) || [];

  commissionsByMethodFooter = commissionMovementsFooter.reduce((acc, mov) => {
    const method = mov.payment_method || "desconocido";
    acc[method] = (acc[method] || 0) + Math.abs(Number(mov.amount || 0));
    return acc;
  }, {});

  totalCommissions = Object.values(commissionsByMethodFooter).reduce(
    (a, b) => a + b,
    0
  );
}


const netoReal =
  report.sessions.reduce((a, r) => a + Number(r.total || 0), 0) -
  totalCommissions;

// ===============================
// 🟩 TOTALES CONSOLIDADOS (como Excel)
// ===============================

// Apertura total
const totalApertura = report?.sessions?.reduce(
  (acc, s) => acc + Number(s.opening || 0),
  0
);

// Ingresos por concepto
const ingresosPorConcepto = report?.movements
  ?.filter(m => m.type === "ingreso")
  .reduce((acc, m) => {
    const c = m.concept || "Ingreso";
    acc[c] = (acc[c] || 0) + Number(m.amount || 0);
    return acc;
  }, {}) || {};

// Total ingresos
const totalIngresos = Object.values(ingresosPorConcepto)
  .reduce((a, b) => a + b, 0);

// Ventas por método
// 🔥 Ventas reales SIN notas de crédito
// Solo ventas reales (sin notas de crédito)
const ventasPorMetodo = (report?.sales || [])
  .filter(s => s.type === "venta")
  .reduce((acc, s) => {
    const metodo = s.payment_method || "otros";
    acc[metodo] = (acc[metodo] || 0) + Number(s.amount || s.total || 0);
    return acc;
  }, {});


// Total real de ventas
const totalVentas = Object.values(ventasPorMetodo)
  .reduce((acc, v) => acc + Number(v || 0), 0);


// Egresos por concepto
const egresosPorConcepto = report?.movements
  ?.filter(m => m.type === "egreso" && !String(m.concept).startsWith("Comisión"))
  .reduce((acc, m) => {
    const c = m.concept || "Egreso";
    acc[c] = (acc[c] || 0) + Number(m.amount || 0);
    return acc;
  }, {}) || {};

// Total egresos (sin comisiones)
const totalEgresos = Object.values(egresosPorConcepto)
  .reduce((a, b) => a + b, 0);

// Total notas de crédito
// Eliminar venta negativa que duplicaba la nota de crédito
const ventasTickets = (report?.sales || []).filter(
  (s) => (s.type || "").toLowerCase() !== "nota_credito_negativa"
);

const totalNotasCredito = report?.creditNotesTotal || 0;



// Total egresos incluyendo comisiones
const totalEgresosConComisiones = totalEgresos + totalCommissions + totalNotasCredito;

// Total general (apertura + ingresos + ventas - todos los egresos)
const totalGeneral =
  totalApertura + totalIngresos + totalVentas - totalEgresosConComisiones;



  return (
    <div className="container mt-4">
      <h2 className="mb-3">💰 Control de Caja</h2>
      {pending && (
        <Alert variant="warning">
          ⚠️ Falta cerrar la caja del día anterior.
          <div className="mt-2">
            Se deshabilitaron los movimientos, reportes y exportaciones hasta que cierres la caja pendiente.
          </div>
        </Alert>
      )}
      {session ? (
        <Alert variant={session.closed ? "secondary" : "success"}>
          Caja del {session.date} —{" "}
          {session.closed ? "CERRADA" : "ABIERTA"} | Apertura: $
          {session.opening_amount}
        </Alert>
      ) : (
        <Alert variant="info">No hay caja abierta hoy.</Alert>
      )}
      <div className="d-flex gap-2 mb-3">
        {!session && (
          <Button onClick={() => setShowOpenModal(true)}>Abrir Caja</Button>
        )}
        {session && !session.closed && (
          <Button variant="danger" onClick={handlePreviewClose}>
            Cerrar Caja
          </Button>
        )}
      </div>
      {/* FORM MOVIMIENTO MANUAL */}
      <Form onSubmit={handleAddMovement} className="mb-4">
        <Row>
          <Col md={2}>
            <Form.Select
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={lock || loading}
            >
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </Form.Select>
          </Col>
          <Col md={6}>
            <Form.Control
              placeholder="Concepto"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              required
              disabled={lock || loading}
            />
          </Col>
          <Col md={2}>
            <Form.Control
              type="number"
              step="0.01"
              placeholder="Monto"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={lock || loading}
            />
          </Col>
          <Col md={2}>
            
            <Button type="submit" variant="primary" disabled={lock || loading}>
              Agregar
            </Button>
          </Col>
        </Row>
      </Form>
        {/* 🔹 Barra de filtros y exportación */}
<div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">

  {/* 🔸 Lado izquierdo: selección de período y Generar */}
  <div className="d-flex align-items-center flex-wrap">
    <Form.Label className="mb-0 me-2">Periodo:</Form.Label>

    <Form.Select
      value={period}
      onChange={(e) => setPeriod(e.target.value)}
      style={{ width: "200px", marginRight: "10px" }}
    >
      <option value="today">Hoy ({getCurrentARDate()})</option>
      <option value="custom">Fecha específica…</option>
      <option value="week">Semana</option>
      <option value="month">Mes</option>
      <option value="year">Año</option>
    </Form.Select>

    {period === "custom" && (
      <Form.Control
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        style={{ width: "180px", marginRight: "10px" }}
      />
    )}

    <Button
      variant="success"
      onClick={fetchReport}
      //disabled={lock || loading}
      style={{ backgroundColor: "#28a745", borderColor: "#28a745" }}
    >
      {loading ? "Generando..." : "Generar"}
    </Button>
  </div>

  {/* 🔸 Lado derecho: exportaciones */}
  <div className="d-flex gap-2 mt-2 mt-md-0">
    <Button
      onClick={handlePreview}
      disabled={lock}
      style={{
        backgroundColor: "#2ecc71",
        borderColor: "#27ae60",
        color: "white",
      }}
    >
      📊 Exportar Excel
    </Button>

    <Button
      onClick={() => setShowPDFPreview(true)}
      disabled={lock}
      style={{
        backgroundColor: "#1e7e34",
        borderColor: "#145a24",
        color: "white",
      }}
    >
      🧾 Exportar PDF
    </Button>

  </div>
</div>
      {/* 🟦 BLOQUE: RESUMEN DE COMISIONES */}
{report?.movements?.some(m => m.type === "commission") && (
  <div className="card mb-4 shadow-sm border-danger">
    <div className="card-header bg-danger text-white fw-bold">
      Comisiones por método de pago
    </div>
    <div className="card-body">
      <ul className="list-group">
        {Object.entries(
          report.movements
            .filter(m => m.type === "commission")
            .reduce((acc, m) => {
              acc[m.payment_method] = (acc[m.payment_method] || 0) + Math.abs(Number(m.amount));
              return acc;
            }, {})
        ).map(([method, amount], idx) => (
          <li key={idx} className="list-group-item d-flex justify-content-between">
            <span>{method.toUpperCase()}</span>
            <span className="fw-bold text-danger">-${amount.toFixed(2)}</span>
          </li>
        ))}
        <li className="list-group-item d-flex justify-content-between bg-light">
          <strong>Total</strong>
          <strong className="text-danger">
            -$
            {Object.values(
              report.movements
                .filter(m => m.type === "commission")
                .reduce((a, m) => a + Math.abs(Number(m.amount || 0)), 0)
            ).reduce((a, b) => a + b, 0).toFixed(2)}
          </strong>
        </li>
      </ul>
    </div>
  </div>
)}


      <h4>📊 Resumen de sesiones</h4>
{/* 🟩 RESUMEN CONSOLIDADO (IGUAL AL EXCEL REAL) */}
<div className="card mb-4 shadow-sm border-success">
  <div className="card-header bg-success text-white fw-bold">
    Resumen Consolidado de Caja
  </div>

  <div className="card-body">

    <Table bordered hover size="sm" className="mb-4">
      <thead className="table-light">
        <tr>
          <th>Descripción</th>
          <th className="text-center">Apertura</th>
          <th className="text-center">Ingresos</th>
          <th className="text-center">Ventas</th>
          <th className="text-center">Egresos</th>
          <th className="text-center">Total</th>
        </tr>
      </thead>

      <tbody>

  {/* 🔹 APERTURA */}
  <tr>
    <td>Apertura de caja</td>
    <td className="text-center">${totalApertura.toFixed(2)}</td>
    <td></td><td></td><td></td><td></td>
  </tr>

  {/* 🔹 INGRESOS POR CONCEPTO */}
  {Object.entries(ingresosPorConcepto).map(([concepto, monto], i) => (
    <tr key={"ing-" + i}>
      <td>{concepto}</td>
      <td></td>
      <td className="text-center text-success">${monto.toFixed(2)}</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  ))}

  {/* 🔹 VENTAS POR MÉTODO */}
{Object.entries(ventasPorMetodo)
  .filter(([metodo, monto]) => typeof monto === "number" && metodo !== "total")
  .map(([metodo, monto], i) => (
    <tr key={"ven-" + i}>
      <td>Venta - {metodo}</td>
      <td></td>
      <td></td>
      <td className="text-center text-primary">${Number(monto).toFixed(2)}</td>
      <td></td>
      <td></td>
    </tr>
))}


  {/* 🔹 EGRESOS POR CONCEPTO (sin comisiones) */}
  {Object.entries(egresosPorConcepto).map(([concepto, monto], i) => (
    <tr key={"egr-" + i}>
      <td>{concepto}</td>
      <td></td>
      <td></td>
      <td></td>
      <td className="text-center text-danger">${monto.toFixed(2)}</td>
      <td></td>
    </tr>
  ))}

  {/* 🔹 NOTAS DE CRÉDITO */}
  {totalNotasCredito > 0 && (
    <tr>
      <td>Notas de crédito</td>
      <td></td><td></td><td></td>
      <td className="text-center text-danger">${totalNotasCredito.toFixed(2)}</td>
      <td></td>
    </tr>
  )}

    {/* 🔹 COMISIONES POR MÉTODO (una fila por método de pago) */}
  {Object.entries(commissionsByMethodFooter)
    .filter(([metodo, monto]) => typeof monto === "number" && monto !== 0)
    .map(([metodo, monto], i) => (
      <tr key={"com-" + i}>
        <td>Comisión {metodo.toUpperCase()}</td>
        <td></td>
        <td></td>
        <td></td>
        <td className="text-center text-danger">
          ${Number(monto).toFixed(2)}
        </td>
        <td></td>
      </tr>
    ))}

  


</tbody>


      {/* TOTALES (IGUAL AL EXCEL) */}
      <tfoot>

  {/* 🔹 TOTALES GENERALES (igual a Excel) */}
  <tr className="table-success fw-bold text-center">
    <td>Totales</td>
    <td>${totalApertura.toFixed(2)}</td>
    <td>${totalIngresos.toFixed(2)}</td>
    <td>${totalVentas.toFixed(2)}</td>
    <td>${totalEgresosConComisiones.toFixed(2)}</td>
    <td>${totalGeneral.toFixed(2)}</td>
  </tr>

  {/* 🔹 NETO REAL DEL COMERCIO */}
<tr className="table-info fw-bold">
  <td>Neto real del comercio</td>
  <td colSpan="5" className="text-center">
    ${totalGeneral.toFixed(2)}
  </td>
</tr>


</tfoot>

    </Table>

  </div>
</div>

      {/* 🟢 MODAL: Apertura */}
      <Modal show={showOpenModal} onHide={() => setShowOpenModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>💰 Abrir Caja</Modal.Title>
        </Modal.Header>
          <Modal.Body>
    <Form.Group className="mb-3">
      <Form.Label>Fecha de apertura:</Form.Label>
      <Form.Control
        type="date"
        value={selectedDate || getCurrentARDate()}
        onChange={(e) => setSelectedDate(e.target.value)}
      />
      <Form.Text muted>
        Por defecto se sugiere la fecha actual ({getCurrentARDate()})
      </Form.Text>
    </Form.Group>

    <Form.Group>
      <Form.Label>Monto inicial:</Form.Label>
      <Form.Control
        type="number"
        placeholder="Ej: 1000"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
    </Form.Group>
  </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowOpenModal(false)}>
            Cancelar
          </Button>
          <Button variant="success" onClick={handleOpenCaja} disabled={loading}>
            {loading ? <Spinner size="sm" /> : "Abrir Caja"}
          </Button>
        </Modal.Footer>
      </Modal>
      {/* 🧾 MODAL: Resumen de cierre */}
      <Modal show={showCloseModal} onHide={() => setShowCloseModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>🧾 Resumen de Cierre</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {closingSummary ? (
            <div>
              <p><b>💵 Apertura:</b> ${closingSummary.apertura.toFixed(2)}</p>
              <p><b>🟢 Ingresos:</b> ${closingSummary.ingresos.toFixed(2)}</p>
              <p><b>🔴 Egresos:</b> ${closingSummary.egresos.toFixed(2)}</p>
              <hr />
              <h5>💰 Saldo Final: ${closingSummary.cierre.toFixed(2)}</h5>

              {/* 🟡 Si la caja es de otro día, pedir confirmación de fecha */}
              {session && session.date !== new Date().toISOString().slice(0, 10) && (
                <div className="mt-3">
                  <Form.Label>Confirmar fecha de cierre:</Form.Label>
                  <Form.Control
                    type="date"
                    value={confirmDate}
                    onChange={(e) => setConfirmDate(e.target.value)}
                  />
                  <Form.Text muted>
                    Ingresá la fecha exacta de la caja abierta ({session.date})
                  </Form.Text>
                </div>
              )}
            </div>
          ) : (
            <p>No hay datos de resumen.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCloseModal(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleCloseCaja} disabled={loading}>
            {loading ? <Spinner size="sm" /> : "Confirmar Cierre"}
          </Button>
        </Modal.Footer>
      </Modal>


      {/* 🟡 MODAL: Mensaje general */}
      <Modal show={showMessageModal} onHide={() => setShowMessageModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Información</Modal.Title>
        </Modal.Header>
        <Modal.Body>{message}</Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowMessageModal(false)}>
            OK
          </Button>
        </Modal.Footer>
      </Modal>
      <h4 className="mt-4">📋 Movimientos del período</h4>
<Table striped bordered hover responsive>
  <thead className="table-light">
    <tr>
      <th>Fecha</th>
      <th>Tipo</th>
      <th>Concepto</th>
      <th className="text-success">Ingreso</th>
      <th className="text-danger">Egreso</th>
      <th>Método</th>
    </tr>
  </thead>
  <tbody>
  {displayRows && displayRows.length > 0 ? (
    displayRows.map((r, i) => (
      <tr key={i}>
        <td>{r.date}</td>

        {/* Columna Tipo: identifica cada tipo de movimiento */}
        <td
  className={
    r.type === "apertura"
      ? "text-primary"
      : r.type === "ingreso" || r.type === "venta"
      ? "text-success"
      : r.type === "nota_credito"
      ? "text-danger"
      : r.type === "commission"
      ? "text-danger fw-bold"
      : "text-danger"
  }
>
  {r.type === "apertura"
    ? "Apertura"
    : r.type === "venta"
    ? "Venta"
    : r.type === "nota_credito"
    ? "Nota de Crédito"
    : r.type === "commission"
    ? "Comisión"
    : r.type === "ingreso"
    ? "Ingreso"
    : "Egreso"}
</td>



        {/* Concepto */}
        <td>{r.concept}</td>

        {/* Ingreso: se muestran Apertura, Ingresos y Ventas */}
        <td className="text-success fw-bold">
        {["apertura", "ingreso", "venta"].includes(r.type)
            ? `+$${Math.abs(r.amount).toFixed(2)}`
            : "—"}
        </td>

        {/* Egreso: se muestran solo Egresos y Notas de crédito */}
        <td className="text-danger fw-bold">
          {["egreso", "nota_credito", "commission"].includes(r.type)
            ? `-$${Math.abs(r.amount).toFixed(2)}`
            : "—"}
        </td>
        {/* Método */}
        <td>{r.payment_method}</td>
        
      </tr>
    ))
  ) : (
    <tr>
      <td colSpan={6} className="text-center">
        No hay movimientos en este período
      </td>
    </tr>
  )}
</tbody>

</Table>
<Modal show={showPreview} onHide={() => setShowPreview(false)} size="lg">
  <Modal.Header closeButton>
    <Modal.Title>Vista previa del Resumen de Caja</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    <Table striped bordered hover size="sm">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Apertura</th>
          <th>Ingresos</th>
          <th>Ventas</th>
          <th>Egresos</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {previewData.map((r, i) => {
          const ventas = r.salesByMethod || {};
          const metodos = Object.keys(ventas)
            .filter((k) => k !== "total")
            .map((m) => `${m}: $${ventas[m].toFixed(2)}`)
            .join(", ");
          return (
            <tr key={i}>
              <td>{r.date}</td>
              <td>${Number(r.opening).toFixed(2)}</td>
              <td>${Number(r.income).toFixed(2)}</td>
              <td>
  <div style={{ lineHeight: "1.3" }}>
    {(() => {
      const metodoSuma = {};
      report.sessions.forEach(s => {
        const ventas = s.salesByMethod || {};
        Object.keys(ventas).forEach(m => {
          if (m !== "total") {
            metodoSuma[m] = (metodoSuma[m] || 0) + Number(ventas[m] || 0);
          }
        });
      });
      const totalMetodos = Object.values(metodoSuma).reduce((a, b) => a + b, 0);
      return <span className="fw-bold text-success">Total ventas: ${totalMetodos.toFixed(2)}</span>;
    })()}
  </div>
</td>

              <td>${Number(r.expense).toFixed(2)}</td>
              <td>${Number(r.total || 0).toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  </Modal.Body>
  <Modal.Footer>
    <Button
    variant="success"
    onClick={async () => {
      await handleExportExcel();
      setShowPreview(false);
    }}
  >
    Confirmar exportación Excel
  </Button>

    <Button variant="secondary" onClick={() => setShowPreview(false)}>
      Cerrar
    </Button>
  </Modal.Footer>
</Modal>
{/* 🧾 Modal de previsualización PDF */}
<Modal
  show={showPDFPreview}
  onHide={() => setShowPDFPreview(false)}
  size="lg"
>
  <Modal.Header closeButton>
    <Modal.Title>Vista previa del PDF - Resumen de Caja</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    <Table striped bordered hover size="sm">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Apertura</th>
          <th>Ingresos</th>
          <th>Ventas</th>
          <th>Egresos</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {report.sessions.map((r, i) => {
          const ventas = r.salesByMethod || {};
          const metodos = Object.keys(ventas)
            .filter((k) => k !== "total")
            .map((m) => `${m}: $${ventas[m].toFixed(2)}`)
            .join("\n");

          const ingresosDetallados = report.movements
            ?.filter((m) => m.date === r.date && m.type === "ingreso")
            .map((m) => `• ${m.concept}: $${Number(m.amount).toFixed(2)}`)
            .join("\n") || "—";

          // 🟢 Egresos = egresos manuales (movements) + notas de crédito (sales) del mismo día
          const egresosMovs = (report.movements || [])
            .filter((m) => m.date === r.date && m.type === "egreso");

          const manualExpenseTotal = egresosMovs
            .reduce((acc, m) => acc + Number(m.amount || 0), 0);

          const refundsOfDay = (report.sales || [])
            .filter((s) => s.type === "nota_credito" && (s.date || "").slice(0,10) === r.date);

          const refundsTotal = refundsOfDay
            .reduce((acc, s) => acc + Math.abs(Number(s.amount ?? s.total ?? 0)), 0);

          const egresosDetallados = [
            `Egresos manuales: $${manualExpenseTotal.toFixed(2)}`,
            `Notas de crédito: $${refundsTotal.toFixed(2)}`,
            `Total egresos del día: $${(manualExpenseTotal + refundsTotal).toFixed(2)}`
          ].join("\n");

          return (
            <tr key={i}>
              <td>{r.date}</td>
              <td>${Number(r.opening).toFixed(2)}</td>
              <td style={{ whiteSpace: "pre-line" }}>{ingresosDetallados}</td>
              <td style={{ whiteSpace: "pre-line" }}>{metodos || "—"}</td>
              <td style={{ whiteSpace: "pre-line" }}>{egresosDetallados}</td>
              <td>${Number(r.total).toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
  <tr className="table-success fw-bold">
    <td>Total general</td>
    <td>
      ${report.sessions.reduce((acc, r) => acc + Number(r.opening || 0), 0).toFixed(2)}
    </td>
    <td>
      ${report.sessions.reduce((acc, r) => acc + Number(r.income || 0), 0).toFixed(2)}
    </td>
    <td>—</td>
    <td className="text-danger">
      ${report.sessions.reduce((acc, r) => acc + Number(r.expense || 0), 0).toFixed(2)}
    </td>
    <td>
      ${report.sessions.reduce((acc, r) => acc + Number(r.total || 0), 0).toFixed(2)}
    </td>
  </tr>
</tfoot>

    </Table>
  </Modal.Body>
  <Modal.Footer>
    <Button
      variant="success"
      onClick={async () => {
        await handleExportPDF();
        setShowPDFPreview(false);
     }}
    >
      Confirmar exportación PDF
    </Button>

    <Button variant="secondary" onClick={() => setShowPDFPreview(false)}>
      Cancelar
    </Button>
  </Modal.Footer>
</Modal>


    
</div>

  );

};


export default Caja;
