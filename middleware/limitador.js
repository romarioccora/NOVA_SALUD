
// Limitador de intentos en memoria (sin dependencias externas).
// Para varias instancias del servidor conviene usar un almacén compartido (p. ej. Redis).
const limitadorIntentos = ({ ventanaMs = 15 * 60 * 1000, maximo = 10 } = {}) => {
    const intentos = new Map();

    setInterval(() => {
        const ahora = Date.now();
        for (const [clave, d] of intentos) if (d.expira <= ahora) intentos.delete(clave);
    }, ventanaMs).unref();

    return (req, res, next) => {
        const clave = req.ip;
        const ahora = Date.now();
        let d = intentos.get(clave);

        if (!d || d.expira <= ahora) {
            d = { cuenta: 0, expira: ahora + ventanaMs };
            intentos.set(clave, d);
        }

        d.cuenta++;

        if (d.cuenta > maximo) {
            res.set("Retry-After", String(Math.ceil((d.expira - ahora) / 1000)));
            return res.status(429).json({ mensaje: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo" });
        }

        next();
    };
};

module.exports = { limitadorIntentos };
