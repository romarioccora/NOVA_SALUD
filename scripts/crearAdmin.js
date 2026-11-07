
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Usuario = require("../models/Usuario");

// Uso: ADMIN_PASSWORD="una-clave-segura" node scripts/crearAdmin.js
async function crearAdmin() {
    const correo = (process.env.ADMIN_CORREO || "admin@novasalud.com").toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!password || password.length < 10) {
        console.log("Define ADMIN_PASSWORD (mínimo 10 caracteres) en .env o en la línea de comandos.");
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);

        const passwordCifrada = await bcrypt.hash(password, 10);
        const usuario = await Usuario.findOne({ correo });

        if (usuario) {
            usuario.password = passwordCifrada;
            usuario.rol = "admin";
            usuario.estado = true;
            await usuario.save();
            console.log("Administrador actualizado correctamente");
        } else {
            await Usuario.create({
                nombre: "Administrador",
                correo,
                password: passwordCifrada,
                rol: "admin",
                estado: true
            });
            console.log("Administrador creado correctamente");
        }
    } catch (error) {
        console.log("Error:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

crearAdmin();
