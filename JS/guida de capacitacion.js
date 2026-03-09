'use strict';

// ================== CONFIGURACIÓN ==================
const APP_SCRIPT_URLS = [
    'https://script.google.com/macros/s/AKfycbyJG_s8t1lV6TQkKeTN7W6EEWtA9l9TWEHaLmYG09IxPNybAONORYyoDbPp5KKOAQim/exec'
];
let activeBackendUrl = APP_SCRIPT_URLS[0];
const APP_TOKEN = '446c0599e6fed1bd0408d31e746e727a31829fdedf957972';
const BACKEND_TIMEOUT_MS = 10000;
const STATE_SYNC_DEBOUNCE_MS = 300; // Reducido para mayor capacidad de respuesta
const LOCAL_CACHE_VERSION = 2;
const LOCAL_CACHE_PREFIX = 'capacitacionyventas:user:';
const ALLOWED_SEMAFOROS = ['Verde', 'Amarillo', 'Rojo'];
const ALLOWED_ETAPAS = ['Nuevo', 'Contactado', 'Respondió', 'Seguimiento 1', 'Seguimiento 2', 'Demo agendada', 'Cerrado', 'Descartado'];
const ALLOWED_INTERES = ['Alto', 'Medio', 'Bajo'];

// ================== UTILERÍAS DOM ==================
const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

// ================== OBJETO DOM (se llena después de que el DOM esté listo) ==================
const dom = {};

function initDomReferences() {
    const ids = [
        'loginModal', 'loginUsername', 'loginPassword', 'loginBtn', 'loginError',
        'mainHeader', 'sidebar-mobile', 'appShell', 'mobileBottomNav', 'mainFooter',
        'loggedUserDisplay', 'logoutBtn', 'progresoGlobal', 'porcentajeProgreso',
        'leyendaProgreso', 'miniProgress', 'diaActual', 'actividadDia', 'objetivoDia',
        'selectorDia', 'marcarDiaCompletado', 'alertasSeguimiento', 'survivalAlert',
        'pauseOverlay', 'statsResponsable', 'filtroResponsable', 'buscarCRM',
        'filtroEtapa', 'filtroSemaforo', 'filtroCanal', 'crmLista', 'crmForm',
        'crmNombre', 'crmGiro', 'crmContacto', 'crmResponsable', 'crmSemaforo',
        'crmEtapa', 'crmCanal', 'crmProximoSeguimiento', 'crmNotas', 'crmProblema',
        'crmObjecion', 'crmNivelInteres', 'crmHorario', 'crmMensajeEnviado',
        'crmRespondio', 'crmDemoAgendada', 'crmCerrado', 'crmEvidencia', 'crmIndex',
        'btnSubmitCRM', 'modoEdicion', 'editandoTexto', 'cancelarEdicion',
        'crmLockedNotice', 'crmLockStatus', 'crmWorkspace', 'crmAccessBadge',
        'dashboardCrmCard', 'dashboardCrmStatus', 'quickActionCrm', 'fundamentosStatus',
        'fundamentosProgressLabel', 'fundamentosProgressFill', 'puntajeEval',
        'estadoEval', 'actualizarKPIs', 'kpi1', 'kpi2', 'kpi3', 'kpi4', 'kpi5',
        'conversionRateValue', 'conversionRateFill', 'conversionRateCaption',
        'conversionRateRatio', 'conversionRateTrend', 'tuRanking', 'menuToggle',
        'mobileMenu', 'quizContainer', 'quizResultado', 'btnEvaluarQuiz',
        'btnGenerarGuion', 'btnCopiarGuionGenerado', 'scriptTipo', 'scriptNegocio',
        'scriptGenerado', 'calcVentas', 'calcComisionProm', 'calcVentasVal', 'calcResultado',
        'modulePrevBtn', 'moduleNextBtn', 'moduleProgress', 'moduleTitle'
    ];
    ids.forEach(id => dom[id] = $(id));
}

// ================== VARIABLES GLOBALES ==================
let currentUser = null;
let userState = defaultState();
let prospectos = [];
let diaActual = 1;
let syncTimer = null;
let syncInFlight = false;
let pendingSyncState = null;
let pendingSyncSnapshot = '';
let lastSyncedSnapshot = '';
let activeTabName = 'progreso';
let tabSectionIndexMap = { entrenamiento: 0, operacion: 0, progreso: 0 };
let unlockedModules = { 1: true, 2: true, 3: true, 4: false };
let prospectInsights = buildProspectInsights([]);
let crmRenderHandle = 0;

// Referencias a elementos comunes (se llenan después)
let checkboxes = [];
let evalItems = [];
let miniChecks = [];
let tabButtons = [];
let sections = [];
let sidebarLinks = [];
let rankingCells = [];

// ================== FUNCIONES BASE ==================
function defaultState() {
    return {
        prospectos: [],
        checklist: [false, false, false, false, false, false],
        evaluacion: [false, false, false, false, false],
        diaActual: 1,
        onboardingStartedAt: '',
        survivalPaused: false,
        certificacion: { aprobada: false, puntaje: 0 },
        checklistNotificado: false
    };
}

function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
}

function clampNumber(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(Math.max(num, min), max);
}

function limitText(value, maxLen) {
    return String(value || '').trim().slice(0, maxLen);
}

function normalizeDateInput(value) {
    const raw = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

function normalizeBooleanArray(list, length) {
    const source = Array.isArray(list) ? list.slice(0, length) : [];
    while (source.length < length) source.push(false);
    return source.map(Boolean);
}

function normalizeProspect(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const contacto = String(source.contacto || '').replace(/\D/g, '').slice(-10);
    let etapa = ALLOWED_ETAPAS.includes(source.etapa) ? source.etapa : 'Nuevo';
    let semaforo = ALLOWED_SEMAFOROS.includes(source.semaforo) ? source.semaforo : 'Verde';
    const prospecto = {
        nombre: limitText(source.nombre, 120),
        giro: limitText(source.giro, 120),
        contacto: contacto,
        responsable: limitText(source.responsable || 'Yo', 80),
        semaforo: semaforo,
        etapa: etapa,
        canal: limitText(source.canal, 80),
        proximoSeguimiento: normalizeDateInput(source.proximoSeguimiento),
        notas: limitText(source.notas, 1200),
        problema: limitText(source.problema, 180),
        objecion: limitText(source.objecion, 180),
        nivelInteres: ALLOWED_INTERES.includes(source.nivelInteres) ? source.nivelInteres : 'Medio',
        horario: limitText(source.horario, 80),
        mensajeEnviado: !!source.mensajeEnviado,
        respondio: !!source.respondio,
        demoAgendada: !!source.demoAgendada,
        cerrado: !!source.cerrado,
        archivado: !!source.archivado,
        evidencia: limitText(source.evidencia, 800),
        fechaAlta: limitText(source.fechaAlta, 60),
        fechaActualizacion: limitText(source.fechaActualizacion, 60),
        ultimoContacto: clampNumber(source.ultimoContacto, 0, Number.MAX_SAFE_INTEGER, 0)
    };

    if (prospecto.cerrado) {
        prospecto.etapa = 'Cerrado';
        prospecto.demoAgendada = true;
        prospecto.respondio = true;
        prospecto.mensajeEnviado = true;
        prospecto.semaforo = 'Verde';
    } else if (prospecto.archivado) {
        prospecto.etapa = 'Descartado';
    } else if (prospecto.demoAgendada) {
        prospecto.etapa = 'Demo agendada';
        prospecto.respondio = true;
        prospecto.mensajeEnviado = true;
        prospecto.semaforo = prospecto.semaforo === 'Rojo' ? 'Amarillo' : prospecto.semaforo;
    } else if (prospecto.respondio && prospecto.etapa === 'Nuevo') {
        prospecto.etapa = 'Respondió';
        prospecto.mensajeEnviado = true;
    } else if (prospecto.mensajeEnviado && prospecto.etapa === 'Nuevo') {
        prospecto.etapa = 'Contactado';
    }

    return prospecto;
}

function normalizeClientState(rawState) {
    const base = rawState && typeof rawState === 'object' ? rawState : {};
    const normalized = {
        prospectos: Array.isArray(base.prospectos) ? base.prospectos.map(normalizeProspect) : [],
        checklist: normalizeBooleanArray(base.checklist, 6),
        evaluacion: normalizeBooleanArray(base.evaluacion, 5),
        diaActual: clampNumber(base.diaActual || 1, 1, 7, 1),
        onboardingStartedAt: limitText(base.onboardingStartedAt, 60),
        survivalPaused: !!base.survivalPaused,
        certificacion: {
            aprobada: !!(base.certificacion && base.certificacion.aprobada),
            puntaje: clampNumber(base.certificacion && base.certificacion.puntaje, 0, 10, 0)
        },
        checklistNotificado: !!base.checklistNotificado
    };

    if (normalized.checklist.every(Boolean)) {
        normalized.checklistNotificado = true;
    }

    return normalized;
}

function cloneValue(value) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (error) {
            // fallback
        }
    }
    return JSON.parse(JSON.stringify(value));
}

