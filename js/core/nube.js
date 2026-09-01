// nube.js — guardado POR CUENTA cuando PRESUNEXO se abre desde el campus.
//
// El campus abre la app con ?t=<token firmado>. La hidratación inicial (traer
// los proyectos del servidor) la hace el bootstrap de index.html ANTES de que
// cargue el estado. Aquí solo se EMPUJAN los cambios al servidor, agrupados,
// para que todo lo que el usuario guarde quede en su cuenta (Supabase, JSON).
// Si no hay token o el servidor falla, la app sigue con el respaldo local.
import { suscribir, getEstado } from './store.js';

const TKEY = 'presunexo.token';

function token() {
  try {
    const u = new URLSearchParams(location.search).get('t');
    if (u) { sessionStorage.setItem(TKEY, u); return u; }
    return sessionStorage.getItem(TKEY) || '';
  } catch { return ''; }
}

export const nubeActiva = !!token();

let timer = null;
async function empujar() {
  const t = token();
  if (!t) return;
  try {
    await fetch('/api/proyectos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Token': t },
      body: JSON.stringify({ estado: getEstado() }),
    });
  } catch (e) { /* silencioso: queda el respaldo local */ }
}

if (nubeActiva) {
  // Agrupa ráfagas de cambios en un solo guardado (debounce).
  suscribir(() => { clearTimeout(timer); timer = setTimeout(empujar, 800); });
  window.addEventListener('beforeunload', () => { try { empujar(); } catch (e) {} });
}
