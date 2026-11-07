
const mongoose = require("mongoose");

const ventaSchema = new mongoose.Schema({

    cliente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cliente",
        default: null
    },

    vendedor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },

    codigo: {
    type: String,
    unique: true,
    sparse: true
    },

    productos: [{
        producto: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Producto",
            required: true
        },

        nombre: {
            type: String,
            required: true
        },

        cantidad: {
            type: Number,
            required: true,
            min: 1
        },

        precio: {
            type: Number,
            required: true,
            min: 0
        },

        subtotal: {
            type: Number,
            required: true,
            min: 0
        }
    }],

    total: {
        type: Number,
        required: true,
        min: 0
    },

    metodoPago: {
        type: String,
        enum: ["efectivo", "tarjeta", "transferencia"],
        default: "efectivo"
    },

    estado: {
        type: String,
        enum: ["completada", "anulada"],
        default: "completada"
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Venta", ventaSchema);
