(() => {
    const token = localStorage.getItem("token");
    const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
    if (!token || !localStorage.getItem("usuario")) { location.href = "/login"; return; }
    if (String(usuario.rol).toLowerCase() !== "admin") { location.href = "/dashboard.html"; return; }

    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    let usuarios = [];

    $("nombreUsuario").textContent = usuario.nombre || "Usuario";
    $("rolUsuario").textContent = "Administrador";

    async function api(url, opts = {}) {
        const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.mensaje || "Error en la solicitud");
        return d;
    }

    function mensaje(t, tipo = "ok") { $("mensaje").textContent = t; $("mensaje").className = `estado ${tipo}`; }

    async function cargar() {
        try { usuarios = (await api("/api/usuarios")).usuarios || []; render(); }
        catch (e) { mensaje(e.message, "error"); }
    }

    function render() {
        const q = $("buscar").value.trim().toLowerCase();
        const lista = usuarios.filter(u => [u.nombre, u.correo].some(v => String(v || "").toLowerCase().includes(q)));
        $("tabla").innerHTML = lista.length ? lista.map(u => {
            const yo = u._id === usuario.id;
            return `<tr>
                <td><strong>${esc(u.nombre)}</strong>${yo ? " <small>(tú)</small>" : ""}</td>
                <td>${esc(u.correo)}</td>
                <td>${u.rol === "admin" ? "Administrador" : "Vendedor"}</td>
                <td>${u.estado ? "Activo" : "Desactivado"}</td>
                <td><div class="acciones-fila">${yo ? "—" : `
                    <button class="btn neutro" data-rol="${esc(u._id)}">${u.rol === "admin" ? "Pasar a vendedor" : "Hacer admin"}</button>
                    <button class="btn ${u.estado ? "peligro" : "primario"}" data-estado="${esc(u._id)}">${u.estado ? "Desactivar" : "Activar"}</button>`}
                </div></td></tr>`;
        }).join("") : '<tr><td colspan="5">No se encontraron usuarios.</td></tr>';
    }

    async function cambiar(id, cambios, texto) {
        if (!confirm(texto)) return;
        try { const d = await api(`/api/usuarios/${id}`, { method: "PATCH", body: JSON.stringify(cambios) }); mensaje(d.mensaje); await cargar(); }
        catch (e) { mensaje(e.message, "error"); }
    }

    $("tabla").addEventListener("click", e => {
        const r = e.target.closest("[data-rol]"), s = e.target.closest("[data-estado]");
        if (r) { const u = usuarios.find(x => x._id === r.dataset.rol); if (u) cambiar(u._id, { rol: u.rol === "admin" ? "vendedor" : "admin" }, `¿Cambiar el rol de ${u.nombre}?`); }
        if (s) { const u = usuarios.find(x => x._id === s.dataset.estado); if (u) cambiar(u._id, { estado: !u.estado }, `¿${u.estado ? "Desactivar" : "Activar"} a ${u.nombre}?`); }
    });

    $("nuevo").addEventListener("click", () => { $("formUsuario").reset(); $("errorForm").textContent = ""; $("modal").classList.add("activo"); });
    $("cancelar").addEventListener("click", () => $("modal").classList.remove("activo"));
    $("buscar").addEventListener("input", render);

    $("formUsuario").addEventListener("submit", async e => {
        e.preventDefault();
        const body = { nombre: $("nombre").value, correo: $("correo").value, rol: $("rol").value, password: $("password").value };
        try { const d = await api("/api/usuarios/registrar", { method: "POST", body: JSON.stringify(body) }); $("modal").classList.remove("activo"); mensaje(d.mensaje); await cargar(); }
        catch (err) { $("errorForm").textContent = err.message; }
    });

    $("btnSalir").addEventListener("click", () => { localStorage.removeItem("token"); localStorage.removeItem("usuario"); location.href = "/login"; });
    cargar();
})();
