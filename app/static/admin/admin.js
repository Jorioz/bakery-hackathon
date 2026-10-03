const api = "/admin/api";
const $ = (id) => document.getElementById(id);
const q = $("q"), results = $("results"), label = $("label"), addBtn = $("add"), statusEl = $("status");
let selected = null, debounce;

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "error" : "";
}

async function request(path, opts) {
  const res = await fetch(api + path, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}

function select(p) {
  selected = p;
  q.value = p.name;
  label.value = p.label;
  label.disabled = addBtn.disabled = false;
  results.hidden = true;
}

function clearSelection() {
  selected = null;
  label.value = "";
  label.disabled = addBtn.disabled = true;
}

q.addEventListener("input", () => {
  clearSelection();
  clearTimeout(debounce);
  debounce = setTimeout(async () => {
    const term = q.value.trim();
    if (!term) { results.hidden = true; return; }
    try {
      const products = await request(`/products?q=${encodeURIComponent(term)}`);
      results.replaceChildren(...products.map((p) => {
        const li = document.createElement("li");
        li.innerHTML = `<span></span><span class="price">$${p.price.toFixed(2)}</span>`;
        li.firstChild.textContent = p.name;
        li.addEventListener("mousedown", () => select(p));
        return li;
      }));
      results.hidden = products.length === 0;
    } catch (e) { setStatus(e.message, true); }
  }, 150);
});
q.addEventListener("blur", () => { results.hidden = true; });

$("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selected) return;
  try {
    await request("/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.value, statcan_product: selected.name }),
    });
    setStatus(`Added ${selected.name}`);
    q.value = "";
    clearSelection();
    load();
  } catch (err) { setStatus(err.message, true); }
});

$("custom-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("c-label").value.trim();
  try {
    await request("/items/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: name, unit_text: $("c-unit").value, price: parseFloat($("c-price").value) }),
    });
    setStatus(`Added custom item ${name}`);
    e.target.reset();
    load();
  } catch (err) { setStatus(err.message, true); }
});

$("flipp-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("flipp");
  btn.disabled = true;
  setStatus("Fetching this week's Flipp flyers…");
  try {
    const postal = encodeURIComponent($("postal").value.trim());
    const r = await request(`/refresh/flipp?postal_code=${postal}`, { method: "POST" });
    setStatus(`Flipp: ${r.matched} matches from ${r.listings} flyer listings`);
    load();
  } catch (err) { setStatus(err.message, true); }
  finally { btn.disabled = false; }
});

async function load() {
  const items = await request("/items");
  $("empty").hidden = items.length > 0;
  $("items").replaceChildren(...items.map((it) => {
    const tr = document.createElement("tr");
    const best = Math.min(...it.prices.filter((p) => p.source === "mock").map((p) => p.price));
    const prices = it.prices.map((p) => {
      const cls = p.source !== "mock" ? "src" : p.price === best ? "best" : "";
      return `<span class="${cls}">${p.merchant}${p.source === "flipp" ? " (flyer)" : ""}: $${p.price.toFixed(2)}</span>`;
    }).join("");
    tr.innerHTML = `<td></td><td></td><td class="prices">${prices}</td><td><button class="remove">Remove</button></td>`;
    tr.children[0].textContent = it.label;
    tr.children[1].textContent = it.product_name;
    if (it.source === "custom") {
      const b = document.createElement("span");
      b.className = "badge"; b.textContent = "custom";
      tr.children[1].append(b);
    }
    tr.querySelector("button").addEventListener("click", async () => {
      try { await request(`/items/${it.id}`, { method: "DELETE" }); setStatus(`Removed ${it.label}`); load(); }
      catch (err) { setStatus(err.message, true); }
    });
    return tr;
  }));
}

load().catch((e) => setStatus(e.message, true));
