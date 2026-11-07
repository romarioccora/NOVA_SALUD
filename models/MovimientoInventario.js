
const mongoose = require("mongoose");

const movimientoSchema = new mongoose.Schema({
    producto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Producto",
        required: true
    },
    tipo: {
        type: String,
        enum: ["entrada", "salida", "ajuste"],
        required: true
    },
    cantidad: {
        type: Number,
        required: true,
        min: 1
    },
    stockAnterior: {
        type: Number,
        required: true
    },
    stockNuevo: {
        type: Number,
        required: true
    },
    motivo: {
        type: String,
        required: true,
        trim: true
    },
    usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario"
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Movimiento", movimientoSchema);
