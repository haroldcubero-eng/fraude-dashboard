
/* ============================================
   DASHBOARD.JS — Versión final
   Gráficos calculados desde [DASHBOARD] resumen general
   No depende del campo "hour" en pendientes.
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

        // CARGA AUTOMÁTICA al iniciar
        this.autoLoadData();

        // Auto-refresh cada 5 minutos
        this.refreshInterval = setInterval(() => {
            this.autoLoadData();
        }, 300000);
    },

    // =============================================
    // Carga automática de datos al iniciar
    // =============================================
    async autoLoadData() {
        document.getElementById('status-text').textContent = 'Conectando...';

        // 1. Resumen general (KPIs + gráficos)
        const dashResponse = await API.getDashboardData();
        if (dashResponse.success) {
            this.processDashboardResponse(dashResponse.message);
            document.getElementById('status-text').textContent = 'Sistema Operativo';
            document.querySelector('.status-dot').classList.remove('offline');
        } else {
            this.setOfflineState();
            return;
        }

        // 2. Pendientes (tabla de alertas)
        const pendResponse = await API.getPendientes();
        if (pendResponse.success) {
            this.processPendientesResponse(pendResponse.message);
        }

        // 3. Centinela
        const centResponse = await API.getCentinela();
        if (centResponse.success) {
            this.processCentinelaResponse(centResponse.message);
        }
    },

    // =============================================
    // Procesar respuesta del resumen general
    // Incluye KPIs + datos para gráficos
    // =============================================
    processDashboardResponse(responseText) {
        let data = this.tryParseJSON(responseText);

        if (data) {
            // KPIs
            if (data.pendientes !== undefined) {
                document.getElementById('kpi-pendientes').textContent = data.pendientes;
            }
            if (data.tasa_fraude !== undefined) {
                document.getElementById('kpi-tasa-fraude').textContent = data.tasa_fraude + '%';
            }
            if (data.total_transacciones !== undefined) {
                document.getElementById('kpi-total').textContent = data.total_transacciones;
            }
            if (data.centinela !== undefined) {
                document.getElementById('kpi-centinela').textContent = data.centinela;
            }
            if (data.desacuerdos !== undefined) {
                this.updateRetrainIndicator(data.desacuerdos, data.estado_modelo);
            }
            this.updateModelHealth(data.estado_modelo);

            // *** GRÁFICOS desde el resumen general ***
            if (data.distribucion_riesgo) {
                this.renderRiskChart(data.distribucion_riesgo);
            }
            if (data.alertas_por_hora && Array.isArray(data.alertas_por_hora) && data.alertas_por_hora.length > 0) {
                this.renderHourlyChart(data.alertas_por_hora);
            }
        } else {
            this.extractMetricsFromText(responseText);
        }
    },

    // =============================================
    // Procesar respuesta de pendientes (solo tabla)
    // =============================================
    processPendientesResponse(responseText) {
        let data = this.tryParseJSON(responseText);

        const alertasBody = document.getElementById('alertas-body');
        const pendientesBody = document.getElementById('pendientes-body');

        if (data && data.transacciones && Array.isArray(data.transacciones)) {
            const rows = data.transacciones.map(t => `
                <tr>
                    <td><strong>${t.transaction_id}</strong></td>
                    <td>$${parseFloat(t.transaction_amt).toFixed(2)}</td>
                    <td>${(t.probabilidad_fraude * 100).toFixed(1)}%</td>
                    <td><span class="badge badge-${this.getBadgeClass(t.nivel_riesgo)}">${t.nivel_riesgo}</span></td>
                    <td><span class="badge badge-pending">PENDIENTE</span></td>
                    <td>${t.hour !== undefined && t.hour !== null ? t.hour.toString().padStart(2, '0') + ':00' : '-'}</td>
                    <td>
                        <button class="btn-detalle" onclick="Dashboard.verDetalle('${t.transaction_id}')">🔍 Detalles</button>
                        <button class="action-btn" onclick="Dashboard.validarDesdeTabla('${t.transaction_id}', 'fraude')">🚨 Fraude</button>
                        <button class="action-btn" onclick="Dashboard.validarDesdeTabla('${t.transaction_id}', 'legitima')">❌ Legítima</button>
                    </td>
                </tr>
            `).join('');

            if (alertasBody) alertasBody.innerHTML = rows;
            if (pendientesBody) pendientesBody.innerHTML = rows;
            document.getElementById('kpi-pendientes').textContent = data.total || data.transacciones.length;

        } else {
            const html = `<tr><td colspan="7"><div class="result-explanation">${this.formatResponseAsHtml(responseText)}</div></td></tr>`;
            if (alertasBody) alertasBody.innerHTML = html;
            if (pendientesBody) pendientesBody.innerHTML = html;
        }
    },

    // =============================================
    // Procesar respuesta de centinela
    // =============================================
    processCentinelaResponse(responseText) {
        let data = this.tryParseJSON(responseText);
        const centinelaBody = document.getElementById('centinela-body');

        if (data && data.alertas && Array.isArray(data.alertas)) {
            const rows = data.alertas.map(a => `
                <tr>
                    <td><strong>${a.tipo_alerta}</strong></td>
                    <td>${a.tarjetas_distintas}</td>
                    <td>${a.valor_compartido}</td>
                    <td>${a.primera_deteccion}</td>
                    <td><span class="badge badge-critical">${a.estado ? a.estado.toUpperCase() : 'ACTIVA'}</span></td>
                </tr>
            `).join('');

            if (centinelaBody) centinelaBody.innerHTML = rows;
            document.getElementById('kpi-centinela').textContent = data.total || data.alertas.length;
        } else if (data && data.total === 0) {
            if (centinelaBody) {
                centinelaBody.innerHTML = `<tr><td colspan="5"><div class="result-explanation">✅ No hay campañas centinela activas en este momento.</div></td></tr>`;
            }
            document.getElementById('kpi-centinela').textContent = '0';
        } else {
            if (centinelaBody) {
                centinelaBody.innerHTML = `<tr><td colspan="5"><div class="result-explanation">${this.formatResponseAsHtml(responseText)}</div></td></tr>`;
            }
        }
    },
    
    // =============================================
    // Renderizar gráfico de distribución de riesgo
    // =============================================
    renderRiskChart(distribucion) {
        const canvas = document.getElementById('chart-riesgo');
        if (!canvas) return;

        // Destruir gráfico anterior si existe
        if (this.charts.riesgo) {
            this.charts.riesgo.destroy();
        }

        const labels = [];
        const values = [];
        const colors = [];

        const colorMap = {
            'CRITICO': '#dc2626',
            'ALTO': '#f59e0b',
            'MEDIO': '#3b82f6',
            'BAJO': '#10b981'
        };

        Object.keys(distribucion).forEach(nivel => {
            if (distribucion[nivel] > 0) {
                labels.push(nivel);
                values.push(distribucion[nivel]);
                colors.push(colorMap[nivel] || '#6b7280');
            }
        });

        const ctx = canvas.getContext('2d');
        this.charts.riesgo = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderColor: '#1a1f2e',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            padding: 15,
                            font: { size: 12 }
                        }
                    },
                    datalabels: {
                        color: '#ffffff',
                        font: {
                            weight: 'bold',
                            size: 11
                        },
                        formatter: function(value, context) {
                            var total = context.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                            var percentage = Math.round((value / total) * 100);
                            return value + ' (' + percentage + '%)';
                        },
                        anchor: 'center',
                        align: 'center'
                    }
                },
                cutout: '60%'
            },
            plugins: [ChartDataLabels]
        });
    },

    // =============================================
    // Renderizar gráfico de alertas por hora
    // =============================================
    renderHourlyChart(alertasPorHora) {
        const canvas = document.getElementById('chart-horas');
        if (!canvas) return;

        // Destruir gráfico anterior si existe
        if (this.charts.horas) {
            this.charts.horas.destroy();
        }

        const labels = alertasPorHora.map(item => item.hora);
        const values = alertasPorHora.map(item => item.cantidad);

        const maxVal = Math.max(...values);
        const colors = values.map(v => {
            const ratio = maxVal > 0 ? v / maxVal : 0;
            if (ratio > 0.75) return '#dc2626';
            if (ratio > 0.5) return '#f59e0b';
            if (ratio > 0.25) return '#3b82f6';
            return '#10b981';
        });

        const ctx = canvas.getContext('2d');
        this.charts.horas = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Alertas',
                    data: values,
                    backgroundColor: colors,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                        ticks: { color: '#94a3b8', font: { size: 10 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                        ticks: { color: '#94a3b8', stepSize: 1 }
                    }
                }
            }
        });
    },

    // =============================================
    // Validar desde la tabla
    // =============================================
    validarDesdeTabla(transactionId, decision) {
        Chat.sendUserMessage(`validar transacción ${transactionId} como ${decision}`);
    },
    // 👇 AGREGAR AQUÍ 👇
    verDetalle(transactionId) {
        const chatInput = document.getElementById('chat-input');
        const chatForm = document.getElementById('chat-form');
        if (chatInput && chatForm) {
            chatInput.value = `consultar detalle de alerta ${transactionId}`;
            chatForm.dispatchEvent(new Event('submit'));
        }
    },
 
    // =============================================
    // Intentar parsear JSON
    // =============================================
    tryParseJSON(text) {
        if (!text) return null;

        try { return JSON.parse(text); } catch (e) {}

        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            try { return JSON.parse(codeBlockMatch[1].trim()); } catch (e) {}
        }

        const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
            try { return JSON.parse(jsonMatch[1]); } catch (e) {}
        }

        return null;
    },

    // =============================================
    // Fallback: extraer métricas del texto
    // =============================================
    extractMetricsFromText(text) {
        const pendMatch = text.match(/(\d+)\s*(alertas?\s*pendientes?|transacciones?\s*pendientes?|pendientes?)/i);
        if (pendMatch) document.getElementById('kpi-pendientes').textContent = parseInt(pendMatch[1]);

        const tasaMatch = text.match(/tasa.*?(\d+[.,]?\d*)\s*%/i) || text.match(/(\d+[.,]?\d*)\s*%.*?fraude/i);
        if (tasaMatch) document.getElementById('kpi-tasa-fraude').textContent = parseFloat(tasaMatch[1].replace(',', '.')) + '%';

        const totalMatch = text.match(/(\d+)\s*transacciones?\s*totales?/i) || text.match(/total.*?(\d+)\s*transacciones?/i);
        if (totalMatch) document.getElementById('kpi-total').textContent = parseInt(totalMatch[1]);

        const centMatch = text.match(/(\d+)\s*(campañas?|alertas?\s*centinela)/i);
        if (centMatch) document.getElementById('kpi-centinela').textContent = parseInt(centMatch[1]);

        const desMatch = text.match(/(\d+)\s*(desacuerdos?|FP|FN)/i);
        if (desMatch) this.updateRetrainIndicator(parseInt(desMatch[1]), null);
    },

    // =============================================
    // Indicador de reentrenamiento
    // =============================================
    updateRetrainIndicator(desacuerdos, estadoModelo) {
        const indicator = document.getElementById('retrain-indicator');
        const detail = document.getElementById('retrain-detail');
        const progress = document.getElementById('retrain-progress');
        const umbral = 10;

        if (!indicator || !detail || !progress) return;

        if (desacuerdos === null || desacuerdos === undefined) {
            if (estadoModelo) {
                this.setRetrainByStatus(estadoModelo, detail, progress, indicator);
            } else {
                detail.textContent = 'Evaluando estado del modelo...';
                progress.style.width = '0%';
            }
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

    setRetrainByStatus(estado, detail, progress, indicator) {
        switch(estado) {
            case 'reentrenamiento':
                indicator.className = 'retrain-indicator critical';
                detail.textContent = '⚠️ SE RECOMIENDA REENTRENAMIENTO';
                progress.style.width = '100%';
                progress.style.background = '#dc2626';
                break;
            case 'observacion':
                indicator.className = 'retrain-indicator warning';
                detail.textContent = 'Modelo en observación';
                progress.style.width = '70%';
                progress.style.background = '#f59e0b';
                break;
            default:
                indicator.className = 'retrain-indicator';
                detail.textContent = 'Modelo estable ✓';
                progress.style.width = '30%';
                progress.style.background = '#10b981';
        }
    },

    // =============================================
    // Actualizar estado del modelo en sidebar
    // =============================================
    updateModelHealth(estado) {
        const modelHealth = document.getElementById('model-health');
        if (!modelHealth) return;

        if (estado === 'reentrenamiento') {
            modelHealth.innerHTML = '<i class="fas fa-brain"></i><span class="nav-text">Modelo: Reentrenar</span>';
            modelHealth.style.color = '#dc2626';
        } else if (estado === 'observacion') {
            modelHealth.innerHTML = '<i class="fas fa-brain"></i><span class="nav-text">Modelo: Observación</span>';
            modelHealth.style.color = '#f59e0b';
        } else {
            modelHealth.innerHTML = '<i class="fas fa-brain"></i><span class="nav-text">Modelo: OK</span>';
            modelHealth.style.color = '#10b981';
        }
    },

    // =============================================
    // Actualizar secciones desde respuesta del chat
    // =============================================
    updateFromChatResponse(section, responseText) {
        switch(section) {
            case 'pendientes': this.processPendientesResponse(responseText); break;
            case 'centinela': this.processCentinelaResponse(responseText); break;
            case 'patrones': this.processPatternsResponse(responseText); break;
            case 'dashboard': this.processDashboardResponse(responseText); break;
        }
    },

    // =============================================
    // Procesar respuesta de patrones
    // =============================================
    processPatternsResponse(responseText) {
        let data = this.tryParseJSON(responseText);
        const container = document.getElementById('patrones-result');
        if (!container) return;

        if (data) {
            container.innerHTML = `
                <div class="chart-card">
                    <h4>📈 Análisis de Patrones</h4>
                    <p><strong>Total alertas analizadas:</strong> ${data.total_alertas || 'N/A'}</p>
                    <p><strong>Concentración horaria:</strong> ${data.concentracion_horaria || 'N/A'}</p>
                    <p><strong>Tendencia:</strong> ${data.tendencia || 'N/A'}</p>
                    <p><strong>Campañas centinela activas:</strong> ${data.centinela_activas || 0}</p>
                    <h4>🧠 Hipótesis</h4>
                    <p>${data.hipotesis || 'Sin hipótesis disponible'}</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="chart-card">
                    <div class="result-explanation">${this.formatResponseAsHtml(responseText)}</div>
                </div>
            `;
        }
    },

    // =============================================
    // Obtener clase CSS para badge
    // =============================================
    getBadgeClass(nivel) {
        if (!nivel) return 'medium';
        const n = nivel.toUpperCase().replace('Í', 'I');
        switch(n) {
            case 'CRITICO': return 'critical';
            case 'ALTO': return 'high';
            case 'MEDIO': return 'medium';
            case 'BAJO': return 'low';
            default: return 'medium';
        }
    },

    // =============================================
    // Formatear respuesta como HTML (fallback)
    // =============================================
    formatResponseAsHtml(text) {
        if (!text) return '<em>Sin datos disponibles</em>';
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
        const btnPendientes = document.getElementById('btn-refresh-pendientes');
        if (btnPendientes) {
            btnPendientes.addEventListener('click', async () => {
                btnPendientes.disabled = true;
                btnPendientes.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
                const response = await API.getPendientes();
                if (response.success) this.processPendientesResponse(response.message);
                btnPendientes.disabled = false;
                btnPendientes.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';
            });
        }

        const btnCentinela = document.getElementById('btn-refresh-centinela');
        if (btnCentinela) {
            btnCentinela.addEventListener('click', async () => {
                btnCentinela.disabled = true;
                btnCentinela.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
                const response = await API.getCentinela();
                if (response.success) this.processCentinelaResponse(response.message);
                btnCentinela.disabled = false;
                btnCentinela.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';
            });
        }

        const btnPatrones = document.getElementById('btn-analyze-patrones');
        if (btnPatrones) {
            btnPatrones.addEventListener('click', async () => {
                btnPatrones.disabled = true;
                btnPatrones.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';
                const response = await API.analizarPatrones();
                if (response.success) this.processPatternsResponse(response.message);
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
            formData.forEach((value, key) => { datos[key] = value; });

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
        
        switch(nivel.replace('Í', 'I')) {
            case 'CRITICO': icon = '🚨'; color = 'var(--risk-critical)'; break;
            case 'ALTO': icon = '⚠️'; color = 'var(--risk-high)'; break;
            case 'MEDIO': icon = '⚡'; color = 'var(--risk-medium)'; break;
            case 'BAJO': icon = '✅'; color = 'var(--risk-low)'; break;
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
        const modelHealth = document.getElementById('model-health');
        if (modelHealth) {
            modelHealth.innerHTML = '<i class="fas fa-brain"></i><span class="nav-text">Modelo: Offline</span>';
            modelHealth.style.color = '#ef4444';
        }
    }
};
