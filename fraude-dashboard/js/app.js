
/* ============================================
   APP.JS — Inicialización y navegación
   Versión de producción (reemplaza la demo)
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
    
    // =============================================
    // 1. NAVEGACIÓN DEL MENÚ LATERAL
    // =============================================
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetSection = this.getAttribute('data-section');
            
            // Remover active de todos
            navItems.forEach(nav => nav.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));
            
            // Activar el seleccionado
            this.classList.add('active');
            const sectionEl = document.getElementById('section-' + targetSection);
            if (sectionEl) {
                sectionEl.classList.add('active');
            }
        });
    });

    // =============================================
    // 2. TOGGLE DEL MENÚ LATERAL (móvil/manual)
    // =============================================
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    
    menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('expanded');
    });

    // Cerrar sidebar al hacer click fuera (móvil)
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 1024) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('expanded');
            }
        }
    });

    // =============================================
    // 3. MINIMIZAR/EXPANDIR CHAT
    // =============================================
    const chatMinimize = document.getElementById('chat-minimize');
    const chatPanel = document.getElementById('chat-panel');
    
    chatMinimize.addEventListener('click', function() {
        chatPanel.classList.toggle('minimized');
        
        // Cambiar ícono
        const icon = chatMinimize.querySelector('i');
        if (chatPanel.classList.contains('minimized')) {
            icon.className = 'fas fa-chevron-left';
        } else {
            icon.className = 'fas fa-chevron-right';
        }
    });

    // =============================================
    // 4. INICIALIZAR MÓDULOS
    // =============================================
    
    // Inicializar Chat
    Chat.init();
    
    // Inicializar Dashboard
    Dashboard.init();

    // =============================================
    // 5. VERIFICAR CONEXIÓN CON n8n
    // =============================================
    checkSystemStatus();
});

// =============================================
// Verificar estado del sistema al cargar
// =============================================
async function checkSystemStatus() {
    const statusText = document.getElementById('status-text');
    const statusDot = document.querySelector('.status-dot');
    const modelHealth = document.getElementById('model-health');

    statusText.textContent = 'Conectando...';

    const isConnected = await API.checkConnection();

    if (isConnected) {
        statusText.textContent = 'Sistema Operativo';
        statusDot.classList.remove('offline');
        modelHealth.innerHTML = '<i class="fas fa-brain"></i><span class="nav-text">Modelo: OK</span>';
        modelHealth.style.color = '#10b981';
    } else {
        statusText.textContent = 'Sin conexión';
        statusDot.classList.add('offline');
        modelHealth.innerHTML = '<i class="fas fa-brain"></i><span class="nav-text">Modelo: Offline</span>';
        modelHealth.style.color = '#ef4444';
    }
}

