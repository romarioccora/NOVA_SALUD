
const mongoose = require("mongoose");

const clienteSchema = new mongoose.Schema({

    nombre: {
        type: String,
        required: true,
        trim: true
    },

    documento: {
        type: String,
        required: true,
        unique: true
    },

    telefono: {
        type: String,
        default: ""
    },

    correo: {
        type: String,
        default: ""
    },

    direccion: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Cliente", clienteSchema);
