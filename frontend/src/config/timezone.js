// =============================================
// Configuración global de zona horaria y formato
// =============================================

// Zona horaria oficial de Argentina
export const TIMEZONE = 'America/Argentina/Buenos_Aires';

// Función general para formatear fecha y hora
export const formatFechaHoraAR = (fecha) => {
  if (!fecha) return '';

  // Si ya viene en formato ISO, convertir a objeto Date
  const dateObj = typeof fecha === 'string' ? new Date(fecha) : fecha;

  // Formatear a hora local argentina
  return dateObj.toLocaleString('es-AR', {
    timeZone: TIMEZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// Función auxiliar solo para fecha (sin hora)
export const formatFechaAR = (fecha) => {
  if (!fecha) return '';
  const dateObj = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return dateObj.toLocaleDateString('es-AR', { timeZone: TIMEZONE });
};

// Función auxiliar solo para hora
export const formatHoraAR = (fecha) => {
  if (!fecha) return '';
  const dateObj = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return dateObj.toLocaleTimeString('es-AR', { timeZone: TIMEZONE, hour12: false });
};
