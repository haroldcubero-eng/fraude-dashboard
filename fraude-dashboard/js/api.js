
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
    // Todas las interacciones pasan por aquí:
    // - Chat del usuario
    // - Acciones de botones
    // - Solicitudes de datos del dashboard
    // =============================================
    async sendMessage(message, sessionId = null) {
        try {
            // Generar o reutilizar sessionId para mantener contexto
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
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            // n8n devuelve la respuesta en diferentes formatos
            // dependiendo de la configuración del Chat Trigger
            let output = '';
            if (typeof data === 'string') {
                output = data;
            } else if (data.output) {
                output = data.output;
            } else if (data.text) {
                output = data.text;
            } else if (data.response) {
                output = data.response;
            } else {
                output = JSON.stringify(data);
            }

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
    // Gestión de Session ID
    // Mantiene la conversación con contexto en n8n
    // =============================================
    getSessionId() {
        let sessionId = localStorage.getItem('fraud_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('fraud_session_id', sessionId);
        }
        return sessionId;
    },

    // Reiniciar sesión (nueva conversación)
    resetSession() {
        const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('fraud_session_id', newSessionId);
        return newSessionId;
    },

    // =============================================
    // Métodos de conveniencia para cada función
    // Todos envían mensajes al mismo webhook
    // =============================================

    // Solicitar datos del dashboard
    async getDashboardData() {
        return await this.sendMessage('mostrar resumen general del sistema');
    },

    // Consultar transacciones pendientes
    async getPendientes() {
        return await this.sendMessage('consultar pendientes');
    },

    // Clasificar una transacción
    async clasificarTransaccion(datos) {
        const mensaje = `clasificar transacción con los siguientes datos: ${JSON.stringify(datos)}`;
        return await this.sendMessage(mensaje);
    },

    // Validar una transacción
    async validarTransaccion(transactionId, decision, motivo, confianza) {
        const mensaje = `validar transacción ${transactionId} como ${decision}. Motivo: ${motivo}. Nivel de confianza: ${confianza}`;
        return await this.sendMessage(mensaje);
    },

    // Consultar alertas centinela
    async getCentinela() {
        return await this.sendMessage('consultar alertas centinela activas');
    },

    // Analizar patrones recientes
    async analizarPatrones() {
        return await this.sendMessage('analizar patrones recientes');
    },

    // Consultar detalle de una alerta
    async getAlertaDetalle(transactionId) {
        return await this.sendMessage(`consultar detalle de alerta ${transactionId}`);
    },

    // Buscar alertas similares
    async buscarSimilares(transactionId) {
        return await this.sendMessage(`buscar alertas similares a ${transactionId}`);
    },

    // Explicar clasificación
    async explicar(transactionId) {
        return await this.sendMessage(`explicar la clasificación de ${transactionId}`);
    },

    // =============================================
    // Verificar conexión con n8n
    // =============================================
    async checkConnection() {
        try {
            const result = await this.sendMessage('ping');
            return result.success;
        } catch {
            return false;
        }
    }
};

