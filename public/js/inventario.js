
// ==========================================
// NOVA SALUD - CONTROL DE INVENTARIO
// ==========================================

const token = localStorage.getItem("token");
const usuarioGuardado = localStorage.getItem("usuario");

if (!token || !usuarioGuardado) {
    window.location.href = "/login";
}

let usuario;

try {
    usuario = JSON.parse(usuarioGuardado);
} catch (error) {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "/login";
}

if (usuario) {
    document.getElementById("nombreUsuario").textContent =
        usuario.nombre || "Usuario";

    document.getElementById("rolUsuario").textContent =
        usuario.rol === "admin" ? "Administrador" : "Vendedor";
}

// ELEMENTOS HTML
const tablaProductos = document.getElementById("tablaProductos");
const tablaMovimientos = document.getElementById("tablaMovimientos");
const modal = document.getElementById("modalMovimiento");
const formulario = document.getElementById("formMovimiento");

let productos = [];
let movimientos = [];

// ==========================================
// CONEXIÓN CON EL SERVIDOR
// ==========================================

async function solicitud(url, opciones = {}) {

    const respuesta = await fetch(url, {
        ...opciones,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(opciones.headers || {})
        }
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
        throw new Error(
            datos.mensaje || `Error HTTP ${respuesta.status}`
        );
    }

    return datos;
}

// ==========================================
// SEGURIDAD HTML
// ==========================================

function escapar(valor) {

    return String(valor ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);

}

// ==========================================
// MENSAJES
// ==========================================

function mostrarEstado(mensaje, tipo = "ok") {

    const elemento = document.getElementById("estado");

    if (!elemento) return;

    elemento.textContent = mensaje;
    elemento.className = `estado ${tipo}`;

}

// ==========================================
// CARGAR INVENTARIO
// ==========================================

async function cargarInventario() {

    try {

        const [datosProductos, datosMovimientos] =
            await Promise.all([
                solicitud("/api/inventario"),
                solicitud("/api/inventario/movimientos")
            ]);

        productos = Array.isArray(datosProductos)
            ? datosProductos
            : datosProductos.productos || [];

        movimientos = Array.isArray(datosMovimientos)
            ? datosMovimientos
            : datosMovimientos.movimientos || [];

        renderizarProductos();
        renderizarMovimientos();
        actualizarEstadisticas();
        cargarSelectorProductos();

    } catch (error) {

        console.error("Error cargando inventario:", error);

        mostrarEstado(error.message, "error");

        tablaProductos.innerHTML =
            `<tr><td colspan="6">${escapar(error.message)}</td></tr>`;

        tablaMovimientos.innerHTML =
            `<tr><td colspan="7">No se pudieron cargar los movimientos.</td></tr>`;

    }

}

// ==========================================
// ESTADÍSTICAS
// ==========================================

function actualizarEstadisticas() {

    document.getElementById("totalProductos").textContent =
        productos.length;

    document.getElementById("totalUnidades").textContent =
        productos.reduce(
            (total, p) => total + Number(p.stock || 0),
            0
        );

    document.getElementById("stockBajo").textContent =
        productos.filter(
            p => Number(p.stock) <= Number(p.stockMinimo ?? 5)
        ).length;

    document.getElementById("totalMovimientos").textContent =
        movimientos.length;

}

// ==========================================
// MOSTRAR PRODUCTOS
// ==========================================

function renderizarProductos() {

    const termino =
        document.getElementById("buscarProducto").value.toLowerCase();

    const filtrados = productos.filter(p =>
        `${p.nombre} ${p.codigo} ${p.categoria}`
            .toLowerCase()
            .includes(termino)
    );

    if (!filtrados.length) {

        tablaProductos.innerHTML =
            '<tr><td colspan="6">No hay productos registrados.</td></tr>';

        return;

    }

    tablaProductos.innerHTML = filtrados.map(p => {

        const bajo =
            Number(p.stock) <= Number(p.stockMinimo ?? 5);

        return `
            <tr>
                <td>${escapar(p.nombre)}</td>
                <td>${escapar(p.codigo)}</td>
                <td>${escapar(p.categoria)}</td>
                <td>${Number(p.stock || 0)}</td>
                <td>${Number(p.stockMinimo || 0)}</td>
                <td class="${bajo ? "stock-bajo" : "stock-normal"}">
                    ${bajo ? "Stock bajo" : "Disponible"}
                </td>
            </tr>
        `;

    }).join("");

}

// ==========================================
// MOSTRAR MOVIMIENTOS
// ==========================================

function renderizarMovimientos() {

    if (!movimientos.length) {

        tablaMovimientos.innerHTML =
            '<tr><td colspan="7">No existen movimientos registrados.</td></tr>';

        return;

    }

    tablaMovimientos.innerHTML = movimientos.map(m => `

        <tr>
            <td>
                ${m.createdAt
                    ? new Date(m.createdAt).toLocaleString("es-PE")
                    : "-"}
            </td>

            <td>${escapar(m.producto?.nombre || "-")}</td>

            <td>${escapar(m.tipo)}</td>

            <td>${Number(m.cantidad || 0)}</td>

            <td>${Number(m.stockAnterior || 0)}</td>

            <td>${Number(m.stockNuevo || 0)}</td>

            <td>${escapar(m.motivo || "-")}</td>
        </tr>

    `).join("");

}

