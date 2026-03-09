/**
 * PROTOCOLO DE OPERACIÓN - Sistema de Gestión Operativa
 * Arquitectura: Vanilla JS ES6+ | Tailwind CSS | Google Apps Script Ready
 * Versión: 2.1.0
 */

const CONFIG = {
    AUTH_KEY: 'Operacion2024',
    GAS_ENDPOINT: 'https://script.google.com/macros/s/AKfycbx.../exec',
    SECURITY_TOKEN: 'token_seguridad_aqui',
    VERSION: '2.1.0'
};

const AppState = {
    currentUser: null,
    currentTab: 'dashboard',
    prospects: [],
    quizProgress: {
        currentQuestion: 0,
        score: 0,
        answers: [],
        completed: false
    },
    quote: {
        services: [],
        urgency: 1,
        clientType: 1,
        total: 0
    },
    training: {
        level: 1,
        completed: Array(10).fill(false)
    }
};

const DB = {
    prospects: [
        {
            id: 1,
            empresa: 'TechStart México',
            contacto: 'Ana García',
            email: 'ana@techstart.mx',
            servicio: 'Diseño Web',
            estado: 'seguimiento',
            interes: 'alto',
            presupuesto: 45000,
            fecha: '2024-03-08'
        },
        {
            id: 2,
            empresa: 'Café Especialidad Oaxaca',
            contacto: 'Roberto López',
            email: 'roberto@cafeoax.com',
            servicio: 'Branding',
            estado: 'contactado',
            interes: 'medio',
            presupuesto: 25000,
            fecha: '2024-03-07'
        }
    ],
    quizQuestions: [
        {
            question: '¿Cuál es el primer paso en el protocolo de onboarding de un nuevo cliente?',
            options: ['Enviar la cotización final', 'Reunión de descubrimiento y brief', 'Iniciar el diseño inmediatamente', 'Solicitar el pago del 100%'],
            correct: 1
        },
        {
            question: '¿Qué porcentaje de anticipo se requiere para iniciar un proyecto estándar?',
            options: ['25%', '50%', '75%', '100%'],
            correct: 1
        },
        {
            question: 'En el semáforo de prospectos, ¿qué significa el color ROJO?',
            options: ['Prospecto listo para cerrar', 'Prospecto en evaluación', 'Prospecto frío o sin respuesta', 'Prospecto VIP'],
            correct: 2
        },
        {
            question: '¿Cuál es el tiempo estándar de respuesta a un lead nuevo?',
            options: ['24 horas', '4 horas hábiles', '1 hora', '48 horas'],
            correct: 1
        },
        {
            question: '¿Qué herramienta usamos para la gestión de proyectos internos?',
            options: ['Excel', 'Notion / Sistema interno', 'WhatsApp únicamente', 'Email'],
            correct: 1
        }
    ]
};

const Utils = {
    generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),
    formatCurrency: (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(amount),
    formatDate: (dateString) => new Date(dateString).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }),
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    sanitize: (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

const Toast = {
    container: null,
    init() {
        this.container = document.getElementById('toast-container');
    },
    show(message, type = 'info', duration = 3000) {
        if (!this.container) this.init();
        const colors = {
            success: 'bg-emerald-500/90 border-emerald-400/30 text-white',
            error: 'bg-red-500/90 border-red-400/30 text-white',
            warning: 'bg-amber-500/90 border-amber-400/30 text-white',
            info: 'bg-indigo-500/90 border-indigo-400/30 text-white'
        };
        const icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
        const toast = document.createElement('div');
        toast.className = `toast flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg ${colors[type]}`;
        toast.innerHTML = `<i data-lucide="${icons[type]}" class="w-5 h-5"></i><span class="text-sm font-medium">${message}</span>`;
        this.container.appendChild(toast);
        lucide.createIcons();
        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

const AuthModule = {
    modal: null,
    form: null,
    errorMsg: null,
    init() {
        this.modal = document.getElementById('auth-modal');
        this.form = document.getElementById('auth-form');
        this.errorMsg = document.getElementById('auth-error');
        this.bindEvents();
        this.checkSession();
    },
    bindEvents() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.validateLogin();
        });
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
    },
    validateLogin() {
        const input = document.getElementById('auth-key');
        const key = input.value.trim();
        if (key === CONFIG.AUTH_KEY) {
            this.successfulLogin();
        } else {
            this.showError();
            input.value = '';
            input.focus();
        }
    },
    successfulLogin() {
        AppState.currentUser = { loginTime: new Date().toISOString() };
        localStorage.setItem('auth_session', JSON.stringify(AppState.currentUser));
        this.modal.style.opacity = '0';
        setTimeout(() => {
            this.modal.classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            document.body.classList.remove('overflow-hidden');
            NavigationModule.init();
            CRMModule.init();
            QuoteModule.init();
            TrainingModule.init();
            DashboardModule.init();
            Toast.show('Acceso concedido. Bienvenido al sistema.', 'success');
        }, 300);
    },
    showError() {
        this.errorMsg.classList.remove('hidden');
        setTimeout(() => this.errorMsg.classList.add('hidden'), 3000);
    },
    checkSession() {
        const session = localStorage.getItem('auth_session');
        if (session) {
            AppState.currentUser = JSON.parse(session);
            this.successfulLogin();
        }
    },
    logout() {
        localStorage.removeItem('auth_session');
        localStorage.removeItem('quiz_progress');
        location.reload();
    }
};

