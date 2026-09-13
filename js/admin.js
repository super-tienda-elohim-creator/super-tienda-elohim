import { db, auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const loginSection = document.getElementById("loginSection");
const appSection = document.getElementById("appSection");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const userLabel = document.getElementById("userLabel");

const productForm = document.getElementById("productForm");
const productList = document.getElementById("productList");
const formTitle = document.getElementById("formTitle");
const cancelEditBtn = document.getElementById("cancelEdit");
const toast = document.getElementById("toast");

const zoneForm = document.getElementById("zoneForm");
const zoneList = document.getElementById("zoneList");
const waForm = document.getElementById("waForm");

let editingId = null;
let unsubProducts = null;
let unsubZones = false;

function showToast(msg, isErr){
  toast.textContent = msg;
  toast.classList.toggle("err", !!isErr);
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 2600);
}

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
  if (unsubProducts){ unsubProducts(); unsubProducts = null; }

  if (!user){
    loginSection.style.display = "block";
    appSection.style.display = "none";
    return;
  }

  const roleSnap = await getDoc(doc(db, "roles", user.uid));
  const role = roleSnap.exists() ? roleSnap.data().role : null;

  if (role !== "admin"){
    loginError.textContent = "Esta cuenta no tiene permisos de administrador.";
    await signOut(auth);
    return;
  }

  loginSection.style.display = "none";
  appSection.style.display = "block";
  userLabel.textContent = user.email;
  loadProducts();
  loadShippingConfig();
});

// ---------------- Productos ----------------
function loadProducts(){
  const q = query(collection(db, "products"), orderBy("name"));
  unsubProducts = onSnapshot(q, (snap) => {
    if (snap.empty){
      productList.innerHTML = `<li class="empty-note">Sin productos todavía.</li>`;
      return;
    }
    productList.innerHTML = "";
    snap.forEach(d => {
      const p = d.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <div>
          <strong>${p.name}</strong>
          <span class="hint mono">$${Number(p.price).toFixed(2)} · stock ${p.stock ?? 0}</span>
          ${p.active === false ? '<span class="status-pill">oculto</span>' : ''}
        </div>
        <div class="row-actions" style="margin:0;">
          <button class="btn btn-outline" data-edit="${d.id}">Editar</button>
          <button class="btn btn-danger" data-del="${d.id}">Eliminar</button>
        </div>
      `;
      productList.appendChild(li);
    });
    productList.querySelectorAll("[data-edit]").forEach(b =>
      b.addEventListener("click", () => startEdit(b.dataset.edit)));
    productList.querySelectorAll("[data-del]").forEach(b =>
      b.addEventListener("click", () => deleteProduct(b.dataset.del)));
  });
}

async function startEdit(id){
  const snap = await getDoc(doc(db, "products", id));
  if (!snap.exists()) return;
  const p = snap.data();
  editingId = id;
  formTitle.textContent = "Editar producto";
  document.getElementById("pName").value = p.name || "";
  document.getElementById("pPrice").value = p.price || 0;
  document.getElementById("pStock").value = p.stock || 0;
  document.getElementById("pCategory").value = p.category || "";
  document.getElementById("pImage").value = p.image || "";
  document.getElementById("pDesc").value = p.description || "";
  document.getElementById("pActive").checked = p.active !== false;
  cancelEditBtn.style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm(){
  editingId = null;
  productForm.reset();
  document.getElementById("pActive").checked = true;
  formTitle.textContent = "Agregar producto";
  cancelEditBtn.style.display = "none";
}
cancelEditBtn.addEventListener("click", resetForm);

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    name: document.getElementById("pName").value.trim(),
    price: Number(document.getElementById("pPrice").value),
    stock: Number(document.getElementById("pStock").value),
    category: document.getElementById("pCategory").value.trim(),
    image: document.getElementById("pImage").value.trim(),
    description: document.getElementById("pDesc").value.trim(),
    active: document.getElementById("pActive").checked
  };
  const btn = productForm.querySelector("button[type=submit]");
  btn.disabled = true;
  try{
    if (editingId){
      await updateDoc(doc(db, "products", editingId), data);
      showToast("Producto actualizado.");
    } else {
      await addDoc(collection(db, "products"), { ...data, createdAt: serverTimestamp() });
      showToast("Producto agregado.");
    }
    resetForm();
  }catch(err){
    showToast("Error al guardar el producto.", true);
    console.error(err);
  }finally{
    btn.disabled = false;
  }
});

async function deleteProduct(id){
  if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return;
  try{
    await deleteDoc(doc(db, "products", id));
    showToast("Producto eliminado.");
    if (editingId === id) resetForm();
  }catch(err){
    showToast("Error al eliminar.", true);
  }
}

// ---------------- Zonas de envío ----------------
async function loadShippingConfig(){
  const snap = await getDoc(doc(db, "config", "shipping"));
  const zones = snap.exists() ? (snap.data().zones || []) : [];
  renderZones(zones);

  const genSnap = await getDoc(doc(db, "config", "general"));
  if (genSnap.exists()){
    document.getElementById("waNumber").value = genSnap.data().whatsappNumber || "";
  }
}

function renderZones(zones){
  if (!zones.length){
    zoneList.innerHTML = `<li class="empty-note">Sin zonas configuradas. Se usará "Retiro en tienda" ($0).</li>`;
    return;
  }
  zoneList.innerHTML = zones.map((z, idx) => `
    <li>
      <span>${z.name} — <span class="mono">$${Number(z.cost).toFixed(2)}</span></span>
      <button class="btn btn-danger btn-icon" data-zonedel="${idx}" aria-label="Eliminar zona">✕</button>
    </li>
  `).join("");
  zoneList.querySelectorAll("[data-zonedel]").forEach(b =>
    b.addEventListener("click", () => removeZone(Number(b.dataset.zonedel), zones)));
}

zoneForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("zName").value.trim();
  const cost = Number(document.getElementById("zCost").value);
  if (!name) return;
  const ref = doc(db, "config", "shipping");
  const snap = await getDoc(ref);
  const zones = snap.exists() ? (snap.data().zones || []) : [];
  zones.push({ name, cost });
  await setDoc(ref, { zones }, { merge: true });
  renderZones(zones);
  zoneForm.reset();
  showToast("Zona agregada.");
});

async function removeZone(idx, zones){
  const updated = zones.filter((_, i) => i !== idx);
  await setDoc(doc(db, "config", "shipping"), { zones: updated }, { merge: true });
  renderZones(updated);
  showToast("Zona eliminada.");
}

waForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const number = document.getElementById("waNumber").value.trim();
  await setDoc(doc(db, "config", "general"), { whatsappNumber: number }, { merge: true });
  showToast("Número de WhatsApp actualizado.");
});