// ==========================================
// SELECTOR DE PRODUCTOS
// ==========================================

function cargarSelectorProductos() {

    const selector = document.getElementById("producto");

    selector.innerHTML =
        '<option value="">Seleccione un producto</option>';

    productos.forEach(p => {

        selector.innerHTML += `
            <option value="${escapar(p._id)}">
                ${escapar(p.nombre)} - Stock: ${Number(p.stock || 0)}
            </option>
        `;

    });

}

// ==========================================
// ABRIR Y CERRAR MODAL
// ==========================================

function abrirModal() {

    formulario.reset();

    document.getElementById("mensajeFormulario").textContent = "";

    document.getElementById("labelCantidad").textContent =
        "Cantidad *";

    modal.classList.add("activo");

}

function cerrarModal() {

    modal.classList.remove("activo");

}

// ==========================================
// CAMBIAR ETIQUETA DE CANTIDAD
// ==========================================

document.getElementById("tipo").addEventListener("change", event => {

    document.getElementById("labelCantidad").textContent =
        event.target.value === "ajuste"
            ? "Nuevo stock total *"
            : "Cantidad *";

    document.getElementById("cantidad").min =
        event.target.value === "ajuste" ? "0" : "1";

});

// ==========================================
// REGISTRAR MOVIMIENTO
// ==========================================

formulario.addEventListener("submit", async event => {

    event.preventDefault();

    const productoId =
        document.getElementById("producto").value.trim();

    const tipo =
        document.getElementById("tipo").value;

    const cantidad =
        Number(document.getElementById("cantidad").value);

    const motivo =
        document.getElementById("motivo").value.trim();

    const boton =
        document.getElementById("btnGuardar");

    const mensaje =
        document.getElementById("mensajeFormulario");

    // VALIDACIONES INDIVIDUALES

    const camposFaltantes = [];

    if (!productoId) {
        camposFaltantes.push("Producto");
    }

    if (!tipo) {
        camposFaltantes.push("Tipo de movimiento");
    }

    if (!Number.isInteger(cantidad) || cantidad < (tipo === "ajuste" ? 0 : 1)) {
        camposFaltantes.push("Cantidad válida");
    }

    if (!motivo) {
        camposFaltantes.push("Motivo");
    }

    if (camposFaltantes.length > 0) {

        mensaje.textContent =
            "Verifique: " + camposFaltantes.join(", ");

        mensaje.className = "estado error";

        console.log("Campos incompletos:", {
            productoId,
            tipo,
            cantidad,
            motivo
        });

        return;

    }

    // COMPROBAR QUE EL PRODUCTO EXISTA

    const productoExiste = productos.find(
        p => String(p._id) === String(productoId)
    );

    if (!productoExiste) {

        mensaje.textContent =
            "El producto seleccionado no existe o no está cargado.";

        mensaje.className = "estado error";

        return;

    }

    // PREPARAR DATOS

    const movimiento = {
        productoId,
        tipo,
        cantidad,
        motivo
    };

    boton.disabled = true;
    boton.textContent = "Guardando...";

    try {

        console.log("Enviando movimiento:", movimiento);

        const datos = await solicitud(
            "/api/inventario/movimientos",
            {
                method: "POST",
                body: JSON.stringify(movimiento)
            }
        );

        console.log("Respuesta del servidor:", datos);

        cerrarModal();

        mostrarEstado(
            datos.mensaje || "Movimiento registrado correctamente.",
            "ok"
        );

        formulario.reset();

        await cargarInventario();

    } catch (error) {

        console.error("Error registrando movimiento:", error);

        mensaje.textContent = error.message;
        mensaje.className = "estado error";

    } finally {

        boton.disabled = false;
        boton.textContent = "Guardar movimiento";

    }

});

// ==========================================
// EVENTOS DE BOTONES
// ==========================================

document.getElementById("btnNuevoMovimiento")
    .addEventListener("click", abrirModal);

document.getElementById("btnCancelar")
    .addEventListener("click", cerrarModal);

document.getElementById("buscarProducto")
    .addEventListener("input", renderizarProductos);

// CERRAR MODAL AL PULSAR FUERA

modal.addEventListener("click", event => {

    if (event.target === modal) {
        cerrarModal();
    }

});

// ==========================================
// CERRAR SESIÓN
// ==========================================

document.getElementById("btnSalir")
    .addEventListener("click", () => {

        localStorage.removeItem("token");
        localStorage.removeItem("usuario");

        window.location.href = "/login";

    });

// ==========================================
// INICIAR SISTEMA
// ==========================================

cargarInventario();
