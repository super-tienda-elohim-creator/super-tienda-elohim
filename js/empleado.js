import { db, auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, getDoc, collection, query, orderBy, onSnapshot, limit
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const loginSection = document.getElementById("loginSection");
const appSection = document.getElementById("appSection");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const ordersBody = document.getElementById("ordersBody");
const userLabel = document.getElementById("userLabel");

let unsubscribeOrders = null;

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = loginForm.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "Ingresando...";
  try{
    await signInWithEmailAndPassword(auth, email, password);
  }catch(err){
    loginError.textContent = "Correo o contraseña incorrectos.";
  }finally{
    btn.disabled = false; btn.textContent = "Ingresar";
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (unsubscribeOrders){ unsubscribeOrders(); unsubscribeOrders = null; }

  if (!user){
    loginSection.style.display = "block";
    appSection.style.display = "none";
    return;
  }

  const roleSnap = await getDoc(doc(db, "roles", user.uid));
  const role = roleSnap.exists() ? roleSnap.data().role : null;

  if (role !== "employee" && role !== "admin"){
    loginError.textContent = "Esta cuenta no tiene permisos de empleado.";
    await signOut(auth);
    return;
  }

  loginSection.style.display = "none";
  appSection.style.display = "block";
  userLabel.textContent = user.email;
  loadOrders();
});

function loadOrders(){
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100));
  unsubscribeOrders = onSnapshot(q, (snap) => {
    if (snap.empty){
      ordersBody.innerHTML = `<tr><td colspan="6" class="empty-note">Todavía no hay pedidos.</td></tr>`;
      return;
    }
    ordersBody.innerHTML = "";
    snap.forEach(d => {
      const o = d.data();
      const date = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("es-SV") : "—";
      const itemsHtml = (o.items || []).map(i => `<li>${i.qty} x ${i.name} — $${Number(i.price*i.qty).toFixed(2)}</li>`).join("");
      const row = document.createElement("tr");
      row.innerHTML = `
        <td data-label="Fecha">${date}</td>
        <td data-label="Cliente"><span><strong>${o.customerName || "—"}</strong><br><span class="hint">${o.customerPhone || ""}</span><br><span class="hint">${o.customerAddress || ""}</span></span></td>
        <td data-label="Productos"><ul class="order-items">${itemsHtml}</ul></td>
        <td data-label="Subtotal" class="mono">$${Number(o.subtotal||0).toFixed(2)}</td>
        <td data-label="Envío" class="mono">$${Number(o.shippingCost||0).toFixed(2)} <span class="hint">(${o.zone||""})</span></td>
        <td data-label="Total" class="mono"><span><strong>$${Number(o.total||0).toFixed(2)}</strong><br><span class="status-pill">${o.status||"nuevo"}</span></span></td>
      `;
      ordersBody.appendChild(row);
    });
  }, (err) => {
    ordersBody.innerHTML = `<tr><td colspan="6" class="empty-note">No se pudieron cargar los pedidos (${err.code||err.message}).</td></tr>`;
  });
}
