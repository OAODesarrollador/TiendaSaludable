// =============================================
// Configuración global de zona horaria y formato
// =============================================
export const TIMEZONE = 'America/Argentina/Buenos_Aires';

// Parseo seguro: detecta ISO o "YYYY-MM-DD HH:mm:ss".
// Si es un string "localizado" (con '/'), lo deja tal cual (evita doble shift).
const parseToDateSafe = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;

  if (typeof val === 'number') return new Date(val);

  if (typeof val === 'string') {
    // ISO 8601 con zona (Z o ±hh:mm)
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
      // Ej. "2025-11-08T14:02:33.000Z" o con offset
      const d = new Date(val);
      return isNaN(d) ? null : d;
    }

    // "YYYY-MM-DD HH:mm:ss" (sin zona) -> interpretar como LOCAL
    const m = val.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
    );
    if (m) {
      const [_, y, mo, d, h, mi, s] = m;
      const dLocal = new Date(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(h),
        Number(mi),
        Number(s || 0)
      );
      return isNaN(dLocal) ? null : dLocal;
    }

    // Si parece ya "formateado para humanos" (con /) — NO lo reparseamos.
    if (val.includes('/') && !val.includes('T')) return null;
  }

  // Fallback
  try {
    const d = new Date(val);
    return isNaN(d) ? null : d;
  } catch {
    return null;
  }
};

export const formatFechaHoraAR = (fecha) => {
  // Si ya viene listo para mostrar (string con '/'), lo devolvemos como está.
  if (typeof fecha === 'string' && fecha.includes('/') && !fecha.includes('T')) {
    return fecha;
  }

  const d = parseToDateSafe(fecha);
  if (!d) return String(fecha ?? '');

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    hour12: false,
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(d);
};

export const formatFechaAR = (fecha) => {
  if (typeof fecha === 'string' && fecha.includes('/') && !fecha.includes('T')) {
    return fecha.split(' ')[0] || fecha; // intenta conservar solo la fecha si ya venía local
  }
  const d = parseToDateSafe(fecha);
  if (!d) return String(fecha ?? '');
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    dateStyle: 'short',
    hour12: false
  }).format(d);
};

export const formatHoraAR = (fecha) => {
  if (typeof fecha === 'string' && fecha.includes('/') && !fecha.includes('T')) {
    const parts = fecha.split(' ');
    return parts.length > 1 ? parts[1] : fecha; // intenta conservar solo la hora si ya venía local
  }
  const d = parseToDateSafe(fecha);
  if (!d) return String(fecha ?? '');
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(d);
};
// 🗓️ Devuelve la fecha local de Argentina en formato yyyy-mm-dd
export function getCurrentARDate() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });
  return formatter.format(now).split('T')[0];
}

// 🕒 Devuelve fecha y hora local de Argentina en formato "YYYY-MM-DD HH:mm:ss"
export function getCurrentARTimestamp() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // sv-SE genera formato ISO-like: "2025-11-08 23:45:30"
  return formatter.format(now).replace('T', ' ');
}
