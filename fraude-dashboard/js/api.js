
/* ============================================
   API.JS — Módulo de conexión con n8n
   Todo el tráfico de datos pasa por el webhook
   de n8n. No hay conexión directa a Supabase.
   ============================================ */

const API = {
    // =============================================
    // URL del webhook del Chat Trigger en n8n
    // Este es el ÚNICO punto de entrada al backend
    // =============================================
    WEBHOOK_URL: 'https://danielperez.app.n8n.cloud/webhook/73b0c003-c74e-4e6a-b99e-44477979e8e2/chat',

    // =============================================
    // Enviar mensaje al agente de n8n
    // =============================================
    async sendMessage(message, sessionId = null) {
        try {
            if (!sessionId) {
                sessionId = API.getSessionId();
            }

            const payload = {
                action: 'sendMessage',
                sessionId: sessionId,
                chatInput: message
            };

            const response = await fetch(this.WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            let output = this.extractOutput(data);

            return {
                success: true,
                message: output,
                raw: data
            };

        } catch (error) {
            console.error('Error al comunicarse con n8n:', error);
            return {
                success: false,
                message: 'Error de conexión con el servidor. Verifica que n8n esté activo.',
                error: error.message
            };
        }
    },

    // =============================================
    // Extraer el texto de respuesta del agente
    // =============================================
    extractOutput(data) {
        if (typeof data === 'string') return data;
        if (data.output) return data.output;
        if (data.text) return data.text;
        if (data.response) return data.response;
        if (data.message) return data.message;
        if (data.result) return data.result;
        if (Array.isArray(data) && data.length > 0) {
            const first = data[0];
            if (first.output) return first.output;
            if (first.text) return first.text;
            if (first.response) return first.response;
        }
        return JSON.stringify(data);
    },

    // =============================================
    // Gestión de Session ID
    // =============================================
    getSessionId() {
        let sessionId = localStorage.getItem('fraud_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('fraud_session_id', sessionId);
        }
        return sessionId;
    },

    resetSession() {
        const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('fraud_session_id', newSessionId);
        return newSessionId;
    },

    // =============================================
    // MÉTODOS DASHBOARD — Usan prefijo [DASHBOARD]
    // El agente responde con JSON estructurado
    // =============================================

    // Solicitar resumen general (KPIs)
    async getDashboardData() {
        return await this.sendMessage('[DASHBOARD] resumen general');
    },

    // Consultar transacciones pendientes (tabla)
    async getPendientes() {
        return await this.sendMessage('[DASHBOARD] pendientes');
    },

    // Consultar alertas centinela (tabla)
    async getCentinela() {
        return await this.sendMessage('[DASHBOARD] centinela');
    },

    // Analizar patrones recientes
    async analizarPatrones() {
        return await this.sendMessage('[DASHBOARD] patrones');
    },

    // =============================================
    // MÉTODOS CONVERSACIONALES — Sin prefijo
    // El agente responde de forma natural con flujos
    // =============================================

    // Clasificar una transacción (conversacional)
    async clasificarTransaccion(datos) {
        const mensaje = `clasificar transacción con los siguientes datos: ${JSON.stringify(datos)}`;
        return await this.sendMessage(mensaje);
    },

    // Validar una transacción (conversacional)
    async validarTransaccion(transactionId, decision, motivo, confianza) {
        const mensaje = `validar transacción ${transactionId} como ${decision}. Motivo: ${motivo}. Nivel de confianza: ${confianza}`;
        return await this.sendMessage(mensaje);
    },

    // Consultar detalle de una alerta (conversacional)
    async getAlertaDetalle(transactionId) {
        return await this.sendMessage(`consultar detalle de alerta ${transactionId}`);
    },

    // Buscar alertas similares (conversacional)
    async buscarSimilares(transactionId) {
        return await this.sendMessage(`buscar alertas similares a ${transactionId}`);
    },

    // Explicar clasificación (conversacional)
    async explicar(transactionId) {
        return await this.sendMessage(`explicar la clasificación de ${transactionId}`);
    },

    // =============================================
    // Verificar conexión con n8n
    // =============================================
    async checkConnection() {
        try {
            const result = await this.sendMessage('[DASHBOARD] resumen general');
            return result.success;
        } catch {
            return false;
        }
    }
};

