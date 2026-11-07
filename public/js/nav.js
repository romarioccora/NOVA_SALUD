// Mantiene la navegación consistente y muestra las opciones según el rol.
(() => {
    const menu = document.querySelector(".sidebar nav");

    if (!menu) return;

    let usuario = {};

    try {
        usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
    } catch (error) {
        console.warn("No se pudo leer la información de la sesión.");
    }

    const esAdministrador = String(usuario.rol || "").toLowerCase() === "admin";
    const rutaActual = window.location.pathname;

    // El historial forma parte del módulo de ventas.
    if (!menu.querySelector('a[href$="ventas.html#historial"]')) {
        const enlaceHistorial = document.createElement("a");
        enlaceHistorial.href = "/ventas.html#historial";
        enlaceHistorial.textContent = "📋 Historial";
        menu.querySelector('a[href$="ventas.html"]')?.after(enlaceHistorial);
    }

    // La administración de usuarios está reservada al administrador.
    let enlaceUsuarios = menu.querySelector('a[href$="usuarios.html"]');

    if (esAdministrador && !enlaceUsuarios) {
        enlaceUsuarios = document.createElement("a");
        enlaceUsuarios.href = "/usuarios.html";
        enlaceUsuarios.textContent = "⚙ Usuarios";
        menu.appendChild(enlaceUsuarios);
    }

    if (!esAdministrador && enlaceUsuarios) {
        enlaceUsuarios.remove();
    }

    // Marca automáticamente la sección en la que se encuentra el usuario.
    menu.querySelectorAll("a").forEach((enlace) => {
        const destino = new URL(enlace.href, window.location.origin);
        const esSeccionActual = destino.pathname === rutaActual &&
            (!destino.hash || window.location.hash === destino.hash);

        enlace.classList.toggle("activo", esSeccionActual);
    });
})();
