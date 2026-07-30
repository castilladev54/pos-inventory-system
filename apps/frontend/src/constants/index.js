export const navLinks = [
    {
        id: "home",
        title: "Inicio",
    },
    {
        id: "productos",
        title: "Colección Nebula",
    },
    {
        id: "proceso",
        title: "Nuestra Ciencia",
    },
    {
        id: "dashboard",
        title: "Mi Cuenta",
    },
];

export const heroContent = {
    title: "📦 CastillaWeb SaaS",
    titleGradient: "Punto de Venta e Inventario",
    description: "La plataforma en la nube definitiva para potenciar tu comercio. 🛒 TPV Ultrarrápido ⚖️ Control de Stock a Granel 📊 Analíticas en tiempo real 🏢 Multicaja y Multiproducto.",
    buttonPrimary: "Contactar un asesor 📞",
    buttonSecondary: "Ver planes",
};

export const authContent = {
    login: {
        title: "Bienvenido de nuevo",
        subtitle: "Accede a tu cuenta CastillaWeb",
        button: "Iniciar Sesión",
        footer: "¿No tienes una cuenta?",
        link: "Regístrate aquí",
    },
    signup: {
        title: "Únete a CastillaWeb",
        subtitle: "Crea tu perfil para beneficios exclusivos",
        button: "Crear Cuenta",
        footer: "¿Ya eres miembro?",
        link: "Inicia sesión",
    },
    forgotPassword: {
        title: "Recuperar Acceso",
        subtitle: "Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.",
        button: "Enviar Enlace",
        successText: "Si existe una cuenta para ",
        successSubText: ", recibirás un enlace de recuperación en breve.",
        backToLogin: "Volver al login"
    },
    resetPassword: {
        title: "Nueva Contraseña",
        button: "Establecer Contraseña",
        loading: "Actualizando...",
    },
    verifyEmail: {
        title: "Verifica tu Email",
        subtitle: "Ingresa el código de 6 dígitos enviado a tu correo.",
        button: "Verificar",
        loading: "Verificando..."
    },
    dashboard: {
        title: "Mi Cuenta CastillaWeb",
        profileInfo: "Información Estelar",
        nameLabel: "Nombre: ",
        emailLabel: "Email: ",
        accountActivity: "Actividad",
        joinedLabel: "Miembro desde: ",
        lastLoginLabel: "Último acceso: ",
        logoutButton: "Cerrar Sesión"
    }
};

export const footerLinks = [
    {
        title: "Comunidad",
        links: [
            { name: "Eventos", link: "#" },
            { name: "Blog", link: "#" },
            { name: "Newsletter", link: "#" },
        ],
    },
    {
        title: "Soporte",
        links: [
            { name: "Centro de Ayuda", link: "#" },
            { name: "Términos de Servicio", link: "#" },
            { name: "Privacidad", link: "#" },
        ],
    },
];

export const stats = [
    { id: "stats-1", title: "Usuarios Activos", value: "3800+" },
    { id: "stats-2", title: "Tuestes Premium", value: "120+" },
    { id: "stats-3", title: "Envíos Globales", value: "50k+" },
];

export const serviceFeatures = [
    {
        id: "service-1",
        title: "Punto de Venta (TPV)",
        description: "Registra ventas al instante con soporte para productos fraccionados y escaneo rápido.",
        iconPath: "M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z",
    },
    {
        id: "service-2",
        title: "Control Analítico",
        description: "Observa tus reportes de ganancias, márgenes y movimientos de stock en tiempo real.",
        iconPath: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
    },
    {
        id: "service-3",
        title: "Respaldo en la Nube",
        description: "Toda tu información sincronizada instantáneamente en servidores asegurados las 24 horas.",
        iconPath: "M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z",
    },
    {
        id: "service-4",
        title: "Gestión de Personal",
        description: "Invita a múltiples usuarios y asígnales roles administrativos para delegar las cajas.",
        iconPath: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
    }
];