const NavigationModule = {
    navItems: null,
    tabContents: null,
    init() {
        this.navItems = document.querySelectorAll('[data-tab-target]');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.bindEvents();
        this.showTab('dashboard');
    },
    bindEvents() {
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.getAttribute('data-tab-target');
                this.showTab(target);
            });
        });
    },
    showTab(tabId) {
        const targetContent = document.getElementById(tabId);
        if (!targetContent) {
            console.error(`Tab "${tabId}" no encontrado`);
            return;
        }
        this.tabContents.forEach(content => {
            content.classList.add('hidden');
            content.classList.remove('animate-fade-in');
        });
        targetContent.classList.remove('hidden');
        targetContent.classList.add('animate-fade-in');
        this.navItems.forEach(item => {
            const isTarget = item.getAttribute('data-tab-target') === tabId;
            item.classList.toggle('active', isTarget);
            if (item.classList.contains('mobile-nav-item')) {
                item.classList.toggle('text-indigo-400', isTarget);
                item.classList.toggle('text-slate-400', !isTarget);
            }
        });
        AppState.currentTab = tabId;
        if (tabId === 'dashboard') DashboardModule.refresh();
        if (tabId === 'crm') CRMModule.renderTable();
    }
};

const CRMModule = {
    currentFilter: 'todos',
    init() {
        this.bindEvents();
        this.loadProspects();
        this.renderTable();
    },
    bindEvents() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.remove('active', 'bg-indigo-600', 'text-white');
                    b.classList.add('bg-slate-800', 'text-slate-300');
                });
                e.target.classList.remove('bg-slate-800', 'text-slate-300');
                e.target.classList.add('active', 'bg-indigo-600', 'text-white');
                this.currentFilter = e.target.dataset.filter;
                this.renderTable();
            });
        });
        document.getElementById('add-prospect-btn')?.addEventListener('click', () => this.openModal());
        document.getElementById('close-prospect-modal')?.addEventListener('click', () => this.closeModal());
        document.getElementById('cancel-prospect')?.addEventListener('click', () => this.closeModal());
        document.getElementById('prospect-modal-backdrop')?.addEventListener('click', () => this.closeModal());
        document.getElementById('prospect-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProspect(e.target);
        });
    },
    loadProspects() {
        const stored = localStorage.getItem('crm_prospects');
        if (stored) {
            AppState.prospects = JSON.parse(stored);
        } else {
            AppState.prospects = [...DB.prospects];
            this.persistProspects();
        }
    },
    persistProspects() {
        localStorage.setItem('crm_prospects', JSON.stringify(AppState.prospects));
        this.updateBadge();
    },
    updateBadge() {
        const count = AppState.prospects.filter(p => p.estado !== 'cerrado').length;
        const badge = document.getElementById('crm-badge');
        if (badge) {
            badge.textContent = count;
            badge.classList.toggle('hidden', count === 0);
        }
    },
    renderTable() {
        const tbody = document.getElementById('crm-table-body');
        const emptyState = document.getElementById('crm-empty');
        if (!tbody) return;
        const filtered = this.currentFilter === 'todos' ? AppState.prospects : AppState.prospects.filter(p => p.estado === this.currentFilter);
        if (filtered.length === 0) {
            tbody.innerHTML = '';
            emptyState?.classList.remove('hidden');
            return;
        }
        emptyState?.classList.add('hidden');
        tbody.innerHTML = filtered.map(prospect => {
            const semaforoClass = ({ alto: 'semaforo-verde', medio: 'semaforo-amarillo', bajo: 'semaforo-rojo' })[prospect.interes];
            const estadoClass = ({ nuevo: 'badge-nuevo', contactado: 'badge-contactado', seguimiento: 'badge-seguimiento', cerrado: 'badge-cerrado' })[prospect.estado];
            return `
                <tr class="group">
                    <td class="px-6 py-4"><span class="semaforo ${semaforoClass}" title="Interés: ${prospect.interes}"></span></td>
                    <td class="px-6 py-4"><div><p class="font-medium text-white">${Utils.sanitize(prospect.empresa)}</p><p class="text-sm text-slate-400">${Utils.sanitize(prospect.contacto)}</p></div></td>
                    <td class="px-6 py-4 text-slate-300">${prospect.servicio}</td>
                    <td class="px-6 py-4"><span class="badge-estado ${estadoClass}">${prospect.estado}</span></td>
                    <td class="px-6 py-4 text-slate-300">${Utils.formatCurrency(prospect.presupuesto)}</td>
                    <td class="px-6 py-4 text-slate-400 text-sm">${Utils.formatDate(prospect.fecha)}</td>
                    <td class="px-6 py-4 text-right">
                        <button onclick="CRMModule.editProspect(${prospect.id})" class="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors mr-1"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                        <button onclick="CRMModule.deleteProspect(${prospect.id})" class="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </td>
                </tr>`;
        }).join('');
        lucide.createIcons();
    },
    openModal() {
        document.getElementById('prospect-modal').classList.remove('hidden');
        document.getElementById('prospect-form').reset();
    },
    closeModal() {
        document.getElementById('prospect-modal').classList.add('hidden');
    },
    saveProspect(form) {
        const formData = new FormData(form);
        const newProspect = {
            id: Date.now(),
            empresa: formData.get('empresa'),
            contacto: formData.get('contacto'),
            email: formData.get('email'),
            servicio: formData.get('servicio'),
            presupuesto: parseFloat(formData.get('presupuesto')) || 0,
            interes: formData.get('interes'),
            estado: 'nuevo',
            fecha: new Date().toISOString()
        };
        AppState.prospects.unshift(newProspect);
        this.persistProspects();
        this.renderTable();
        this.closeModal();
        Toast.show('Prospecto registrado correctamente', 'success');
        this.syncToBackend(newProspect);
    },
    deleteProspect(id) {
        if (!confirm('¿Eliminar este prospecto permanentemente?')) return;
        AppState.prospects = AppState.prospects.filter(p => p.id !== id);
        this.persistProspects();
        this.renderTable();
        Toast.show('Prospecto eliminado', 'warning');
    },
    editProspect(id) {
        Toast.show(`Edición en desarrollo para ID ${id}`, 'info');
    },
    async syncToBackend(data) {
        try {
            await fetch(CONFIG.GAS_ENDPOINT, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: CONFIG.SECURITY_TOKEN, action: 'new_prospect', data: data, timestamp: new Date().toISOString() })
            });
        } catch (error) {
            console.log('Sync pendiente (modo offline)');
        }
    }
};

