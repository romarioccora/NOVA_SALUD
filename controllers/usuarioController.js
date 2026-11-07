
const mongoose = require("mongoose");
const Usuario = require("../models/Usuario");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const texto = (v) => (typeof v === "string" ? v.trim() : "");
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Registrar un nuevo usuario (solo administrador)
const registrarUsuario = async (req, res) => {
    try {
        const nombre = texto(req.body.nombre);
        const correo = texto(req.body.correo).toLowerCase();
        const password = typeof req.body.password === "string" ? req.body.password : "";
        const rol = req.body.rol === "admin" ? "admin" : "vendedor";

        if (!nombre || !correo || !password) {
            return res.status(400).json({ mensaje: "Todos los campos son obligatorios" });
        }

        if (!CORREO_VALIDO.test(correo)) {
            return res.status(400).json({ mensaje: "Correo electrónico inválido" });
        }

        if (password.length < 8) {
            return res.status(400).json({ mensaje: "La contraseña debe tener al menos 8 caracteres" });
        }

        if (await Usuario.exists({ correo })) {
            return res.status(400).json({ mensaje: "El correo ya está registrado" });
        }

        await Usuario.create({
            nombre,
            correo,
            password: await bcrypt.hash(password, 10),
            rol
        });

        res.status(201).json({ mensaje: "Usuario registrado correctamente" });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ mensaje: "El correo ya está registrado" });
        }
        console.error("ERROR AL REGISTRAR USUARIO:", error);
        res.status(500).json({ mensaje: "Error al registrar usuario" });
    }
};

// Iniciar sesión
const iniciarSesion = async (req, res) => {
    try {
        // Solo cadenas: evita inyección de operadores ({"$gt": ""})
        const correo = texto(req.body.correo).toLowerCase();
        const password = typeof req.body.password === "string" ? req.body.password : "";

        if (!correo || !password) {
            return res.status(400).json({ mensaje: "Correo y contraseña son obligatorios" });
        }

        const usuario = await Usuario.findOne({ correo });

        if (!usuario || !usuario.estado) {
            return res.status(401).json({ mensaje: "Correo o contraseña incorrectos" });
        }

        const passwordValida = await bcrypt.compare(password, usuario.password);

        if (!passwordValida) {
            return res.status(401).json({ mensaje: "Correo o contraseña incorrectos" });
        }

        const token = jwt.sign(
            { id: usuario._id, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        res.json({
            mensaje: "Inicio de sesión correcto",
            token,
            usuario: {
                id: usuario._id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error("ERROR AL INICIAR SESION:", error);
        res.status(500).json({ mensaje: "Error al iniciar sesión" });
    }
};

// Listar usuarios (solo administrador)
const listarUsuarios = async (req, res) => {
    try {
        const usuarios = await Usuario.find().select("-password").sort({ nombre: 1 }).lean();
        res.json({ total: usuarios.length, usuarios });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al obtener usuarios" });
    }
};

// Cambiar rol y/o estado de un usuario (solo administrador)
const actualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ mensaje: "ID de usuario inválido" });
        }

        const cambios = {};

        if (req.body.rol !== undefined) {
            if (!["admin", "vendedor"].includes(req.body.rol)) {
                return res.status(400).json({ mensaje: "Rol inválido" });
            }
            cambios.rol = req.body.rol;
        }

        if (req.body.estado !== undefined) {
            if (typeof req.body.estado !== "boolean") {
                return res.status(400).json({ mensaje: "Estado inválido" });
            }
            cambios.estado = req.body.estado;
        }

        if (Object.keys(cambios).length === 0) {
            return res.status(400).json({ mensaje: "No hay cambios para aplicar" });
        }

        // Evita que el administrador se quite el acceso a sí mismo
        if (String(id) === String(req.usuario.id) && (cambios.estado === false || cambios.rol === "vendedor")) {
            return res.status(400).json({ mensaje: "No puedes desactivarte ni quitarte el rol de administrador" });
        }

        const usuario = await Usuario.findByIdAndUpdate(id, { $set: cambios }, { new: true, runValidators: true }).select("-password");

        if (!usuario) {
            return res.status(404).json({ mensaje: "Usuario no encontrado" });
        }

        res.json({ mensaje: "Usuario actualizado correctamente", usuario });

    } catch (error) {
        console.error("ERROR AL ACTUALIZAR USUARIO:", error);
        res.status(500).json({ mensaje: "Error al actualizar usuario" });
    }
};

// Obtener el perfil del usuario autenticado
const obtenerPerfil = async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.usuario.id).select("-password").lean();
        if (!usuario) {
            return res.status(404).json({ mensaje: "Usuario no encontrado" });
        }
        res.json({ usuario });
    } catch (error) {
        console.error("ERROR AL OBTENER PERFIL:", error);
        res.status(500).json({ mensaje: "Error al obtener el perfil" });
    }
};

// Cambiar la contraseña del propio usuario autenticado
const cambiarPassword = async (req, res) => {
    try {
        const passwordActual = typeof req.body.passwordActual === "string" ? req.body.passwordActual : "";
        const passwordNueva = typeof req.body.passwordNueva === "string" ? req.body.passwordNueva : "";

        if (!passwordActual || !passwordNueva) {
            return res.status(400).json({ mensaje: "Debes indicar la contraseña actual y la nueva" });
        }

        if (passwordNueva.length < 8) {
            return res.status(400).json({ mensaje: "La nueva contraseña debe tener al menos 8 caracteres" });
        }

        if (passwordNueva === passwordActual) {
            return res.status(400).json({ mensaje: "La nueva contraseña debe ser distinta de la actual" });
        }

        const usuario = await Usuario.findById(req.usuario.id);

        if (!usuario) {
            return res.status(404).json({ mensaje: "Usuario no encontrado" });
        }

        const passwordValida = await bcrypt.compare(passwordActual, usuario.password);

        if (!passwordValida) {
            return res.status(401).json({ mensaje: "La contraseña actual no es correcta" });
        }

        usuario.password = await bcrypt.hash(passwordNueva, 10);
        await usuario.save();

        res.json({ mensaje: "Contraseña actualizada correctamente" });

    } catch (error) {
        console.error("ERROR AL CAMBIAR CONTRASEÑA:", error);
        res.status(500).json({ mensaje: "Error al cambiar la contraseña" });
    }
};

module.exports = {
    registrarUsuario,
    iniciarSesion,
    listarUsuarios,
    actualizarUsuario,
    obtenerPerfil,
    cambiarPassword
};

