
const dotenv = require('dotenv');
// Cargar variables de entorno antes que cualquier otro módulo
dotenv.config();

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

// Importar rutas
const rutasUsuarios = require('./routes/usuarios');
const rutasProductos = require('./routes/productos');
const rutasClientes = require('./routes/clientes');
const rutasVentas = require('./routes/ventas');
const rutasInventario = require('./routes/inventario');

// Validar configuración obligatoria
if (!process.env.MONGO_URI) {
    console.error('Falta MONGO_URI en el archivo .env');
    process.exit(1);
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET debe existir y tener al menos 32 caracteres (ver .env.example)');
    process.exit(1);
}

// Crear aplicación
const app = express();
app.disable('x-powered-by');

// Cabeceras de seguridad básicas
app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; frame-ancestors 'none'"
    });
    next();
});

// Configuración del servidor
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Archivos públicos
app.use(express.static(path.join(__dirname, 'public')));

// Registrar rutas API
app.use('/api/usuarios', rutasUsuarios);
app.use('/api/productos', rutasProductos);
app.use('/api/clientes', rutasClientes);
app.use('/api/ventas', rutasVentas);
app.use('/api/inventario', rutasInventario);

// API inexistente
app.use('/api', (req, res) => {
    res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

// Página de inicio de sesión
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Ruta principal
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Manejo central de errores (JSON mal formado, errores no controlados)
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ mensaje: 'JSON inválido' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ mensaje: 'Solicitud demasiado grande' });
    }
    console.error('ERROR NO CONTROLADO:', err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
});

// Conexión a MongoDB e inicio del servidor
const PORT = process.env.PORT || 3000;

if (require.main === module) {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => {
            console.log('MongoDB conectado correctamente');

            app.listen(PORT, () => {
                console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
            });
        })
        .catch((error) => {
            console.error('Error al conectar MongoDB:', error.message);
            process.exit(1);
        });
}

module.exports = app;
