/**
 * Backend Apps Script para Protocolo de Operación (Servicios Digitales MX)
 *
 * Endpoints soportados:
 * - action=login      { username, password }
 * - action=loadState  { username }
 * - action=saveState  { username, state }
 * - action=ping       {}
 *
 * Uso:
 * 1) Publicar como Web App (Ejecutar como: tú, Acceso: cualquiera con enlace).
 * 2) Configurar APP_TOKEN en frontend y aquí en TOKEN.
 * 3) Pegar URL del Web App en APP_SCRIPT_URL del frontend.
 */

// =========================
// Configuración
// =========================
const TOKEN = '446c0599e6fed1bd0408d31e746e727a31829fdedf957972'; // Debe coincidir con APP_TOKEN en frontend
const APP_NAME = 'Backend Protocolo Operacion';
const DEFAULT_SPREADSHEET_ID = ''; // Opcional. Si está vacío se crea automáticamente.

const SHEET_USERS = 'Usuarios';
const SHEET_STATE = 'EstadoUsuario';
const SHEET_EVENTS = 'Eventos';
const USERS_HEADER = ['username', 'password', 'activo', 'rol', 'updatedAt'];
const STATE_HEADER = ['username', 'stateJson', 'updatedAt'];
const EVENTS_HEADER = ['username', 'tipo', 'detalleJson', 'createdAt'];
const USERS_CACHE_KEY = 'users_map_v2';

const FALLBACK_USERS = [
  ['freelancer1', 'pass1'], ['freelancer2', 'pass2'], ['freelancer3', 'pass3'], ['freelancer4', 'pass4'], ['freelancer5', 'pass5'],
  ['freelancer6', 'pass6'], ['freelancer7', 'pass7'], ['freelancer8', 'pass8'], ['freelancer9', 'pass9'], ['freelancer10', 'pass10'],
  ['freelancer11', 'pass11'], ['freelancer12', 'pass12'], ['freelancer13', 'pass13'], ['freelancer14', 'pass14'], ['freelancer15', 'pass15'],
  ['freelancer16', 'pass16'], ['freelancer17', 'pass17'], ['freelancer18', 'pass18'], ['freelancer19', 'pass19'], ['freelancer20', 'pass20']
];

// =========================
// Entry points
// =========================
function doGet(e) {
  return handleRequest_(e);
}

function doPost(e) {
  return handleRequest_(e);
}

function handleRequest_(e) {
  try {
    const params = getParams_(e);
    const action = String(params.action || 'ping').trim();

    if (!isTokenValid_(params.token)) {
      return jsonResponse_({ success: false, error: 'Token inválido' });
    }

    const ss = getOrCreateSpreadsheet_();
    ensureSchema_(ss);

    switch (action) {
      case 'ping':
        return jsonResponse_({
          success: true,
          app: APP_NAME,
          spreadsheetId: ss.getId(),
          spreadsheetUrl: ss.getUrl(),
          time: new Date().toISOString()
        });
      case 'login':
        return login_(ss, params);
      case 'loadState':
        return loadState_(ss, params);
      case 'saveState':
        return saveState_(ss, params);
      case 'notifyEvent':
        return notifyEvent_(ss, params);
      default:
        return jsonResponse_({ success: false, error: 'Acción no válida' });
    }
  } catch (err) {
    return jsonResponse_({ success: false, error: String(err) });
  }
}

// =========================
// Actions
// =========================
function login_(ss, params) {
  const username = normalizeUsername_(params.username);
  const password = String(params.password || '');

  if (!username || !password) {
    return jsonResponse_({ success: false, error: 'Credenciales incompletas' });
  }

  const usersSheet = ss.getSheetByName(SHEET_USERS);
  const users = readUsers_(usersSheet);
  const user = users[username];

  if (!user || !user.activo || user.password !== password) {
    return jsonResponse_({ success: false, error: 'Usuario o contraseña inválidos' });
  }

  return jsonResponse_({
    success: true,
    user: {
      username: username,
      rol: user.rol || 'freelancer'
    }
  });
}