const QuoteModule = {
    init() {
        this.bindEvents();
        this.calculate();
    },
    bindEvents() {
        document.querySelectorAll('.service-check').forEach(check => {
            check.addEventListener('change', (e) => {
                const options = e.target.closest('.service-item').querySelector('.service-options');
                options?.classList.toggle('hidden', !e.target.checked);
                this.calculate();
            });
        });
        document.querySelectorAll('.complexity-select, .extra-pages, .branding-opt, .marketing-level').forEach(input => {
            input.addEventListener('change', () => this.calculate());
            input.addEventListener('input', () => this.calculate());
        });
        document.getElementById('urgency-factor')?.addEventListener('change', (e) => {
            AppState.quote.urgency = parseFloat(e.target.value);
            this.calculate();
        });
        document.getElementById('client-type')?.addEventListener('change', (e) => {
            AppState.quote.clientType = parseFloat(e.target.value);
            this.calculate();
        });
        document.getElementById('save-quote-btn')?.addEventListener('click', () => this.saveQuote());
        document.getElementById('export-quote-btn')?.addEventListener('click', () => Toast.show('Generando PDF... (Demo)', 'info'));
    },
    calculate() {
        let subtotal = 0;
        document.querySelectorAll('.service-check:checked').forEach(check => {
            const base = parseFloat(check.dataset.base) || 0;
            const serviceItem = check.closest('.service-item');
            let multiplier = 1;
            let extra = 0;
            if (check.dataset.service === 'web') {
                const complexity = serviceItem.querySelector('.complexity-select')?.value || 1;
                const pages = parseInt(serviceItem.querySelector('.extra-pages')?.value, 10) || 0;
                multiplier = parseFloat(complexity);
                extra = pages * 1500;
            } else if (check.dataset.service === 'branding') {
                serviceItem.querySelectorAll('.branding-opt:checked').forEach(opt => { extra += parseFloat(opt.dataset.add) || 0; });
            } else if (check.dataset.service === 'marketing') {
                const level = serviceItem.querySelector('.marketing-level')?.value || 1;
                multiplier = parseFloat(level);
            }
            subtotal += (base * multiplier) + extra;
        });
        const total = subtotal * AppState.quote.urgency * AppState.quote.clientType;
        document.getElementById('subtotal-services').textContent = Utils.formatCurrency(subtotal);
        document.getElementById('urgency-display').textContent = `x${AppState.quote.urgency}`;
        document.getElementById('client-display').textContent = `x${AppState.quote.clientType}`;
        document.getElementById('total-quote').textContent = Utils.formatCurrency(total);
        AppState.quote.total = total;
    },
    saveQuote() {
        if (AppState.quote.total === 0) {
            Toast.show('Selecciona al menos un servicio', 'warning');
            return;
        }
        const quoteData = { id: Utils.generateId(), date: new Date().toISOString(), total: AppState.quote.total, services: AppState.quote.services };
        const saved = JSON.parse(localStorage.getItem('quotes') || '[]');
        saved.push(quoteData);
        localStorage.setItem('quotes', JSON.stringify(saved));
        Toast.show('Cotización guardada localmente', 'success');
        this.syncQuote(quoteData);
    },
    async syncQuote(data) {
        try {
            await fetch(CONFIG.GAS_ENDPOINT, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: CONFIG.SECURITY_TOKEN, action: 'save_quote', data: data })
            });
        } catch (e) {
            console.log('Quote sync pendiente');
        }
    }
};

