
        // ================== AUTH + BACKEND ==================
        const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxfTsZDlIuSosrVfj8fbIucl64kBqQdmyXhywjy3szq8VjZ4w7g4xkKPXWjI8S7OXk9/exec'; // Ej: https://script.google.com/macros/s/XXXX/exec
        const APP_TOKEN = '446c0599e6fed1bd0408d31e746e727a31829fdedf957972';
        const FALLBACK_USERS = [
            { username: 'freelancer1', password: 'pass1' }, { username: 'freelancer2', password: 'pass2' },
            { username: 'freelancer3', password: 'pass3' }, { username: 'freelancer4', password: 'pass4' },
            { username: 'freelancer5', password: 'pass5' }, { username: 'freelancer6', password: 'pass6' },
            { username: 'freelancer7', password: 'pass7' }, { username: 'freelancer8', password: 'pass8' },
            { username: 'freelancer9', password: 'pass9' }, { username: 'freelancer10', password: 'pass10' },
            { username: 'freelancer11', password: 'pass11' }, { username: 'freelancer12', password: 'pass12' },
            { username: 'freelancer13', password: 'pass13' }, { username: 'freelancer14', password: 'pass14' },
            { username: 'freelancer15', password: 'pass15' }, { username: 'freelancer16', password: 'pass16' },
            { username: 'freelancer17', password: 'pass17' }, { username: 'freelancer18', password: 'pass18' },
            { username: 'freelancer19', password: 'pass19' }, { username: 'freelancer20', password: 'pass20' }
        ];
        let currentUser = null;
        let saveTimer = null;

        async function callBackend(payload) {
            if (!APP_SCRIPT_URL) return null;
            try {
                const res = await fetch(APP_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.assign({ token: APP_TOKEN }, payload))
                });
                return await res.json();
            } catch (e) {
                return null;
            }
        }

        async function validateCredentials(username, password) {
            const remote = await callBackend({ action: 'login', username, password });
            if (remote && remote.success === true) return true;
            return FALLBACK_USERS.some(u => u.username === username && u.password === password);
        }

        async function cargarDatosDesdeBackend(username) {
            const remote = await callBackend({ action: 'loadState', username });
            if (remote && remote.success && remote.state) return remote.state;
            return null;
        }

        async function guardarDatosEnBackend(username, state) {
            await callBackend({ action: 'saveState', username, state });
        }

        function collectUserState() {
            return {
                prospectos: prospectos || [],
                checklist: obtenerDeStorage('checklist', [false, false, false, false, false, false]),
                evaluacion: obtenerDeStorage('evaluacion', [false, false, false, false, false]),
                diaActual: obtenerDeStorage('diaActual', 1)
            };
        }

        function scheduleBackendSync() {
            if (!currentUser) return;
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                guardarDatosEnBackend(currentUser, collectUserState());
            }, 400);
        }

        // ================== FUNCIONES GLOBALES ==================
        function copiarTexto(btn) {
            const parent = btn.closest('[data-script]');
            if (parent) {
                const texto = parent.getAttribute('data-script');
                navigator.clipboard.writeText(texto).then(() => {
                    btn.innerText = 'Copiado!';
                    setTimeout(() => btn.innerText = 'Copiar', 1500);
                }).catch(() => alert('Error al copiar, selecciona manual.'));
            }
        }

        // ================== PERSISTENCIA GENERAL ==================
        function guardarEnStorage(key, value) {
            if (!currentUser) return;
            localStorage.setItem(`${currentUser}_${key}`, JSON.stringify(value));
            scheduleBackendSync();
        }

        function obtenerDeStorage(key, defaultValue) {
            if (!currentUser) return defaultValue;
            const item = localStorage.getItem(`${currentUser}_${key}`);
            return item ? JSON.parse(item) : defaultValue;
        }

        // ================== CRM AVANZADO ==================
        let prospectos = [];

        function sanitizar(texto) {
            if (!texto) return '';
            return texto.replace(/[&<>"]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                if (m === '"') return '&quot;';
                return m;
            });
        }

        function actualizarStatsResponsable() {
            const stats = {};
            prospectos.forEach(p => {
                const resp = p.responsable || 'Sin asignar';
                stats[resp] = (stats[resp] || 0) + 1;
            });
            const div = document.getElementById('statsResponsable');
            div.innerHTML = '';
            for (let [resp, count] of Object.entries(stats)) {
                const span = document.createElement('span');
                span.className = 'bg-white px-3 py-1 rounded-full shadow-sm';
                span.textContent = `${resp}: ${count}`;
                div.appendChild(span);
            }
        }

        function actualizarFiltrosResponsable() {
            const select = document.getElementById('filtroResponsable');
            const responsables = [...new Set(prospectos.map(p => p.responsable || 'Sin asignar'))];
            select.innerHTML = '<option value="">Todos los responsables</option>';
            responsables.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r;
                opt.textContent = r;
                select.appendChild(opt);
            });
        }

        function ordenarProspectos(lista) {
            const hoy = new Date().toISOString().split('T')[0];
            return lista.sort((a, b) => {
                if (a.etapa === 'Demo agendada' && b.etapa !== 'Demo agendada') return -1;
                if (a.etapa !== 'Demo agendada' && b.etapa === 'Demo agendada') return 1;
                const aVencido = a.proximoSeguimiento && a.proximoSeguimiento < hoy;
                const bVencido = b.proximoSeguimiento && b.proximoSeguimiento < hoy;
                if (aVencido && !bVencido) return -1;
                if (!aVencido && bVencido) return 1;
                const aHoy = a.proximoSeguimiento === hoy;
                const bHoy = b.proximoSeguimiento === hoy;
                if (aHoy && !bHoy) return -1;
                if (!aHoy && bHoy) return 1;
                if (a.semaforo === 'Verde' && b.semaforo !== 'Verde') return -1;
                if (a.semaforo !== 'Verde' && b.semaforo === 'Verde') return 1;
                return (b.ultimoContacto || 0) - (a.ultimoContacto || 0);
            });
        }

        function renderCRM() {
            const lista = document.getElementById('crmLista');
            const busqueda = document.getElementById('buscarCRM').value.toLowerCase();
            const filtroEtapa = document.getElementById('filtroEtapa').value;
            const filtroSemaforo = document.getElementById('filtroSemaforo').value;
            const filtroResponsable = document.getElementById('filtroResponsable').value;
            const filtroCanal = document.getElementById('filtroCanal').value.toLowerCase();

            let filtrados = prospectos.filter(p => {
                return (p.nombre.toLowerCase().includes(busqueda) || p.giro.toLowerCase().includes(busqueda)) &&
                       (filtroEtapa === '' || p.etapa === filtroEtapa) &&
                       (filtroSemaforo === '' || p.semaforo === filtroSemaforo) &&
                       (filtroResponsable === '' || (p.responsable || 'Sin asignar') === filtroResponsable) &&
                       (filtroCanal === '' || (p.canal || '').toLowerCase().includes(filtroCanal));
            });

            filtrados = ordenarProspectos(filtrados);
            const hoy = new Date().toISOString().split('T')[0];

            if (filtrados.length === 0) {
                lista.innerHTML = '<div class="p-4 text-center text-slate-400">Aún no hay prospectos registrados. ¡Agrega uno arriba!</div>';
            } else {
                lista.innerHTML = '';
                filtrados.forEach((p, idx) => {
                    const indexReal = prospectos.indexOf(p);
                    const badge = p.proximoSeguimiento === hoy ? '<span class="badge-hoy ml-1">Hoy</span>' :
                                 (p.proximoSeguimiento && p.proximoSeguimiento < hoy ? '<span class="badge-vencido ml-1">Vencido</span>' : '');
                    const nombre = sanitizar(p.nombre);
                    const giro = sanitizar(p.giro);
                    const contacto = sanitizar(p.contacto);
                    const responsable = sanitizar(p.responsable || '');
                    const canal = sanitizar(p.canal || '');
                    const proximo = sanitizar(p.proximoSeguimiento || '');
                    const problema = sanitizar(p.problema || '');
                    const objecion = sanitizar(p.objecion || '');
                    const nivelInteres = sanitizar(p.nivelInteres || '');
                    const horario = sanitizar(p.horario || '');
                    const evidencia = sanitizar(p.evidencia || '');
                    const notas = sanitizar(p.notas || '');
                    const fechaAlta = sanitizar(p.fechaAlta || '');
                    const fechaAct = sanitizar(p.fechaActualizacion || '');
                    const mensajeIcon = p.mensajeEnviado ? '📤' : '⏳';
                    const respondioIcon = p.respondio ? '💬' : '🔇';
                    const demoIcon = p.demoAgendada ? '📅' : '';
                    const cerradoIcon = p.cerrado ? '✅' : '';

                    const div = document.createElement('div');
                    div.className = 'p-3 border rounded flex flex-wrap justify-between items-center gap-2';
                    div.innerHTML = `
                        <div class="flex-1">
                            <div><strong>${nombre}</strong> (${giro}) - ${contacto} - ${p.semaforo} - ${p.etapa} ${mensajeIcon} ${respondioIcon} ${demoIcon} ${cerradoIcon} ${badge}</div>
                            <div class="text-xs text-slate-500">Resp: ${responsable} | Canal: ${canal} | Próx seg: ${proximo}</div>
                            <div class="text-xs text-slate-500">Problema: ${problema} | Objeción: ${objecion} | Interés: ${nivelInteres} | Horario: ${horario}</div>
                            <div class="text-xs text-slate-500">Notas: ${notas}</div>
                            <div class="text-xs text-slate-500">Evidencia: ${evidencia}</div>
                            <div class="text-xs text-slate-400">Creado: ${fechaAlta} | Últ. act: ${fechaAct}</div>
                        </div>
                        <div class="flex gap-2">
                            <button class="bg-yellow-500 text-white px-3 py-1 rounded text-xs" onclick="editarProspecto(${indexReal})">Editar</button>
                            <button class="bg-red-500 text-white px-3 py-1 rounded text-xs" onclick="eliminarProspecto(${indexReal})">Eliminar</button>
                        </div>
                    `;
                    lista.appendChild(div);
                });
            }
            actualizarRankingPropio();
            actualizarKPIsReales();
            actualizarProgresoGlobal();
            actualizarAlertasSeguimiento();
            actualizarStatsResponsable();
            actualizarFiltrosResponsable();
        }

        // Coherencia etapa-checkbox
        document.getElementById('crmCerrado').addEventListener('change', function(e) {
            if (this.checked) document.getElementById('crmEtapa').value = 'Cerrado';
        });
        document.getElementById('crmDemoAgendada').addEventListener('change', function(e) {
            if (this.checked) document.getElementById('crmEtapa').value = 'Demo agendada';
        });
        document.getElementById('crmRespondio').addEventListener('change', function(e) {
            if (this.checked && document.getElementById('crmEtapa').value === 'Nuevo') {
                document.getElementById('crmEtapa').value = 'Respondió';
            }
        });
        document.getElementById('crmMensajeEnviado').addEventListener('change', function(e) {
            if (this.checked && document.getElementById('crmEtapa').value === 'Nuevo') {
                document.getElementById('crmEtapa').value = 'Contactado';
            }
        });

        window.editarProspecto = function(index) {
            const p = prospectos[index];
            document.getElementById('crmNombre').value = p.nombre || '';
            document.getElementById('crmGiro').value = p.giro || '';
            document.getElementById('crmContacto').value = p.contacto || '';
            document.getElementById('crmResponsable').value = p.responsable || 'Yo';
            document.getElementById('crmSemaforo').value = p.semaforo || 'Verde';
            document.getElementById('crmEtapa').value = p.etapa || 'Nuevo';
            document.getElementById('crmCanal').value = p.canal || '';
            document.getElementById('crmProximoSeguimiento').value = p.proximoSeguimiento || '';
            document.getElementById('crmNotas').value = p.notas || '';
            document.getElementById('crmProblema').value = p.problema || '';
            document.getElementById('crmObjecion').value = p.objecion || '';
            document.getElementById('crmNivelInteres').value = p.nivelInteres || 'Medio';
            document.getElementById('crmHorario').value = p.horario || '';
            document.getElementById('crmMensajeEnviado').checked = p.mensajeEnviado || false;
            document.getElementById('crmRespondio').checked = p.respondio || false;
            document.getElementById('crmDemoAgendada').checked = p.demoAgendada || false;
            document.getElementById('crmCerrado').checked = p.cerrado || false;
            document.getElementById('crmEvidencia').value = p.evidencia || '';
            document.getElementById('crmIndex').value = index;
            document.getElementById('btnSubmitCRM').innerText = 'Actualizar prospecto';
            document.getElementById('modoEdicion').classList.remove('hidden');
            document.getElementById('editandoTexto').innerText = `Editando: ${p.nombre}`;
        };

        window.eliminarProspecto = function(index) {
            if (confirm('¿Seguro que quieres eliminar este prospecto?')) {
                prospectos.splice(index, 1);
                guardarEnStorage('prospectos', prospectos);
                renderCRM();
            }
        };

        document.getElementById('crmForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const nombre = document.getElementById('crmNombre').value.trim();
            const giro = document.getElementById('crmGiro').value.trim();
            const contacto = document.getElementById('crmContacto').value.trim();
            const responsable = document.getElementById('crmResponsable').value.trim();
            const semaforo = document.getElementById('crmSemaforo').value;
            const etapa = document.getElementById('crmEtapa').value;
            const canal = document.getElementById('crmCanal').value;
            const proximoSeguimiento = document.getElementById('crmProximoSeguimiento').value;
            const notas = document.getElementById('crmNotas').value;
            const problema = document.getElementById('crmProblema').value;
            const objecion = document.getElementById('crmObjecion').value;
            const nivelInteres = document.getElementById('crmNivelInteres').value;
            const horario = document.getElementById('crmHorario').value;
            const mensajeEnviado = document.getElementById('crmMensajeEnviado').checked;
            const respondio = document.getElementById('crmRespondio').checked;
            const demoAgendada = document.getElementById('crmDemoAgendada').checked;
            const cerrado = document.getElementById('crmCerrado').checked;
            const evidencia = document.getElementById('crmEvidencia').value;
            const index = parseInt(document.getElementById('crmIndex').value);

            // Validaciones
            if (!nombre || !giro || !contacto) {
                alert('Nombre, giro y contacto son obligatorios.');
                return;
            }
            if (!/^\d{10}$/.test(contacto)) {
                alert('WhatsApp debe tener 10 dígitos.');
                return;
            }
            const existe = prospectos.find((p, i) => p.contacto === contacto && i !== index);
            if (existe) {
                alert('Ya existe un prospecto con ese WhatsApp.');
                return;
            }

            const ahora = new Date().toLocaleString();
            const timestamp = Date.now();
            const nuevoProspecto = {
                nombre, giro, contacto, responsable, semaforo, etapa, canal, proximoSeguimiento, notas,
                problema, objecion, nivelInteres, horario,
                mensajeEnviado, respondio, demoAgendada, cerrado,
                evidencia,
                fechaAlta: index === -1 ? ahora : prospectos[index].fechaAlta || ahora,
                fechaActualizacion: ahora,
                ultimoContacto: timestamp
            };

            if (index === -1) {
                prospectos.push(nuevoProspecto);
            } else {
                prospectos[index] = nuevoProspecto;
            }

            guardarEnStorage('prospectos', prospectos);
            renderCRM();
            e.target.reset();
            document.getElementById('crmIndex').value = '-1';
            document.getElementById('btnSubmitCRM').innerText = 'Guardar prospecto';
            document.getElementById('modoEdicion').classList.add('hidden');
        });

        document.getElementById('cancelarEdicion').addEventListener('click', () => {
            document.getElementById('crmForm').reset();
            document.getElementById('crmIndex').value = '-1';
            document.getElementById('btnSubmitCRM').innerText = 'Guardar prospecto';
            document.getElementById('modoEdicion').classList.add('hidden');
        });

        document.getElementById('buscarCRM').addEventListener('input', renderCRM);
        document.getElementById('filtroEtapa').addEventListener('change', renderCRM);
        document.getElementById('filtroSemaforo').addEventListener('change', renderCRM);
        document.getElementById('filtroResponsable').addEventListener('change', renderCRM);
        document.getElementById('filtroCanal').addEventListener('input', renderCRM);

        document.getElementById('exportarCRM').addEventListener('click', () => {
            let csv = "Nombre,Giro,Contacto,Responsable,Semaforo,Etapa,Canal,ProximoSeguimiento,Notas,Problema,Objecion,NivelInteres,Horario,MensajeEnviado,Respondio,DemoAgendada,Cerrado,Evidencia,FechaAlta,FechaActualizacion\n";
            prospectos.forEach(p => {
                csv += `"${p.nombre}","${p.giro}","${p.contacto}","${p.responsable || ''}","${p.semaforo}","${p.etapa}","${p.canal || ''}","${p.proximoSeguimiento || ''}","${p.notas || ''}","${p.problema || ''}","${p.objecion || ''}","${p.nivelInteres || ''}","${p.horario || ''}","${p.mensajeEnviado || false}","${p.respondio || false}","${p.demoAgendada || false}","${p.cerrado || false}","${p.evidencia || ''}","${p.fechaAlta || ''}","${p.fechaActualizacion || ''}"\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'prospectos.csv';
            a.click();
            URL.revokeObjectURL(url);
        });

        document.getElementById('exportarJSON').addEventListener('click', () => {
            const data = JSON.stringify(prospectos, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'prospectos_backup.json';
            a.click();
            URL.revokeObjectURL(url);
        });

        document.getElementById('btnImportar').addEventListener('click', () => {
            document.getElementById('importarJSON').click();
        });
        document.getElementById('importarJSON').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const datos = JSON.parse(ev.target.result);
                    if (Array.isArray(datos)) {
                        // Validar estructura mínima
                        const valido = datos.every(d => d.nombre && d.giro && d.contacto);
                        if (!valido) {
                            alert('El archivo contiene objetos incompletos (deben tener nombre, giro y contacto).');
                            return;
                        }
                        if (confirm('¿Deseas mezclar con los prospectos existentes? (Se evitarán duplicados por contacto). Cancelar para reemplazar todo.')) {
                            const existentesContactos = new Set(prospectos.map(p => p.contacto));
                            const nuevos = datos.filter(p => !existentesContactos.has(p.contacto));
                            prospectos = [...prospectos, ...nuevos];
                        } else {
                            prospectos = datos;
                        }
                        guardarEnStorage('prospectos', prospectos);
                        renderCRM();
                        alert('Datos importados correctamente.');
                    } else {
                        alert('El archivo no contiene un array válido.');
                    }
                } catch (ex) {
                    alert('Error al leer el archivo.');
                }
            };
            reader.readAsText(file);
        });

        document.getElementById('limpiarCRM').addEventListener('click', () => {
            if (confirm('¿Borrar TODOS los prospectos?')) {
                localStorage.removeItem(`${currentUser}_prospectos`);
                prospectos = [];
                renderCRM();
            }
        });

        // ================== CHECKLIST DIARIO (autoguardado) ==================
        const checkboxes = document.querySelectorAll('.check-dia');
        const miniChecks = [
            document.getElementById('mini-chk1'),
            document.getElementById('mini-chk2'),
            document.getElementById('mini-chk3')
        ].filter(Boolean);
        let savedChecks = [];

        function cargarChecklist() {
            savedChecks = obtenerDeStorage('checklist', [false, false, false, false, false, false]);
            checkboxes.forEach((cb, i) => { cb.checked = savedChecks[i] || false; });
            syncMiniChecklist();
        }

        function syncMiniChecklist() {
            miniChecks.forEach((mini, i) => {
                mini.checked = checkboxes[i] ? checkboxes[i].checked : false;
            });
        }
        cargarChecklist();

        checkboxes.forEach((cb, i) => {
            cb.addEventListener('change', () => {
                const estados = Array.from(checkboxes).map(c => c.checked);
                guardarEnStorage('checklist', estados);
                syncMiniChecklist();
                actualizarProgresoGlobal();
            });
        });

        miniChecks.forEach((mini, i) => {
            mini.addEventListener('change', () => {
                if (!checkboxes[i]) return;
                checkboxes[i].checked = mini.checked;
                const estados = Array.from(checkboxes).map(c => c.checked);
                guardarEnStorage('checklist', estados);
                actualizarProgresoGlobal();
            });
        });

        // ================== EVALUACIÓN (autoguardado) ==================
        const evalItems = document.querySelectorAll('.eval-item');
        let savedEval = [];

        function cargarEvaluacion() {
            savedEval = obtenerDeStorage('evaluacion', [false, false, false, false, false]);
            evalItems.forEach((cb, i) => { cb.checked = savedEval[i] || false; });
            actualizarPuntajeEval();
        }
        cargarEvaluacion();

        function actualizarPuntajeEval() {
            const checks = Array.from(evalItems).map(cb => cb.checked);
            const puntaje = checks.filter(Boolean).length;
            document.getElementById('puntajeEval').innerText = puntaje;
            const estado = puntaje === 5 ? '✅ Aprobado' : puntaje >= 3 ? '⚠️ En proceso' : '❌ No aprobado';
            document.getElementById('estadoEval').innerText = estado;
        }

        evalItems.forEach(cb => {
            cb.addEventListener('change', () => {
                const estados = Array.from(evalItems).map(c => c.checked);
                guardarEnStorage('evaluacion', estados);
                actualizarPuntajeEval();
                actualizarProgresoGlobal();
            });
        });

        // ================== PROGRESO GLOBAL ==================
        function actualizarProgresoGlobal() {
            const checklistPct = Array.from(checkboxes).filter(cb => cb.checked).length / checkboxes.length * 30;
            const evalPct = Array.from(evalItems).filter(cb => cb.checked).length / evalItems.length * 30;
            const prospectosPct = Math.min(prospectos.length / 10, 1) * 40; // máx 40% con 10+
            const total = Math.round(checklistPct + evalPct + prospectosPct);
            document.getElementById('progresoGlobal').style.width = total + '%';
            document.getElementById('porcentajeProgreso').innerText = total + '%';
            document.getElementById('leyendaProgreso').innerText = `30% checklist · 30% evaluación · 40% CRM (10+ pros)`;
            const miniProgress = document.getElementById('miniProgress');
            if (miniProgress) miniProgress.style.width = total + '%';
        }

        // ================== RANKING PROPIO ==================
        function actualizarRankingPropio() {
            const totalProspectos = prospectos.length;
            const conversaciones = prospectos.filter(p => p.respondio).length;
            const demos = prospectos.filter(p => p.demoAgendada).length;
            const ventas = prospectos.filter(p => p.cerrado).length;
            document.querySelector('#tuRanking td:nth-child(2)').innerText = totalProspectos;
            document.querySelector('#tuRanking td:nth-child(3)').innerText = conversaciones;
            document.querySelector('#tuRanking td:nth-child(4)').innerText = demos;
            document.querySelector('#tuRanking td:nth-child(5)').innerText = ventas;
        }

        // ================== KPIs REALES ==================
        function actualizarKPIsReales() {
            const total = prospectos.length;
            const mensajes = prospectos.filter(p => p.mensajeEnviado).length;
            const respuestas = prospectos.filter(p => p.respondio).length;
            const demos = prospectos.filter(p => p.demoAgendada).length;
            const cerrados = prospectos.filter(p => p.cerrado).length;
            document.getElementById('kpi1').innerText = total;
            document.getElementById('kpi2').innerText = mensajes;
            document.getElementById('kpi3').innerText = respuestas;
            document.getElementById('kpi4').innerText = demos;
            document.getElementById('kpi5').innerText = cerrados;
        }

        document.getElementById('actualizarKPIs').addEventListener('click', () => {
            actualizarKPIsReales();
        });

        // ================== ALERTAS DE SEGUIMIENTO ==================
        function actualizarAlertasSeguimiento() {
            const hoy = new Date().toISOString().split('T')[0];
            const vencidos = prospectos.filter(p => p.proximoSeguimiento && p.proximoSeguimiento < hoy && p.etapa !== 'Cerrado' && p.etapa !== 'Descartado').length;
            const hoyMismo = prospectos.filter(p => p.proximoSeguimiento === hoy).length;
            const demosHoy = prospectos.filter(p => p.etapa === 'Demo agendada' && p.proximoSeguimiento === hoy).length;
            const alertaDiv = document.getElementById('alertasSeguimiento');
            if (vencidos > 0 || hoyMismo > 0) {
                alertaDiv.classList.remove('hidden');
                alertaDiv.innerHTML = `🔔 Tienes ${hoyMismo} seguimiento(s) para hoy (${demosHoy} demas) y ${vencidos} vencido(s). ¡Revisa el CRM!`;
            } else {
                alertaDiv.classList.add('hidden');
            }
        }

        // ================== PLAN POR DÍAS ==================
        let diaActual = 1;
        const actividades = [
            "Leer guía + practicar mensaje 5 veces",
            "Ejercicios de voz + grabarse 2 min",
            "Buscar 30 prospectos",
            "Enviar 20 mensajes",
            "Seguimiento + roleplay",
            "Revisar KPIs y afinar",
            "Evaluación con el equipo"
        ];
        const objetivos = [
            "Meta: leer y practicar",
            "Meta: voz clara",
            "Meta: 30 prospectos",
            "Meta: 20 mensajes",
            "Meta: seguimiento",
            "Meta: revisar números",
            "Meta: evaluación"
        ];

        function actualizarDiaHeader() {
            document.getElementById('diaActual').innerText = diaActual;
            document.getElementById('actividadDia').innerText = actividades[diaActual-1];
            document.getElementById('objetivoDia').innerText = objetivos[diaActual-1];
            document.getElementById('selectorDia').value = diaActual;
        }

        function cargarDia() {
            diaActual = obtenerDeStorage('diaActual', 1);
            actualizarDiaHeader();
        }

        cargarDia();

        document.getElementById('marcarDiaCompletado').addEventListener('click', () => {
            if (diaActual < 7) {
                diaActual++;
                guardarEnStorage('diaActual', diaActual);
                actualizarDiaHeader();
                alert('¡Día marcado! Sigue con el siguiente.');
            } else {
                alert('¡Felicidades, completaste los 7 días!');
            }
        });

        document.getElementById('selectorDia').addEventListener('change', (e) => {
            diaActual = parseInt(e.target.value);
            guardarEnStorage('diaActual', diaActual);
            actualizarDiaHeader();
        });

        // ================== RESET DE DEMO ==================
        document.getElementById('resetDemo').addEventListener('click', () => {
            if (confirm('¿Resetear checklist, evaluación y día? (Los prospectos del CRM se conservan)')) {
                localStorage.removeItem(`${currentUser}_checklist`);
                localStorage.removeItem(`${currentUser}_evaluacion`);
                localStorage.removeItem(`${currentUser}_diaActual`);
                cargarChecklist();
                cargarEvaluacion();
                cargarDia();
                actualizarProgresoGlobal();
            }
        });

        // ================== SIDEBAR MÓVIL + MÓDULOS ==================
        const menuToggle = document.getElementById('menuToggle');
        const mobileMenu = document.getElementById('mobileMenu');
        const desktopNavSource = document.querySelector('#sidebar-desktop nav');
        const desktopNav = desktopNavSource ? desktopNavSource.cloneNode(true) : null;
        if (mobileMenu && desktopNav) mobileMenu.innerHTML = desktopNav.innerHTML;

        function setupModuleAccordions(container) {
            container.querySelectorAll('.module').forEach(module => {
                const toggle = module.querySelector('.module-toggle');
                if (!toggle) return;
                toggle.addEventListener('click', () => {
                    module.classList.toggle('is-open');
                });
            });
        }

        if (desktopNavSource) setupModuleAccordions(desktopNavSource);
        if (mobileMenu) setupModuleAccordions(mobileMenu);

        if (menuToggle && mobileMenu) {
            menuToggle.addEventListener('click', () => {
                mobileMenu.classList.toggle('open');
            });
        }

        // ================== TABS PRINCIPALES ==================
        const TAB_SECTIONS = {
            entrenamiento: ['ruta', 'calificacion', 'seguimiento', 'objeciones', 'guiones-giro', 'kpis', 'disciplina', 'casos', 'rol', 'plan-dias'],
            operacion: ['crm', 'comisiones', 'ranking', 'evaluacion', 'psicologia', 'errores', 'frases-prohibidas', 'roleplay', 'crecimiento', 'post-demo', 'handoff', 'herramientas', 'inicio-rapido', 'preguntas-frecuentes', 'scripts', 'comunicado-equipo'],
            progreso: ['dashboard-inicio', 'checklist', 'mi-semana']
        };
        const tabButtons = document.querySelectorAll('[data-tab-target]');
        const allTabSectionIds = Array.from(new Set(Object.values(TAB_SECTIONS).flat()));

        function prepareSectionAccordions() {
            allTabSectionIds.forEach((id) => {
                const section = document.getElementById(id);
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

        function expandFirstVisible(tabName) {
            const ids = TAB_SECTIONS[tabName] || [];
            let firstOpen = false;
            ids.forEach((id) => {
                const section = document.getElementById(id);
                if (!section) return;
                if (!firstOpen) {
                    section.classList.remove('section-collapsed');
                    firstOpen = true;
                } else {
                    section.classList.add('section-collapsed');
                }
            });
        }

        function setActiveTab(tabName) {
            allTabSectionIds.forEach((id) => {
                const section = document.getElementById(id);
                if (!section) return;
                section.classList.toggle('tab-hidden', !(TAB_SECTIONS[tabName] || []).includes(id));
            });
            tabButtons.forEach((btn) => {
                btn.classList.toggle('is-active', btn.dataset.tabTarget === tabName);
            });
            expandFirstVisible(tabName);
        }

        tabButtons.forEach((btn) => {
            btn.addEventListener('click', () => setActiveTab(btn.dataset.tabTarget));
        });

        function tabForSection(id) {
            return Object.keys(TAB_SECTIONS).find((tab) => TAB_SECTIONS[tab].includes(id));
        }

        // Etiquetas simples + iconos para escaneo rápido
        function decorateSectionTitles() {
            const titleIcons = {
                ruta: '🧭', calificacion: '🚦', seguimiento: '🔁', objeciones: '🗣️',
                'guiones-giro': '📝', kpis: '📊', disciplina: '⚖️', casos: '📂',
                rol: '🎯', 'plan-dias': '📅', crm: '🗃️', comisiones: '💰',
                ranking: '🏆', evaluacion: '✅', psicologia: '🧠', errores: '❌',
                'frases-prohibidas': '🚫', roleplay: '🎭', crecimiento: '📈',
                'post-demo': '📞', handoff: '🤝', herramientas: '🛠️',
                'inicio-rapido': '⚡', checklist: '📋', 'preguntas-frecuentes': '❓',
                scripts: '📜', 'comunicado-equipo': '📣', 'mi-semana': '⭐'
            };
            Object.keys(titleIcons).forEach((id) => {
                const section = document.getElementById(id);
                if (!section) return;
                const h2 = section.querySelector('h2');
                if (!h2 || h2.dataset.iconified === '1') return;
                h2.textContent = `${titleIcons[id]} ${h2.textContent}`;
                h2.dataset.iconified = '1';
            });
        }

        document.querySelectorAll('a[href^="#"]').forEach((link) => {
            link.addEventListener('click', () => {
                const targetId = (link.getAttribute('href') || '').replace('#', '');
                const tab = tabForSection(targetId);
                if (tab) setActiveTab(tab);
            });
        });

        prepareSectionAccordions();
        decorateSectionTitles();
        setActiveTab('progreso');

        // ================== BOTONES "SIGUIENTE TEMA" ==================
        const flowOrder = [
            'dashboard-inicio', 'rol', 'psicologia', 'herramientas', 'frases-prohibidas',
            'ruta', 'calificacion', 'guiones-giro', 'objeciones', 'seguimiento',
            'inicio-rapido', 'plan-dias', 'crm', 'kpis', 'handoff',
            'comisiones', 'ranking', 'crecimiento', 'evaluacion', 'comunicado-equipo'
        ];
        const sectionTitleMap = {
            'rol': 'Rol exacto',
            'psicologia': 'Psicología',
            'herramientas': 'Herramientas',
            'frases-prohibidas': 'Frases prohibidas',
            'ruta': 'Ruta operativa',
            'calificacion': 'Calificación',
            'guiones-giro': 'Guiones por giro',
            'objeciones': 'Objeciones',
            'seguimiento': 'Seguimiento',
            'inicio-rapido': 'Inicio rápido',
            'plan-dias': 'Plan día a día',
            'crm': 'CRM avanzado',
            'kpis': 'KPIs y diagnóstico',
            'handoff': 'Handoff',
            'comisiones': 'Comisiones',
            'ranking': 'Ranking semanal',
            'crecimiento': 'Niveles de crecimiento',
            'evaluacion': 'Evaluación final',
            'comunicado-equipo': 'comunicado al equipo'
        };

        flowOrder.forEach((id, idx) => {
            const current = document.getElementById(id);
            const nextId = flowOrder[idx + 1];
            const next = nextId ? document.getElementById(nextId) : null;
            if (!current || !next) return;

            const btn = document.createElement('a');
            btn.href = `#${nextId}`;
            btn.className = 'next-topic-btn';
            btn.innerText = `Entendido, ir a ${sectionTitleMap[nextId] || 'siguiente tema'}`;
            current.appendChild(btn);
        });

        // ================== INTERSECTION OBSERVER (desktop y móvil) ==================
        const sections = document.querySelectorAll('.active-section');
        const sidebarLinks = document.querySelectorAll('.sidebar-link');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    sidebarLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${id}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }, { threshold: 0.3, rootMargin: '-100px 0px -100px 0px' });
        sections.forEach(s => observer.observe(s));

        // ================== LOGIN / LOGOUT ==================
        function setAppVisible(visible) {
            document.getElementById('mainHeader').style.display = visible ? '' : 'none';
            document.getElementById('sidebar-mobile').style.display = visible ? '' : 'none';
            document.getElementById('appShell').style.display = visible ? 'flex' : 'none';
            document.getElementById('mobileBottomNav').style.display = visible ? '' : 'none';
            document.getElementById('mainFooter').style.display = visible ? '' : 'none';
        }

        async function hydrateUserState() {
            const remoteState = await cargarDatosDesdeBackend(currentUser);
            if (remoteState) {
                if (Array.isArray(remoteState.prospectos)) localStorage.setItem(`${currentUser}_prospectos`, JSON.stringify(remoteState.prospectos));
                if (Array.isArray(remoteState.checklist)) localStorage.setItem(`${currentUser}_checklist`, JSON.stringify(remoteState.checklist));
                if (Array.isArray(remoteState.evaluacion)) localStorage.setItem(`${currentUser}_evaluacion`, JSON.stringify(remoteState.evaluacion));
                if (remoteState.diaActual) localStorage.setItem(`${currentUser}_diaActual`, JSON.stringify(remoteState.diaActual));
            }
            prospectos = obtenerDeStorage('prospectos', []);
            cargarChecklist();
            cargarEvaluacion();
            cargarDia();
        }

        async function doLogin() {
            const username = (document.getElementById('loginUsername').value || '').trim();
            const password = (document.getElementById('loginPassword').value || '').trim();
            const loginError = document.getElementById('loginError');
            const ok = await validateCredentials(username, password);
            if (!ok) {
                loginError.classList.remove('hidden');
                loginError.innerText = 'Usuario o contraseña incorrectos.';
                return;
            }

            currentUser = username;
            loginError.classList.add('hidden');
            document.getElementById('loggedUserDisplay').innerText = `👤 ${currentUser}`;
            document.getElementById('loginModal').classList.add('hidden');
            setAppVisible(true);

            await hydrateUserState();
            renderCRM();
            actualizarProgresoGlobal();
            actualizarKPIsReales();
            actualizarAlertasSeguimiento();
            setActiveTab('progreso');
        }

        document.getElementById('loginBtn').addEventListener('click', doLogin);
        document.getElementById('loginPassword').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doLogin();
        });
        document.getElementById('logoutBtn').addEventListener('click', () => {
            currentUser = null;
            setAppVisible(false);
            document.getElementById('loginUsername').value = '';
            document.getElementById('loginPassword').value = '';
            document.getElementById('loggedUserDisplay').innerText = '';
            document.getElementById('loginModal').classList.remove('hidden');
        });

        // Estado inicial
        setAppVisible(false);
    

