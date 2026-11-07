const mongoose = require("mongoose");
const Cliente = require("../models/Cliente");

function datosCliente(body) {
    const nombre = String(body.nombre || "").trim();
    const documento = String(body.documento || "").trim().toUpperCase();
    const telefono = String(body.telefono || "").trim();
    const correo = String(body.correo || "").trim().toLowerCase();
    const direccion = String(body.direccion || "").trim();
    if (!nombre || !documento) throw new Error("Nombre y documento son obligatorios");
    if (nombre.length > 120 || documento.length > 20 || telefono.length > 25 || correo.length > 120 || direccion.length > 200) throw new Error("Uno o más campos superan la longitud permitida");
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error("Correo electrónico inválido");
    return { nombre, documento, telefono, correo, direccion };
}

exports.listarClientes = async (req, res) => {
    try { const clientes = await Cliente.find().sort({ nombre: 1 }).lean(); res.json({ total: clientes.length, clientes }); }
    catch (e) { res.status(500).json({ mensaje: "Error al obtener clientes" }); }
};

exports.buscarCliente = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ mensaje: "ID de cliente inválido" });
    try {
        const cliente = await Cliente.findById(req.params.id);
        if (!cliente) return res.status(404).json({ mensaje: "Cliente no encontrado" });
        res.json(cliente);
    } catch (e) { res.status(500).json({ mensaje: "Error al buscar cliente" }); }
};

exports.registrarCliente = async (req, res) => {
    try {
        const cliente = await Cliente.create(datosCliente(req.body));
        res.status(201).json({ mensaje: "Cliente registrado correctamente", cliente });
    } catch (e) { res.status(400).json({ mensaje: e.code === 11000 ? "Ya existe un cliente con ese documento" : e.message }); }
};

exports.actualizarCliente = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ mensaje: "ID de cliente inválido" });
    try {
        const cliente = await Cliente.findByIdAndUpdate(req.params.id, { $set: datosCliente(req.body) }, { new: true, runValidators: true });
        if (!cliente) return res.status(404).json({ mensaje: "Cliente no encontrado" });
        res.json({ mensaje: "Cliente actualizado correctamente", cliente });
    } catch (e) { res.status(400).json({ mensaje: e.code === 11000 ? "Ya existe otro cliente con ese documento" : e.message }); }
};

exports.eliminarCliente = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ mensaje: "ID de cliente inválido" });
    try {
        const Venta = require("../models/Venta");
        const cliente = await Cliente.findById(req.params.id);
        if (!cliente) return res.status(404).json({ mensaje: "Cliente no encontrado" });
        if (await Venta.exists({ cliente: cliente._id })) return res.status(409).json({ mensaje: "No se puede eliminar: el cliente tiene ventas asociadas. Conserva su historial y edita sus datos si es necesario." });
        await cliente.deleteOne();
        res.json({ mensaje: "Cliente eliminado correctamente" });
    } catch (e) { res.status(500).json({ mensaje: "No se pudo eliminar el cliente" }); }
};