function loadState_(ss, params) {
  const username = normalizeUsername_(params.username);
  if (!username) return jsonResponse_({ success: false, error: 'username requerido' });

  if (!userExistsAndActive_(ss, username)) {
    return jsonResponse_({ success: false, error: 'Usuario no válido' });
  }

  const stateSheet = ss.getSheetByName(SHEET_STATE);
  const state = readStateByUsername_(stateSheet, username);

  if (!state) {
    return jsonResponse_({
      success: true,
      state: normalizeState_({})
    });
  }

  return jsonResponse_({ success: true, state: state });
}

function saveState_(ss, params) {
  const username = normalizeUsername_(params.username);
  if (!username) return jsonResponse_({ success: false, error: 'username requerido' });
  if (!userExistsAndActive_(ss, username)) {
    return jsonResponse_({ success: false, error: 'Usuario no válido' });
  }

  let state = params.state;
  if (typeof state === 'string') {
    try {
      state = JSON.parse(state);
    } catch (e) {
      return jsonResponse_({ success: false, error: 'state JSON inválido' });
    }
  }
  if (!state || typeof state !== 'object') {
    return jsonResponse_({ success: false, error: 'state inválido' });
  }

  const normalizedState = normalizeState_(state);
  writeStateByUsername_(ss.getSheetByName(SHEET_STATE), username, normalizedState);
  return jsonResponse_({ success: true, message: 'Estado guardado' });
}

function notifyEvent_(ss, params) {
  const username = normalizeUsername_(params.username);
  const tipo = String(params.tipo || '').trim();
  if (!username || !tipo) {
    return jsonResponse_({ success: false, error: 'username y tipo requeridos' });
  }
  if (!userExistsAndActive_(ss, username)) {
    return jsonResponse_({ success: false, error: 'Usuario no válido' });
  }

  let detalle = params.detalle || {};
  if (typeof detalle === 'string') {
    try { detalle = JSON.parse(detalle); } catch (e) { detalle = { raw: detalle }; }
  }
  const eventsSheet = ss.getSheetByName(SHEET_EVENTS);
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    appendSheetRow_(eventsSheet, [username, tipo, JSON.stringify(detalle || {}), isoNow_()]);
  } finally {
    lock.releaseLock();
  }
  return jsonResponse_({ success: true, message: 'Evento registrado' });
}

// =========================
// Setup schema
// =========================
function getOrCreateSpreadsheet_() {
  if (DEFAULT_SPREADSHEET_ID) {
    return SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
  }

  const props = PropertiesService.getScriptProperties();
  const key = 'BACKEND_SPREADSHEET_ID';
  const existing = props.getProperty(key);
  if (existing) return SpreadsheetApp.openById(existing);

  const ss = SpreadsheetApp.create(APP_NAME);
  props.setProperty(key, ss.getId());
  return ss;
}

function ensureSchema_(ss) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureSheet_(ss, SHEET_USERS, USERS_HEADER);
    ensureSheet_(ss, SHEET_STATE, STATE_HEADER);
    ensureSheet_(ss, SHEET_EVENTS, EVENTS_HEADER);
    ensureDefaultUsers_(ss.getSheetByName(SHEET_USERS));
  } finally {
    lock.releaseLock();
  }
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  const lastCol = sheet.getLastColumn();
  const current = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];

  const isEmptyHeader = current.length === 0 || current.every(function(v) {
    return String(v || '').trim() === '';
  });

  if (isEmptyHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    let changed = false;
    headers.forEach(function(h) {
      if (current.indexOf(h) === -1) {
        current.push(h);
        changed = true;
      }
    });
    if (changed) {
      sheet.getRange(1, 1, 1, current.length).setValues([current]);
    }
  }

  const totalCols = sheet.getLastColumn();
  sheet.getRange(1, 1, 1, totalCols)
    .setFontWeight('bold')
    .setBackground('#eef2ff')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

