
/* ============================================
   AUTH.JS — Login con Supabase Auth (email + contraseña)
   Bloquea todo el dashboard hasta que el analista inicia sesión.
   Cuentas creadas manualmente en Supabase (Authentication > Users),
   no hay registro público desde acá.
   ============================================ */

// ⚠️ COMPLETAR: Settings > API en el dashboard de Supabase.
// Usar la "anon key" (pública), nunca la "service_role".
const SUPABASE_URL = 'PONÉ_ACÁ_TU_URL_DE_SUPABASE';
const SUPABASE_ANON_KEY = 'PONÉ_ACÁ_TU_ANON_KEY';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Auth = {
    currentUserEmail: null,
    _appInitialized: false,

    // =============================================
    // Inicializar: revisa si ya hay sesión activa,
    // si no, muestra la pantalla de login.
    // =============================================
    async init() {
        this.bindLoginForm();
        this.bindLogoutButton();

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            this.onLoginSuccess(session);
        } else {
            this.showLoginScreen();
        }

        // Reacciona a login/logout (incluye expiración de sesión)
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                this.onLoginSuccess(session);
            } else if (event === 'SIGNED_OUT') {
                this.currentUserEmail = null;
                this.showLoginScreen();
            }
        });
    },

    // =============================================
    // Mostrar pantalla de login / ocultar la app
    // =============================================
    showLoginScreen() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-shell').classList.add('hidden');
    },

    // =============================================
    // Login exitoso: ocultar login, mostrar la app,
    // e inicializar Chat/Dashboard recién acá (una sola vez)
    // =============================================
    onLoginSuccess(session) {
        this.currentUserEmail = session.user.email;

        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');

        const userLabel = document.getElementById('current-user-email');
        if (userLabel) userLabel.textContent = this.currentUserEmail;

        if (!this._appInitialized) {
            this._appInitialized = true;
            Chat.init();
            Dashboard.init();
        }
    },

    // =============================================
    // Formulario de login
    // =============================================
    bindLoginForm() {
        const form = document.getElementById('login-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');
            const submitBtn = form.querySelector('button[type="submit"]');

            errorEl.textContent = '';
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ingresando...';

            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Iniciar sesión';

            if (error) {
                errorEl.textContent = 'Email o contraseña incorrectos.';
            }
            // Si fue exitoso, onAuthStateChange dispara onLoginSuccess()
        });
    },

    // =============================================
    // Botón de cerrar sesión
    // =============================================
    bindLogoutButton() {
        const btn = document.getElementById('logout-btn');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
        });
    }
};

document.addEventListener('DOMContentLoaded', () => Auth.init());