const QuizModule = {
    questions: DB.quizQuestions,
    init() {
        this.loadProgress();
        this.bindEvents();
        this.updateProgressUI();
    },
    bindEvents() {
        document.getElementById('start-quiz-btn')?.addEventListener('click', () => this.startQuiz());
        document.getElementById('retry-quiz-btn')?.addEventListener('click', () => {
            this.resetQuiz();
            this.startQuiz();
        });
        document.getElementById('sync-results-btn')?.addEventListener('click', () => this.syncResults());
    },
    loadProgress() {
        const saved = localStorage.getItem('quiz_progress');
        if (saved) AppState.quizProgress = JSON.parse(saved);
    },
    saveProgress() {
        localStorage.setItem('quiz_progress', JSON.stringify(AppState.quizProgress));
        this.updateProgressUI();
    },
    updateProgressUI() {
        const percentage = AppState.quizProgress.completed ? 100 : Math.round((AppState.quizProgress.currentQuestion / this.questions.length) * 100);
        document.getElementById('global-progress').textContent = `${percentage}%`;
        document.getElementById('progress-bar').style.width = `${percentage}%`;
        document.getElementById('training-progress').textContent = `${percentage}%`;
    },
    startQuiz() {
        document.getElementById('quiz-intro').classList.add('hidden');
        document.getElementById('quiz-results').classList.add('hidden');
        document.getElementById('quiz-question').classList.remove('hidden');
        if (AppState.quizProgress.completed) this.resetQuiz();
        this.showQuestion();
    },
    showQuestion() {
        const q = this.questions[AppState.quizProgress.currentQuestion];
        document.getElementById('current-q').textContent = AppState.quizProgress.currentQuestion + 1;
        document.getElementById('total-q').textContent = this.questions.length;
        document.getElementById('quiz-score').textContent = `Puntuación: ${AppState.quizProgress.score}`;
        document.getElementById('question-text').textContent = q.question;
        const optionsContainer = document.getElementById('options-container');
        optionsContainer.innerHTML = q.options.map((opt, idx) => `
            <button class="quiz-option w-full text-left p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800 transition-all text-slate-200" data-index="${idx}">
                <span class="inline-block w-6 h-6 rounded-full bg-slate-700 text-center text-sm leading-6 mr-3 text-slate-400">${String.fromCharCode(65 + idx)}</span>
                ${Utils.sanitize(opt)}
            </button>`).join('');
        optionsContainer.querySelectorAll('.quiz-option').forEach(btn => {
            btn.addEventListener('click', (e) => this.answerQuestion(parseInt(e.currentTarget.dataset.index, 10)));
        });
        this.updateProgressUI();
    },
    answerQuestion(selectedIndex) {
        const currentQ = this.questions[AppState.quizProgress.currentQuestion];
        const isCorrect = selectedIndex === currentQ.correct;
        if (isCorrect) {
            AppState.quizProgress.score++;
            Toast.show('¡Correcto!', 'success', 1500);
        } else {
            Toast.show('Incorrecto', 'error', 1500);
        }
        AppState.quizProgress.answers.push({ question: AppState.quizProgress.currentQuestion, correct: isCorrect });
        AppState.quizProgress.currentQuestion++;
        if (AppState.quizProgress.currentQuestion >= this.questions.length) {
            this.finishQuiz();
        } else {
            this.saveProgress();
            setTimeout(() => this.showQuestion(), 500);
        }
    },
    finishQuiz() {
        AppState.quizProgress.completed = true;
        this.saveProgress();
        document.getElementById('quiz-question').classList.add('hidden');
        document.getElementById('quiz-results').classList.remove('hidden');
        const percentage = Math.round((AppState.quizProgress.score / this.questions.length) * 100);
        const passed = percentage >= 80;
        document.getElementById('final-score').textContent = `${AppState.quizProgress.score}/${this.questions.length} (${percentage}%)`;
        document.getElementById('result-title').textContent = passed ? '¡Certificación Aprobada!' : 'Evaluación No Aprobada';
        document.getElementById('result-message').textContent = passed ? 'Has demostrado dominio de los protocolos operativos.' : 'Necesitas 80% para aprobar. Revisa los materiales e intenta de nuevo.';
        const iconContainer = document.getElementById('result-icon');
        iconContainer.className = `w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${passed ? 'bg-emerald-500/20' : 'bg-red-500/20'}`;
        iconContainer.innerHTML = `<i data-lucide="${passed ? 'check-circle' : 'x-circle'}" class="w-10 h-10 ${passed ? 'text-emerald-400' : 'text-red-400'}"></i>`;
        lucide.createIcons();
        this.updateProgressUI();
    },
    resetQuiz() {
        AppState.quizProgress = { currentQuestion: 0, score: 0, answers: [], completed: false };
        this.saveProgress();
    },
    async syncResults() {
        const data = { user: AppState.currentUser, results: AppState.quizProgress, timestamp: new Date().toISOString() };
        try {
            await fetch(CONFIG.GAS_ENDPOINT, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: CONFIG.SECURITY_TOKEN, action: 'quiz_results', data: data })
            });
            Toast.show('Resultados sincronizados con el servidor', 'success');
        } catch (e) {
            Toast.show('Error de sincronización. Se intentará más tarde.', 'error');
        }
    }
};