function serializeState(state) {
    return JSON.stringify(normalizeClientState(state));
}

function getLocalCacheKey(username) {
    return `${LOCAL_CACHE_PREFIX}${normalizeUsername(username)}`;
}

function safeJsonParse(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try {
        return JSON.parse(raw);
    } catch (error) {
        return null;
    }
}

function readLocalStateCache(username) {
    if (!username || !window.localStorage) return null;
    try {
        const parsed = safeJsonParse(window.localStorage.getItem(getLocalCacheKey(username)));
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            version: Number(parsed.version || 0),
            updatedAt: Number(parsed.updatedAt || 0),
            dirty: !!parsed.dirty,
            state: normalizeClientState(parsed.state)
        };
    } catch (error) {
        return null;
    }
}

function persistLocalState(username, state, dirty) {
    if (!username || !window.localStorage) return;
    try {
        window.localStorage.setItem(getLocalCacheKey(username), JSON.stringify({
            version: LOCAL_CACHE_VERSION,
            updatedAt: Date.now(),
            dirty: !!dirty,
            state: normalizeClientState(state)
        }));
    } catch (error) {
        console.warn('No se pudo escribir en localStorage:', error);
    }
}

function clearLocalState(username) {
    if (!username || !window.localStorage) return;
    try {
        window.localStorage.removeItem(getLocalCacheKey(username));
    } catch (error) {
        console.warn('No se pudo limpiar la cache local:', error);
    }
}

function applyStateToRuntime(state, options) {
    const normalized = normalizeClientState(state);
    userState = normalized;
    prospectos = normalized.prospectos.slice();
    diaActual = normalized.diaActual;
    prospectInsights = buildProspectInsights(prospectos);

    if (options && options.persistLocal && currentUser) {
        persistLocalState(currentUser, normalized, !!options.dirty);
    }
}

async function callBackend(payload) {
    if (!Array.isArray(APP_SCRIPT_URLS) || APP_SCRIPT_URLS.length === 0) return null;
    if (!payload || typeof payload !== 'object') return null;

    const action = String(payload.action || '').trim();
    if (!action) return null;

    const urls = [activeBackendUrl].concat(APP_SCRIPT_URLS.filter((url) => url && url !== activeBackendUrl));
    const normalizedPayload = Object.assign({ token: APP_TOKEN }, payload);
    const body = new URLSearchParams();
    Object.keys(normalizedPayload).forEach((key) => {
        const value = normalizedPayload[key];
        if (value === null || typeof value === 'undefined') return;
        if (typeof value === 'object') {
            body.set(key, JSON.stringify(value));
            return;
        }
        body.set(key, String(value));
    });

    for (let i = 0; i < urls.length; i += 1) {
        const url = urls[i];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method: 'POST',
                cache: 'no-store',
                body: body,
                signal: controller.signal
            });
            const raw = await response.text();
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = safeJsonParse(raw);
            if (!data || typeof data !== 'object') {
                throw new Error('Respuesta no JSON del backend');
            }

            activeBackendUrl = url;
            return data;
        } catch (error) {
            console.warn(`Backend fallido en ${url}:`, error);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    return null;
}

async function validateCredentials(username, password) {
    const cleanUsername = normalizeUsername(username);
    const cleanPassword = String(password || '').trim();
    if (!cleanUsername || !cleanPassword) return false;

    const remote = await callBackend({
        action: 'login',
        username: cleanUsername,
        password: cleanPassword
    });

    return !!(remote && remote.success === true);
}

async function cargarDatosDesdeBackend(username) {
    const cleanUsername = normalizeUsername(username);
    if (!cleanUsername) return null;

    const remote = await callBackend({
        action: 'loadState',
        username: cleanUsername
    });

    if (remote && remote.success && remote.state && typeof remote.state === 'object') {
        return normalizeClientState(remote.state);
    }

    return null;
}

async function guardarDatosEnBackend(username, state) {
    const cleanUsername = normalizeUsername(username);
    if (!cleanUsername) return false;

    const remote = await callBackend({
        action: 'saveState',
        username: cleanUsername,
        state: normalizeClientState(state)
    });

    return !!(remote && remote.success === true);
}

function notifyEvent(tipo, detalle) {
    if (!currentUser || !tipo) return;
    void callBackend({
        action: 'notifyEvent',
        username: currentUser,
        tipo: String(tipo).trim(),
        detalle: detalle && typeof detalle === 'object' ? detalle : {}
    });
}

function collectUserState() {
    const base = userState || defaultState();
    return normalizeClientState({
        prospectos: prospectos,
        checklist: base.checklist,
        evaluacion: base.evaluacion,
        diaActual: diaActual,
        onboardingStartedAt: base.onboardingStartedAt,
        survivalPaused: base.survivalPaused,
        certificacion: base.certificacion,
        checklistNotificado: base.checklistNotificado
    });
}

async function flushBackendSync() {
    if (!currentUser || syncInFlight || !pendingSyncState || !pendingSyncSnapshot) return;

    const snapshot = pendingSyncSnapshot;
    const state = normalizeClientState(pendingSyncState);
    syncInFlight = true;

    try {
        const ok = await guardarDatosEnBackend(currentUser, state);
        if (!ok) return;

        if (pendingSyncSnapshot === snapshot) {
            pendingSyncSnapshot = '';
            pendingSyncState = null;
        }
        lastSyncedSnapshot = snapshot;
        persistLocalState(currentUser, state, false);
    } finally {
        syncInFlight = false;
        if (pendingSyncSnapshot && pendingSyncSnapshot !== lastSyncedSnapshot) {
            clearTimeout(syncTimer);
            syncTimer = setTimeout(() => {
                void flushBackendSync();
            }, 250);
        }
    }
}

function scheduleBackendSync() {
    if (!currentUser) return;

    const snapshotState = collectUserState();
    const snapshot = serializeState(snapshotState);
    persistLocalState(currentUser, snapshotState, true);

    if (snapshot === lastSyncedSnapshot || snapshot === pendingSyncSnapshot) return;

    pendingSyncState = snapshotState;
    pendingSyncSnapshot = snapshot;

    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
        void flushBackendSync();
    }, STATE_SYNC_DEBOUNCE_MS);
}

// ================== PERSISTENCIA AL CERRAR PESTAÑA ==================
window.addEventListener('beforeunload', () => {
    if (currentUser && pendingSyncState && pendingSyncSnapshot) {
        // Usar sendBeacon para intentar guardar incluso si la página se cierra
        const url = activeBackendUrl;
        const payload = {
            token: APP_TOKEN,
            action: 'saveState',
            username: currentUser,
            state: JSON.stringify(normalizeClientState(pendingSyncState))
        };
        const body = new URLSearchParams(payload);
        navigator.sendBeacon(url, body);
    }
});

function guardarEnStorage(key, value) {
    const nextState = cloneValue(userState || defaultState());
    nextState[key] = value;
    applyStateToRuntime(nextState, { persistLocal: !!currentUser, dirty: !!currentUser });
    if (currentUser) scheduleBackendSync();
}

function obtenerDeStorage(key, defaultValue) {
    if (!userState || typeof userState[key] === 'undefined') {
        return cloneValue(defaultValue);
    }
    return cloneValue(userState[key]);
}

function sanitizar(texto) {
    if (!texto) return '';
    return String(texto).replace(/[&<>"]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return m;
    });
}

