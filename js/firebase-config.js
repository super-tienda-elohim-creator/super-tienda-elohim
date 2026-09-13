// ============================================================
// CONFIGURACIÓN DE FIREBASE
// ------------------------------------------------------------
// 1. Ve a https://console.firebase.google.com y crea un proyecto (gratis).
// 2. Dentro del proyecto: "Compilación" > "Firestore Database" > Crear
//    base de datos (modo producción, cualquier región cercana).
// 3. "Compilación" > "Authentication" > Sign-in method > habilita
//    "Correo electrónico/contraseña".
// 4. "Configuración del proyecto" (ícono de engranaje) > "Tus apps" >
//    ícono web </> > registra la app > copia el objeto firebaseConfig
//    que te muestra y pégalo abajo, reemplazando los valores de ejemplo.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBswOLMHiujmY2a4HAdlGaIYSTDkotXUhw",
  authDomain: "super-tienda-elohim-35e09.firebaseapp.com",
  projectId: "super-tienda-elohim-35e09",
  storageBucket: "super-tienda-elohim-35e09.firebasestorage.app",
  messagingSenderId: "407762735028",
  appId: "1:407762735028:web:661d4117508d81dd7fece1"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Número de WhatsApp de respaldo (se usa si no existe config/general
// en Firestore todavía). Formato internacional sin "+", ej. 50370001234
export const WHATSAPP_FALLBACK = "50300000000";
