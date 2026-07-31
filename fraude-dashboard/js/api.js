
/* ============================================
   API.JS — Versión con webhook separado
   Dashboard: Code Node determinístico (sin LLM)
   Chat: AI Agent con Gemini (conversacional)
   ============================================ */

const API = {
    // URL para datos del dashboard (Code Node - determinístico)
    dashboardUrl: 'https://danielperez.app.n8n.cloud/webhook/dashboard-data',

    // URL para chat conversacional (AI Agent - Gemini)
    chatUrl: 'https://danielperez.app.n8n.cloud/webhook/73b0c003-c74e-4e6a-b99e-44477979e8e2/chat',

    // =============================================
    // Enviar comando al dashboard (determinístico)
    // =============================================
    async sendDashboardCommand(comando) {
        try {
            const response = await fetch(this.dashboardUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatInput: '[DASHBOARD] ' + comando })
            });

            if (!response.ok) {
                return { success: false, message: 'Error HTTP: ' + response.status };
            }

            const data = await response.json();
            // El Code Node devuelve { output: "JSON string" }
            const output = data.output || data;
            return { success: true, message: typeof output === 'string' ? output : JSON.stringify(output) };
        } catch (error) {
            console.error('Error dashboard:', error);
            return { success: false, message: 'Error de conexión: ' + error.message };
        }
    },

    // =============================================
    // Enviar mensaje al chat (conversacional)
    // =============================================
    async sendChatMessage(message) {
        try {
            const response = await fetch(this.chatUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatInput: message, sessionId: "dashboard-user" })
            });

            if (!response.ok) {
                return { success: false, message: 'Error HTTP: ' + response.status };
            }

            const data = await response.json();
            const output = data.output || data.response || data.text || JSON.stringify(data);
            return { success: true, message: typeof output === 'string' ? output : JSON.stringify(output) };
        } catch (error) {
            console.error('Error chat:', error);
            return { success: false, message: 'Error de conexión: ' + error.message };
        }
    },

    // =============================================
    // Funciones específicas del dashboard
    // Todas usan el webhook determinístico
    // =============================================
    async getDashboardData() {
        return await this.sendDashboardCommand('resumen general');
    },

    async getPendientes() {
        return await this.sendDashboardCommand('pendientes');
    },

    async getCentinela() {
        return await this.sendDashboardCommand('centinela');
    },

    async analizarPatrones() {
        return await this.sendDashboardCommand('patrones');
    },

    // =============================================
    // Funciones del chat conversacional
    // Usan el AI Agent con Gemini
    // =============================================
    async clasificarTransaccion(datos) {
        const campos = Object.entries(datos).map(([k, v]) => k + ': ' + v).join(', ');
        return await this.sendChatMessage('clasificar transacción con estos datos: ' + campos);
    },
    
    async clasificarTransaccion(datos) {
       const mensaje = `
    clasificar transaccion usando exactamente este JSON.
    No modifiques nombres de campos ni valores.
    Envia este objeto a la herramienta predecir:
   
    ${JSON.stringify(datos, null, 2)}
    `;

       return await this.sendChatMessage(mensaje);
    },

    async explicarAlerta(transactionId) {
        return await this.sendChatMessage('explicar alerta de transacción ' + transactionId);
    },

    async buscarSimilares(transactionId) {
        return await this.sendChatMessage('buscar alertas similares a transacción ' + transactionId);
    }
};