function buildProspectInsights(lista) {
    const today = new Date().toISOString().split('T')[0];
    const statsResponsable = {};
    let active = 0;
    let mensajes = 0;
    let respuestas = 0;
    let demos = 0;
    let cerrados = 0;
    let vencidos = 0;
    let seguimientosHoy = 0;
    let demosHoy = 0;

    lista.forEach((prospecto) => {
        const p = normalizeProspect(prospecto);
        if (!p.archivado) {
            active += 1;
            const responsable = p.responsable || 'Sin asignar';
            statsResponsable[responsable] = (statsResponsable[responsable] || 0) + 1;
        }
        if (p.mensajeEnviado) mensajes += 1;
        if (p.respondio) respuestas += 1;
        if (p.demoAgendada) demos += 1;
        if (p.cerrado) cerrados += 1;
        if (p.proximoSeguimiento === today) {
            seguimientosHoy += 1;
            if (p.etapa === 'Demo agendada') demosHoy += 1;
        }
        if (p.proximoSeguimiento && p.proximoSeguimiento < today && p.etapa !== 'Cerrado' && p.etapa !== 'Descartado') {
            vencidos += 1;
        }
    });

    return {
        total: lista.length,
        active: active,
        mensajes: mensajes,
        respuestas: respuestas,
        demos: demos,
        cerrados: cerrados,
        vencidos: vencidos,
        seguimientosHoy: seguimientosHoy,
        demosHoy: demosHoy,
        conversionRate: lista.length ? (cerrados / lista.length) * 100 : 0,
        statsResponsable: statsResponsable,
        responsables: Object.keys(statsResponsable).sort((a, b) => a.localeCompare(b, 'es'))
    };
}

function getChecklistStats() {
    const estados = obtenerDeStorage('checklist', defaultState().checklist);
    const total = estados.length || 6;
    const completados = estados.filter(Boolean).length;
    return {
        estados: estados,
        total: total,
        completados: completados,
        porcentaje: total ? Math.round((completados / total) * 100) : 0,
        completo: total > 0 && completados === total
    };
}

function getSectionAccessState(sectionId) {
    if (sectionId === 'crm') {
        const checklistStats = getChecklistStats();
        const locked = !checklistStats.completo;
        return {
            locked: locked,
            reason: locked ? `Completa Fundamentos ${checklistStats.completados}/${checklistStats.total} para habilitar el CRM.` : '',
            checklistStats: checklistStats
        };
    }

    return { locked: false, reason: '', checklistStats: getChecklistStats() };
}

function updateCrmAccessUi() {
    const access = getSectionAccessState('crm');
    const statusText = access.locked
        ? `CRM bloqueado. Fundamentos completados: ${access.checklistStats.completados}/${access.checklistStats.total}.`
        : `CRM habilitado. Fundamentos completados: ${access.checklistStats.completados}/${access.checklistStats.total}.`;

    if (dom.crmLockedNotice) {
        dom.crmLockedNotice.classList.toggle('hidden', !access.locked);
    }
    if (dom.crmLockStatus) {
        dom.crmLockStatus.innerText = statusText;
    }
    if (dom.crmWorkspace) {
        dom.crmWorkspace.classList.toggle('hidden', access.locked);
    }
    if (dom.crmAccessBadge) {
        dom.crmAccessBadge.classList.remove('hidden');
        dom.crmAccessBadge.classList.toggle('status-pill--locked', access.locked);
        dom.crmAccessBadge.classList.toggle('status-pill--success', !access.locked);
        dom.crmAccessBadge.textContent = access.locked ? 'CRM bloqueado' : 'CRM habilitado';
    }
    if (dom.dashboardCrmCard) {
        dom.dashboardCrmCard.classList.toggle('is-disabled', access.locked);
        dom.dashboardCrmCard.setAttribute('aria-disabled', access.locked ? 'true' : 'false');
    }
    if (dom.dashboardCrmStatus) {
        dom.dashboardCrmStatus.innerText = access.locked
            ? `Disponible al completar Fundamentos ${access.checklistStats.completados}/${access.checklistStats.total}.`
            : 'Disponible para registrar y dar seguimiento.';
    }
    if (dom.quickActionCrm) {
        dom.quickActionCrm.classList.toggle('is-disabled', access.locked);
        dom.quickActionCrm.setAttribute('aria-disabled', access.locked ? 'true' : 'false');
        dom.quickActionCrm.setAttribute('title', access.locked ? access.reason : 'Abrir CRM');
    }
    if (dom.fundamentosStatus) {
        dom.fundamentosStatus.classList.toggle('is-ready', !access.locked);
        dom.fundamentosStatus.innerText = access.locked
            ? `Completa los 6 fundamentos para desbloquear el CRM.`
            : 'Fundamentos completos. El CRM ya está habilitado.';
    }
    if (dom.fundamentosProgressLabel) {
        dom.fundamentosProgressLabel.innerText = `${access.checklistStats.completados}/${access.checklistStats.total}`;
    }
    if (dom.fundamentosProgressFill) {
        dom.fundamentosProgressFill.style.width = `${access.checklistStats.porcentaje}%`;
    }
}

function actualizarStatsResponsable() {
    if (!dom.statsResponsable) return;

    const fragment = document.createDocumentFragment();
    dom.statsResponsable.replaceChildren();

    if (!prospectInsights.responsables.length) {
        const span = document.createElement('span');
        span.className = 'metric-badge';
        span.textContent = 'Sin actividad registrada';
        fragment.appendChild(span);
    } else {
        prospectInsights.responsables.forEach((responsable) => {
            const span = document.createElement('span');
            span.className = 'metric-badge';
            span.textContent = `${responsable}: ${prospectInsights.statsResponsable[responsable]}`;
            fragment.appendChild(span);
        });
    }

    dom.statsResponsable.appendChild(fragment);
}

function actualizarFiltrosResponsable() {
    if (!dom.filtroResponsable) return;

    const currentValue = dom.filtroResponsable.value;
    dom.filtroResponsable.innerHTML = '<option value="">Todos los responsables</option>';
    prospectInsights.responsables.forEach((responsable) => {
        const option = document.createElement('option');
        option.value = responsable;
        option.textContent = responsable;
        dom.filtroResponsable.appendChild(option);
    });

    if (prospectInsights.responsables.includes(currentValue)) {
        dom.filtroResponsable.value = currentValue;
    }
}

function ordenarProspectos(lista) {
    const hoy = new Date().toISOString().split('T')[0];
    return lista.sort((a, b) => {
        if (a.prospecto.etapa === 'Demo agendada' && b.prospecto.etapa !== 'Demo agendada') return -1;
        if (a.prospecto.etapa !== 'Demo agendada' && b.prospecto.etapa === 'Demo agendada') return 1;

        const aVencido = a.prospecto.proximoSeguimiento && a.prospecto.proximoSeguimiento < hoy;
        const bVencido = b.prospecto.proximoSeguimiento && b.prospecto.proximoSeguimiento < hoy;
        if (aVencido && !bVencido) return -1;
        if (!aVencido && bVencido) return 1;

        const aHoy = a.prospecto.proximoSeguimiento === hoy;
        const bHoy = b.prospecto.proximoSeguimiento === hoy;
        if (aHoy && !bHoy) return -1;
        if (!aHoy && bHoy) return 1;

        if (a.prospecto.semaforo === 'Verde' && b.prospecto.semaforo !== 'Verde') return -1;
        if (a.prospecto.semaforo !== 'Verde' && b.prospecto.semaforo === 'Verde') return 1;

        return (b.prospecto.ultimoContacto || 0) - (a.prospecto.ultimoContacto || 0);
    });
}

