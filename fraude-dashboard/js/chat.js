
/* ============================================
   CHAT.JS — Lógica del chat con n8n
   Incluye:
   - Envío/recepción de mensajes
   - Parser de [BUTTONS]...[/BUTTONS]
   - Botones de acción rápida
   - Actualización dinámica del contenido
   ============================================ */

const Chat = {
    messagesContainer: null,
    inputField: null,
    sendButton: null,
    isProcessing: false,

    // =============================================
    // Inicializar el chat
    // =============================================
    init() {
        this.messagesContainer = document.getElementById('chat-messages');
        this.inputField = document.getElementById('chat-input');
        this.sendButton = document.getElementById('chat-send');

        // Evento: enviar con botón
        this.sendButton.addEventListener('click', () => this.handleSend());

        // Evento: enviar con Enter
        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        // Eventos: botones de acción iniciales
        this.bindActionButtons();
    },

    // =============================================
    // Manejar envío de mensaje
    // =============================================
    async handleSend() {
        const text = this.inputField.value.trim();
        if (!text || this.isProcessing) return;

        this.sendUserMessage(text);
    },

    // =============================================
    // Enviar mensaje del usuario (desde input o botón)
    // =============================================
    async sendUserMessage(text) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        // Mostrar mensaje del usuario en el chat
        this.addMessage(text, 'user');
        this.inputField.value = '';

        // Mostrar indicador de "escribiendo..."
        const loadingId = this.showLoading();

        // Enviar a n8n
        try {
            const response = await API.sendChatMessage(text);
            this.removeLoading(loadingId);
            if (response.success) {
                const parsed = this.parseResponse(response.message);
                this.addMessage(parsed.text, 'bot', parsed.buttons);
                this.checkForDashboardUpdate(text, response.message);
            } else {
               this.addMessage('⚠️ ' + response.message, 'bot');
            }
        } catch (error) {
           console.error(error);
           this.removeLoading(loadingId);
           this.addMessage(
               '⚠️ Error de comunicación con el agente: ' + error.message,
               'bot'
           );
        } finally {
           this.isProcessing = false;
       }
    },

    // =============================================
    // Parser de respuesta: extrae [BUTTONS]...[/BUTTONS]
    // =============================================
    parseResponse(responseText) {
        let text = responseText;
        let buttons = [];

        // Buscar bloque [BUTTONS]...[/BUTTONS]
        const buttonsRegex = /\[BUTTONS\]([\s\S]*?)\[\/BUTTONS\]/;
        const match = text.match(buttonsRegex);

        if (match) {
            // Extraer el texto sin el bloque de botones
            text = text.replace(buttonsRegex, '').trim();

            // Parsear cada línea de botones
            const buttonsBlock = match[1].trim();
            const lines = buttonsBlock.split('\n').filter(line => line.trim());

            buttons = lines.map(line => {
                const parts = line.split('|');
                if (parts.length === 2) {
                    return {
                        label: parts[0].trim(),
                        command: parts[1].trim()
                    };
                }
                return null;
            }).filter(btn => btn !== null);
        }

        return { text, buttons };
    },

    // =============================================
    // Agregar mensaje al chat
    // =============================================
    addMessage(content, sender, buttons = []) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;

        // Contenido del mensaje (convertir markdown básico a HTML)
        const formattedContent = this.formatMessage(content);
        let html = `<div class="message-content">${formattedContent}</div>`;

        // Agregar botones si existen
        if (buttons.length > 0) {
            html += '<div class="message-buttons">';
            buttons.forEach(btn => {
                html += `<button class="action-btn" data-command="${this.escapeHtml(btn.command)}">${btn.label}</button>`;
            });
            html += '</div>';
        }

        messageDiv.innerHTML = html;
        this.messagesContainer.appendChild(messageDiv);

        // Scroll al final
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

        // Bind eventos a los nuevos botones
        messageDiv.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const command = btn.getAttribute('data-command');
                this.sendUserMessage(command);
            });
        });
    },

    // =============================================
    // Formatear mensaje (markdown básico → HTML)
    // =============================================
    formatMessage(text) {
        if (!text) return '';
        
        let formatted = text
            // Negritas **texto** o __texto__
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            // Cursivas *texto* o _texto_
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Saltos de línea
            .replace(/\n/g, '<br>')
            // Listas con •
            .replace(/^• /gm, '&bull; ')
            // Listas con -
            .replace(/^- /gm, '&bull; ');

        return formatted;
    },

    // =============================================
    // Indicador de "escribiendo..."
    // =============================================
    showLoading() {
        const id = 'loading-' + Date.now();
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-message bot';
        loadingDiv.id = id;
        loadingDiv.innerHTML = `
            <div class="message-content">
                <span class="loading">Analizando...</span>
            </div>
        `;
        this.messagesContainer.appendChild(loadingDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        return id;
    },

    removeLoading(id) {
        const element = document.getElementById(id);
        if (element) element.remove();
    },

    // =============================================
    // Bind de botones de acción (iniciales y nuevos)
    // =============================================
    bindActionButtons() {
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const command = btn.getAttribute('data-command');
                if (command) {
                    this.sendUserMessage(command);
                }
            });
        });
    },

    // =============================================
    // Verificar si la respuesta debe actualizar
    // alguna sección del dashboard
    // =============================================
    checkForDashboardUpdate(userMessage, botResponse) {
        const lower = userMessage.toLowerCase();

        // Si el usuario pidió pendientes, actualizar la sección
        if (lower.includes('pendientes')) {
            Dashboard.updateFromChatResponse('pendientes', botResponse);
        }
        // Si pidió centinela
        else if (lower.includes('centinela')) {
            Dashboard.updateFromChatResponse('centinela', botResponse);
        }
        // Si pidió patrones
        else if (lower.includes('patrones')) {
            Dashboard.updateFromChatResponse('patrones', botResponse);
        }
        // Si pidió resumen/estado
        else if (lower.includes('resumen') || lower.includes('estado')) {
            Dashboard.updateFromChatResponse('dashboard', botResponse);
        }
    },

    // =============================================
    // Utilidades
    // =============================================
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

