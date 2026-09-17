import { db, WHATSAPP_FALLBACK } from "./firebase-config.js";
import {
  collection, onSnapshot, query, where, addDoc, doc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const grid = document.getElementById("grid");
const cartBtn = document.getElementById("cartBtn");
const cartCount = document.getElementById("cartCount");
const overlay = document.getElementById("overlay");
const drawer = document.getElementById("drawer");
const closeDrawer = document.getElementById("closeDrawer");
const cartBody = document.getElementById("cartBody");
const cartFoot = document.getElementById("cartFoot");
const toast = document.getElementById("toast");
const catList = document.getElementById("catList");
const catHeading = document.getElementById("catHeading");

let products = [];
let activeCategory = "__todas__";
let cart = JSON.parse(localStorage.getItem("cart_v1") || "[]");
let zones = [];
let whatsappNumber = WHATSAPP_FALLBACK;
let currentZone = null;

function showToast(msg, isErr){
  toast.textContent = msg;
  toast.classList.toggle("err", !!isErr);
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 2600);
}

function saveCart(){
  localStorage.setItem("cart_v1", JSON.stringify(cart));
  renderCartCount();
}

function renderCartCount(){
  const n = cart.reduce((s,i)=>s+i.qty,0);
  cartCount.textContent = n;
  cartCount.style.display = n ? "inline-block" : "none";
}

function money(n){
  return "$" + Number(n).toFixed(2);
}

// ---------- Cargar productos en tiempo real ----------
const q = query(collection(db, "products"), where("active", "==", true));
onSnapshot(q, (snap) => {
  products = [];
  snap.forEach(d => products.push({ id: d.id, ...d.data() }));
  products.sort((a,b) => {
    const c = categoryOf(a).localeCompare(categoryOf(b), "es");
    return c !== 0 ? c : (a.name || "").localeCompare(b.name || "", "es");
  });
  renderCategories();
  renderGrid();
  renderCart(); // por si cambió stock/precio
}, (err) => {
  grid.innerHTML = `<p class="empty-note">No se pudo cargar el catálogo. Revisa la consola (${err.code || err.message}).</p>`;
});

function categoryOf(p){
  const c = (p.category || "").trim();
  return c || "Sin categoría";
}

function renderCategories(){
  const counts = new Map();
  products.forEach(p => {
    const c = categoryOf(p);
    counts.set(c, (counts.get(c) || 0) + 1);
  });
  const names = [...counts.keys()].sort((a,b) => a.localeCompare(b, "es"));

  // si la categoría activa ya no existe, volver a "Todas"
  if (activeCategory !== "__todas__" && !counts.has(activeCategory)){
    activeCategory = "__todas__";
  }

  const items = [
    { key:"__todas__", label:"Todos los productos", count: products.length },
    ...names.map(n => ({ key:n, label:n, count: counts.get(n) }))
  ];

  catList.innerHTML = items.map(it => `
    <li>
      <button data-cat="${encodeURIComponent(it.key)}" class="${it.key === activeCategory ? "active" : ""}">
        <span>${it.label}</span>
        <span class="count">${it.count}</span>
      </button>
    </li>
  `).join("");

  catList.querySelectorAll("[data-cat]").forEach(b => {
    b.addEventListener("click", () => {
      activeCategory = decodeURIComponent(b.dataset.cat);
      renderCategories();
      renderGrid();
    });
  });
}

function visibleProducts(){
  if (activeCategory === "__todas__") return products;
  return products.filter(p => categoryOf(p) === activeCategory);
}

