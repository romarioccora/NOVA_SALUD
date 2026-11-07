
const express = require("express");
const router = express.Router();

const {
    registrarUsuario,
    iniciarSesion,
    listarUsuarios,
    actualizarUsuario,
    obtenerPerfil,
    cambiarPassword
} = require("../controllers/usuarioController");

const {
    verificarToken,
    verificarAdmin
} = require("../middleware/autenticacion");

const { limitadorIntentos } = require("../middleware/limitador");

// ==========================================
// RUTAS PÚBLICAS
// ==========================================

// Iniciar sesión (protegido contra fuerza bruta por IP)
router.post("/login", limitadorIntentos({ ventanaMs: 15 * 60 * 1000, maximo: 10 }), iniciarSesion);

// ==========================================
// A PARTIR DE AQUÍ TODO REQUIERE INICIAR SESIÓN
// ==========================================
router.use(verificarToken);

// Perfil del usuario autenticado (rutas específicas antes de "/:id")
router.get("/perfil", obtenerPerfil);
router.patch("/perfil/password", cambiarPassword);

// ==========================================
// SOLO ADMINISTRADOR
// ==========================================

// Registrar un nuevo usuario
router.post("/registrar", verificarAdmin, registrarUsuario);

// Listar usuarios
router.get("/", verificarAdmin, listarUsuarios);

// Cambiar rol y/o estado de un usuario
router.patch("/:id", verificarAdmin, actualizarUsuario);

module.exports = router;
