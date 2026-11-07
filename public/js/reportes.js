
const token = localStorage.getItem("token");
const usuarioGuardado = localStorage.getItem("usuario");

if (!token || !usuarioGuardado) window.location.href = "/login";

const usuario = JSON.parse(usuarioGuardado || "{}");
const $ = id => document.getElementById(id);

$("nombreUsuario").textContent = usuario.nombre || "Usuario";
$("rolUsuario").textContent = usuario.rol === "admin" ? "Administrador" : "Vendedor";

let ventas = [];
let productos = [];
let ventasFiltradas = [];

const moneda = valor => `S/ ${Number(valor || 0).toFixed(2)}`;

function escapar(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

async function obtenerDatos(url) {
    const respuesta = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });

    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.mensaje || "Error al consultar información");

    return datos;
}

async function cargarReportes() {
    try {
        const [datosVentas, datosProductos] = await Promise.all([
            obtenerDatos("/api/ventas"),
            obtenerDatos("/api/productos")
        ]);

        ventas = datosVentas.ventas || [];
        productos = Array.isArray(datosProductos)
            ? datosProductos
            : datosProductos.productos || [];

        generarReporte();
        mostrarInventario();
        $("mensajeReporte").textContent = "Información actualizada correctamente.";
    } catch (error) {
        $("mensajeReporte").textContent = error.message;

        if (error.message.toLowerCase().includes("token")) cerrarSesion();
    }
}

function generarReporte() {
    const inicio = $("fechaInicio").value;
    const fin = $("fechaFin").value;

    if (inicio && fin && inicio > fin) {
        $("mensajeReporte").textContent = "La fecha inicial no puede ser posterior a la fecha final.";
        return;
    }

    ventasFiltradas = ventas.filter(v => {
        if (v.estado === "anulada" || !v.createdAt) return false;

        const fecha = new Date(v.createdAt);
        const fechaLocal = [
            fecha.getFullYear(),
            String(fecha.getMonth() + 1).padStart(2, "0"),
            String(fecha.getDate()).padStart(2, "0")
        ].join("-");

        return (!inicio || fechaLocal >= inicio) && (!fin || fechaLocal <= fin);
    });

    mostrarResumen();
    mostrarTablaVentas();
    mostrarProductosVendidos();
}

function mostrarResumen() {
    const ingresos = ventasFiltradas.reduce((s, v) => s + Number(v.total || 0), 0);
    const unidades = ventasFiltradas.reduce((s, v) =>
        s + (v.productos || []).reduce((cantidad, p) => cantidad + Number(p.cantidad || 0), 0), 0
    );

    $("cantidadVentas").textContent = ventasFiltradas.length;
    $("ingresosTotales").textContent = moneda(ingresos);
    $("unidadesVendidas").textContent = unidades;
}

function mostrarTablaVentas() {
    if (!ventasFiltradas.length) {
        $("tablaReporte").innerHTML = '<tr><td colspan="6">No hay ventas en este periodo.</td></tr>';
        return;
    }

    $("tablaReporte").innerHTML = ventasFiltradas.map(v => {
        const fecha = new Date(v.createdAt).toLocaleString("es-PE");
        const cliente = v.cliente?.nombre || "Cliente ocasional";
        const vendedor = v.vendedor?.nombre || "No disponible";
        const cantidad = (v.productos || []).reduce((s, p) => s + Number(p.cantidad || 0), 0);

        return `
            <tr>
                <td>${fecha}</td>
                <td>${escapar(cliente)}</td>
                <td>${escapar(vendedor)}</td>
                <td>${cantidad}</td>
                <td>${moneda(v.total)}</td>
                <td>Completada</td>
            </tr>
        `;
    }).join("");
}

function mostrarProductosVendidos() {
    const resumen = {};

    ventasFiltradas.forEach(v => {
        (v.productos || []).forEach(p => {
            const nombre = p.nombre || p.producto?.nombre || "Producto";
            if (!resumen[nombre]) resumen[nombre] = { cantidad: 0, importe: 0 };

            resumen[nombre].cantidad += Number(p.cantidad || 0);
            resumen[nombre].importe += Number(p.subtotal || (p.precio * p.cantidad) || 0);
        });
    });

    const lista = Object.entries(resumen)
        .sort((a, b) => b[1].cantidad - a[1].cantidad);

    $("tablaProductos").innerHTML = lista.length
        ? lista.map(([nombre, datos]) => `
            <tr>
                <td>${escapar(nombre)}</td>
                <td>${datos.cantidad}</td>
                <td>${moneda(datos.importe)}</td>
            </tr>
        `).join("")
        : '<tr><td colspan="3">No hay productos vendidos en este periodo.</td></tr>';
}

function mostrarInventario() {
    if (!productos.length) {
        $("tablaInventario").innerHTML = '<tr><td colspan="5">No hay productos registrados.</td></tr>';
        return;
    }

    $("tablaInventario").innerHTML = productos.map(p => {
        const bajo = Number(p.stock) <= Number(p.stockMinimo ?? 5);

        return `
            <tr>
                <td>${escapar(p.nombre)}</td>
                <td>${escapar(p.codigo)}</td>
                <td>${Number(p.stock)}</td>
                <td>${Number(p.stockMinimo ?? 5)}</td>
                <td style="color:${bajo ? "#c0392b" : "#218653"}">
                    ${bajo ? "Stock bajo" : "Disponible"}
                </td>
            </tr>
        `;
    }).join("");
}

function exportarCSV() {
    if (!ventasFiltradas.length) {
        $("mensajeReporte").textContent = "No hay ventas para exportar.";
        return;
    }

    const filas = [
        ["Fecha", "Cliente", "Vendedor", "Productos", "Total", "Metodo de pago"],
        ...ventasFiltradas.map(v => [
            new Date(v.createdAt).toLocaleString("es-PE"),
            v.cliente?.nombre || "Cliente ocasional",
            v.vendedor?.nombre || "No disponible",
            (v.productos || []).map(p => `${p.nombre} x${p.cantidad}`).join(" | "),
            Number(v.total || 0).toFixed(2),
            v.metodoPago || "efectivo"
        ])
    ];

    const contenido = "\uFEFF" + filas.map(fila =>
        fila.map(valor => {
            let t = String(valor);
            // Evita inyección de fórmulas al abrir el CSV en Excel
            if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
            return `"${t.replace(/"/g, '""')}"`;
        }).join(";")
    ).join("\n");

    const archivo = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = "reporte_ventas_nova_salud.csv";
    enlace.click();

    URL.revokeObjectURL(url);
}

function cerrarSesion() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "/login";
}

$("btnFiltrar").addEventListener("click", generarReporte);

$("btnLimpiar").addEventListener("click", () => {
    $("fechaInicio").value = "";
    $("fechaFin").value = "";
    generarReporte();
});

$("btnExportar").addEventListener("click", exportarCSV);
$("btnSalir").addEventListener("click", cerrarSesion);

cargarReportes();
