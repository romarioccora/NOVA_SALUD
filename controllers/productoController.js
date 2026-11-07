const mongoose = require("mongoose");
const Producto = require("../models/Producto");
const Movimiento = require("../models/MovimientoInventario");
const Venta = require("../models/Venta");

const camposProducto = ["nombre", "codigo", "categoria", "descripcion", "precio", "stockMinimo", "fechaVencimiento", "laboratorio"];
function validarDatos(body, crear = false) {
    const datos = {};
    for (const campo of camposProducto) if (body[campo] !== undefined) datos[campo] = body[campo];
    if (crear && body.stock !== undefined) datos.stock = body.stock;
    if (datos.nombre !== undefined) datos.nombre = String(datos.nombre).trim();
    if (datos.codigo !== undefined) datos.codigo = String(datos.codigo).trim().toUpperCase();
    if (datos.categoria !== undefined) datos.categoria = String(datos.categoria).trim();
    if (datos.descripcion !== undefined) datos.descripcion = String(datos.descripcion).trim();
    if (datos.laboratorio !== undefined) datos.laboratorio = String(datos.laboratorio).trim();
    for (const campo of ["precio", "stockMinimo", "stock"]) {
        if (datos[campo] !== undefined) {
            datos[campo] = Number(datos[campo]);
            if (!Number.isFinite(datos[campo]) || datos[campo] < 0 || (campo !== "precio" && !Number.isInteger(datos[campo]))) {
                throw new Error(`El campo ${campo} debe ser ${campo === "precio" ? "un número no negativo" : "un entero no negativo"}`);
            }
        }
    }
    if (datos.fechaVencimiento === "") datos.fechaVencimiento = null;
    else if (datos.fechaVencimiento !== undefined && Number.isNaN(new Date(datos.fechaVencimiento).getTime())) throw new Error("Fecha de vencimiento inválida");
    if (crear && (!datos.nombre || !datos.codigo || !datos.categoria || datos.precio === undefined)) throw new Error("Nombre, código, categoría y precio son obligatorios");
    if (crear && datos.stock === undefined) datos.stock = 0;
    if (crear && datos.stockMinimo === undefined) datos.stockMinimo = 5;
    return datos;
}

exports.listarProductos = async (req, res) => {
    try { res.json(await Producto.find().sort({ nombre: 1 }).lean()); }
    catch (e) { res.status(500).json({ mensaje: "Error al obtener productos" }); }
};

exports.buscarProducto = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ mensaje: "ID de producto inválido" });
    try {
        const producto = await Producto.findById(req.params.id);
        if (!producto) return res.status(404).json({ mensaje: "Producto no encontrado" });
        res.json(producto);
    } catch (e) { res.status(500).json({ mensaje: "Error al buscar el producto" }); }
};

exports.registrarProducto = async (req, res) => {
    let producto;
    try {
        const datos = validarDatos(req.body, true);
        producto = await Producto.create(datos);
        if (datos.stock > 0) {
            try {
                await Movimiento.create({ producto: producto._id, tipo: "entrada", cantidad: datos.stock, stockAnterior: 0, stockNuevo: datos.stock, motivo: "Stock inicial al registrar producto", usuario: req.usuario.id });
            } catch (e) {
                await Producto.findByIdAndDelete(producto._id);
                throw e;
            }
        }
        res.status(201).json({ mensaje: "Producto registrado correctamente", producto });
    } catch (e) {
        const duplicado = e.code === 11000;
        res.status(400).json({ mensaje: duplicado ? "El código del producto ya existe" : e.message || "No se pudo registrar el producto" });
    }
};

exports.actualizarProducto = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ mensaje: "ID de producto inválido" });
    try {
        const datos = validarDatos(req.body, false);
        // El stock se modifica exclusivamente desde Inventario para conservar trazabilidad.
        if (Object.prototype.hasOwnProperty.call(req.body, "stock")) return res.status(400).json({ mensaje: "El stock se modifica desde el módulo Inventario" });
        const producto = await Producto.findByIdAndUpdate(req.params.id, { $set: datos }, { new: true, runValidators: true, context: "query" });
        if (!producto) return res.status(404).json({ mensaje: "Producto no encontrado" });
        res.json({ mensaje: "Producto actualizado correctamente", producto });
    } catch (e) { res.status(400).json({ mensaje: e.code === 11000 ? "El código del producto ya existe" : e.message }); }
};

exports.eliminarProducto = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ mensaje: "ID de producto inválido" });
    try {
        const producto = await Producto.findById(req.params.id);
        if (!producto) return res.status(404).json({ mensaje: "Producto no encontrado" });
        const [enVentas, conMovimientos] = await Promise.all([
            Venta.exists({ "productos.producto": producto._id }),
            Movimiento.exists({ producto: producto._id })
        ]);
        if (enVentas || conMovimientos) return res.status(409).json({ mensaje: "No se puede eliminar: el producto tiene historial de ventas o movimientos. Puedes dejar de utilizarlo sin borrar su historial." });
        await producto.deleteOne();
        res.json({ mensaje: "Producto eliminado correctamente" });
    } catch (e) { res.status(500).json({ mensaje: "No se pudo eliminar el producto" }); }
};