function renderCRM() {
    if (!dom.crmLista) return;

    crmRenderHandle = 0;
    updateCrmAccessUi();
    prospectInsights = buildProspectInsights(prospectos);

    const busqueda = limitText((dom.buscarCRM && dom.buscarCRM.value) || '', 120).toLowerCase();
    const filtroEtapa = (dom.filtroEtapa && dom.filtroEtapa.value) || '';
    const filtroSemaforo = (dom.filtroSemaforo && dom.filtroSemaforo.value) || '';
    const filtroResponsable = (dom.filtroResponsable && dom.filtroResponsable.value) || '';
    const filtroCanal = limitText((dom.filtroCanal && dom.filtroCanal.value) || '', 80).toLowerCase();

    const filtrados = ordenarProspectos(prospectos.reduce((acumulado, prospecto, index) => {
        const p = normalizeProspect(prospecto);
        const matchBusqueda = !busqueda
            || p.nombre.toLowerCase().includes(busqueda)
            || p.giro.toLowerCase().includes(busqueda)
            || p.contacto.includes(busqueda);
        const matchEtapa = !filtroEtapa || p.etapa === filtroEtapa;
        const matchSemaforo = !filtroSemaforo || p.semaforo === filtroSemaforo;
        const matchResponsable = !filtroResponsable || (p.responsable || 'Sin asignar') === filtroResponsable;
        const matchCanal = !filtroCanal || (p.canal || '').toLowerCase().includes(filtroCanal);

        if (!p.archivado && matchBusqueda && matchEtapa && matchSemaforo && matchResponsable && matchCanal) {
            acumulado.push({ prospecto: p, index: index });
        }
        return acumulado;
    }, []));

    if (!filtrados.length) {
        dom.crmLista.innerHTML = '<div class="empty-state">Aun no hay prospectos registrados con esos filtros.</div>';
    } else {
        const hoy = new Date().toISOString().split('T')[0];
        const fragment = document.createDocumentFragment();

        filtrados.forEach(({ prospecto, index }) => {
            const badge = prospecto.proximoSeguimiento === hoy
                ? '<span class="badge-hoy">Hoy</span>'
                : (prospecto.proximoSeguimiento && prospecto.proximoSeguimiento < hoy ? '<span class="badge-vencido">Vencido</span>' : '');

            const div = document.createElement('div');
            div.className = 'crm-card';
            div.innerHTML = `
                <div class="crm-card__content">
                    <div class="crm-card__title">
                        <strong>${sanitizar(prospecto.nombre)}</strong>
                        <span>${sanitizar(prospecto.giro)}</span>
                        <span class="crm-card__meta">${sanitizar(prospecto.contacto)}</span>
                        <span class="crm-card__meta">${sanitizar(prospecto.semaforo)} / ${sanitizar(prospecto.etapa)}</span>
                        ${badge}
                    </div>
                    <div class="crm-card__line">Responsable: ${sanitizar(prospecto.responsable || 'Sin asignar')} | Canal: ${sanitizar(prospecto.canal || 'N/D')} | Proximo seguimiento: ${sanitizar(prospecto.proximoSeguimiento || 'Pendiente')}</div>
                    <div class="crm-card__line">Problema: ${sanitizar(prospecto.problema || 'Sin definir')} | Objecion: ${sanitizar(prospecto.objecion || 'Sin definir')} | Interes: ${sanitizar(prospecto.nivelInteres || 'Medio')}</div>
                    <div class="crm-card__line">Notas: ${sanitizar(prospecto.notas || 'Sin notas')}</div>
                    <div class="crm-card__line">Evidencia: ${sanitizar(prospecto.evidencia || 'Sin evidencia')}</div>
                    <div class="crm-card__footer">Alta: ${sanitizar(prospecto.fechaAlta || 'N/D')} | Actualizacion: ${sanitizar(prospecto.fechaActualizacion || 'N/D')}</div>
                </div>
                <div class="crm-card__actions">
                    <button type="button" class="crm-action-btn" data-crm-action="edit" data-prospect-index="${index}">Editar</button>
                    <button type="button" class="crm-action-btn crm-action-btn--ghost" data-crm-action="archive" data-prospect-index="${index}">Archivar</button>
                </div>
            `;
            fragment.appendChild(div);
        });

        dom.crmLista.replaceChildren(fragment);
    }

    actualizarRankingPropio();
    actualizarKPIsReales();
    actualizarProgresoGlobal();
    actualizarAlertasSeguimiento();
    actualizarStatsResponsable();
    actualizarFiltrosResponsable();
    applyModuleLocks();
    checkSurvivalMode();
}

function scheduleRenderCRM() {
    if (crmRenderHandle) return;
    crmRenderHandle = window.requestAnimationFrame(renderCRM);
}

function resetCrmForm() {
    if (dom.crmForm) dom.crmForm.reset();
    if (dom.crmIndex) dom.crmIndex.value = '-1';
    if (dom.btnSubmitCRM) dom.btnSubmitCRM.innerText = 'Guardar prospecto';
    if (dom.modoEdicion) dom.modoEdicion.classList.add('hidden');
    if (dom.editandoTexto) dom.editandoTexto.innerText = '';
}

function editarProspecto(index) {
    const prospecto = normalizeProspect(prospectos[index]);
    if (!prospecto || !dom.crmIndex) return;

    dom.crmNombre.value = prospecto.nombre || '';
    dom.crmGiro.value = prospecto.giro || '';
    dom.crmContacto.value = prospecto.contacto || '';
    dom.crmResponsable.value = prospecto.responsable || 'Yo';
    dom.crmSemaforo.value = prospecto.semaforo || 'Verde';
    dom.crmEtapa.value = prospecto.etapa || 'Nuevo';
    dom.crmCanal.value = prospecto.canal || '';
    dom.crmProximoSeguimiento.value = prospecto.proximoSeguimiento || '';
    dom.crmNotas.value = prospecto.notas || '';
    dom.crmProblema.value = prospecto.problema || '';
    dom.crmObjecion.value = prospecto.objecion || '';
    dom.crmNivelInteres.value = prospecto.nivelInteres || 'Medio';
    dom.crmHorario.value = prospecto.horario || '';
    dom.crmMensajeEnviado.checked = prospecto.mensajeEnviado || false;
    dom.crmRespondio.checked = prospecto.respondio || false;
    dom.crmDemoAgendada.checked = prospecto.demoAgendada || false;
    dom.crmCerrado.checked = prospecto.cerrado || false;
    dom.crmEvidencia.value = prospecto.evidencia || '';
    dom.crmIndex.value = String(index);
    dom.btnSubmitCRM.innerText = 'Actualizar prospecto';
    dom.modoEdicion.classList.remove('hidden');
    dom.editandoTexto.innerText = `Editando: ${prospecto.nombre}`;
}

function archivarProspecto(index) {
    if (!prospectos[index]) return;
    const nextProspectos = prospectos.slice();
    const prospecto = normalizeProspect(nextProspectos[index]);
    prospecto.archivado = true;
    prospecto.etapa = 'Descartado';
    prospecto.fechaActualizacion = new Date().toLocaleString('es-MX');
    nextProspectos[index] = prospecto;
    guardarEnStorage('prospectos', nextProspectos);
    scheduleRenderCRM();
}

function readCrmFormData() {
    return {
        nombre: limitText(dom.crmNombre.value, 120),
        giro: limitText(dom.crmGiro.value, 120),
        contacto: String(dom.crmContacto.value || '').replace(/\D/g, '').slice(-10),
        responsable: limitText(dom.crmResponsable.value || 'Yo', 80),
        semaforo: dom.crmSemaforo.value,
        etapa: dom.crmEtapa.value,
        canal: limitText(dom.crmCanal.value, 80),
        proximoSeguimiento: normalizeDateInput(dom.crmProximoSeguimiento.value),
        notas: limitText(dom.crmNotas.value, 1200),
        problema: limitText(dom.crmProblema.value, 180),
        objecion: limitText(dom.crmObjecion.value, 180),
        nivelInteres: dom.crmNivelInteres.value,
        horario: limitText(dom.crmHorario.value, 80),
        mensajeEnviado: !!dom.crmMensajeEnviado.checked,
        respondio: !!dom.crmRespondio.checked,
        demoAgendada: !!dom.crmDemoAgendada.checked,
        cerrado: !!dom.crmCerrado.checked,
        evidencia: limitText(dom.crmEvidencia.value, 800)
    };
}

function onCrmStageAssist() {
    if (dom.crmCerrado.checked) {
        dom.crmEtapa.value = 'Cerrado';
    } else if (dom.crmDemoAgendada.checked) {
        dom.crmEtapa.value = 'Demo agendada';
    } else if (dom.crmRespondio.checked && dom.crmEtapa.value === 'Nuevo') {
        dom.crmEtapa.value = 'Respondió';
    } else if (dom.crmMensajeEnviado.checked && dom.crmEtapa.value === 'Nuevo') {
        dom.crmEtapa.value = 'Contactado';
    }
}