function ensureDefaultUsers_(usersSheet) {
  const users = readUsers_(usersSheet);
  const now = isoNow_();
  const newRows = [];

  FALLBACK_USERS.forEach(function(pair) {
    const username = pair[0];
    const password = pair[1];
    if (!users[username]) {
      newRows.push([username, password, true, 'freelancer', now]);
    }
  });

  if (newRows.length) {
    usersSheet
      .getRange(usersSheet.getLastRow() + 1, 1, newRows.length, USERS_HEADER.length)
      .setValues(newRows);
    CacheService.getScriptCache().remove(USERS_CACHE_KEY);
  }
}

// =========================
// Data helpers
// =========================
function readUsers_(usersSheet) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(USERS_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      cache.remove(USERS_CACHE_KEY);
    }
  }

  const data = usersSheet.getDataRange().getValues();
  if (data.length <= 1) {
    cache.put(USERS_CACHE_KEY, JSON.stringify({}), 300);
    return {};
  }
  const headers = data[0];
  const out = {};

  data.slice(1).forEach(function(row) {
    const obj = rowToObj_(headers, row);
    const username = normalizeUsername_(obj.username);
    if (!username) return;
    out[username] = {
      password: String(obj.password || ''),
      activo: toBoolean_(obj.activo, true),
      rol: String(obj.rol || 'freelancer')
    };
  });

  cache.put(USERS_CACHE_KEY, JSON.stringify(out), 300);
  return out;
}

function userExistsAndActive_(ss, username) {
  const users = readUsers_(ss.getSheetByName(SHEET_USERS));
  return !!(users[username] && users[username].activo);
}

