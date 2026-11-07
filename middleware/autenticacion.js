
const jwt = require("jsonwebtoken");
const Usuario = require("../models/Usuario");

// ==========================================
// 1. VERIFICAR AUTENTICACIÓN CON JWT
// ==========================================
const verificarToken = async (req, res, next) => {
    const autorizacion = req.headers.authorization;

    if (!autorizacion || !/^Bearer\s+\S+$/i.test(autorizacion)) {
        return res.status(401).json({
            mensaje: "Debes iniciar sesión para continuar"
        });
    }

    if (!process.env.JWT_SECRET) {
        console.error("ERROR: JWT_SECRET no está configurado");

        return res.status(500).json({
            mensaje: "Error de configuración del servidor"
        });
    }

    try {
        const token = autorizacion.split(/\s+/)[1];

        const datos = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (!datos || typeof datos !== "object") {
            return res.status(401).json({
                mensaje: "Token inválido"
            });
        }

        // Revalidar contra la base de datos: cuenta activa y rol vigente
        const usuarioBD = await Usuario.findById(datos.id).select("rol estado").lean();

        if (!usuarioBD || !usuarioBD.estado) {
            return res.status(401).json({
                mensaje: "Cuenta desactivada o inexistente"
            });
        }

        req.usuario = { ...datos, id: String(usuarioBD._id), rol: usuarioBD.rol };

        next();

    } catch (error) {
        if (!["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name)) {
            console.error("ERROR AUTENTICACION:", error);
            return res.status(500).json({ mensaje: "Error de autenticación" });
        }
        return res.status(401).json({
            mensaje: error.name === "TokenExpiredError"
                ? "Tu sesión ha vencido. Inicia sesión nuevamente"
                : "Token inválido o vencido"
        });
    }
};


// ==========================================
// 2. VERIFICAR PERMISOS SEGÚN EL ROL
// ==========================================
const verificarRol = (...rolesPermitidos) => {

    return (req, res, next) => {

        if (!req.usuario) {
            return res.status(401).json({
                mensaje: "Debes iniciar sesión"
            });
        }

        const rol = String(req.usuario.rol || "")
            .toLowerCase()
            .trim();

        const roles = rolesPermitidos.map(rolPermitido =>
            String(rolPermitido).toLowerCase().trim()
        );

        if (!roles.includes(rol)) {
            return res.status(403).json({
                mensaje: "No tienes permisos para realizar esta operación"
            });
        }

        next();
    };
};


// ==========================================
// 3. SOLO ADMINISTRADORES
// ==========================================
const verificarAdmin = verificarRol("admin");


// ==========================================
// 4. ADMINISTRADORES Y VENDEDORES
// ==========================================
const verificarAdminOVendedor = verificarRol(
    "admin",
    "vendedor"
);


// ==========================================
// 5. EXPORTAR FUNCIONES
// ==========================================
module.exports = {
    verificarToken,
    verificarAdmin,
    verificarRol,
    verificarAdminOVendedor
};