function guardarProspectoDesdeFormulario(event) {
    event.preventDefault();

    const access = getSectionAccessState('crm');
    if (access.locked) {
        alert(access.reason);
        return;
    }

    const formData = readCrmFormData();
    const index = Number(dom.crmIndex.value || -1);

    if (!formData.nombre || !formData.giro || !formData.contacto) {
        alert('Nombre, giro y WhatsApp son obligatorios.');
        return;
    }
    if (!/^\d{10}$/.test(formData.contacto)) {
        alert('WhatsApp debe contener 10 digitos.');
        return;
    }

    const cert = obtenerDeStorage('certificacion', defaultState().certificacion);
    if (formData.cerrado && !(cert && cert.aprobada)) {
        alert('Debes aprobar la certificacion antes de registrar cierres.');
        return;
    }

    const duplicado = prospectos.find((prospecto, prospectIndex) => {
        return normalizeProspect(prospecto).contacto === formData.contacto && prospectIndex !== index;
    });
    if (duplicado) {
        alert('Ya existe un prospecto con ese WhatsApp.');
        return;
    }

    const ahora = new Date().toLocaleString('es-MX');
    const nuevoProspecto = normalizeProspect(Object.assign({}, formData, {
        fechaAlta: index === -1 ? ahora : normalizeProspect(prospectos[index]).fechaAlta || ahora,
        fechaActualizacion: ahora,
        ultimoContacto: Date.now()
    }));

    const nextProspectos = prospectos.slice();
    if (index === -1) {
        nextProspectos.push(nuevoProspecto);
        notifyEvent('crm_created', { contacto: nuevoProspecto.contacto });
    } else {
        nextProspectos[index] = nuevoProspecto;
        notifyEvent('crm_updated', { contacto: nuevoProspecto.contacto });
    }

    guardarEnStorage('prospectos', nextProspectos);
    resetCrmForm();
    scheduleRenderCRM();
}

// ================== CHECKLIST DIARIO ==================
function cargarChecklist() {
    const savedChecks = normalizeBooleanArray(obtenerDeStorage('checklist', defaultState().checklist), checkboxes.length || 6);
    checkboxes.forEach((checkbox, index) => {
        checkbox.checked = !!savedChecks[index];
    });
    syncMiniChecklist();
    updateCrmAccessUi();
}

function syncMiniChecklist() {
    miniChecks.forEach((mini, index) => {
        mini.checked = checkboxes[index] ? checkboxes[index].checked : false;
    });
}

function onChecklistChange(index, checked) {
    const estados = checkboxes.map((checkbox) => checkbox.checked);
    guardarEnStorage('checklist', estados);
    syncMiniChecklist();
    actualizarProgresoGlobal();
    applyModuleLocks();
    updateCrmAccessUi();

    if (checked) {
        notifyEvent('checklist_item_done', { item: index + 1 });
    }
    if (estados.every(Boolean) && !obtenerDeStorage('checklistNotificado', false)) {
        guardarEnStorage('checklistNotificado', true);
        notifyEvent('checklist_completo', { total: estados.length });
    }
}

// ================== EVALUACION ==================
function cargarEvaluacion() {
    const savedEval = normalizeBooleanArray(obtenerDeStorage('evaluacion', defaultState().evaluacion), evalItems.length || 5);
    evalItems.forEach((checkbox, index) => {
        checkbox.checked = !!savedEval[index];
    });
    actualizarPuntajeEval();
}

function actualizarPuntajeEval() {
    const checks = evalItems.map((checkbox) => checkbox.checked);
    const puntaje = checks.filter(Boolean).length;

    if (dom.puntajeEval) dom.puntajeEval.innerText = String(puntaje);
    if (dom.estadoEval) {
        dom.estadoEval.innerText = puntaje === 5 ? 'Aprobado' : puntaje >= 3 ? 'En proceso' : 'No aprobado';
    }
}

// ================== PROGRESO ==================
function actualizarProgresoGlobal() {
    const checklistPct = checkboxes.length ? (checkboxes.filter((checkbox) => checkbox.checked).length / checkboxes.length) * 30 : 0;
    const evalPct = evalItems.length ? (evalItems.filter((checkbox) => checkbox.checked).length / evalItems.length) * 30 : 0;
    const prospectosPct = Math.min(prospectInsights.total / 10, 1) * 40;
    const total = Math.round(checklistPct + evalPct + prospectosPct);

    if (dom.progresoGlobal) dom.progresoGlobal.style.width = `${total}%`;
    if (dom.porcentajeProgreso) dom.porcentajeProgreso.innerText = `${total}%`;
    if (dom.leyendaProgreso) {
        dom.leyendaProgreso.innerText = '30% Fundamentos · 30% Evaluacion · 40% CRM (10+ prospectos)';
    }
    if (dom.miniProgress) dom.miniProgress.style.width = `${total}%`;
}

function actualizarRankingPropio() {
    if (!rankingCells || rankingCells.length < 5) return;
    rankingCells[1].innerText = String(prospectInsights.total);
    rankingCells[2].innerText = String(prospectInsights.respuestas);
    rankingCells[3].innerText = String(prospectInsights.demos);
    rankingCells[4].innerText = String(prospectInsights.cerrados);
}

function actualizarDashboardConversion() {
    const rate = Number(prospectInsights.conversionRate.toFixed(1));
    const tone = rate >= 20 ? 'Solido' : rate >= 10 ? 'Saludable' : rate > 0 ? 'Por desarrollar' : 'Sin cierres';

    if (dom.conversionRateValue) dom.conversionRateValue.innerText = `${rate}%`;
    if (dom.conversionRateFill) dom.conversionRateFill.style.width = `${Math.min(rate, 100)}%`;
    if (dom.conversionRateCaption) {
        dom.conversionRateCaption.innerText = prospectInsights.total
            ? `${prospectInsights.cerrados} cierres sobre ${prospectInsights.total} prospectos registrados.`
            : 'Registra prospectos y cierres para construir tu referencia operativa.';
    }
    if (dom.conversionRateRatio) {
        dom.conversionRateRatio.innerText = `${prospectInsights.cerrados}/${prospectInsights.total || 0}`;
    }
    if (dom.conversionRateTrend) {
        dom.conversionRateTrend.innerText = tone;
    }
}

function actualizarKPIsReales() {
    if (dom.kpi1) dom.kpi1.innerText = String(prospectInsights.total);
    if (dom.kpi2) dom.kpi2.innerText = String(prospectInsights.mensajes);
    if (dom.kpi3) dom.kpi3.innerText = String(prospectInsights.respuestas);
    if (dom.kpi4) dom.kpi4.innerText = String(prospectInsights.demos);
    if (dom.kpi5) dom.kpi5.innerText = String(prospectInsights.cerrados);
    actualizarDashboardConversion();
}

function actualizarAlertasSeguimiento() {
    if (!dom.alertasSeguimiento) return;

    if (prospectInsights.vencidos > 0 || prospectInsights.seguimientosHoy > 0) {
        dom.alertasSeguimiento.classList.remove('hidden');
        dom.alertasSeguimiento.innerText = `Seguimientos hoy: ${prospectInsights.seguimientosHoy} | Demos hoy: ${prospectInsights.demosHoy} | Vencidos: ${prospectInsights.vencidos}.`;
    } else {
        dom.alertasSeguimiento.classList.add('hidden');
        dom.alertasSeguimiento.innerText = '';
    }
}

// ================== PLAN POR DIAS ==================
const actividades = [
    'Leer guia y practicar mensaje 5 veces',
    'Ejercicios de voz y grabarse 2 minutos',
    'Buscar 30 prospectos',
    'Enviar 20 mensajes',
    'Seguimiento y roleplay',
    'Revisar KPIs y afinar',
    'Evaluacion con el equipo'
];

const objetivos = [
    'Meta: leer y practicar',
    'Meta: voz clara',
    'Meta: 30 prospectos',
    'Meta: 20 mensajes',
    'Meta: seguimiento',
    'Meta: revisar numeros',
    'Meta: evaluacion'
];

function actualizarDiaHeader() {
    if (dom.diaActual) dom.diaActual.innerText = String(diaActual);
    if (dom.actividadDia) dom.actividadDia.innerText = actividades[diaActual - 1];
    if (dom.objetivoDia) dom.objetivoDia.innerText = objetivos[diaActual - 1];
    if (dom.selectorDia) dom.selectorDia.value = String(diaActual);
}

function cargarDia() {
    diaActual = clampNumber(obtenerDeStorage('diaActual', 1), 1, 7, 1);
    actualizarDiaHeader();
}

