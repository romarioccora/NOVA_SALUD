// routes/inventario.js

const express = require("express");
const router = express.Router();

const {
    registrarMovimiento,
    listarMovimientos,
    consultarStock,
    productosStockBajo,
    productosPorVencer
} = require("../controllers/inventarioController");

const {
    verificarToken,
    verificarAdmin
} = require("../middleware/autenticacion");

router.use(verificarToken);

router.get("/", consultarStock);
router.get("/movimientos", listarMovimientos);
router.get("/stock-bajo", productosStockBajo);
router.get("/por-vencer", productosPorVencer);
router.post("/movimientos", verificarAdmin, registrarMovimiento);

module.exports = router;