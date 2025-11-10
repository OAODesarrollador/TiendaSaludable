// ============================================
// SOLUCIÓN DEFINITIVA - NO CONFIAR EN SQLITE
// ============================================

// backend/src/config/timezone.js
const TIMEZONE = 'America/Argentina/Buenos_Aires';

// Función para obtener fecha/hora ACTUAL en Argentina en formato SQLite
function getCurrentARTimestamp() {
  const now = new Date();
  
  // Formatear en zona horaria de Argentina
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const values = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });
  
  // Formato: YYYY-MM-DD HH:mm:ss (compatible con SQLite y migrador)
  const fecha = `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
  // Forzar coherencia con Node TZ configurado
  process.env.TZ = TIMEZONE;
  return fecha;

}

function formatFechaHoraAR(fecha) {
  if (typeof fecha === 'string' && fecha.includes('/') && !fecha.includes('T')) {
    return fecha;
  }
  
  if (!fecha) return '';
  
  let d;
  if (typeof fecha === 'string') {
    // "YYYY-MM-DD HH:mm:ss" -> parsear como LOCAL
    const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      d = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );
    } else {
      d = new Date(fecha);
    }
  } else {
    d = new Date(fecha);
  }
  
  if (isNaN(d.getTime())) return String(fecha);
  
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    hour12: false,
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(d);
}

const fmtAR = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'medium',
  hour12: false,
  timeZone: TIMEZONE
});

// 🗓️ Devuelve la fecha local de Argentina en formato yyyy-mm-dd
function getCurrentARDate() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return formatter.format(now).split('T')[0];
}


module.exports = { 
  TIMEZONE, 
  formatFechaHoraAR, 
  fmtAR,
  getCurrentARDate,
  getCurrentARTimestamp  // ✅ Nueva función
};