// ================== GENERADOR DE GUIONES ==================
const SCRIPT_TEMPLATES = {
    comercio: 'Hola {negocio}, vi su negocio y les contacto porque ayudamos a comercios a ordenar mensajes y cotizaciones en un solo flujo. Te puedo mostrar un ejemplo de 5 minutos?',
    servicios: 'Hola {negocio}, trabajamos con negocios de servicios para que reciban datos completos del cliente antes de cotizar y asi responder mas rapido. Te explico como?',
    marca_personal: 'Hola {negocio}, ayudamos a marcas personales a convertir mensajes en citas ordenadas sin perder oportunidades. Te comparto una idea breve?'
};

function generarGuion() {
    const tipo = (dom.scriptTipo && dom.scriptTipo.value) || 'comercio';
    const negocio = limitText((dom.scriptNegocio && dom.scriptNegocio.value) || 'tu negocio', 120) || 'tu negocio';
    const base = SCRIPT_TEMPLATES[tipo] || SCRIPT_TEMPLATES.comercio;
    if (dom.scriptGenerado) {
        dom.scriptGenerado.value = base.replace('{negocio}', negocio);
    }
}

async function copiarGuionGenerado() {
    const value = (dom.scriptGenerado && dom.scriptGenerado.value) || '';
    if (!value) return;

    try {
        await navigator.clipboard.writeText(value);
        dom.btnCopiarGuionGenerado.innerText = 'Copiado';
        setTimeout(() => {
            if (dom.btnCopiarGuionGenerado) dom.btnCopiarGuionGenerado.innerText = 'Copiar guion';
        }, 1200);
    } catch (error) {
        alert('No se pudo copiar el guion en este navegador.');
    }
}

async function handleCopyScript(button) {
    const container = button.closest('[data-script]');
    const text = container ? container.getAttribute('data-script') : '';
    if (!text) return;

    try {
        await navigator.clipboard.writeText(text);
        const originalText = button.innerText;
        button.innerText = 'Copiado';
        setTimeout(() => {
            button.innerText = originalText;
        }, 1200);
    } catch (error) {
        alert('No se pudo copiar el texto.');
    }
}

// ================== CALCULADORA ==================
function actualizarCalculadora() {
    const ventas = clampNumber(dom.calcVentas && dom.calcVentas.value, 0, 30, 0);
    const comisionProm = clampNumber(dom.calcComisionProm && dom.calcComisionProm.value, 0, 100000, 0);
    const total = ventas * comisionProm;

    if (dom.calcVentasVal) dom.calcVentasVal.innerText = String(ventas);
    if (dom.calcResultado) dom.calcResultado.innerText = `$${total.toLocaleString('es-MX')} MXN`;
}

// ================== CERTIFICACION ==================
const QUIZ_QUESTIONS = [
    { q: 'Que haces primero con un prospecto nuevo?', a: 'registrar', o: ['mandar precio directo', 'registrar', 'cerrar venta'] },
    { q: 'Si te dicen "esta caro", que haces?', a: 'valor', o: ['discutir', 'valor', 'colgar'] },
    { q: 'Cuando cuenta la comision de cierre?', a: 'liquida', o: ['al agendar', 'liquida', 'al primer mensaje'] },
    { q: 'Cuantos prospectos minimo en 48h para no pausa?', a: 'cinco', o: ['uno', 'cinco', 'diez'] },
    { q: 'Que no debes hacer?', a: 'prometer', o: ['prometer', 'seguir proceso', 'registrar crm'] },
    { q: 'Semaforo rojo significa:', a: 'descartar', o: ['cerrar', 'descartar', 'bono'] },
    { q: 'El follow-up ideal es:', a: 'persistente', o: ['solo 1 mensaje', 'persistente', 'nunca'] },
    { q: 'Si no esta certificado:', a: 'no_cierre', o: ['puede cerrar', 'no_cierre', 'puede cobrar cierre'] },
    { q: 'Dato clave en CRM:', a: 'contacto', o: ['solo nombre', 'contacto', 'solo giro'] },
    { q: 'Meta del dia 1:', a: 'primer_prospecto', o: ['cerrar 3 ventas', 'primer_prospecto', 'ignorar checklist'] }
];

function renderQuiz() {
    if (!dom.quizContainer) return;
    dom.quizContainer.replaceChildren();

    QUIZ_QUESTIONS.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'quiz-card';
        card.innerHTML = `
            <p class="text-sm font-semibold">${index + 1}. ${item.q}</p>
            <select class="quiz-select p-2 border rounded-xl mt-2 w-full" data-quiz-index="${index}">
                <option value="">Selecciona...</option>
                ${item.o.map((opt) => `<option value="${opt}">${opt.replace('_', ' ')}</option>`).join('')}
            </select>
        `;
        dom.quizContainer.appendChild(card);
    });
}

function evaluarQuiz() {
    const answers = $$('.quiz-select').map((select) => select.value);
    let ok = 0;
    QUIZ_QUESTIONS.forEach((question, index) => {
        if (answers[index] === question.a) ok += 1;
    });
    guardarEnStorage('certificacion', { aprobada: ok >= 8, puntaje: ok });
    syncCertResult();
    applyModuleLocks();
}

function syncCertResult() {
    if (!dom.quizResultado) return;
    const cert = obtenerDeStorage('certificacion', defaultState().certificacion);
    dom.quizResultado.innerText = cert.aprobada ? `Aprobado (${cert.puntaje}/10)` : `No aprobado (${cert.puntaje}/10)`;
}

// ================== KPI SUPERVIVENCIA ==================
function checkSurvivalMode() {
    const started = obtenerDeStorage('onboardingStartedAt', '');
    const startTs = started ? Date.parse(started) : Date.now();
    const shouldPause = (Date.now() - startTs) > (48 * 60 * 60 * 1000) && prospectInsights.active < 5;
    const currentPauseState = !!obtenerDeStorage('survivalPaused', false);

    if (currentPauseState !== shouldPause) {
        guardarEnStorage('survivalPaused', shouldPause);
    }

    if (dom.survivalAlert) {
        dom.survivalAlert.classList.toggle('hidden', !shouldPause);
        dom.survivalAlert.innerText = shouldPause
            ? 'KPI de supervivencia: en las primeras 48 horas debias registrar 5 prospectos activos.'
            : '';
    }
    if (dom.pauseOverlay) {
        dom.pauseOverlay.classList.toggle('hidden', !shouldPause);
    }

    return shouldPause;
}

// ================== SIDEBAR MOVIL + MODULOS ==================
function setupModuleAccordions(container) {
    if (!container) return;
    $$('.module', container).forEach((module) => {
        const toggle = module.querySelector('.module-toggle');
        if (!toggle) return;
        toggle.addEventListener('click', () => {
            const mod = Number(toggle.dataset.module || 0);
            if (mod && !unlockedModules[mod]) {
                alert('Ese modulo sigue bloqueado por hitos de operacion.');
                return;
            }
            module.classList.toggle('is-open');
        });
    });
}

function refreshMobileMenu() {
    if (!dom.mobileMenu) return;
    const desktopNavSource = document.querySelector('#sidebar-desktop nav');
    if (desktopNavSource) {
        const clone = desktopNavSource.cloneNode(true);
        dom.mobileMenu.innerHTML = '';
        dom.mobileMenu.appendChild(clone);
        setupModuleAccordions(dom.mobileMenu);
        // Re-aplicar locks después de clonar
        applyModuleLocks();
    }
}

// ================== TABS PRINCIPALES ==================
const SECTION_TO_MODULE = {
    rol: 1, psicologia: 1, herramientas: 1, 'frases-prohibidas': 1,
    ruta: 2, calificacion: 2, 'guiones-giro': 2, 'generador-guiones': 2, objeciones: 2, 'battle-cards': 2, seguimiento: 2,
    'inicio-rapido': 3, 'plan-dias': 3, crm: 3, kpis: 3, handoff: 3, checklist: 3, 'mi-semana': 3, certificacion: 3,
    comisiones: 4, 'calculadora-comision': 4, ranking: 4, crecimiento: 4, evaluacion: 4, 'post-demo': 4, 'comunicado-equipo': 4
};

