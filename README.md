# NOVA SALUD

Sistema web para la gestión de productos, clientes, ventas e inventario de una botica. Está desarrollado con Node.js, Express, MongoDB, Mongoose y JavaScript nativo.

## Requisitos

- Node.js 18 o superior.
- MongoDB local o una base de datos MongoDB Atlas.

## Instalación

1. Descomprime el proyecto y abre la carpeta `NOVA_SALUD` en Visual Studio Code.
2. Instala las dependencias con `npm install`.
3. Copia `.env.example` y crea un archivo llamado `.env` en la carpeta principal.
4. Configura `MONGO_URI`, `JWT_SECRET` y `ADMIN_PASSWORD` en el archivo `.env`.
5. Crea el administrador inicial con `npm run admin`.
6. Inicia el servidor con `npm run dev`.
7. Abre `http://localhost:3000` en el navegador.

## Roles del sistema

- **Administrador:** administra usuarios, productos e inventario; consulta reportes y puede anular ventas.
- **Vendedor:** registra ventas y clientes, consulta productos y revisa la información permitida para su rol.

Los permisos se validan en el servidor. Ocultar una opción en el menú no reemplaza la validación de las rutas API.

## Módulos

- Dashboard: resumen de actividad, ventas y alertas.
- Productos: registro, consulta, actualización y eliminación según permisos.
- Inventario: existencias, movimientos, stock bajo y productos próximos a vencer.
- Ventas: registro de operaciones, detalle e historial.
- Clientes: registro y mantenimiento de datos.
- Reportes: filtros por fechas y exportación de ventas a CSV.
- Usuarios: administración de cuentas y roles.

## Pruebas

Ejecuta `npm test` para realizar las pruebas de humo de autenticación, autorización y respuestas de la API. Estas pruebas usan modelos simulados y no sustituyen una validación integral con una base MongoDB real.

## Seguridad

No compartas el archivo `.env` ni incluyas credenciales reales en entregas o repositorios. El archivo `.env` está excluido mediante `.gitignore`.