const TrainingModule = {
    moduloLinks: [],
    currentModule: 1,
    psicoByModulo: {
        1: 'La primera impresión dura 7 segundos. Usa este acertijo para entrenar claridad.',
        2: 'Sesgo de autoridad: mostrarte como experto aumenta la confianza.',
        3: 'Efecto Von Restorff: lo que destaca se recuerda. Sé diferente.',
        4: 'Categorizar ayuda al cerebro a procesar. Los nichos son atajos mentales.',
        5: 'La mera exposición genera afinidad. Aparece frecuentemente.',
        6: 'El encuadre decide si el mensaje se acepta o rechaza.',
        7: 'Escucha activa: repetir lo que dice el cliente crea rapport.',
        8: 'La prueba social desactiva el escepticismo.',
        9: 'Números concretos son más creíbles que redondeados.',
        10: 'Mentalidad de crecimiento: cada no es un dato, no un fracaso.'
    },
    init() {
        this.moduloLinks = Array.from(document.querySelectorAll('#modulosNav .modulo-link'));
        if (!this.moduloLinks.length) return;
        this.loadState();
        this.bindEvents();
        this.updateProgress();
        this.loadModule(this.currentModule);
        this.highlightActive(this.currentModule);
    },
    loadState() {
        const saved = localStorage.getItem('training_modules_v1');
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved);
            if (parsed && Array.isArray(parsed.completed) && parsed.completed.length === 10) {
                AppState.training.completed = parsed.completed.map(Boolean);
            }
        } catch (_) {}
    },
    persistState() {
        localStorage.setItem('training_modules_v1', JSON.stringify({
            completed: AppState.training.completed
        }));
    },
    getProgressPercentage() {
        return Math.round((AppState.training.completed.filter(Boolean).length / 10) * 100);
    },
    getLevelFromCompleted(completedCount) {
        if (completedCount >= 8) return 5;
        if (completedCount >= 6) return 4;
        if (completedCount >= 4) return 3;
        if (completedCount >= 2) return 2;
        return 1;
    },
    updateProgress() {
        const completedCount = AppState.training.completed.filter(Boolean).length;
        const percentage = this.getProgressPercentage();
        const level = this.getLevelFromCompleted(completedCount);
        AppState.training.level = level;

        const progressBar = document.getElementById('progresoGlobalTrain');
        const levelNode = document.getElementById('nivelActual');
        const sideProgress = document.getElementById('training-progress');
        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (levelNode) levelNode.textContent = String(level);
        if (sideProgress) sideProgress.textContent = `${percentage}%`;

        this.moduloLinks.forEach((link, idx) => {
            const modulo = idx + 1;
            const locked = modulo > (level * 2);
            link.classList.toggle('module-locked', locked);
            link.dataset.locked = locked ? 'true' : 'false';

            if (AppState.training.completed[idx]) {
                link.classList.add('line-through', 'text-indigo-300');
            } else {
                link.classList.remove('line-through');
            }
        });
    },
    bindEvents() {
        this.moduloLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const modulo = Number(link.dataset.modulo || 1);
                this.loadModule(modulo);
                this.highlightActive(modulo);
            });
        });
    },
    highlightActive(modulo) {
        this.moduloLinks.forEach(link => {
            const isActive = Number(link.dataset.modulo) === modulo;
            link.classList.toggle('bg-indigo-500/20', isActive);
            link.classList.toggle('text-indigo-300', isActive);
            link.classList.toggle('border-l-4', isActive);
            link.classList.toggle('border-indigo-500', isActive);
        });
    },
    completeModule(modulo) {
        if (!AppState.training.completed[modulo - 1]) {
            AppState.training.completed[modulo - 1] = true;
            this.persistState();
            this.updateProgress();
            DashboardModule.refresh();
            Toast.show(`Módulo ${modulo} completado`, 'success', 1800);
        }
    },
    loadModule(modulo) {
        this.currentModule = modulo;
        const targetLink = this.moduloLinks.find(link => Number(link.dataset.modulo) === modulo);
        const gameContent = document.getElementById('gameContent');
        const psicoBox = document.getElementById('psicoBox');
        const psicoText = document.getElementById('psicoText');
        if (!gameContent || !targetLink) return;

        if (targetLink.dataset.locked === 'true') {
            gameContent.innerHTML = '<div class="p-10 text-center"><span class="text-3xl">🔒</span><p class="text-slate-400 mt-2">Completa más módulos para desbloquear</p></div>';
            if (psicoBox) psicoBox.classList.add('hidden');
            return;
        }

        if (psicoText) psicoText.textContent = this.psicoByModulo[modulo] || 'Juega y aprende.';
        if (psicoBox) psicoBox.classList.remove('hidden');

        switch (modulo) {
            case 1: this.gameMission(); break;
            case 2: this.gameSolution(); break;
            case 3: this.gameReflex(); break;
            case 4: this.gameMemory(); break;
            case 5: this.gameSources(); break;
            case 6: this.gameScriptOrder(); break;
            case 7: this.gamePainDetection(); break;
            case 8: this.gamePitch(); break;
            case 9: this.gameMetrics(); break;
            case 10: this.gameMindset(); break;
            default: gameContent.innerHTML = '<p class="text-slate-400">Módulo no disponible.</p>';
        }
    },
    gameMission() {
        const gameContent = document.getElementById('gameContent');
        if (!gameContent) return;
        gameContent.innerHTML = `
            <h3 class="text-2xl font-bold mb-4">🧩 Acertijo: Misión del puesto</h3>
            <p class="text-sm text-slate-400 mb-6">Ordena las palabras para formar la misión correcta</p>
            <div id="palabras-container" class="flex flex-wrap gap-2 justify-center mb-6"></div>
            <div class="bg-slate-900 p-4 rounded-xl min-h-[60px] flex flex-wrap gap-2 items-center justify-center border border-slate-700" id="zona-soltar"></div>
            <button id="btnVerificar" class="mt-6 bg-indigo-600 text-white px-6 py-2 rounded-full text-sm">Verificar</button>
            <div id="resultadoMision" class="mt-4 text-sm"></div>
        `;
        const words = ['Tu', 'trabajo', 'no', 'es', 'vender', 'tecnologia', 'sino', 'identificar', 'negocios', 'desorganizados'];
        const container = document.getElementById('palabras-container');
        const zone = document.getElementById('zona-soltar');
        words.sort(() => Math.random() - 0.5);
        words.forEach(word => {
            const chip = document.createElement('span');
            chip.className = 'draggable bg-slate-800 px-4 py-2 rounded-full shadow-sm border border-slate-700 text-sm';
            chip.textContent = word;
            chip.draggable = true;
            chip.addEventListener('dragstart', e => e.dataTransfer?.setData('text/plain', word));
            container?.appendChild(chip);
        });
        zone?.addEventListener('dragover', e => e.preventDefault());
        zone?.addEventListener('drop', e => {
            e.preventDefault();
            const word = e.dataTransfer?.getData('text/plain');
            if (!word) return;
            const span = document.createElement('span');
            span.className = 'bg-indigo-500/20 text-indigo-200 px-3 py-1 rounded-full text-sm';
            span.textContent = word;
            zone.appendChild(span);
        });
        document.getElementById('btnVerificar')?.addEventListener('click', () => {
            const phrase = Array.from(zone?.children || []).map(s => s.textContent).join(' ');
            const resultNode = document.getElementById('resultadoMision');
            if (phrase === 'Tu trabajo no es vender tecnologia sino identificar negocios desorganizados') {
                if (resultNode) resultNode.innerHTML = '<span class="text-green-400">✅ Correcto. Misión interiorizada.</span>';
                this.completeModule(1);
            } else if (resultNode) {
                resultNode.innerHTML = '<span class="text-red-400">❌ No coincide. Intenta de nuevo.</span>';
            }
        });
    },
    gameSolution() {
        const gameContent = document.getElementById('gameContent');
        if (!gameContent) return;
        gameContent.innerHTML = `
            <h3 class="text-2xl font-bold mb-4">🧠 Nuestra solución (psicología)</h3>
            <div id="flipCard" class="flip-card w-full h-48 mx-auto cursor-pointer">
                <div class="flip-inner">
                    <div class="flip-front bg-indigo-600 text-white flex items-center justify-center p-6 rounded-2xl">
                        <p class="text-lg font-medium">¿Qué problema psicológico resuelve nuestra herramienta?</p>
                    </div>
                    <div class="flip-back bg-slate-800 text-white flex items-center justify-center p-6 rounded-2xl border border-slate-700">
                        <p class="text-lg">Reduce la carga cognitiva del dueño. Menos decisiones, más automatización.</p>
                    </div>
                </div>
            </div>
            <p class="text-xs text-center mt-2 text-slate-400">Haz clic en la tarjeta para ver la respuesta</p>
            <button id="btnComplete2" class="mt-6 bg-indigo-600 text-white px-6 py-2 rounded-full text-sm">Marcar como aprendido</button>
        `;
        document.getElementById('flipCard')?.addEventListener('click', (e) => e.currentTarget.classList.toggle('flipped'));
        document.getElementById('btnComplete2')?.addEventListener('click', () => this.completeModule(2));
    },
    gameReflex() {
        const gameContent = document.getElementById('gameContent');
        if (!gameContent) return;
        gameContent.innerHTML = `
            <h3 class="text-2xl font-bold mb-4">⚡ Problemas que resolvemos (reflejos)</h3>
            <p class="mb-4 text-slate-300">Haz clic en el problema correcto</p>
            <div id="problemaDisplay" class="text-center p-6 bg-slate-900 border border-slate-700 rounded-2xl text-xl font-bold"></div>
            <div class="flex gap-4 justify-center mt-6">
                <button id="btnSi" class="bg-green-600 text-white px-8 py-3 rounded-xl">✅ Sí, lo resolvemos</button>
                <button id="btnNo" class="bg-red-600 text-white px-8 py-3 rounded-xl">❌ No</button>
            </div>
            <p id="puntuacionReflejos" class="mt-4 text-sm text-slate-400">Aciertos: 0</p>
        `;
        const items = [
            { text: 'Perdida de mensajes de clientes', ok: true },
            { text: 'Falta de inventario', ok: false },
            { text: 'Doble agendamiento', ok: true },
            { text: 'Empleados no llegan tarde', ok: false },
            { text: 'No saben quien pregunto primero', ok: true }
        ];
        let i = 0;
        let hits = 0;
        const display = document.getElementById('problemaDisplay');
        const score = document.getElementById('puntuacionReflejos');
        const render = () => {
            if (!display) return;
            if (i >= items.length) {
                display.textContent = '¡Completado!';
                if (hits === items.length) this.completeModule(3);
                return;
            }
            display.textContent = items[i].text;
        };
        const answer = (ans) => {
            if (i >= items.length) return;
            const ok = (ans === 'si' && items[i].ok) || (ans === 'no' && !items[i].ok);
            if (ok) hits += 1;
            if (score) score.textContent = `Aciertos: ${hits}`;
            i += 1;
            render();
        };
        document.getElementById('btnSi')?.addEventListener('click', () => answer('si'));
        document.getElementById('btnNo')?.addEventListener('click', () => answer('no'));
        render();
    },
    gameMemory() {
        const gameContent = document.getElementById('gameContent');
        if (!gameContent) return;
        gameContent.innerHTML = `
            <h3 class="text-2xl font-bold mb-4">🧩 Memory: empareja nicho con ejemplo</h3>
            <div id="memoryGrid" class="grid grid-cols-4 gap-3 max-w-md mx-auto"></div>
            <p id="memoryMsg" class="mt-4 text-sm"></p>
        `;
        const pairs = [
            { niche: 'Tecnicos', example: 'Minisplit' },
            { niche: 'Belleza', example: 'Barberias' },
            { niche: 'Mascotas', example: 'Veterinarias' },
            { niche: 'Comida', example: 'Taquerias' }
        ];
        let cards = [];
        pairs.forEach((p, idx) => {
            cards.push({ text: p.niche, pair: idx });
            cards.push({ text: p.example, pair: idx });
        });
        cards.sort(() => Math.random() - 0.5);
        const grid = document.getElementById('memoryGrid');
        let selected = [];
        let locked = false;
        let matched = 0;
        cards.forEach((card) => {
            const tile = document.createElement('div');
            tile.className = 'bg-indigo-500/20 p-4 rounded-xl text-center cursor-pointer hover:bg-indigo-500/30 transition';
            tile.dataset.pair = String(card.pair);
            tile.innerHTML = '?';
            tile.addEventListener('click', () => {
                if (locked || tile.classList.contains('matched')) return;
                tile.innerHTML = card.text;
                tile.classList.add('bg-indigo-500/40');
                selected.push(tile);
                if (selected.length !== 2) return;
                locked = true;
                const [a, b] = selected;
                if (a !== b && a.dataset.pair === b.dataset.pair) {
                    a.classList.add('matched', 'bg-green-500/30');
                    b.classList.add('matched', 'bg-green-500/30');
                    matched += 1;
                    if (matched === pairs.length) {
                        const msg = document.getElementById('memoryMsg');
                        if (msg) msg.textContent = '✅ ¡Memoria maestra! Nichos aprendidos.';
                        this.completeModule(4);
                    }
                    selected = [];
                    locked = false;
                } else {
                    setTimeout(() => {
                        a.innerHTML = '?';
                        b.innerHTML = '?';
                        a.classList.remove('bg-indigo-500/40');
                        b.classList.remove('bg-indigo-500/40');
                        selected = [];
                        locked = false;
                    }, 700);
                }
            });
            grid?.appendChild(tile);
        });
    },
    gameSources() {
        const gameContent = document.getElementById('gameContent');
        if (!gameContent) return;
        gameContent.innerHTML = `
            <h3 class="text-2xl font-bold mb-4">🔍 Haz clic en las fuentes válidas</h3>
            <div id="fuentesGrid" class="grid grid-cols-3 gap-3 max-w-sm mx-auto"></div>
            <p id="fuentesResult" class="mt-4"></p>
        `;
        const options = [
            { text: 'Facebook Marketplace', valid: true },
            { text: 'Google Maps', valid: true },
            { text: 'Instagram', valid: true },
            { text: 'WhatsApp Business', valid: true },
            { text: 'Periodico impreso', valid: false },
            { text: 'Radio local', valid: false }
        ];
        options.sort(() => Math.random() - 0.5);
        const grid = document.getElementById('fuentesGrid');
        let hits = 0;
        let fails = 0;
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'p-3 bg-slate-800 rounded-xl text-sm hover:bg-slate-700';
            btn.textContent = opt.text;
            btn.addEventListener('click', () => {
                if (opt.valid) {
                    hits += 1;
                    btn.classList.add('bg-green-500/30');
                } else {
                    fails += 1;
                    btn.classList.add('bg-red-500/30');
                }
                btn.disabled = true;
                if ((hits + fails) === options.length) {
                    const result = document.getElementById('fuentesResult');
                    if (result) result.textContent = `Aciertos: ${hits} (necesitas 4)`;
                    if (hits >= 4) this.completeModule(5);
                }
            });
            grid?.appendChild(btn);
        });
    },
    gameScriptOrder() {
        const gameContent = document.getElementById('gameContent');
        if (!gameContent) return;
        gameContent.innerHTML = `
            <h3 class="text-2xl font-bold mb-4">📝 Ordena el guion de apertura</h3>
            <div id="listaFrases" class="space-y-2"></div>
            <button id="checkOrden" class="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-full">Comprobar</button>
        `;
        const phrases = [
            'Hola [nombre], soy [nombre] de Servicios Digitales MX',
            'He visto que atiendes muchos mensajes en redes',
            'Te ayudo a organizar las citas y responder automaticamente',
            '¿Tienes 5 minutos para una breve llamada?'
        ];
        const correct = phrases.join('|');
        const list = document.getElementById('listaFrases');
        phrases.sort(() => Math.random() - 0.5);
        phrases.forEach((text) => {
            const row = document.createElement('div');
            row.className = 'p-3 bg-slate-800 border border-slate-700 rounded-xl cursor-move flex items-center gap-2';
            row.innerHTML = `<span class="text-indigo-300 font-bold">☰</span> ${text}`;
            row.draggable = true;
            row.dataset.phrase = text;
            row.addEventListener('dragstart', e => e.dataTransfer?.setData('text/plain', text));
            list?.appendChild(row);
        });
        list?.addEventListener('dragover', e => e.preventDefault());
        list?.addEventListener('drop', e => {
            e.preventDefault();
            const phrase = e.dataTransfer?.getData('text/plain');
            const target = e.target.closest('div[data-phrase]');
            if (!target || !phrase || !list) return;
            const dragged = Array.from(list.children).find(el => el.dataset.phrase === phrase);
            if (!dragged) return;
            const targetIndex = Array.from(list.children).indexOf(target);
            const draggedIndex = Array.from(list.children).indexOf(dragged);
            list.insertBefore(dragged, targetIndex > draggedIndex ? target.nextSibling : target);
        });
        document.getElementById('checkOrden')?.addEventListener('click', () => {
            const order = Array.from(list?.children || []).map(el => el.dataset.phrase).join('|');
            if (order === correct) {
                this.completeModule(6);
                Toast.show('✅ Guion correcto', 'success');
            } else {
                Toast.show('❌ Orden incorrecto', 'error');
            }
        });
    },
    gamePainDetection() {
        const gameContent = document.getElementById('gameContent');
        if (!gameContent) return;
        gameContent.innerHTML = `
            <h3 class="text-2xl font-bold mb-4">🩺 Caso: Barbería El Corte</h3>
            <p class="mb-4">El dueño dice: "A veces se me pierden los mensajes y no sé a quién le toca cita". ¿Qué dolor detectas?</p>
            <div class="space-y-2">
                <button class="opcion-dolor w-full text-left p-3 bg-slate-800 rounded-xl border border-slate-700" data-correct="true">Pérdida de organización de citas</button>
                <button class="opcion-dolor w-full text-left p-3 bg-slate-800 rounded-xl border border-slate-700" data-correct="false">Precio muy bajo</button>
                <button class="opcion-dolor w-full text-left p-3 bg-slate-800 rounded-xl border border-slate-700" data-correct="false">Falta de clientes</button>
            </div>
        `;
        gameContent.querySelectorAll('.opcion-dolor').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.currentTarget.dataset.correct === 'true') {
                    this.completeModule(7);
                    Toast.show('✅ Dolor identificado', 'success');
                } else {
                    Toast.show('❌ Ese no es el dolor principal', 'error');
                }
            });
        });
    },
    gamePitch() {
        const gameContent = document.getElementById('gameContent');
        if (!gameContent) return;
        gameContent.innerHTML = `
            <h3 class="text-2xl font-bold mb-4">⏱️ Pitch de 10 segundos</h3>
            <p>Simula que le explicas a un electricista tu servicio. Escribe tu pitch:</p>
            <textarea id="pitchText" class="w-full p-3 border border-slate-700 bg-slate-800 rounded-xl mt-2" rows="3"></textarea>
            <button id="enviarPitch" class="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-full">Enviar</button>
            <p id="pitchFeedback" class="mt-2 text-sm"></p>
        `;
        document.getElementById('enviarPitch')?.addEventListener('click', () => {
            const value = (document.getElementById('pitchText')?.value || '').toLowerCase();
            const feedback = document.getElementById('pitchFeedback');
            if (value.length > 20 && value.includes('mensajes')) {
                if (feedback) feedback.innerHTML = '✅ Buen pitch, mencionas el beneficio.';
                this.completeModule(8);
            } else if (feedback) {
                feedback.innerHTML = '❌ Intenta incluir "organizar mensajes".';
            }
        });
    },
    gameMetrics() {
        const gameContent = document.getElementById('gameContent');
        if (!gameContent) return;
        gameContent.innerHTML = `
            <h3 class="text-2xl font-bold mb-4">📊 Si haces 20 llamadas y cierras 2 ventas, ¿tasa de conversión?</h3>
            <input id="respuestaNum" class="border border-slate-700 bg-slate-800 p-2 rounded w-24 text-center" type="number"> %
            <button id="checkNum" class="bg-indigo-600 text-white px-4 py-2 rounded-full ml-2">Comprobar</button>
            <p id="feedNum" class="mt-4"></p>
        `;
        document.getElementById('checkNum')?.addEventListener('click', () => {
            const val = parseInt(document.getElementById('respuestaNum')?.value || '', 10);
            const node = document.getElementById('feedNum');
            if (val === 10) {
                if (node) node.innerHTML = '✅ Correcto: 2/20 = 10%';
                this.completeModule(9);
            } else if (node) {
                node.innerHTML = '❌ Vuelve a calcular';
            }
        });
    },
    gameMindset() {
        const gameContent = document.getElementById('gameContent');
        if (!gameContent) return;
        gameContent.innerHTML = `
            <h3 class="text-2xl font-bold mb-4">💪 Mentalidad de cierre</h3>
            <p>Cuando un prospecto dice "No me interesa", ¿qué haces?</p>
            <div class="space-y-2 mt-4">
                <button class="mental-opcion block w-full p-3 bg-slate-800 rounded-xl border border-slate-700" data-correct="true">Anoto por qué dijo no y aprendo</button>
                <button class="mental-opcion block w-full p-3 bg-slate-800 rounded-xl border border-slate-700" data-correct="false">Me desanimo y dejo de llamar</button>
                <button class="mental-opcion block w-full p-3 bg-slate-800 rounded-xl border border-slate-700" data-correct="false">Insisto hasta que acepte</button>
            </div>
        `;
        gameContent.querySelectorAll('.mental-opcion').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.currentTarget.dataset.correct === 'true') {
                    this.completeModule(10);
                    Toast.show('✅ Mentalidad de crecimiento', 'success');
                } else {
                    Toast.show('❌ Revisa tu enfoque', 'error');
                }
            });
        });
    }
};

