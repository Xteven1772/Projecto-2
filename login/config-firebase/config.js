// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
// Import Firestore
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js"; // <--- AÑADIR ESTA LÍNEA
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAayglCegQe8NluFsdvQhVglHGh9wl1Kug",
  authDomain: "unibaq-proyecto.firebaseapp.com",
  projectId: "unibaq-proyecto",
  storageBucket: "unibaq-proyecto.firebasestorage.app",
  messagingSenderId: "604683338019",
  appId: "1:604683338019:web:40343c865ef7710537cc96",
  measurementId: "G-F7X3V9VSYR"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // Puedes comentar o eliminar esta línea si no usas Analytics
export const auth = getAuth(app);
export const db = getFirestore(app); // <--- AÑADIR ESTA LÍNEA para exportar la instancia de Firestore