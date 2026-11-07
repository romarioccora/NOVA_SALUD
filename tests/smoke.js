// Prueba de humo con modelos simulados (sin MongoDB)
const path = require("path"), Module = require("module");
const root = path.resolve(process.argv[2] || ".");
process.env.JWT_SECRET = "x".repeat(40); process.env.MONGO_URI = "mongodb://x/y";
const bcrypt = require(path.join(root, "node_modules/bcryptjs"));
const jwt = require(path.join(root, "node_modules/jsonwebtoken"));
const usuarios = { a: { _id: "64b000000000000000000001", correo: "a@a.com", rol: "admin", estado: true, password: bcrypt.hashSync("password123", 4), nombre: "A" },
                   v: { _id: "64b000000000000000000002", correo: "v@a.com", rol: "vendedor", estado: false, password: "x", nombre: "V" },
                   vendedorActivo: { _id: "64b000000000000000000003", correo: "activo@a.com", rol: "vendedor", estado: true, password: "x", nombre: "Vendedor" } };
const fakeUsuario = {
  findOne: async (f) => { if (typeof f.correo !== "string") throw new Error("OPERADOR INYECTADO"); return Object.values(usuarios).find(u => u.correo === f.correo) || null; },
  findById: (id) => ({ select: () => ({ lean: async () => Object.values(usuarios).find(u => u._id === id) || null }) }),
  exists: async () => null, create: async () => ({}),
};
const orig = Module._load;
Module._load = function (req, parent, ...r) { if (/models\/Usuario$/.test(req)) return fakeUsuario; return orig.call(this, req, parent, ...r); };
const app = require(path.join(root, "server.js"));
const srv = app.listen(0, async () => {
  const base = `http://127.0.0.1:${srv.address().port}`;
  const call = async (m, u, b, t) => { const r = await fetch(base + u, { method: m, headers: { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}) }, body: b ? JSON.stringify(b) : undefined }); return r.status; };
  const tok = (u) => jwt.sign({ id: u._id, rol: "admin" }, process.env.JWT_SECRET);
  const res = [];
  const t = (n, got, exp) => res.push([n, got, exp, got === exp]);
  t("registrar sin token -> 401", await call("POST", "/api/usuarios/registrar", { nombre: "x", correo: "x@x.com", password: "12345678" }), 401);
  t("registrar con admin -> 201", await call("POST", "/api/usuarios/registrar", { nombre: "x", correo: "x@x.com", password: "12345678" }, tok(usuarios.a)), 201);
  t("usuario desactivado con token válido -> 401", await call("GET", "/api/productos", null, tok(usuarios.v)), 401);
  t("login con operador {$gt:''} -> 400 (no inyecta)", await call("POST", "/api/usuarios/login", { correo: { $gt: "" }, password: "password123" }), 400);
  t("login correcto -> 200", await call("POST", "/api/usuarios/login", { correo: "a@a.com", password: "password123" }), 200);
  t("login clave mala -> 401", await call("POST", "/api/usuarios/login", { correo: "a@a.com", password: "mala" }), 401);
  t("anular venta como vendedor -> 403", await call("PATCH", "/api/ventas/64b000000000000000000099/anular", null, tok(usuarios.vendedorActivo)), 403);
  t("API inexistente -> 404", await call("GET", "/api/nada", null, tok(usuarios.a)), 404);
  let last; for (let i = 0; i < 12; i++) last = await call("POST", "/api/usuarios/login", { correo: "a@a.com", password: "mala" });
  t("fuerza bruta -> 429", last, 429);
  res.forEach(r => console.log(r[3] ? "OK  " : "FAIL", r[0], "(got", r[1] + ")"));
  srv.close(); process.exit(res.every(r => r[3]) ? 0 : 1);
});
