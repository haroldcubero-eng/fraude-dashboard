
/* ============================================
   API.JS — Versión completa con getGraficos
   ============================================ */

const API = {
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
    // Extraer el texto de respuesta
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
    // MÉTODOS DASHBOARD — Prefijo [DASHBOARD]
    // =============================================

    async getDashboardData() {
        return await this.sendMessage('[DASHBOARD] resumen general');
    },

    async getPendientes() {
        return await this.sendMessage('[DASHBOARD] pendientes');
    },

    async getCentinela() {
        return await this.sendMessage('[DASHBOARD] centinela');
    },

    async analizarPatrones() {
        return await this.sendMessage('[DASHBOARD] patrones');
    },

    // NUEVO: Datos para gráficos
    async getGraficos() {
        return await this.sendMessage('[DASHBOARD] graficos');
    },

    // =============================================
    // MÉTODOS CONVERSACIONALES — Sin prefijo
    // =============================================

    async clasificarTransaccion(datos) {
        const mensaje = `clasificar transacción con los siguientes datos: ${JSON.stringify(datos)}`;
        return await this.sendMessage(mensaje);
    },

    async validarTransaccion(transactionId, decision, motivo, confianza) {
        const mensaje = `validar transacción ${transactionId} como ${decision}. Motivo: ${motivo}. Nivel de confianza: ${confianza}`;
        return await this.sendMessage(mensaje);
    },

    async getAlertaDetalle(transactionId) {
        return await this.sendMessage(`consultar detalle de alerta ${transactionId}`);
    },

    async buscarSimilares(transactionId) {
        return await this.sendMessage(`buscar alertas similares a ${transactionId}`);
    },

    async explicar(transactionId) {
        return await this.sendMessage(`explicar la clasificación de ${transactionId}`);
    },

    // =============================================
    // Verificar conexión
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

