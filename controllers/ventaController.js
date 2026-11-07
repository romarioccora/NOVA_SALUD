const crypto = require("crypto");
const mongoose = require("mongoose");
const Venta = require("../models/Venta");
const Producto = require("../models/Producto");
const Cliente = require("../models/Cliente");
const Movimiento = require("../models/MovimientoInventario");

// Error con código HTTP para respuestas controladas
class ErrorVenta extends Error {
    constructor(estado, mensaje) {
        super(mensaje);
        this.estado = estado;
    }
}

const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const esAdmin = (req) => String(req.usuario?.rol || "").toLowerCase() === "admin";

const generarCodigoVenta = () =>
    `VTA-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

// Registrar movimiento de inventario sin romper la operación principal
async function registrarMovimientos(movimientos) {
    try {
        await Movimiento.insertMany(movimientos);
    } catch (error) {
        console.error("ERROR AL GUARDAR MOVIMIENTOS DE INVENTARIO:", error);
    }
}

// Registrar una nueva venta
const registrarVenta = async (req, res) => {
    const descontados = [];

    try {
        const { cliente, productos, metodoPago } = req.body;

        if (!Array.isArray(productos) || productos.length === 0) {
            throw new ErrorVenta(400, "Debe agregar productos a la venta");
        }

        if (productos.length > 100) {
            throw new ErrorVenta(400, "La venta tiene demasiados productos");
        }

        // Validar cliente
        if (cliente) {
            if (!mongoose.Types.ObjectId.isValid(cliente)) {
                throw new ErrorVenta(400, "ID de cliente inválido");
            }
            if (!(await Cliente.exists({ _id: cliente }))) {
                throw new ErrorVenta(404, "Cliente no encontrado");
            }
        }

        // Validar vendedor
        const vendedor = req.usuario?.id || req.usuario?._id;

        if (!vendedor || !mongoose.Types.ObjectId.isValid(vendedor)) {
            throw new ErrorVenta(401, "Usuario no autorizado");
        }

        // Validar método de pago
        const pago = metodoPago || "efectivo";

        if (!["efectivo", "tarjeta", "transferencia"].includes(pago)) {
            throw new ErrorVenta(400, "Método de pago inválido");
        }

        // Agrupar líneas repetidas del mismo producto
        const cantidades = new Map();

        for (const item of productos) {
            if (!item || !mongoose.Types.ObjectId.isValid(item.producto)) {
                throw new ErrorVenta(400, "ID de producto inválido");
            }

            const cantidad = Number(item.cantidad);

            if (!Number.isInteger(cantidad) || cantidad < 1) {
                throw new ErrorVenta(400, "La cantidad debe ser un número entero mayor a cero");
            }

            const id = String(item.producto);
            cantidades.set(id, (cantidades.get(id) || 0) + cantidad);
        }

        // Verificar productos y stock
        let total = 0;
        const detalleProductos = [];

        for (const [id, cantidad] of cantidades) {
            const producto = await Producto.findById(id);

            if (!producto) {
                throw new ErrorVenta(404, "Producto no encontrado");
            }

            if (producto.stock < cantidad) {
                throw new ErrorVenta(400, `Stock insuficiente para ${producto.nombre}`);
            }

            const precio = Number(producto.precio);

            if (!Number.isFinite(precio) || precio < 0) {
                throw new ErrorVenta(400, `Precio inválido para ${producto.nombre}`);
            }

            const subtotal = redondear(precio * cantidad);
            total += subtotal;

            detalleProductos.push({
                producto: producto._id,
                nombre: producto.nombre,
                cantidad,
                precio,
                subtotal
            });
        }

        total = redondear(total);

        const codigoVenta = generarCodigoVenta();
        const movimientos = [];

        // Descontar stock de forma atómica
        for (const item of detalleProductos) {
            const actualizado = await Producto.findOneAndUpdate(
                { _id: item.producto, stock: { $gte: item.cantidad } },
                { $inc: { stock: -item.cantidad } },
                { new: true }
            );

            if (!actualizado) {
                throw new ErrorVenta(409, "El stock cambió durante la venta. Intente nuevamente");
            }

            descontados.push(item);

            movimientos.push({
                producto: item.producto,
                tipo: "salida",
                cantidad: item.cantidad,
                stockAnterior: actualizado.stock + item.cantidad,
                stockNuevo: actualizado.stock,
                motivo: `Venta ${codigoVenta}`,
                usuario: vendedor
            });
        }

        const venta = await Venta.create({
            cliente: cliente || null,
            vendedor,
            codigo: codigoVenta,
            productos: detalleProductos,
            total,
            metodoPago: pago,
            estado: "completada"
        });

        await registrarMovimientos(movimientos);

        res.status(201).json({
            mensaje: "Venta registrada correctamente",
            venta
        });

    } catch (error) {
        // Reponer stock si ocurrió un error después de descontar
        for (const item of descontados.reverse()) {
            try {
                await Producto.updateOne(
                    { _id: item.producto },
                    { $inc: { stock: item.cantidad } }
                );
            } catch (errorStock) {
                console.error("ERROR AL REPONER STOCK:", errorStock);
            }
        }

        if (error instanceof ErrorVenta) {
            return res.status(error.estado).json({ mensaje: error.message });
        }

        console.error("ERROR AL REGISTRAR VENTA:", error);

        res.status(500).json({ mensaje: "Error al registrar la venta" });
    }
};


// Listar ventas (el vendedor solo ve las suyas). ?limite=N (máx. 1000, por defecto 500)
const listarVentas = async (req, res) => {
    try {
        const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 500, 1), 1000);
        const filtro = esAdmin(req) ? {} : { vendedor: req.usuario.id };

        const ventas = await Venta.find(filtro)
            .populate({ path: "cliente", select: "nombre documento", strictPopulate: false })
            .populate({ path: "vendedor", select: "nombre correo", strictPopulate: false })
            .populate({ path: "productos.producto", select: "nombre codigo", strictPopulate: false })
            .sort({ createdAt: -1 })
            .limit(limite)
            .lean();

        res.status(200).json({
            mensaje: "Ventas obtenidas correctamente",
            total: ventas.length,
            ventas
        });

    } catch (error) {
        console.error("ERROR AL OBTENER VENTAS:", error);
        res.status(500).json({ mensaje: "Error al obtener las ventas" });
    }
};


// Buscar una venta por ID
const buscarVenta = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ mensaje: "ID de venta inválido" });
        }

        const venta = await Venta.findById(req.params.id)
            .populate("cliente", "nombre documento")
            .populate("vendedor", "nombre correo")
            .populate("productos.producto", "nombre codigo");

        if (!venta) {
            return res.status(404).json({ mensaje: "Venta no encontrada" });
        }

        if (!esAdmin(req) && String(venta.vendedor?._id) !== String(req.usuario.id)) {
            return res.status(403).json({ mensaje: "No tienes permisos para ver esta venta" });
        }

        res.status(200).json(venta);

    } catch (error) {
        console.error("ERROR AL BUSCAR VENTA:", error);
        res.status(500).json({ mensaje: "Error al buscar la venta" });
    }
};


// Anular una venta y devolver productos al inventario (solo administrador)
const anularVenta = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ mensaje: "ID de venta inválido" });
        }

        // Paso atómico: solo una petición puede pasar de "completada" a "anulada"
        const venta = await Venta.findOneAndUpdate(
            { _id: req.params.id, estado: "completada" },
            { $set: { estado: "anulada" } },
            { new: true }
        );

        if (!venta) {
            const existe = await Venta.exists({ _id: req.params.id });
            return res.status(existe ? 400 : 404).json({
                mensaje: existe ? "Esta venta ya fue anulada" : "Venta no encontrada"
            });
        }

        // Devolver productos al inventario
        const movimientos = [];

        for (const item of venta.productos) {
            const actualizado = await Producto.findOneAndUpdate(
                { _id: item.producto },
                { $inc: { stock: item.cantidad } },
                { new: true }
            );

            if (!actualizado) {
                console.error(`ANULACION ${venta.codigo}: producto ${item.producto} ya no existe`);
                continue;
            }

            movimientos.push({
                producto: item.producto,
                tipo: "entrada",
                cantidad: item.cantidad,
                stockAnterior: actualizado.stock - item.cantidad,
                stockNuevo: actualizado.stock,
                motivo: `Anulación de venta ${venta.codigo || venta._id}`,
                usuario: req.usuario.id
            });
        }

        await registrarMovimientos(movimientos);

        res.status(200).json({ mensaje: "Venta anulada correctamente", venta });

    } catch (error) {
        console.error("ERROR AL ANULAR VENTA:", error);
        res.status(500).json({ mensaje: "Error al anular la venta" });
    }
};


module.exports = {
    registrarVenta,
    listarVentas,
    buscarVenta,
    anularVenta
};