function renderGrid(){
  if (!products.length){
    catHeading.innerHTML = "";
    grid.innerHTML = `<p class="empty-note">Todavía no hay productos publicados.</p>`;
    return;
  }

  const list = visibleProducts();
  const title = activeCategory === "__todas__" ? "Todos los productos" : activeCategory;
  catHeading.innerHTML = `
    <h2>${title}</h2>
    <span class="cat-count">${list.length} producto${list.length === 1 ? "" : "s"}</span>
  `;

  if (!list.length){
    grid.innerHTML = `<p class="empty-note">No hay productos en esta categoría.</p>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const outOfStock = Number(p.stock) <= 0;
    return `
    <article class="card">
      <div style="position:relative;">
        <img class="thumb" src="${p.image || 'https://placehold.co/400x300/EFE7D6/1C2B2D?text=Sin+imagen'}" alt="${p.name}">
        ${outOfStock ? '<div class="stock-out">AGOTADO</div>' : ''}
        <div class="price-tag">${money(p.price)}</div>
      </div>
      <div class="body">
        <span class="cat">${p.category || "General"}</span>
        <h3>${p.name}</h3>
        <p class="desc">${p.description || ""}</p>
        <div class="row-actions">
          <button class="btn btn-primary btn-block" data-add="${p.id}" ${outOfStock ? "disabled" : ""}>
            ${outOfStock ? "Agotado" : "Agregar al carrito"}
          </button>
        </div>
      </div>
    </article>`;
  }).join("");

  grid.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => addToCart(btn.dataset.add));
  });
}

function addToCart(productId){
  const p = products.find(x => x.id === productId);
  if (!p) return;
  const existing = cart.find(i => i.productId === productId);
  const currentQty = existing ? existing.qty : 0;
  if (currentQty + 1 > Number(p.stock)) {
    showToast("No hay más existencias de este producto.", true);
    return;
  }
  if (existing) existing.qty += 1;
  else cart.push({ productId, name: p.name, price: p.price, image: p.image, qty: 1 });
  saveCart();
  renderCart();
  cartBtn.classList.remove("bump"); void cartBtn.offsetWidth; cartBtn.classList.add("bump");
  showToast(`${p.name} agregado al carrito`);
}

function changeQty(productId, delta){
  const item = cart.find(i => i.productId === productId);
  if (!item) return;
  const p = products.find(x => x.id === productId);
  const next = item.qty + delta;
  if (next <= 0){
    cart = cart.filter(i => i.productId !== productId);
  } else if (p && next > Number(p.stock)) {
    showToast("No hay más existencias de este producto.", true);
    return;
  } else {
    item.qty = next;
  }
  saveCart();
  renderCart();
}

function removeItem(productId){
  cart = cart.filter(i => i.productId !== productId);
  saveCart();
  renderCart();
}

function subtotal(){
  return cart.reduce((s,i) => s + i.price * i.qty, 0);
}

function currentShippingCost(){
  const z = zones.find(z => z.name === currentZone);
  return z ? Number(z.cost) : 0;
}

function renderCart(){
  if (!cart.length){
    cartBody.innerHTML = `<p class="empty-note">Tu carrito está vacío.<br>Agrega productos del catálogo.</p>`;
    cartFoot.innerHTML = "";
    return;
  }
  cartBody.innerHTML = `
    <div id="cartItems">
      ${cart.map(i => `
        <div class="cart-item">
          <img src="${i.image || 'https://placehold.co/60x60/EFE7D6/1C2B2D?text=%20'}" alt="">
          <div>
            <div class="name">${i.name}</div>
            <div class="qty-controls">
              <button data-dec="${i.productId}" aria-label="Reducir cantidad">–</button>
              <span class="mono">${i.qty}</span>
              <button data-inc="${i.productId}" aria-label="Aumentar cantidad">+</button>
            </div>
            <button class="remove" data-rm="${i.productId}">Quitar</button>
          </div>
          <div class="line-total">${money(i.price * i.qty)}</div>
        </div>
      `).join("")}
    </div>
  `;
  cartBody.querySelectorAll("[data-inc]").forEach(b => b.addEventListener("click", () => changeQty(b.dataset.inc, 1)));
  cartBody.querySelectorAll("[data-dec]").forEach(b => b.addEventListener("click", () => changeQty(b.dataset.dec, -1)));
  cartBody.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", () => removeItem(b.dataset.rm)));

  if (!currentZone && zones.length) currentZone = zones[0].name;
  const sub = subtotal();
  const ship = currentShippingCost();
  cartFoot.innerHTML = `
    <div class="field">
      <label for="zoneSelect">Zona de envío</label>
      <select id="zoneSelect">
        ${zones.map(z => `<option value="${z.name}" ${z.name === currentZone ? "selected" : ""}>${z.name} (${money(z.cost)})</option>`).join("")}
      </select>
    </div>
    <div class="summary-row"><span>Subtotal</span><span class="val mono">${money(sub)}</span></div>
    <div class="summary-row"><span>Envío</span><span class="val mono">${money(ship)}</span></div>
    <div class="summary-row total"><span>Total</span><span class="val mono">${money(sub + ship)}</span></div>
    <form id="checkoutForm" style="margin-top:.9rem;">
      <div class="field">
        <label for="custName">Nombre completo</label>
        <input type="text" id="custName" required>
      </div>
      <div class="field">
        <label for="custPhone">Teléfono</label>
        <input type="tel" id="custPhone" required placeholder="7000-0000">
      </div>
      <div class="field">
        <label for="custAddress">Dirección de entrega</label>
        <textarea id="custAddress" required></textarea>
      </div>
      <button type="submit" class="btn btn-amber btn-block">Enviar pedido por WhatsApp</button>
      <p class="hint">Se abrirá WhatsApp con el resumen de tu pedido y costo total. Un asesor confirmará tu compra ahí mismo.</p>
    </form>
  `;
  document.getElementById("zoneSelect").addEventListener("change", (e) => {
    currentZone = e.target.value;
    renderCart();
  });
  document.getElementById("checkoutForm").addEventListener("submit", handleCheckout);
}

async function loadConfig(){
  try{
    const shipSnap = await getDoc(doc(db, "config", "shipping"));
    zones = shipSnap.exists() ? (shipSnap.data().zones || []) : [];
  }catch(e){ zones = []; }
  if (!zones.length){
    zones = [{ name: "Retiro en tienda", cost: 0 }];
  }
  currentZone = zones[0].name;

  try{
    const genSnap = await getDoc(doc(db, "config", "general"));
    if (genSnap.exists() && genSnap.data().whatsappNumber){
      whatsappNumber = genSnap.data().whatsappNumber;
    }
  }catch(e){ /* usa el número de respaldo */ }
}

async function handleCheckout(e){
  e.preventDefault();
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const address = document.getElementById("custAddress").value.trim();
  const zoneName = currentZone;
  const ship = currentShippingCost();
  const sub = subtotal();
  const total = sub + ship;

  if (!cart.length){ showToast("Tu carrito está vacío.", true); return; }

  const order = {
    customerName: name,
    customerPhone: phone,
    customerAddress: address,
    zone: zoneName,
    items: cart.map(i => ({ productId: i.productId, name: i.name, price: i.price, qty: i.qty })),
    subtotal: sub,
    shippingCost: ship,
    total,
    status: "nuevo",
    createdAt: serverTimestamp()
  };

  const submitBtn = e.target.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando...";

  try{
    await addDoc(collection(db, "orders"), order);

    const lines = cart.map(i => `• ${i.qty} x ${i.name} — ${money(i.price * i.qty)}`).join("%0A");
    const msg =
      `*Nuevo pedido*%0A%0A` +
      `${lines}%0A%0A` +
      `Subtotal: ${money(sub)}%0A` +
      `Envío (${zoneName}): ${money(ship)}%0A` +
      `*Total: ${money(total)}*%0A%0A` +
      `Cliente: ${name}%0A` +
      `Teléfono: ${phone}%0A` +
      `Dirección: ${address}`;

    window.open(`https://wa.me/${whatsappNumber}?text=${msg}`, "_blank");

    cart = [];
    saveCart();
    renderCart();
    closeCart();
    showToast("¡Pedido enviado! Revisa WhatsApp para confirmar.");
  }catch(err){
    showToast("No se pudo enviar el pedido. Intenta de nuevo.", true);
    console.error(err);
  }finally{
    submitBtn.disabled = false;
    submitBtn.textContent = "Enviar pedido por WhatsApp";
  }
}

function openCart(){ overlay.classList.add("open"); drawer.classList.add("open"); }
function closeCart(){ overlay.classList.remove("open"); drawer.classList.remove("open"); }

cartBtn.addEventListener("click", openCart);
closeDrawer.addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);

renderCartCount();
loadConfig().then(renderCart);
