// Importar las funciones necesarias de Firebase Auth
import { 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// Importar la instancia de auth desde tu archivo de configuración
import { auth } from "./config.js"; 

// Funcionamiento del login
// Al usar type="module" en el script de login.html, las funciones no son globales por defecto.
// Una forma de hacerla global es adjuntarla al objeto window.
window.login = async function login() { // Añadimos 'async' porque signInWithEmailAndPassword devuelve una Promesa
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorMessage = document.getElementById("error-message");

  // Ocultar mensaje de error previo
  errorMessage.classList.add("oculto");
  errorMessage.textContent = "";

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Usuario autenticado
    console.log("Usuario autenticado:", userCredential.user);
    // Redirigir a la página de mapas
    // Ruta corregida: Asume que 'mapas' está en el mismo nivel que 'login'
    window.location.href = "/mapas/mapas.html"; 
  } catch (error) {
    console.error("Error de autenticación:", error.code, error.message);
    let msg = "Correo o contraseña incorrectos.";
    if (error.code === 'auth/user-not-found') {
      msg = "El usuario no existe.";
    } else if (error.code === 'auth/wrong-password') {
      msg = "Contraseña incorrecta.";
    } else if (error.code === 'auth/invalid-email') {
      msg = "Formato de correo electrónico inválido.";
    } else if (error.code === 'auth/invalid-credential') { 
      msg = "Credenciales inválidas. Verifica tu correo y contraseña.";
    }
    errorMessage.textContent = msg;
    errorMessage.classList.remove("oculto");
  }
}; // <-- ¡Asegúrate de que este punto y coma esté aquí!

// Opcional: Verificar si el usuario ya está logueado al cargar la página de login
// Si ya está logueado, redirigirlo directamente a mapas.html
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Usuario logueado, redirigir a mapas.html
    // Ruta corregida: Asume que 'mapas' está en el mismo nivel que 'login'
    window.location.href = "/mapas/mapas.html";
  }
});
