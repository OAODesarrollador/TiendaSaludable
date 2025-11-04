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


  const token = localStorage.getItem("token");
  const api = axios.create({
    baseURL: "/api/cash",
    headers: { Authorization: `Bearer ${token}` },
  });
  const fetchSession = async () => {
  try {
    const res = await api.get("/session");
    setSession(res.data.session);
    // fijar la fecha visible/usable para hoy
    const isoToday = new Date().toISOString().slice(0, 10);
    setSelectedDate(isoToday);
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
        const isoToday = new Date().toISOString().slice(0, 10);

        let qs = "";
        if (period === "today") {
          // ✅ "Hoy" SIEMPRE es hoy (no depende de selectedDate)
          qs = `period=custom&start_date=${isoToday}&end_date=${isoToday}`;
        } else if (period === "custom") {
          // ✅ Fecha específica elegida por el usuario
          const d = selectedDate || isoToday;
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
      await api.post("/register", { opening_amount: parseFloat(amount) });
      setMessage("✅ Caja abierta correctamente");
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
  // 🔹 Calcular resumen previo al cierre
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

        const resumen = {
          apertura: Number(todayData.opening ?? todayData.opening_amount ?? 0),
          ingresos: Number(todayData.income ?? 0),
          egresos:  Number(todayData.expense ?? 0),
          cierre:   Number(todayData.closing ?? (todayData.opening + todayData.income - todayData.expense) ?? 0),
        };

        setClosingSummary(resumen);
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
  const handleExport = (fmt) => {
    window.open(`/api/cash/report?period=${period}&format=${fmt}`, "_blank");
  };
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
}, [period, selectedDate]); // si aún NO agregaste selectedDate, dejalo solo con [period]

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
        type: m.type, // "ingreso" | "egreso"
        concept: m.concept,
        amount: Number(m.amount || 0),
        payment_method: m.payment_method || "—",
      });
    }
  }
    // 3) Filas de Tickets de Venta
  // 3) Filas de Tickets de Venta
if (report?.sales?.length) {
  for (const s of report.sales) {
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

   return rows;
}, [report]);
// 🔒 Bloquear funciones si hay pendiente y caja abierta
const lock = pending && session && !session.closed;

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
        <div className="mb-3 ">
          <Form.Label>Período:</Form.Label>

          {/* Selector de período */}
          <Form.Select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ width: "220px", display: "inline-block", marginLeft: "10px", marginRight: "10px" }}
            // ❌ NO bloquear el selector aunque haya pendiente; solo bloqueamos "Generar" y exportaciones
            // disabled={lock}
          >
            {/* "Hoy" muestra SIEMPRE la fecha real de hoy */}
            <option value="today">Hoy ({new Date().toISOString().slice(0, 10)})</option>
            <option value="custom">Fecha específica…</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
            <option value="year">Año</option>
          </Form.Select>

          {/* Si el usuario elige "custom", mostramos el input de fecha EDITABLE */}
          {period === "custom" && (
            <Form.Control
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ width: "180px", display: "inline-block", marginRight: "10px" }}
              // ❌ NO bloquear la edición de fecha
              // disabled={lock}
            />
          )}

          <Button
            variant="success"
            onClick={fetchReport}
            disabled={lock || loading} // ✅ Bloqueamos solo la acción de generar si hay pendiente
          >
            {loading ? "Generando..." : "Generar"}
          </Button>
        </div>

      <div className="d-flex gap-2 mb-2">
        <Button onClick={() => handleExport("csv")} disabled={lock}>Exportar CSV</Button>
        <Button onClick={() => handleExport("pdf")} variant="secondary" disabled={lock}>Exportar PDF</Button>
      </div>
      <h4>📊 Resumen de sesiones</h4>
      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Apertura</th>
            <th>Ingresos</th>
            <th>Ventas</th>
            <th>Egresos</th>
            <th>Cierre</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {report.sessions && report.sessions.length > 0 ? (
            report.sessions.map((r, i) => (
              <tr key={i}>
                <td>{r.date}</td>
                <td>${Number(r.opening).toFixed(2)}</td>
                <td>${Number(r.income).toFixed(2)}</td>
                <td className="text-success">${Number(r.salesTotal || 0).toFixed(2)}</td>
                <td className="text-danger">${Number(r.expense).toFixed(2)}</td>
                <td>${Number(r.closing).toFixed(2)}</td>
                <td className="fw-bold">${Number(r.total || 0).toFixed(2)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="text-center">
                No hay sesiones en el período seleccionado
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {/* 🟢 MODAL: Apertura */}
      <Modal show={showOpenModal} onHide={() => setShowOpenModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>💰 Abrir Caja</Modal.Title>
        </Modal.Header>
        <Modal.Body>
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
            : "text-danger"
        }
        >
        {r.type === "apertura"
            ? "Apertura"
            : r.type === "venta"
            ? "Venta"
            : r.type === "nota_credito"
            ? "Nota de Crédito"
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
        {["egreso", "nota_credito"].includes(r.type)
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

    
</div>

  );

};


export default Caja;
