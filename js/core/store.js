// store.js — estado global, persistencia en localStorage, pub/sub y undo/redo.
import { VERSION_ESQUEMA, proyectoSemilla, nuevoProyecto as crearProyecto, uid, migrarProyecto } from './model.js';

const CLAVE = 'presunexo.v1';
const MAX_UNDO = 60;

let estado = null;
const suscriptores = new Set();
let pilaUndo = [];
let pilaRedo = [];
let timerGuardado = null;

function estadoInicial() {
  const p = proyectoSemilla();
  return { version: VERSION_ESQUEMA, proyectos: [p], activoId: p.id };
}

function cargar() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return estadoInicial();
    const dato = JSON.parse(crudo);
    if (!dato || !Array.isArray(dato.proyectos) || dato.proyectos.length === 0) return estadoInicial();
    if (!dato.proyectos.some(p => p.id === dato.activoId)) dato.activoId = dato.proyectos[0].id;
    dato.proyectos.forEach(migrarProyecto);
    return dato;
  } catch (e) {
    console.error('PRESUNEXO: no se pudo cargar el estado guardado', e);
    return estadoInicial();
  }
}

function guardar() {
  clearTimeout(timerGuardado);
  timerGuardado = setTimeout(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); }
    catch (e) { console.error('PRESUNEXO: no se pudo guardar', e); }
  }, 150);
}

function notificar() {
  for (const fn of suscriptores) { try { fn(); } catch (e) { console.error(e); } }
}

export function iniciar() {
  if (!estado) estado = cargar();
}

export function getEstado() { iniciar(); return estado; }

export function getProyecto() {
  iniciar();
  return estado.proyectos.find(p => p.id === estado.activoId) || estado.proyectos[0];
}

export function suscribir(fn) {
  suscriptores.add(fn);
  return () => suscriptores.delete(fn);
}

// Mutación del proyecto activo con snapshot para undo.
// update(p => { p.ggPct = 12 })
export function update(fn, { registrarUndo = true } = {}) {
  iniciar();
  if (registrarUndo) {
    pilaUndo.push(JSON.stringify(estado));
    if (pilaUndo.length > MAX_UNDO) pilaUndo.shift();
    pilaRedo = [];
  }
  fn(getProyecto());
  guardar();
  notificar();
}

// Mutación del estado global (lista de proyectos, activo…).
export function updateGlobal(fn) {
  iniciar();
  pilaUndo.push(JSON.stringify(estado));
  if (pilaUndo.length > MAX_UNDO) pilaUndo.shift();
  pilaRedo = [];
  fn(estado);
  guardar();
  notificar();
}

export function puedeUndo() { return pilaUndo.length > 0; }
export function puedeRedo() { return pilaRedo.length > 0; }

export function undo() {
  if (!pilaUndo.length) return;
  pilaRedo.push(JSON.stringify(estado));
  estado = JSON.parse(pilaUndo.pop());
  guardar();
  notificar();
}

export function redo() {
  if (!pilaRedo.length) return;
  pilaUndo.push(JSON.stringify(estado));
  estado = JSON.parse(pilaRedo.pop());
  guardar();
  notificar();
}

// --- Gestión de proyectos ---------------------------------------------------

export function nuevoProyecto(nombre) {
  const p = crearProyecto(nombre);
  updateGlobal(e => { e.proyectos.push(p); e.activoId = p.id; });
  return p;
}

export function nuevoProyectoDemo() {
  const p = proyectoSemilla();
  p.id = uid('pry');
  updateGlobal(e => { e.proyectos.push(p); e.activoId = p.id; });
  return p;
}

export function duplicarProyecto(id) {
  iniciar();
  const orig = estado.proyectos.find(p => p.id === id);
  if (!orig) return;
  const copia = JSON.parse(JSON.stringify(orig));
  copia.id = uid('pry');
  copia.nombre = orig.nombre + ' (copia)';
  updateGlobal(e => { e.proyectos.push(copia); e.activoId = copia.id; });
}

export function eliminarProyecto(id) {
  updateGlobal(e => {
    e.proyectos = e.proyectos.filter(p => p.id !== id);
    if (e.proyectos.length === 0) {
      const p = proyectoSemilla();
      e.proyectos.push(p);
    }
    if (!e.proyectos.some(p => p.id === e.activoId)) e.activoId = e.proyectos[0].id;
  });
}

export function setActivo(id) {
  updateGlobal(e => { if (e.proyectos.some(p => p.id === id)) e.activoId = id; });
}

// --- Backup -----------------------------------------------------------------

export function exportJSON() {
  iniciar();
  return JSON.stringify(estado, null, 2);
}

// Importa un backup completo o un proyecto suelto. Lanza Error con mensaje legible.
export function importJSON(texto) {
  let dato;
  try { dato = JSON.parse(texto); }
  catch { throw new Error('El archivo no es un JSON válido.'); }

  if (dato && Array.isArray(dato.proyectos)) {
    dato.proyectos.forEach(migrarProyecto);
    updateGlobal(e => {
      e.proyectos = dato.proyectos;
      e.activoId = dato.proyectos.some(p => p.id === dato.activoId) ? dato.activoId : dato.proyectos[0]?.id;
      if (!e.proyectos.length) { const p = proyectoSemilla(); e.proyectos.push(p); e.activoId = p.id; }
    });
  } else if (dato && dato.id && Array.isArray(dato.items) && Array.isArray(dato.insumos)) {
    migrarProyecto(dato);
    updateGlobal(e => {
      if (e.proyectos.some(p => p.id === dato.id)) dato.id = uid('pry');
      e.proyectos.push(dato);
      e.activoId = dato.id;
    });
  } else {
    throw new Error('El JSON no tiene el formato de PRESUNEXO (backup o proyecto).');
  }
}
