
        function setMarket(type) {
            const container = document.getElementById('market-container');
            const btnGeneral = document.getElementById('btn-general');
            const btnElite = document.getElementById('btn-elite');
            const p3Shimmer = document.getElementById('p3-shimmer');
            
            // Actualización de UI
            if (type === 'elite') {
                container.className = 'theme-elite pt-28 pb-20 px-4 min-h-screen';
                btnElite.className = 'px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest market-active text-slate-900';
                btnGeneral.className = 'px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white';
                
                // Textos San Pedro
                document.getElementById('main-title').innerHTML = 'Arquitectura Digital: <br>La Evolución de su <span class="gold-text">Modelo de Negocio</span>';
                document.getElementById('main-desc').innerText = 'No instalamos herramientas; digitalizamos su operación. Transformamos procesos manuales en activos tecnológicos de alto rendimiento.';
                
                // Precios y Planes Elite
                updatePlan('p1', 'Cimentación Digital', 'Estructura fundamental para blindaje operativo inicial.', '$25,000', '$5,000');
                updatePlan('p2', 'Estructura de Control', 'Arquitectura de procesos para visibilidad y optimización de flujos.', '$35,000', '$8,500');
                updatePlan('p3', 'Blindaje & Transparencia', 'Cultura de evidencia multimedia y blindaje multimedia irrefutable.', '$45,000', '$12,000');
                updatePlan('p4', 'Arquitectura Corporativa', 'Digitalización de modelos de expansión y multisucursal a medida.', 'COTIZACIÓN', '25%');
                
                p3Shimmer.classList.remove('hidden');
            } else {
                container.className = 'theme-general pt-28 pb-20 px-4 min-h-screen';
                btnGeneral.className = 'px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest market-active text-slate-900';
                btnElite.className = 'px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800';
                
                // Textos Mercado General
                document.getElementById('main-title').innerHTML = 'Digitalizamos su Negocio: <span class="text-indigo-600">Orden y Control</span>';
                document.getElementById('main-desc').innerText = 'Transformamos su taller en una empresa moderna. No es un sistema, es la evolución digital de su forma de trabajar.';
                
                // Precios y Planes General
                updatePlan('p1', 'Digitalización Operativa', 'Mapeo y migración de procesos manuales a una base digital sólida.', '$800', '$250');
                updatePlan('p2', 'Control de Gestión', 'Optimización de flujos y visibilidad de rendimiento en tiempo real.', '$1,500', '$450');
                updatePlan('p3', 'Blindaje de Marca', 'Cultura de transparencia y evidencia multimedia para protección total.', '$2,800', '$800');
                updatePlan('p4', 'Crecimiento Escalar', 'Integración multisucursal y arquitectura a la medida para expansión.', 'COTIZACIÓN', '25%');
                
                p3Shimmer.classList.add('hidden');
            }
        }

        function updatePlan(id, name, desc, price, comm) {
            document.getElementById(id + '-name').innerText = name;
            document.getElementById(id + '-desc').innerText = desc;
            document.getElementById(id + '-price').innerText = price;
            document.getElementById(id + '-comm').innerText = comm;
        }

        // Inicializar
        setMarket('general');
    

