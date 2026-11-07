
const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
const esAdministrador = String(usuario.rol || "").toLowerCase() === "admin";

if (!token || !localStorage.getItem("usuario")) window.location.href = "/login";

document.getElementById("nombreUsuario").textContent = usuario.nombre || "Usuario";
document.getElementById("rolUsuario").textContent = usuario.rol === "admin" ? "Administrador" : "Vendedor";

let productos = [];
let clientes = [];
let ventas = [];
let carrito = [];

const $ = id => document.getElementById(id);
const moneda = valor => `S/ ${Number(valor || 0).toFixed(2)}`;

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

    if (!respuesta.ok) throw new Error(datos.mensaje || "Error en la solicitud");
    return datos;
}

function escapar(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

function mostrarMensaje(mensaje, tipo = "ok") {
    $("mensajeVenta").textContent = mensaje;
    $("mensajeVenta").className = `estado ${tipo}`;
}

async function cargarDatos() {
    try {
        const [datosProductos, datosClientes, datosVentas] = await Promise.all([
            solicitud("/api/productos"),
            solicitud("/api/clientes"),
            solicitud("/api/ventas")
        ]);

        productos = Array.isArray(datosProductos) ? datosProductos : datosProductos.productos || [];
        clientes = datosClientes.clientes || [];
        ventas = datosVentas.ventas || [];

        cargarSelectores();
        renderizarVentas();
        actualizarResumen();
    } catch (error) {
        mostrarMensaje(error.message, "error");
        if (error.message.toLowerCase().includes("token")) cerrarSesion();
    }
}

function cargarSelectores() {
    $("producto").innerHTML = '<option value="">Seleccionar producto</option>' +
        productos.filter(p => p.stock > 0).map(p =>
            `<option value="${p._id}">${escapar(p.nombre)} - ${moneda(p.precio)} (Stock: ${p.stock})</option>`
        ).join("");

    $("cliente").innerHTML = '<option value="">Cliente ocasional</option>' +
        clientes.map(c =>
            `<option value="${c._id}">${escapar(c.nombre)} - ${escapar(c.documento)}</option>`
        ).join("");
}

function agregarProducto() {
    const id = $("producto").value;
    const cantidad = Number($("cantidad").value);
    const producto = productos.find(p => p._id === id);

    if (!producto) return mostrarMensaje("Selecciona un producto.", "error");
    if (!Number.isInteger(cantidad) || cantidad < 1) return mostrarMensaje("Ingresa una cantidad válida.", "error");

    const existente = carrito.find(p => p.producto === id);
    const cantidadActual = existente ? existente.cantidad : 0;

    if (cantidadActual + cantidad > producto.stock) {
        return mostrarMensaje(`Stock disponible de ${producto.nombre}: ${producto.stock}`, "error");
    }

    if (existente) {
        existente.cantidad += cantidad;
    } else {
        carrito.push({
            producto: id,
            nombre: producto.nombre,
            precio: Number(producto.precio),
            cantidad
        });
    }

    $("producto").value = "";
    $("cantidad").value = 1;
    mostrarMensaje("Producto agregado a la venta.");
    renderizarCarrito();
}

function renderizarCarrito() {
    const tabla = $("detalleVenta");

    if (!carrito.length) {
        tabla.innerHTML = '<tr><td colspan="5">Agrega productos a la venta.</td></tr>';
    } else {
        tabla.innerHTML = carrito.map((item, indice) => `
            <tr>
                <td>${escapar(item.nombre)}</td>
                <td>${moneda(item.precio)}</td>
                <td>${item.cantidad}</td>
                <td>${moneda(item.precio * item.cantidad)}</td>
                <td><button class="btn btn-eliminar" data-quitar="${indice}">Quitar</button></td>
            </tr>
        `).join("");
    }

    const total = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
    $("totalVenta").textContent = moneda(total);
}

async function registrarVenta() {
    if (!carrito.length) return mostrarMensaje("Agrega al menos un producto.", "error");

    const boton = $("btnRegistrar");
    boton.disabled = true;

    const venta = {
        cliente: $("cliente").value || null,
        metodoPago: $("metodoPago").value,
        productos: carrito.map(item => ({
            producto: item.producto,
            cantidad: item.cantidad
        }))
    };

    try {
        const datos = await solicitud("/api/ventas", {
            method: "POST",
            body: JSON.stringify(venta)
        });

        carrito = [];
        renderizarCarrito();
        mostrarMensaje(datos.mensaje || "Venta registrada correctamente.");
        await cargarDatos();
    } catch (error) {
        mostrarMensaje(error.message, "error");
    } finally {
        boton.disabled = false;
    }
}

function renderizarVentas() {
    const termino = $("buscarVenta").value.trim().toLowerCase();

    const filtradas = ventas.filter(v => {
        const cliente = v.cliente?.nombre || "Cliente ocasional";
        const vendedor = v.vendedor?.nombre || "";
        const codigo = v.codigo || "";
        return `${cliente} ${vendedor} ${codigo}`.toLowerCase().includes(termino);
    });

    $("resumenHistorial").textContent = `${filtradas.length} venta(s) encontrada(s)`;

    if (!filtradas.length) {
        $("tablaVentas").innerHTML = '<tr><td colspan="8">No hay ventas para mostrar.</td></tr>';
        return;
    }

    $("tablaVentas").innerHTML = filtradas.map(v => {
        const fecha = v.createdAt ? new Date(v.createdAt).toLocaleString("es-PE") : "-";
        const cliente = v.cliente?.nombre || "Cliente ocasional";
        const vendedor = v.vendedor?.nombre || "No disponible";
        const cantidad = (v.productos || []).reduce((s, p) => s + p.cantidad, 0);
        const anulada = v.estado === "anulada";

        return `
            <tr>
                <td>${fecha}</td>
                <td>${escapar(cliente)}</td>
                <td>${escapar(vendedor)}</td>
                <td>${cantidad} unidad(es)</td>
                <td>${moneda(v.total)}</td>
                <td>${escapar(v.metodoPago || "-")}</td>
                <td><span class="estado-venta ${anulada ? "anulada" : ""}">${anulada ? "Anulada" : "Completada"}</span></td>
                <td>
                    ${!anulada && esAdministrador ? `<button class="btn btn-eliminar" data-anular="${v._id}">Anular</button>` : "-"}
                </td>
            </tr>
        `;
    }).join("");
}

function actualizarResumen() {
    const completadas = ventas.filter(v => v.estado !== "anulada");
    const ingresos = completadas.reduce((suma, v) => suma + Number(v.total || 0), 0);

    $("totalVentas").textContent = ventas.length;
    $("ventasCompletadas").textContent = completadas.length;
    $("ingresosVentas").textContent = moneda(ingresos);
}

async function anularVenta(id) {
    if (!confirm("¿Deseas anular esta venta? El stock de los productos será restituido.")) return;

    try {
        const datos = await solicitud(`/api/ventas/${id}/anular`, { method: "PATCH" });
        mostrarMensaje(datos.mensaje || "Venta anulada correctamente.");
        await cargarDatos();
    } catch (error) {
        mostrarMensaje(error.message, "error");
    }
}

function limpiarVenta() {
    carrito = [];
    $("cliente").value = "";
    $("producto").value = "";
    $("cantidad").value = 1;
    $("metodoPago").value = "efectivo";
    renderizarCarrito();
    mostrarMensaje("Formulario de venta limpiado.");
}

$("btnAgregar").addEventListener("click", agregarProducto);
$("btnRegistrar").addEventListener("click", registrarVenta);
$("btnLimpiar").addEventListener("click", limpiarVenta);
$("buscarVenta").addEventListener("input", renderizarVentas);

$("detalleVenta").addEventListener("click", event => {
    const indice = event.target.dataset.quitar;
    if (indice === undefined) return;

    carrito.splice(Number(indice), 1);
    renderizarCarrito();
});

$("tablaVentas").addEventListener("click", event => {
    const id = event.target.dataset.anular;
    if (id) anularVenta(id);
});

$("btnSalir").addEventListener("click", cerrarSesion);

function cerrarSesion() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "/login";
}

renderizarCarrito();
cargarDatos();
