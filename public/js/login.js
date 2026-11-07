
const formLogin = document.getElementById("formLogin");
const mensaje = document.getElementById("mensaje");
const btnLogin = document.getElementById("btnLogin");

// Procesar el inicio de sesión
formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();

    const correo = document.getElementById("correo").value.trim();
    const password = document.getElementById("password").value;

    mensaje.textContent = "Verificando datos...";
    btnLogin.disabled = true;

    try {
        const respuesta = await fetch("/api/usuarios/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ correo, password })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(datos.mensaje);
        }

        // Guardar la sesión
        localStorage.setItem("token", datos.token);
        localStorage.setItem("usuario", JSON.stringify(datos.usuario));

        mensaje.style.color = "green";
        mensaje.textContent = "Acceso correcto";

        // Redirigir al panel principal
        window.location.href = "/dashboard.html";

    } catch (error) {
        mensaje.style.color = "red";
        mensaje.textContent = error.message;

    } finally {
        btnLogin.disabled = false;
    }
});
