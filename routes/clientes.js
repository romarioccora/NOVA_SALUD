const express = require("express");
const router = express.Router();
const { verificarToken, verificarAdmin } = require("../middleware/autenticacion");
const { listarClientes, buscarCliente, registrarCliente, actualizarCliente, eliminarCliente } = require("../controllers/clienteController");

router.use(verificarToken);
router.get("/", listarClientes);
router.get("/:id", buscarCliente);
// Administradores y vendedores pueden registrar clientes durante la atención.
router.post("/", registrarCliente);
router.put("/:id", actualizarCliente);
router.delete("/:id", verificarAdmin, eliminarCliente);
module.exports = router;