const TAB_SECTIONS = {
    entrenamiento: ['ruta', 'calificacion', 'seguimiento', 'objeciones', 'battle-cards', 'guiones-giro', 'generador-guiones', 'kpis', 'disciplina', 'casos', 'rol', 'plan-dias'],
    operacion: ['crm', 'comisiones', 'calculadora-comision', 'ranking', 'evaluacion', 'certificacion', 'psicologia', 'errores', 'frases-prohibidas', 'roleplay', 'crecimiento', 'post-demo', 'handoff', 'herramientas', 'inicio-rapido', 'preguntas-frecuentes', 'scripts', 'comunicado-equipo'],
    progreso: ['dashboard-inicio', 'checklist', 'mi-semana']
};

const allTabSectionIds = Array.from(new Set(Object.values(TAB_SECTIONS).flat()));

function computeUnlockedModules() {
    const cert = obtenerDeStorage('certificacion', defaultState().certificacion);
    const certOk = !!(cert && cert.aprobada);
    unlockedModules = {
        1: true,
        2: true,
        3: true,
        4: prospectInsights.active >= 5 && prospectInsights.demos >= 1 && certOk
    };
}

function applyModuleLocks() {
    computeUnlockedModules();

    $$('.module-toggle[data-module]').forEach((button) => {
        const mod = Number(button.dataset.module);
        const unlocked = !!unlockedModules[mod];
        button.classList.toggle('is-locked', !unlocked);

        let chip = button.querySelector('.lock-chip');
        if (!unlocked && !chip) {
            chip = document.createElement('span');
            chip.className = 'lock-chip';
            button.appendChild(chip);
        }
        if (chip) {
            chip.textContent = mod === 4 ? 'hito pendiente' : 'bloqueado';
            if (unlocked) chip.remove();
        }
    });

    sidebarLinks.forEach((link) => {
        const sectionId = (link.getAttribute('href') || '').replace('#', '');
        const access = getSectionAccessState(sectionId);
        const mod = SECTION_TO_MODULE[sectionId];
        const moduleLocked = mod ? !unlockedModules[mod] : false;
        const locked = access.locked || moduleLocked;
        const reason = access.reason || (moduleLocked ? 'Cumple los hitos de resultados para abrir este bloque.' : '');

        link.classList.toggle('is-locked', locked);
        if (locked) {
            link.setAttribute('title', reason);
        } else {
            link.removeAttribute('title');
        }
    });

    setActiveTab(activeTabName);
}

function prepareSectionAccordions() {
    allTabSectionIds.forEach((id) => {
        const section = $(id);
        if (!section || section.dataset.prepared === '1') return;
        if (section.children.length < 2) {
            section.dataset.prepared = '1';
            return;
        }

        const head = section.firstElementChild;
        const body = document.createElement('div');
        body.className = 'section-body';

        while (section.children.length > 1) {
            body.appendChild(section.children[1]);
        }

        section.appendChild(body);
        head.classList.add('section-head-toggle');
        head.addEventListener('click', () => section.classList.toggle('section-collapsed'));
        section.dataset.prepared = '1';
    });
}

function getTabVisibleSectionIds(tabName) {
    return (TAB_SECTIONS[tabName] || []).filter((id) => {
        const section = $(id);
        if (!section) return false;
        const access = getSectionAccessState(id);
        const mod = SECTION_TO_MODULE[id];
        const moduleLocked = mod ? !unlockedModules[mod] : false;
        return !access.locked && !moduleLocked;
    });
}

function getSectionDisplayTitle(sectionId) {
    const section = $(sectionId);
    if (!section) return 'Bloque';
    const heading = section.querySelector('h2');
    if (!heading) return 'Bloque';
    return limitText(heading.textContent || 'Bloque', 110) || 'Bloque';
}

function syncModuleProgressUi(tabName, visibleIds, activeIndex) {
    const hasSections = visibleIds.length > 0;
    const total = hasSections ? visibleIds.length : 0;
    const current = hasSections ? (activeIndex + 1) : 0;
    const activeId = hasSections ? visibleIds[activeIndex] : '';

    if (dom.moduleProgress) dom.moduleProgress.innerText = `${current} / ${total}`;
    if (dom.moduleTitle) dom.moduleTitle.innerText = hasSections ? getSectionDisplayTitle(activeId) : 'Sin bloques disponibles';
    if (dom.modulePrevBtn) dom.modulePrevBtn.disabled = !hasSections || activeIndex <= 0;
    if (dom.moduleNextBtn) dom.moduleNextBtn.disabled = !hasSections || activeIndex >= (visibleIds.length - 1);

    sidebarLinks.forEach((link) => {
        link.classList.toggle('active', hasSections && link.getAttribute('href') === `#${activeId}`);
    });
}

function setActiveTab(tabName, preferredSectionId) {
    activeTabName = tabName;
    const visibleIds = getTabVisibleSectionIds(tabName);

    let nextIndex = clampNumber(tabSectionIndexMap[tabName], 0, Math.max(visibleIds.length - 1, 0), 0);
    if (preferredSectionId) {
        const targetIndex = visibleIds.indexOf(preferredSectionId);
        if (targetIndex >= 0) nextIndex = targetIndex;
    }
    tabSectionIndexMap[tabName] = nextIndex;

    const activeId = visibleIds[nextIndex] || '';

    allTabSectionIds.forEach((id) => {
        const section = $(id);
        if (!section) return;
        const isActive = id === activeId;
        section.classList.toggle('tab-hidden', !isActive);
        if (isActive) section.classList.remove('section-collapsed');
    });

    tabButtons.forEach((button) => {
        button.classList.toggle('is-active', button.dataset.tabTarget === tabName);
    });

    syncModuleProgressUi(tabName, visibleIds, nextIndex);
}

function shiftTabSection(delta) {
    const visibleIds = getTabVisibleSectionIds(activeTabName);
    if (!visibleIds.length) return;

    const currentIndex = clampNumber(tabSectionIndexMap[activeTabName], 0, visibleIds.length - 1, 0);
    const nextIndex = clampNumber(currentIndex + delta, 0, visibleIds.length - 1, currentIndex);
    if (nextIndex === currentIndex) return;

    tabSectionIndexMap[activeTabName] = nextIndex;
    setActiveTab(activeTabName, visibleIds[nextIndex]);
}

function tabForSection(id) {
    return Object.keys(TAB_SECTIONS).find((tab) => TAB_SECTIONS[tab].includes(id));
}

// ================== EVENTOS DE NAVEGACIÓN ==================
$$('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
        const targetId = (link.getAttribute('href') || '').replace('#', '');
        const access = getSectionAccessState(targetId);
        const mod = SECTION_TO_MODULE[targetId];
        const moduleLocked = mod ? !unlockedModules[mod] : false;

        if (access.locked || moduleLocked) {
            event.preventDefault();
            alert(access.reason || 'Ese bloque sigue bloqueado por hitos.');
            return;
        }

        const tab = tabForSection(targetId);
        if (tab) setActiveTab(tab, targetId);
    });
});

// ================== INTERSECTION OBSERVER ==================
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.getAttribute('id');
        sidebarLinks.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
    });
}, { threshold: 0.3, rootMargin: '-100px 0px -100px 0px' });

sections.forEach((section) => observer.observe(section));

// ================== LOGIN / LOGOUT ==================
function setAppVisible(visible) {
    if (dom.mainHeader) dom.mainHeader.style.display = visible ? '' : 'none';
    if (dom['sidebar-mobile']) dom['sidebar-mobile'].style.display = visible ? '' : 'none';
    if (dom.appShell) dom.appShell.style.display = visible ? 'flex' : 'none';
    if (dom.mobileBottomNav) dom.mobileBottomNav.style.display = visible ? '' : 'none';
    if (dom.mainFooter) dom.mainFooter.style.display = visible ? '' : 'none';
}

async function hydrateUserState() {
    const localCache = readLocalStateCache(currentUser);
    const remoteState = await cargarDatosDesdeBackend(currentUser);

    let nextState = defaultState();
    let dirty = false;

    if (remoteState && localCache && localCache.dirty) {
        nextState = localCache.state;
        dirty = true;
    } else if (remoteState) {
        nextState = remoteState;
        dirty = false;
    } else if (localCache) {
        nextState = localCache.state;
        dirty = !!localCache.dirty;
    }

    applyStateToRuntime(nextState, { persistLocal: !!currentUser, dirty: dirty });
    lastSyncedSnapshot = remoteState ? serializeState(remoteState) : '';
    pendingSyncSnapshot = '';
    pendingSyncState = null;

    if (!userState.onboardingStartedAt) {
        userState.onboardingStartedAt = new Date().toISOString();
        scheduleBackendSync();
    } else if (dirty) {
        scheduleBackendSync();
    }

    cargarChecklist();
    cargarEvaluacion();
    cargarDia();
    syncCertResult();
}

