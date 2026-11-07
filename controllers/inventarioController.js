
const mongoose = require("mongoose");

const Producto = require("../models/Producto");
const Movimiento = require("../models/MovimientoInventario");

// ==========================================
// REGISTRAR MOVIMIENTO
// ==========================================

const registrarMovimiento = async (req, res) => {

    try {

        const { productoId, tipo, cantidad, motivo } = req.body;

        // VALIDAR PRODUCTO

        if (!productoId || !mongoose.Types.ObjectId.isValid(productoId)) {

            return res.status(400).json({
                mensaje: "Seleccione un producto válido."
            });

        }

        // VALIDAR TIPO

        if (!["entrada", "salida", "ajuste"].includes(tipo)) {

            return res.status(400).json({
                mensaje: "Seleccione un tipo de movimiento válido."
            });

        }

        // VALIDAR CANTIDAD

        const cantidadNum = Number(cantidad);

        // En un ajuste, la cantidad es el nuevo stock total (puede ser 0)
        const minimo = tipo === "ajuste" ? 0 : 1;

        if (!Number.isInteger(cantidadNum) || cantidadNum < minimo) {

            return res.status(400).json({
                mensaje: tipo === "ajuste"
                    ? "El nuevo stock debe ser un entero igual o mayor que cero."
                    : "La cantidad debe ser un entero mayor que cero."
            });

        }

        // VALIDAR MOTIVO

        if (typeof motivo !== "string" || !motivo.trim()) {

            return res.status(400).json({
                mensaje: "El motivo del movimiento es obligatorio."
            });

        }

        // VALIDAR USUARIO

        if (!req.usuario?.id ||
            !mongoose.Types.ObjectId.isValid(req.usuario.id)) {

            return res.status(401).json({
                mensaje: "Usuario no identificado. Inicie sesión nuevamente."
            });

        }

        // BUSCAR PRODUCTO

        const producto = await Producto.findById(productoId);

        if (!producto) {

            return res.status(404).json({
                mensaje: "Producto no encontrado."
            });

        }

        const stockAnterior = Number(producto.stock);

        let stockNuevo = stockAnterior;

        // CALCULAR STOCK

        if (tipo === "entrada") {

            stockNuevo = stockAnterior + cantidadNum;

        } else if (tipo === "salida") {

            if (cantidadNum > stockAnterior) {

                return res.status(400).json({
                    mensaje: "Stock insuficiente para realizar la salida."
                });

            }

            stockNuevo = stockAnterior - cantidadNum;

        } else if (tipo === "ajuste") {

            stockNuevo = cantidadNum;

        }

        // ACTUALIZAR STOCK DE FORMA CONDICIONAL

        const actualizado = await Producto.findOneAndUpdate(
            {
                _id: productoId,
                stock: stockAnterior
            },
            {
                $set: {
                    stock: stockNuevo
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!actualizado) {

            return res.status(409).json({
                mensaje: "El stock cambió. Actualice el inventario e intente nuevamente."
            });

        }

        // GUARDAR HISTORIAL

        try {

            const movimiento = await Movimiento.create({

                producto: productoId,

                tipo,

                // En ajustes se guarda la diferencia absoluta; el stock final queda en stockNuevo
                cantidad: tipo === "ajuste" ? Math.abs(stockNuevo - stockAnterior) : cantidadNum,

                stockAnterior,

                stockNuevo,

                motivo: motivo.trim(),

                usuario: req.usuario.id

            });

            return res.status(201).json({

                mensaje: "Movimiento registrado correctamente.",

                movimiento,

                stock: stockNuevo

            });

        } catch (error) {

            // RESTAURAR STOCK SI FALLA EL HISTORIAL

            await Producto.updateOne(
                {
                    _id: productoId,
                    stock: stockNuevo
                },
                {
                    $set: {
                        stock: stockAnterior
                    }
                }
            );

            throw error;

        }

    } catch (error) {

        console.error("ERROR INVENTARIO:", error);

        return res.status(500).json({

            mensaje: "Error al registrar movimiento: " + error.message

        });

    }

};

// ==========================================
// LISTAR MOVIMIENTOS
// ==========================================

const listarMovimientos = async (req, res) => {

    try {

        const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 500, 1), 2000);

        const movimientos = await Movimiento.find()
            .populate("producto", "nombre codigo categoria")
            .sort({ createdAt: -1 })
            .limit(limite);

        res.json(movimientos);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: "Error al obtener movimientos."
        });

    }

};

// ==========================================
// CONSULTAR STOCK
// ==========================================

const consultarStock = async (req, res) => {

    try {

        const productos = await Producto.find()
            .select("nombre codigo categoria stock stockMinimo fechaVencimiento")
            .sort({ nombre: 1 });

        res.json(productos);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: "Error al consultar inventario."
        });

    }

};

// ==========================================
// PRODUCTOS CON STOCK BAJO
// ==========================================

const productosStockBajo = async (req, res) => {

    try {

        const productos = await Producto.find({

            $expr: {
                $lte: ["$stock", "$stockMinimo"]
            }

        });

        res.json(productos);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: "Error al consultar stock bajo."
        });

    }

};

// ==========================================
// PRODUCTOS POR VENCER
// ==========================================

const productosPorVencer = async (req, res) => {

    try {

        const hoy = new Date();

        const limite = new Date();

        limite.setDate(hoy.getDate() + 30);

        const productos = await Producto.find({

            // Incluye productos ya vencidos (con stock) y los que vencen en 30 días
            fechaVencimiento: { $ne: null, $lte: limite },
            stock: { $gt: 0 }

        }).sort({
            fechaVencimiento: 1
        });

        res.json(productos);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: "Error al consultar vencimientos."
        });

    }

};

// ==========================================
// EXPORTAR FUNCIONES
// ==========================================

module.exports = {

    registrarMovimiento,

    listarMovimientos,

    consultarStock,

    productosStockBajo,

    productosPorVencer

};
