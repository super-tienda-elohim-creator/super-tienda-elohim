# Super Tienda Elohim — Catálogo + Carrito + WhatsApp (GitHub Pages + Firebase)

Sitio con 3 niveles de acceso:

- **Cliente** (`index.html`): sin cuenta. Ve el catálogo, arma un carrito y al finalizar
  se abre WhatsApp con el pedido, el subtotal, el envío y el total.
- **Empleado** (`empleado.html`): inicia sesión y solo puede **ver** los pedidos.
- **Administrador** (`admin.html`): inicia sesión y puede **agregar, editar y eliminar**
  productos, además de configurar zonas de envío y el número de WhatsApp.

GitHub Pages solo sirve archivos estáticos (no tiene servidor propio), así que los
datos (productos, pedidos, usuarios) se guardan en **Firebase** (gratis para este
tamaño de proyecto). Esto es lo que permite que un cambio del administrador se vea
igual en el celular de cualquier cliente.

---

## 1. Crear el proyecto de Firebase

1. Entra a https://console.firebase.google.com → **Agregar proyecto** → dale un nombre
   (ej. `mi-tienda`) → puedes desactivar Google Analytics, no se necesita.
2. En el menú lateral, **Compilación → Firestore Database → Crear base de datos**.
   Elige una región cercana (ej. `us-central`) y modo **producción**.
3. En el menú lateral, **Compilación → Authentication → Comenzar** → pestaña
   **Sign-in method** → habilita **Correo electrónico/contraseña**.
4. Ve a **Configuración del proyecto** (ícono de engranaje, arriba izquierda) →
   pestaña **Tus apps** → ícono `</>` (Web) → registra la app con cualquier nombre
   (no marques Hosting) → copia el objeto `firebaseConfig` que te muestra.
5. Pega esos valores en `js/firebase-config.js`, reemplazando los que dicen
   `REEMPLAZA_...`.

## 2. Reglas de seguridad de Firestore

En **Firestore Database → Reglas**, reemplaza el contenido por esto y publica:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function getRole() {
      return exists(/databases/$(database)/documents/roles/$(request.auth.uid))
        ? get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role
        : null;
    }
    function isAdmin() { return isSignedIn() && getRole() == 'admin'; }
    function isEmployee() { return isSignedIn() && (getRole() == 'employee' || getRole() == 'admin'); }

    match /products/{productId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /orders/{orderId} {
      allow create: if true;      // el cliente no tiene cuenta, así que puede crear pedidos
      allow read, update: if isEmployee();
      allow delete: if isAdmin();
    }
    match /config/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /roles/{uid} {
      allow read: if isSignedIn() && request.auth.uid == uid;
      allow write: if false;      // los roles solo se editan a mano desde la consola
    }
  }
}
```

Esto garantiza que: cualquiera puede ver productos y enviar un pedido, pero solo
cuentas con rol `employee` o `admin` pueden leer los pedidos, y solo `admin` puede
modificar productos.

## 3. Crear las cuentas de empleado y administrador

Firebase no permite "auto-registro" de empleados desde el sitio (sería inseguro),
así que las cuentas se crean manualmente, una sola vez por persona:

1. **Authentication → Users → Add user** → ingresa correo y contraseña para cada
   empleado/administrador. Copia el **UID** que se genera para cada uno.
2. **Firestore Database → Iniciar colección** → nombre de colección: `roles`.
   Por cada usuario, crea un documento cuyo **ID sea el UID copiado**, con un campo:
   - `role` (string): `"employee"` o `"admin"`

Una cuenta con `role: "admin"` puede entrar tanto a `empleado.html` como a
`admin.html` (el panel de admin revisa específicamente `role == "admin"`).

## 4. Configurar zonas de envío y WhatsApp

Inicia sesión en `admin.html` con una cuenta admin y, en la parte inferior del
panel, agrega tus zonas de envío (nombre + costo) y el número de WhatsApp que
recibirá los pedidos (formato internacional sin `+`, ej. `50370001234` para
El Salvador). Si no configuras nada, se usa una zona "Retiro en tienda" ($0) y
el número de respaldo en `firebase-config.js`.

## 5. Publicar en GitHub Pages

1. Sube esta carpeta completa a un repositorio de GitHub.
2. En el repo: **Settings → Pages → Source**: selecciona la rama (`main`) y
   carpeta `/ (root)` → Guardar.
3. En unos minutos tu sitio estará en `https://tu-usuario.github.io/tu-repo/`.

## 6. Cómo agregar productos

Con una cuenta admin, entra a `admin.html` → llena el formulario "Agregar
producto" (nombre, precio, existencias, categoría, imagen, descripción) →
Guardar. Aparece de inmediato en el catálogo de todos los clientes.

## Estructura del proyecto

```
index.html        → catálogo + carrito (cliente, sin login)
empleado.html      → login + ver pedidos (rol employee o admin)
admin.html         → login + CRUD de productos (rol admin)
css/style.css       → estilos compartidos
js/firebase-config.js → credenciales de Firebase (edítalo con tus datos)
js/cliente.js       → lógica de catálogo, carrito y envío a WhatsApp
js/empleado.js      → lógica de login y tabla de pedidos
js/admin.js         → lógica de login, CRUD de productos, zonas y WhatsApp
```

## Notas importantes

- El plan gratuito de Firebase (Spark) es más que suficiente para una tienda
  pequeña/mediana con tráfico normal.
- El carrito del cliente vive en `localStorage` de su navegador, así que se
  conserva si cierra la pestaña, pero es individual por dispositivo (normal en
  cualquier tienda en línea).
- El pedido se guarda en Firestore (`orders`) **antes** de abrir WhatsApp, así
  que el empleado lo verá aunque el cliente no llegue a enviar el mensaje.
