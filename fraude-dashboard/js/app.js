
/* ============================================
   APP.JS — Inicialización y navegación
   Versión de producción
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
    
    // Inicializar Dashboard (esto dispara la carga automática de datos)
    Dashboard.init();
});