async function doLogin() {
    const username = normalizeUsername(dom.loginUsername && dom.loginUsername.value);
    const password = String((dom.loginPassword && dom.loginPassword.value) || '').trim();
    if (!dom.loginError || !dom.loginBtn) return;

    dom.loginError.classList.add('hidden');
    dom.loginError.innerText = '';
    dom.loginBtn.disabled = true;
    dom.loginBtn.innerText = 'Validando...';

    try {
        const ok = await validateCredentials(username, password);
        if (!ok) {
            dom.loginError.classList.remove('hidden');
            dom.loginError.innerText = 'No se pudo iniciar sesion. Revisa credenciales o conectividad.';
            return;
        }

        currentUser = username;
        if (dom.loggedUserDisplay) dom.loggedUserDisplay.innerText = currentUser;
        if (dom.loginModal) dom.loginModal.classList.add('hidden');
        setAppVisible(true);

        await hydrateUserState();
        refreshMobileMenu(); // Asegura que el menú móvil tenga los módulos
        scheduleRenderCRM();
        actualizarProgresoGlobal();
        actualizarKPIsReales();
        actualizarAlertasSeguimiento();
        applyModuleLocks();
        checkSurvivalMode();
        setActiveTab('progreso');
    } finally {
        dom.loginBtn.disabled = false;
        dom.loginBtn.innerText = 'Entrar';
    }
}

function doLogout() {
    const previousUser = currentUser;
    currentUser = null;
    userState = defaultState();
    prospectos = [];
    tabSectionIndexMap = { entrenamiento: 0, operacion: 0, progreso: 0 };
    diaActual = 1;
    syncInFlight = false;
    pendingSyncState = null;
    pendingSyncSnapshot = '';
    lastSyncedSnapshot = '';
    clearTimeout(syncTimer);

    setAppVisible(false);
    if (dom.loginUsername) dom.loginUsername.value = previousUser || '';
    if (dom.loginPassword) dom.loginPassword.value = '';
    if (dom.loggedUserDisplay) dom.loggedUserDisplay.innerText = '';
    if (dom.loginModal) dom.loginModal.classList.remove('hidden');
    if (dom.loginError) {
        dom.loginError.classList.add('hidden');
        dom.loginError.innerText = '';
    }

    resetCrmForm();
}

// ================== INICIALIZACIÓN DE EVENTOS ==================
function initEventListeners() {
    if (dom.crmCerrado) dom.crmCerrado.addEventListener('change', onCrmStageAssist);
    if (dom.crmDemoAgendada) dom.crmDemoAgendada.addEventListener('change', onCrmStageAssist);
    if (dom.crmRespondio) dom.crmRespondio.addEventListener('change', onCrmStageAssist);
    if (dom.crmMensajeEnviado) dom.crmMensajeEnviado.addEventListener('change', onCrmStageAssist);

    if (dom.crmForm) dom.crmForm.addEventListener('submit', guardarProspectoDesdeFormulario);
    if (dom.cancelarEdicion) dom.cancelarEdicion.addEventListener('click', resetCrmForm);

    [dom.buscarCRM, dom.filtroEtapa, dom.filtroSemaforo, dom.filtroResponsable, dom.filtroCanal].forEach((node) => {
        if (!node) return;
        node.addEventListener(node.tagName === 'SELECT' ? 'change' : 'input', scheduleRenderCRM);
    });

    checkboxes = $$('.check-dia');
    checkboxes.forEach((checkbox, index) => {
        checkbox.addEventListener('change', () => onChecklistChange(index, checkbox.checked));
    });

    miniChecks = ['mini-chk1', 'mini-chk2', 'mini-chk3'].map($).filter(Boolean);
    miniChecks.forEach((mini, index) => {
        mini.addEventListener('change', () => {
            if (!checkboxes[index]) return;
            checkboxes[index].checked = mini.checked;
            onChecklistChange(index, mini.checked);
        });
    });

    evalItems = $$('.eval-item');
    evalItems.forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            const estados = evalItems.map((item) => item.checked);
            guardarEnStorage('evaluacion', estados);
            actualizarPuntajeEval();
            actualizarProgresoGlobal();
            applyModuleLocks();
        });
    });

    if (dom.actualizarKPIs) dom.actualizarKPIs.addEventListener('click', actualizarKPIsReales);
    if (dom.marcarDiaCompletado) {
        dom.marcarDiaCompletado.addEventListener('click', () => {
            if (diaActual < 7) {
                diaActual += 1;
                guardarEnStorage('diaActual', diaActual);
                actualizarDiaHeader();
                alert('Dia actualizado. Sigue con el siguiente bloque.');
            } else {
                alert('Completaste los 7 dias del plan.');
            }
        });
    }
    if (dom.selectorDia) {
        dom.selectorDia.addEventListener('change', (event) => {
            diaActual = clampNumber(event.target.value, 1, 7, 1);
            guardarEnStorage('diaActual', diaActual);
            actualizarDiaHeader();
        });
    }

    if (dom.btnGenerarGuion) dom.btnGenerarGuion.addEventListener('click', generarGuion);
    if (dom.btnCopiarGuionGenerado) dom.btnCopiarGuionGenerado.addEventListener('click', () => { void copiarGuionGenerado(); });

    if (dom.calcVentas) dom.calcVentas.addEventListener('input', actualizarCalculadora);
    if (dom.calcComisionProm) dom.calcComisionProm.addEventListener('input', actualizarCalculadora);

    if (dom.btnEvaluarQuiz) dom.btnEvaluarQuiz.addEventListener('click', evaluarQuiz);

    if (dom.menuToggle && dom.mobileMenu) {
        dom.menuToggle.addEventListener('click', () => {
            dom.mobileMenu.classList.toggle('open');
        });
    }

    tabButtons = $$('[data-tab-target]');
    tabButtons.forEach((button) => {
        button.addEventListener('click', () => setActiveTab(button.dataset.tabTarget, ''));
    });
    if (dom.modulePrevBtn) dom.modulePrevBtn.addEventListener('click', () => shiftTabSection(-1));
    if (dom.moduleNextBtn) dom.moduleNextBtn.addEventListener('click', () => shiftTabSection(1));

    document.addEventListener('click', (event) => {
        const copyButton = event.target.closest('[data-copy-script]');
        if (copyButton) {
            event.preventDefault();
            void handleCopyScript(copyButton);
            return;
        }

        const crmAction = event.target.closest('[data-crm-action]');
        if (crmAction) {
            event.preventDefault();
            const index = Number(crmAction.getAttribute('data-prospect-index'));
            if (crmAction.getAttribute('data-crm-action') === 'edit') {
                editarProspecto(index);
            } else if (crmAction.getAttribute('data-crm-action') === 'archive') {
                archivarProspecto(index);
            }
            return;
        }

        const lockedCrmTrigger = event.target.closest('[data-requires-crm]');
        if (lockedCrmTrigger) {
            const access = getSectionAccessState('crm');
            if (access.locked) {
                event.preventDefault();
                alert(access.reason);
            }
        }
    });

    if (dom.loginBtn) dom.loginBtn.addEventListener('click', doLogin);
    if (dom.loginPassword) {
        dom.loginPassword.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') doLogin();
        });
    }
    if (dom.logoutBtn) dom.logoutBtn.addEventListener('click', doLogout);
}

// ================== INICIALIZACIÓN GENERAL ==================
document.addEventListener('DOMContentLoaded', () => {
    initDomReferences();
    initEventListeners();

    sections = $$('.active-section');
    sidebarLinks = $$('.sidebar-link');
    rankingCells = dom.tuRanking ? dom.tuRanking.querySelectorAll('td') : [];

    renderQuiz();
    prepareSectionAccordions();
    actualizarCalculadora();
    cargarChecklist();
    cargarEvaluacion();
    cargarDia();
    updateCrmAccessUi();
    applyModuleLocks();
    setActiveTab('progreso');
    setAppVisible(false);
});