function readStateByUsername_(stateSheet, username) {
  const headers = stateSheet.getRange(1, 1, 1, stateSheet.getLastColumn()).getValues()[0];
  const idxUsername = headers.indexOf('username');
  const idxState = headers.indexOf('stateJson');
  if (idxUsername === -1 || idxState === -1) return null;
  const row = findRowByUsername_(stateSheet, idxUsername, username);
  if (row < 2) return null;

  const raw = String(stateSheet.getRange(row, idxState + 1).getValue() || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeStateByUsername_(stateSheet, username, state) {
  const headers = stateSheet.getRange(1, 1, 1, stateSheet.getLastColumn()).getValues()[0];
  const idxUsername = headers.indexOf('username');
  const idxState = headers.indexOf('stateJson');
  const idxUpdated = headers.indexOf('updatedAt');
  const payload = JSON.stringify(state);
  const now = isoNow_();
  const lock = LockService.getScriptLock();

  if (payload.length > 45000) {
    throw new Error('state excede el tamaño seguro para la celda');
  }

  lock.waitLock(10000);
  try {
    const row = findRowByUsername_(stateSheet, idxUsername, username);
    if (row >= 2) {
      const values = [[payload, now]];
      stateSheet.getRange(row, idxState + 1, 1, 2).setValues(values);
      return;
    }

    appendSheetRow_(stateSheet, [username, payload, now]);
  } finally {
    lock.releaseLock();
  }
}

function normalizeState_(state) {
  const out = {
    prospectos: Array.isArray(state.prospectos) ? state.prospectos.map(normalizeProspect_) : [],
    checklist: Array.isArray(state.checklist) ? state.checklist : [false, false, false, false, false, false],
    evaluacion: Array.isArray(state.evaluacion) ? state.evaluacion : [false, false, false, false, false],
    diaActual: Number(state.diaActual || 1),
    onboardingStartedAt: String(state.onboardingStartedAt || ''),
    survivalPaused: !!state.survivalPaused,
    checklistNotificado: !!state.checklistNotificado,
    certificacion: {
      aprobada: !!(state.certificacion && state.certificacion.aprobada),
      puntaje: Number((state.certificacion && state.certificacion.puntaje) || 0)
    }
  };

  if (!isFinite(out.diaActual) || out.diaActual < 1) out.diaActual = 1;
  if (out.diaActual > 7) out.diaActual = 7;

  out.checklist = out.checklist.slice(0, 6);
  while (out.checklist.length < 6) out.checklist.push(false);
  out.checklist = out.checklist.map(function(v) { return !!v; });

  out.evaluacion = out.evaluacion.slice(0, 5);
  while (out.evaluacion.length < 5) out.evaluacion.push(false);
  out.evaluacion = out.evaluacion.map(function(v) { return !!v; });

  if (!isFinite(out.certificacion.puntaje) || out.certificacion.puntaje < 0) {
    out.certificacion.puntaje = 0;
  }
  if (out.certificacion.puntaje > 10) out.certificacion.puntaje = 10;

  return out;
}

// =========================
// Utils
// =========================
function appendSheetRow_(sheet, values) {
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, values.length).setValues([values]);
}

function findRowByUsername_(sheet, idxUsername, username) {
  if (sheet.getLastRow() <= 1) return -1;
  const usernames = sheet.getRange(2, idxUsername + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < usernames.length; i++) {
    if (normalizeUsername_(usernames[i][0]) === username) {
      return i + 2;
    }
  }
  return -1;
}

function getParams_(e) {
  const query = (e && e.parameter) ? e.parameter : {};
  let body = {};

  if (e && e.postData && e.postData.contents) {
    try {
      const parsed = JSON.parse(e.postData.contents);
      if (parsed && typeof parsed === 'object') body = parsed;
    } catch (err) {
      body = {};
    }
  }

  const merged = {};
  Object.keys(query).forEach(function(k) { merged[k] = query[k]; });
  Object.keys(body).forEach(function(k) { merged[k] = body[k]; });
  return merged;
}

function isTokenValid_(token) {
  if (!TOKEN) return true;
  return String(token || '') === TOKEN;
}

function normalizeUsername_(v) {
  return String(v || '').trim().toLowerCase();
}

function toBoolean_(v, fallback) {
  if (v === true || v === false) return v;
  if (v === 'true' || v === '1' || v === 1) return true;
  if (v === 'false' || v === '0' || v === 0) return false;
  return fallback;
}

function rowToObj_(headers, row) {
  const out = {};
  headers.forEach(function(h, i) {
    out[h] = row[i];
  });
  return out;
}

function limitText_(value, maxLen) {
  return String(value || '').trim().slice(0, maxLen);
}

function normalizeDate_(value) {
  const raw = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

function normalizeProspect_(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    nombre: limitText_(source.nombre, 120),
    giro: limitText_(source.giro, 120),
    contacto: String(source.contacto || '').replace(/\D/g, '').slice(-10),
    responsable: limitText_(source.responsable || 'Yo', 80),
    semaforo: ['Verde', 'Amarillo', 'Rojo'].indexOf(source.semaforo) >= 0 ? source.semaforo : 'Verde',
    etapa: ['Nuevo', 'Contactado', 'Respondió', 'Seguimiento 1', 'Seguimiento 2', 'Demo agendada', 'Cerrado', 'Descartado'].indexOf(source.etapa) >= 0 ? source.etapa : 'Nuevo',
    canal: limitText_(source.canal, 80),
    proximoSeguimiento: normalizeDate_(source.proximoSeguimiento),
    notas: limitText_(source.notas, 1200),
    problema: limitText_(source.problema, 180),
    objecion: limitText_(source.objecion, 180),
    nivelInteres: ['Alto', 'Medio', 'Bajo'].indexOf(source.nivelInteres) >= 0 ? source.nivelInteres : 'Medio',
    horario: limitText_(source.horario, 80),
    mensajeEnviado: !!source.mensajeEnviado,
    respondio: !!source.respondio,
    demoAgendada: !!source.demoAgendada,
    cerrado: !!source.cerrado,
    archivado: !!source.archivado,
    evidencia: limitText_(source.evidencia, 800),
    fechaAlta: limitText_(source.fechaAlta, 60),
    fechaActualizacion: limitText_(source.fechaActualizacion, 60),
    ultimoContacto: Number(source.ultimoContacto || 0) || 0
  };
}

function isoNow_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
