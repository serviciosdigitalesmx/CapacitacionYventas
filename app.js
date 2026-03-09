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
            QuizModule.init();
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
        const quizProgress = AppState.quizProgress.completed ? 100 : Math.round((AppState.quizProgress.currentQuestion / DB.quizQuestions.length) * 100);
        document.getElementById('stat-certificacion').textContent = `${quizProgress}%`;
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
