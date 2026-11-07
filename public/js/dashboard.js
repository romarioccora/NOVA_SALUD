
const token = localStorage.getItem("token");
const usuarioGuardado = localStorage.getItem("usuario");

if (!token || !usuarioGuardado) {
    window.location.href = "/login";
}

const usuario = JSON.parse(usuarioGuardado || "{}");

$("nombreUsuario").textContent = usuario.nombre || "Usuario";
$("rolUsuario").textContent = usuario.rol === "admin" ? "Administrador" : "Vendedor";

function $(id) {
    return document.getElementById(id);
}

function escapar(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

function moneda(valor) {
    return `S/ ${Number(valor || 0).toFixed(2)}`;
}

async function obtenerDatos(url) {
    const respuesta = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
        throw new Error(datos.mensaje || "No se pudieron obtener los datos");
    }

    return datos;
}

function esHoy(fecha) {
    if (!fecha) return false;

    const fechaVenta = new Date(fecha);
    const hoy = new Date();

    return fechaVenta.getFullYear() === hoy.getFullYear() &&
        fechaVenta.getMonth() === hoy.getMonth() &&
        fechaVenta.getDate() === hoy.getDate();
}

function mostrarAlertas(productos) {
    const bajos = productos.filter(p =>
        Number(p.stock) <= Number(p.stockMinimo ?? 5)
    );

    $("stockBajo").textContent = bajos.length;

    // Vencimientos: ya vencidos o que vencen en los próximos 30 días (solo con stock)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + 30);

    const porVencer = productos
        .filter(p => p.fechaVencimiento && Number(p.stock) > 0 && new Date(p.fechaVencimiento) <= limite)
        .sort((x, y) => new Date(x.fechaVencimiento) - new Date(y.fechaVencimiento));

    if (!bajos.length && !porVencer.length) {
        $("listaAlertas").innerHTML =
            '<p class="vacio">No hay alertas de stock ni de vencimiento.</p>';
        return;
    }

    const fila = (p, etiqueta, color) => `
        <div style="display:flex;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid #eee">
            <div>
                <strong>${escapar(p.nombre)}</strong>
                <p style="font-size:12px;color:#858b98;margin-top:5px">
                    Código: ${escapar(p.codigo)}
                </p>
            </div>
            <strong style="color:${color};text-align:right">${etiqueta}</strong>
        </div>`;

    const filasVenc = porVencer.map(p => {
        const f = new Date(p.fechaVencimiento);
        const vencido = f < hoy;
        const fecha = f.toLocaleDateString("es-PE", { timeZone: "UTC" });
        return fila(p, vencido ? `VENCIDO (${fecha})` : `Vence ${fecha}`, vencido ? "#d32f2f" : "#e69a00");
    });

    $("listaAlertas").innerHTML =
        filasVenc.join("") +
        bajos.map(p => fila(p, `${Number(p.stock)} unidades`, "#f36b35")).join("");
}

function mostrarVentas(ventas) {
    const recientes = ventas.filter(v => v.estado !== "anulada").slice(0, 6);

    if (!recientes.length) {
        $("tablaVentas").innerHTML =
            '<tr><td colspan="3">No hay ventas registradas.</td></tr>';
        return;
    }

    $("tablaVentas").innerHTML = recientes.map(v => {
        const nombres = (v.productos || [])
            .map(p => p.nombre || p.producto?.nombre || "Producto")
            .join(", ");

        const cantidad = (v.productos || [])
            .reduce((total, p) => total + Number(p.cantidad || 0), 0);

        return `
            <tr>
                <td>${escapar(nombres || "Venta")}</td>
                <td>${cantidad}</td>
                <td>${moneda(v.total)}</td>
            </tr>
        `;
    }).join("");
}

function mostrarEstadisticas(productos, ventas) {
    const ventasHoy = ventas.filter(v =>
        v.estado !== "anulada" && esHoy(v.createdAt)
    );

    const ingresosHoy = ventasHoy.reduce(
        (total, venta) => total + Number(venta.total || 0), 0
    );

    $("totalProductos").textContent = productos.length;
    $("totalVentas").textContent = ventasHoy.length;
    $("ingresos").textContent = moneda(ingresosHoy);

    mostrarAlertas(productos);
    mostrarVentas(ventas);
}

async function cargarDashboard() {
    try {
        const [datosProductos, datosVentas] = await Promise.all([
            obtenerDatos("/api/productos"),
            obtenerDatos("/api/ventas")
        ]);

        const productos = Array.isArray(datosProductos)
            ? datosProductos
            : datosProductos.productos || [];

        const ventas = datosVentas.ventas || [];

        mostrarEstadisticas(productos, ventas);

    } catch (error) {
        console.error("Error en dashboard:", error);
        $("listaAlertas").innerHTML =
            `<p class="vacio">${escapar(error.message)}</p>`;

        if (/token|sesión|cuenta|iniciar/i.test(error.message)) {
            cerrarSesion();
        }
    }
}

function cerrarSesion() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "/login";
}

$("btnSalir").addEventListener("click", cerrarSesion);

cargarDashboard();
