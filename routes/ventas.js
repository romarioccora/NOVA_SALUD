
const express = require("express");
const router = express.Router();

const {
    registrarVenta,
    listarVentas,
    buscarVenta,
    anularVenta
} = require("../controllers/ventaController");

const { verificarToken, verificarAdmin } = require("../middleware/autenticacion");

// Proteger todas las rutas
router.use(verificarToken);

// Registrar venta
router.post("/", registrarVenta);

// Listar ventas
router.get("/", listarVentas);

// Buscar venta por ID
router.get("/:id", buscarVenta);

// Anular venta: solo el administrador puede realizar esta operación.
router.patch("/:id/anular", verificarAdmin, anularVenta);

module.exports = router;
