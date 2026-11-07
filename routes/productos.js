
const express = require("express");
const router = express.Router();

const {
    listarProductos,
    registrarProducto,
    buscarProducto,
    actualizarProducto,
    eliminarProducto
} = require("../controllers/productoController");

// Importar middleware de autenticación y permisos
const {
    verificarToken,
    verificarAdmin
} = require("../middleware/autenticacion");

// Todas las rutas requieren iniciar sesión
router.use(verificarToken);

// Listar productos
router.get("/", listarProductos);

// Registrar producto (solo administrador)
router.post("/", verificarAdmin, registrarProducto);

// Buscar producto por ID
router.get("/:id", buscarProducto);

// Actualizar producto (solo administrador)
router.put("/:id", verificarAdmin, actualizarProducto);

// Eliminar producto (solo administrador)
router.delete("/:id", verificarAdmin, eliminarProducto);

module.exports = router;
