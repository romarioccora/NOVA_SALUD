
const mongoose = require("mongoose");

const productoSchema = new mongoose.Schema({

    nombre: {
        type: String,
        required: true,
        trim: true
    },

    codigo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
},

    categoria: {
        type: String,
        required: true
    },

    descripcion: {
        type: String,
        default: ""
    },

    precio: {
        type: Number,
        required: true,
        min: 0
    },

    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },

    stockMinimo: {
        type: Number,
        default: 5,
        min: 0
    },

    fechaVencimiento: {
        type: Date
    },

    laboratorio: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Producto", productoSchema);
