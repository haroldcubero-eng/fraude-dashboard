
/* ============================================
   DASHBOARD.JS — Métricas, gráficos y tablas
   Los datos se obtienen enviando mensajes a n8n
   y parseando las respuestas del agente.
   ============================================ */

const Dashboard = {
    charts: {},
    refreshInterval: null,

    // =============================================
    // Inicializar dashboard
    // =============================================
    init() {
        this.loadDashboardData();
        this.setupRefreshButtons();
        this.setupPredictForm();

        // Auto-refresh cada 5 minutos
        this.refreshInterval = setInterval(() => {
            this.loadDashboardData();
        }, 300000);
    },

    // =============================================
    // Cargar datos del dashboard desde n8n
    // =============================================
    async loadDashboardData() {
        // Solicitar resumen general al agente
        const response = await API.getDashboardData();
        
        if (response.success) {
            this.parseDashboardResponse(response.message);
        } else {
            // Si falla la conexión, mostrar estado offline
            this.setOfflineState();
        }
    },

    // =============================================
    // Parsear respuesta del agente para extraer métricas
    // El agente responde en texto natural, extraemos números
    // =============================================
    parseDashboardResponse(responseText) {
        // Intentar extraer métricas del texto de respuesta
        const metrics = this.extractMetrics(responseText);
        
        // Actualizar KPIs
        if (metrics.pendientes !== null) {
            document.getElementById('kpi-pendientes').textContent = metrics.pendientes;
        }
        if (metrics.tasaFraude !== null) {
            document.getElementById('kpi-tasa-fraude').textContent = metrics.tasaFraude + '%';
        }
        if (metrics.totalTransacciones !== null) {
            document.getElementById('kpi-total').textContent = metrics.totalTransacciones;
        }
        if (metrics.centinela !== null) {
            document.getElementById('kpi-centinela').textContent = metrics.centinela;
        }

        // Actualizar indicador de reentrenamiento
        this.updateRetrainIndicator(metrics.desacuerdos);

        // Actualizar estado del sistema
        document.getElementById('status-text').textContent = 'Sistema Operativo';
        document.querySelector('.status-dot').classList.remove('offline');
    },

    // =============================================
    // Extraer números/métricas del texto del agente
    // =============================================
    extractMetrics(text) {
        const metrics = {
            pendientes: null,
            tasaFraude: null,
            totalTransacciones: null,
            centinela: null,
            desacuerdos: null
        };

        // Buscar patrones comunes en la respuesta del agente
        // Pendientes
        const pendMatch = text.match(/(\d+)\s*(alertas?\s*pendientes?|transacciones?\s*pendientes?|pendientes?)/i);
        if (pendMatch) metrics.pendientes = parseInt(pendMatch[1]);

        // Tasa de fraude
        const tasaMatch = text.match(/tasa.*?(\d+[.,]?\d*)\s*%/i) || text.match(/(\d+[.,]?\d*)\s*%.*?fraude/i);
        if (tasaMatch) metrics.tasaFraude = parseFloat(tasaMatch[1].replace(',', '.'));

        // Total transacciones
        const totalMatch = text.match(/(\d+)\s*transacciones?\s*totales?/i) || text.match(/total.*?(\d+)\s*transacciones?/i);
        if (totalMatch) metrics.totalTransacciones = parseInt(totalMatch[1]);

        // Centinela
        const centMatch = text.match(/(\d+)\s*(campañas?|alertas?\s*centinela)/i);
        if (centMatch) metrics.centinela = parseInt(centMatch[1]);

        // Desacuerdos para reentrenamiento
        const desMatch = text.match(/(\d+)\s*(desacuerdos?|FP|FN)/i) || text.match(/(\d+)\/\d+\s*desacuerdos?/i);
        if (desMatch) metrics.desacuerdos = parseInt(desMatch[1]);

        return metrics;
    },

    // =============================================
    // Indicador de reentrenamiento
    // =============================================
    updateRetrainIndicator(desacuerdos) {
        const indicator = document.getElementById('retrain-indicator');
        const detail = document.getElementById('retrain-detail');
        const progress = document.getElementById('retrain-progress');
        
        const umbral = 10; // Umbral de desacuerdos para recomendar reentrenamiento
        
        if (desacuerdos === null) {
            detail.textContent = 'Evaluando estado del modelo...';
            progress.style.width = '0%';
            return;
        }

        const porcentaje = Math.min((desacuerdos / umbral) * 100, 100);
        progress.style.width = porcentaje + '%';

        if (desacuerdos >= umbral) {
            // CRÍTICO: recomendar reentrenamiento
            indicator.className = 'retrain-indicator critical';
            detail.textContent = `⚠️ SE RECOMIENDA REENTRENAMIENTO — ${desacuerdos} desacuerdos acumulados (umbral: ${umbral})`;
            progress.style.background = '#dc2626';
        } else if (desacuerdos >= umbral * 0.7) {
            // WARNING: próximo al umbral
            indicator.className = 'retrain-indicator warning';
            detail.textContent = `${desacuerdos}/${umbral} desacuerdos acumulados — Modelo en observación`;
            progress.style.background = '#f59e0b';
        } else {
            // OK: modelo estable
            indicator.className = 'retrain-indicator';
            detail.textContent = `${desacuerdos}/${umbral} desacuerdos — Modelo estable ✓`;
            progress.style.background = '#10b981';
        }
    },

    // =============================================
    // Actualizar secciones desde respuesta del chat
    // Cuando el usuario interactúa por chat, los
    // resultados también se reflejan en la UI
    // =============================================
    updateFromChatResponse(section, responseText) {
        switch(section) {
            case 'pendientes':
                this.displayTextResponse('pendientes-body', responseText, 'table-pendientes');
                break;
            case 'centinela':
                this.displayTextResponse('centinela-body', responseText, 'table-centinela');
                break;
            case 'patrones':
                document.getElementById('patrones-result').innerHTML = `
                    <div class="chart-card">
                        <div class="result-explanation">${this.formatResponseAsHtml(responseText)}</div>
                    </div>
                `;
                break;
            case 'dashboard':
                this.parseDashboardResponse(responseText);
                break;
        }
    },

    // =============================================
    // Mostrar respuesta de texto en una sección
    // =============================================
    displayTextResponse(containerId, text, tableId) {
        const container = document.getElementById(containerId);
        if (container) {
            // Si el texto contiene datos tabulares, intentar parsear
            // Si no, mostrar como texto formateado
            container.innerHTML = `<tr><td colspan="6"><div class="result-explanation">${this.formatResponseAsHtml(text)}</div></td></tr>`;
        }
    },

    // =============================================
    // Formatear respuesta del agente como HTML
    // =============================================
    formatResponseAsHtml(text) {
        if (!text) return '<em>Sin datos disponibles</em>';
        
        // Remover bloque [BUTTONS] si existe
        text = text.replace(/\[BUTTONS\][\s\S]*?\[\/BUTTONS\]/, '').trim();
        
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
            .replace(/^• /gm, '&bull; ')
            .replace(/^- /gm, '&bull; ');
    },

    // =============================================
    // Configurar botones de refresh
    // =============================================
    setupRefreshButtons() {
        // Botón refresh pendientes
        const btnPendientes = document.getElementById('btn-refresh-pendientes');
        if (btnPendientes) {
            btnPendientes.addEventListener('click', async () => {
                btnPendientes.disabled = true;
                btnPendientes.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
                
                const response = await API.getPendientes();
                if (response.success) {
                    this.updateFromChatResponse('pendientes', response.message);
                }
                
                btnPendientes.disabled = false;
                btnPendientes.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';
            });
        }

        // Botón refresh centinela
        const btnCentinela = document.getElementById('btn-refresh-centinela');
        if (btnCentinela) {
            btnCentinela.addEventListener('click', async () => {
                btnCentinela.disabled = true;
                btnCentinela.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
                
                const response = await API.getCentinela();
                if (response.success) {
                    this.updateFromChatResponse('centinela', response.message);
                }
                
                btnCentinela.disabled = false;
                btnCentinela.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';
            });
        }

        // Botón analizar patrones
        const btnPatrones = document.getElementById('btn-analyze-patrones');
        if (btnPatrones) {
            btnPatrones.addEventListener('click', async () => {
                btnPatrones.disabled = true;
                btnPatrones.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';
                
                const response = await API.analizarPatrones();
                if (response.success) {
                    this.updateFromChatResponse('patrones', response.message);
                }
                
                btnPatrones.disabled = false;
                btnPatrones.innerHTML = '<i class="fas fa-chart-bar"></i> Ejecutar Análisis';
            });
        }
    },

    // =============================================
    // Formulario de predicción
    // =============================================
    setupPredictForm() {
        const form = document.getElementById('predict-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Recoger datos del formulario
            const formData = new FormData(form);
            const datos = {};
            formData.forEach((value, key) => {
                datos[key] = value;
            });

            // Deshabilitar botón mientras procesa
            const submitBtn = form.querySelector('.btn-predict');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clasificando...';

            // Enviar a n8n para clasificar
            const response = await API.clasificarTransaccion(datos);

            // Mostrar resultado
            const resultDiv = document.getElementById('prediction-result');
            resultDiv.classList.remove('hidden');

            if (response.success) {
                this.displayPredictionResult(response.message);
            } else {
                document.getElementById('result-explanation').innerHTML = 
                    '<span style="color: var(--accent-red);">Error al clasificar: ' + response.message + '</span>';
            }

            // Restaurar botón
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-robot"></i> Clasificar Transacción';

            resultDiv.scrollIntoView({ behavior: 'smooth' });
        });
    },

    // =============================================
    // Mostrar resultado de predicción
    // =============================================
    displayPredictionResult(responseText) {
        // Intentar extraer probabilidad y nivel del texto
        const probMatch = responseText.match(/(\d+[.,]?\d*)\s*%/) || responseText.match(/probabilidad.*?(\d+[.,]?\d*)/i) || responseText.match(/0\.\d+/);
        const nivelMatch = responseText.match(/(CRÍTICO|ALTO|MEDIO|BAJO)/i);

        let prob = probMatch ? probMatch[1] || probMatch[0] : '??';
        let nivel = nivelMatch ? nivelMatch[1].toUpperCase() : 'EVALUANDO';

        // Determinar ícono y color según nivel
        let icon = '🔍';
        let color = 'var(--text-primary)';
        
        switch(nivel) {
            case 'CRÍTICO':
                icon = '🚨'; color = 'var(--risk-critical)'; break;
            case 'ALTO':
                icon = '⚠️'; color = 'var(--risk-high)'; break;
            case 'MEDIO':
                icon = '⚡'; color = 'var(--risk-medium)'; break;
            case 'BAJO':
                icon = '✅'; color = 'var(--risk-low)'; break;
        }

        document.getElementById('result-icon').textContent = icon;
        document.getElementById('result-level').textContent = `NIVEL ${nivel}`;
        document.getElementById('result-level').style.color = color;
        document.getElementById('result-prob').textContent = `Probabilidad: ${prob}`;

        // Mostrar explicación completa del agente
        const cleanResponse = responseText.replace(/\[BUTTONS\][\s\S]*?\[\/BUTTONS\]/, '').trim();
        document.getElementById('result-explanation').innerHTML = this.formatResponseAsHtml(cleanResponse);

        // Parsear botones de acción de la respuesta
        const parsed = Chat.parseResponse(responseText);
        if (parsed.buttons.length > 0) {
            const actionsDiv = document.getElementById('result-actions');
            actionsDiv.innerHTML = parsed.buttons.map(btn => 
                `<button class="action-btn" data-command="${btn.command}">${btn.label}</button>`
            ).join('');

            // Bind eventos
            actionsDiv.querySelectorAll('.action-btn').forEach(btnEl => {
                btnEl.addEventListener('click', () => {
                    Chat.sendUserMessage(btnEl.getAttribute('data-command'));
                });
            });
        }
    },

    // =============================================
    // Estado offline
    // =============================================
    setOfflineState() {
        document.getElementById('status-text').textContent = 'Sin conexión';
        document.querySelector('.status-dot').classList.add('offline');
    }
};

