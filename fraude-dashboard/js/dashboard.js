
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
        this.setupRefreshButtons();
        this.setupPredictForm();

        // CARGA AUTOMÁTICA: Solicitar datos al iniciar
        this.autoLoadData();

        // Auto-refresh cada 5 minutos
        this.refreshInterval = setInterval(() => {
            this.autoLoadData();
        }, 300000);
    },

    // =============================================
    // Carga automática de datos al iniciar
    // Hace las peticiones necesarias a n8n
    // =============================================
    async autoLoadData() {
        // Actualizar estado de conexión
        document.getElementById('status-text').textContent = 'Conectando...';

        // 1. Solicitar resumen general (para KPIs)
        const dashResponse = await API.getDashboardData();
        if (dashResponse.success) {
            this.parseDashboardResponse(dashResponse.message);
            document.getElementById('status-text').textContent = 'Sistema Operativo';
            document.querySelector('.status-dot').classList.remove('offline');
        } else {
            this.setOfflineState();
            return; // Si no hay conexión, no seguir pidiendo datos
        }

        // 2. Solicitar pendientes (para tabla de alertas y KPI)
        const pendResponse = await API.getPendientes();
        if (pendResponse.success) {
            this.parsePendientesResponse(pendResponse.message);
        }

        // 3. Solicitar alertas centinela
        const centResponse = await API.getCentinela();
        if (centResponse.success) {
            this.parseCentinelaResponse(centResponse.message);
        }
    },

    // =============================================
    // Parsear respuesta del dashboard para KPIs
    // =============================================
    parseDashboardResponse(responseText) {
        const metrics = this.extractMetrics(responseText);
        
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

        // Mostrar la respuesta completa en el área de patrones como contexto
        this.updateDashboardSummary(responseText);
    },

    // =============================================
    // Parsear respuesta de pendientes
    // Llena la tabla de alertas y la sección pendientes
    // =============================================
    parsePendientesResponse(responseText) {
        // Actualizar tabla en sección Dashboard (últimas alertas)
        const alertasBody = document.getElementById('alertas-body');
        if (alertasBody) {
            alertasBody.innerHTML = `<tr><td colspan="6"><div class="result-explanation">${this.formatResponseAsHtml(responseText)}</div></td></tr>`;
        }

        // Actualizar tabla en sección Pendientes
        const pendientesBody = document.getElementById('pendientes-body');
        if (pendientesBody) {
            pendientesBody.innerHTML = `<tr><td colspan="6"><div class="result-explanation">${this.formatResponseAsHtml(responseText)}</div></td></tr>`;
        }

        // Intentar extraer conteo de pendientes para KPI
        const countMatch = responseText.match(/(\d+)\s*(transacciones?|alertas?)\s*(pendientes?)/i);
        if (countMatch) {
            document.getElementById('kpi-pendientes').textContent = countMatch[1];
        }
    },

    // =============================================
    // Parsear respuesta de centinela
    // =============================================
    parseCentinelaResponse(responseText) {
        // Actualizar tabla centinela
        const centinelaBody = document.getElementById('centinela-body');
        if (centinelaBody) {
            centinelaBody.innerHTML = `<tr><td colspan="5"><div class="result-explanation">${this.formatResponseAsHtml(responseText)}</div></td></tr>`;
        }

        // Intentar extraer conteo para KPI
        const countMatch = responseText.match(/(\d+)\s*(campañas?|alertas?\s*centinela)/i);
        if (countMatch) {
            document.getElementById('kpi-centinela').textContent = countMatch[1];
        }
    },

    // =============================================
    // Mostrar resumen del dashboard
    // =============================================
    updateDashboardSummary(responseText) {
        // Si hay información del estado general, mostrarla
        const cleanText = this.formatResponseAsHtml(responseText);
        
        // Actualizar el modelo health en el sidebar
        const modelHealth = document.getElementById('model-health');
        if (responseText.toLowerCase().includes('operativo') || responseText.toLowerCase().includes('estable') || responseText.toLowerCase().includes('ok')) {
            modelHealth.innerHTML = '<i class="fas fa-brain"></i><span class="nav-text">Modelo: OK</span>';
            modelHealth.style.color = '#10b981';
        }
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
        
        const umbral = 10;
        
        if (desacuerdos === null) {
            detail.textContent = 'Evaluando estado del modelo...';
            progress.style.width = '0%';
            return;
        }

        const porcentaje = Math.min((desacuerdos / umbral) * 100, 100);
        progress.style.width = porcentaje + '%';

        if (desacuerdos >= umbral) {
            indicator.className = 'retrain-indicator critical';
            detail.textContent = `⚠️ SE RECOMIENDA REENTRENAMIENTO — ${desacuerdos} desacuerdos acumulados (umbral: ${umbral})`;
            progress.style.background = '#dc2626';
        } else if (desacuerdos >= umbral * 0.7) {
            indicator.className = 'retrain-indicator warning';
            detail.textContent = `${desacuerdos}/${umbral} desacuerdos acumulados — Modelo en observación`;
            progress.style.background = '#f59e0b';
        } else {
            indicator.className = 'retrain-indicator';
            detail.textContent = `${desacuerdos}/${umbral} desacuerdos — Modelo estable ✓`;
            progress.style.background = '#10b981';
        }
    },

    // =============================================
    // Actualizar secciones desde respuesta del chat
    // =============================================
    updateFromChatResponse(section, responseText) {
        switch(section) {
            case 'pendientes':
                this.parsePendientesResponse(responseText);
                break;
            case 'centinela':
                this.parseCentinelaResponse(responseText);
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
                    this.parsePendientesResponse(response.message);
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
                    this.parseCentinelaResponse(response.message);
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

            const formData = new FormData(form);
            const datos = {};
            formData.forEach((value, key) => {
                datos[key] = value;
            });

            const submitBtn = form.querySelector('.btn-predict');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clasificando...';

            const response = await API.clasificarTransaccion(datos);

            const resultDiv = document.getElementById('prediction-result');
            resultDiv.classList.remove('hidden');

            if (response.success) {
                this.displayPredictionResult(response.message);
            } else {
                document.getElementById('result-explanation').innerHTML = 
                    '<span style="color: var(--accent-red);">Error al clasificar: ' + response.message + '</span>';
            }

            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-robot"></i> Clasificar Transacción';

            resultDiv.scrollIntoView({ behavior: 'smooth' });
        });
    },

    // =============================================
    // Mostrar resultado de predicción
    // =============================================
    displayPredictionResult(responseText) {
        const probMatch = responseText.match(/(\d+[.,]?\d*)\s*%/) || responseText.match(/probabilidad.*?(\d+[.,]?\d*)/i) || responseText.match(/0\.\d+/);
        const nivelMatch = responseText.match(/(CR[ÍI]TICO|ALTO|MEDIO|BAJO)/i);

        let prob = probMatch ? probMatch[1] || probMatch[0] : '??';
        let nivel = nivelMatch ? nivelMatch[1].toUpperCase() : 'EVALUANDO';

        let icon = '🔍';
        let color = 'var(--text-primary)';
        
        switch(nivel) {
            case 'CRÍTICO':
            case 'CRITICO':
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

        const cleanResponse = responseText.replace(/\[BUTTONS\][\s\S]*?\[\/BUTTONS\]/, '').trim();
        document.getElementById('result-explanation').innerHTML = this.formatResponseAsHtml(cleanResponse);

        const parsed = Chat.parseResponse(responseText);
        if (parsed.buttons.length > 0) {
            const actionsDiv = document.getElementById('result-actions');
            actionsDiv.innerHTML = parsed.buttons.map(btn => 
                `<button class="action-btn" data-command="${btn.command}">${btn.label}</button>`
            ).join('');

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
        document.getElementById('model-health').innerHTML = '<i class="fas fa-brain"></i><span class="nav-text">Modelo: Offline</span>';
        document.getElementById('model-health').style.color = '#ef4444';
    }
};