const DashboardModule = {
    init() {
        this.refresh();
    },
    refresh() {
        const prospects = AppState.prospects;
        const cerrados = prospects.filter(p => p.estado === 'cerrado').length;
        const seguimiento = prospects.filter(p => p.estado === 'seguimiento').length;
        document.getElementById('stat-prospectos').textContent = prospects.length;
        document.getElementById('stat-cerrados').textContent = cerrados;
        document.getElementById('stat-seguimiento').textContent = seguimiento;
        const trainingProgress = TrainingModule.getProgressPercentage ? TrainingModule.getProgressPercentage() : 0;
        document.getElementById('stat-certificacion').textContent = `${trainingProgress}%`;
        this.renderActivityFeed();
    },
    renderActivityFeed() {
        const container = document.getElementById('activity-feed');
        const recent = AppState.prospects.slice(0, 3);
        if (recent.length === 0) return;
        container.innerHTML = recent.map(p => `
            <div class="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                <div class="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <i data-lucide="user-plus" class="w-4 h-4 text-indigo-400"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-white truncate">Nuevo prospecto: ${Utils.sanitize(p.empresa)}</p>
                    <p class="text-xs text-slate-500">${Utils.formatDate(p.fecha)} • ${p.servicio}</p>
                </div>
            </div>`).join('');
        lucide.createIcons();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    AuthModule.init();
});
