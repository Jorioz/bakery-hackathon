const api = "/admin/api/kitchen";
const $ = (id) => document.getElementById(id);
const statusEl = $("status");
let ingredients = [];

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "error" : "";
}

async function request(path, method = "GET", body) {
  const res = await fetch(api + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = Array.isArray(err.detail) ? err.detail.map((d) => d.msg).join("; ") : err.detail;
    throw new Error(detail || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}

// Runs a mutation, reports errors, and reloads everything so derived fields (on hand, alerts) stay correct.
async function save(fn, msg) {
  try { await fn(); setStatus(msg); } catch (e) { setStatus(e.message, true); }
  await load();
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k in node && k !== "list") node[k] = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

function removeBtn(onclick) {
  return el("button", { className: "remove", type: "button", title: "Remove", onclick }, "✕");
}

const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (iso) => Math.round((new Date(iso) - new Date(today())) / 86400000);

// --- ingredients ---

function ingredientRow(i) {
  const tr = el("tr");
  const field = (key, attrs = {}) => {
    const input = el("input", { value: i[key], ...attrs });
    input.addEventListener("change", () => update({ [key]: attrs.type === "number" ? Number(input.value) : input.value }));
    return el("td", {}, input);
  };
  const update = (patch) => save(() => request(`/ingredients/${i.id}`, "PUT", { ...i, ...patch }), `Saved ${i.name}.`);
  const role = el("select", { onchange: (e) => update({ role: e.target.value }) },
    ...["addin", "base"].map((r) => el("option", { value: r, selected: r === i.role }, r)));
  const perish = el("input", { type: "checkbox", checked: i.perishable, onchange: (e) => update({ perishable: e.target.checked }) });

  const badges = [];
  if (i.low_stock) badges.push(el("span", { className: "badge bad" }, "reorder"));
  if (i.expired_batches) badges.push(el("span", { className: "badge bad" }, `${i.expired_batches} expired`));
  if (i.expiring_batches) badges.push(el("span", { className: "badge" }, "expiring soon"));

  tr.append(
    field("name"), el("td", {}, role), field("unit_text", { className: "short" }),
    field("baseline", { type: "number", step: "0.01", min: "0.01", className: "short" }),
    el("td", {}, perish), field("stock_unit", { className: "short" }),
    field("reorder_at", { type: "number", step: "any", min: "0", className: "short" }),
    el("td", { className: "nowrap" }, `${+i.on_hand.toFixed(2)} ${i.stock_unit}`, ...badges),
    el("td", {}, removeBtn(() => {
      if (confirm(`Remove ${i.name}? Its batches and special links go too.`))
        save(() => request(`/ingredients/${i.id}`, "DELETE"), `Removed ${i.name}.`);
    })),
  );
  if (i.low_stock || i.expired_batches) tr.className = "alert";
  return tr;
}

// --- specials ---

function specialCard(s) {
  const update = (patch) => save(() => request(`/specials/${s.id}`, "PUT", { ...s, ...patch }), `Saved ${s.name}.`);
  const byId = Object.fromEntries(ingredients.map((i) => [i.id, i]));
  const short = s.ingredient_ids.map((id) => byId[id]).filter((i) => i && (i.on_hand <= 0 || i.low_stock));

  const name = el("input", { value: s.name, className: "title", onchange: (e) => update({ name: e.target.value }) });
  const status = el("select", { className: `status ${s.status}`, onchange: (e) => update({ status: e.target.value }) },
    ...["idea", "testing", "active", "retired"].map((v) => el("option", { value: v, selected: v === s.status }, v)));
  const notes = el("textarea", { value: s.notes, placeholder: "Notes: portions, taste tests, pricing…",
    onchange: (e) => update({ notes: e.target.value }) });
  const addins = el("div", { className: "addins" }, ...ingredients.filter((i) => i.role === "addin").map((i) =>
    el("label", { className: "check" },
      el("input", { type: "checkbox", checked: s.ingredient_ids.includes(i.id), onchange: (e) => {
        const ids = e.target.checked ? [...s.ingredient_ids, i.id] : s.ingredient_ids.filter((x) => x !== i.id);
        update({ ingredient_ids: ids });
      } }),
      i.name)));

  return el("div", { className: "card" },
    el("div", { className: "card-head" }, name, status, removeBtn(() => {
      if (confirm(`Remove ${s.name}?`)) save(() => request(`/specials/${s.id}`, "DELETE"), `Removed ${s.name}.`);
    })),
    short.length ? el("p", { className: "hint bad" }, `Low or out: ${short.map((i) => i.name).join(", ")}`) : "",
    addins, notes);
}

// --- inventory ---

function batchRow(b) {
  const update = (patch) => save(() => request(`/inventory/${b.id}`, "PUT", { ...b, ...patch }), `Saved batch.`);
  const qty = el("input", { type: "number", min: "0", step: "any", value: b.quantity, className: "short",
    onchange: (e) => update({ quantity: Number(e.target.value) }) });
  const exp = el("input", { type: "date", value: b.expires_on || "",
    onchange: (e) => update({ expires_on: e.target.value || null }) });

  let flag = "";
  if (b.expires_on) {
    const d = daysUntil(b.expires_on);
    if (d < 0) flag = el("span", { className: "badge bad" }, "expired");
    else if (d <= 3) flag = el("span", { className: "badge" }, d === 0 ? "today" : `${d}d left`);
  }
  const tr = el("tr", {},
    el("td", {}, b.name),
    el("td", { className: "nowrap" }, qty, ` ${b.stock_unit}`),
    el("td", { className: "nowrap" }, exp, flag),
    el("td", {}, b.received_on),
    el("td", {}, removeBtn(() => save(() => request(`/inventory/${b.id}`, "DELETE"), "Removed batch."))));
  if (b.expires_on && daysUntil(b.expires_on) < 0) tr.className = "alert";
  return tr;
}

// --- load + forms ---

async function load() {
  try {
    const [ings, specials, batches] = await Promise.all(
      [request("/ingredients"), request("/specials"), request("/inventory")]);
    ingredients = ings;
    $("ingredients").replaceChildren(...ings.map(ingredientRow));
    $("specials").replaceChildren(...specials.map(specialCard));
    $("batches").replaceChildren(...batches.map(batchRow));
    $("batch-ing").replaceChildren(...ings.map((i) => el("option", { value: i.id }, i.name)));
  } catch (e) { setStatus(e.message, true); }
}

function formData(form) {
  const data = Object.fromEntries(new FormData(form));
  for (const input of form.querySelectorAll("input[type=number], select[name$=_id]"))
    if (data[input.name] !== undefined) data[input.name] = Number(data[input.name]);
  for (const input of form.querySelectorAll("input[type=checkbox]")) data[input.name] = input.checked;
  return data;
}

$("ing-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = formData(e.target);
  save(() => request("/ingredients", "POST", data).then(() => e.target.reset()), `Added ${data.name}.`);
});

$("special-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = formData(e.target);
  save(() => request("/specials", "POST", data).then(() => e.target.reset()), `Added ${data.name}.`);
});

$("batch-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = formData(e.target);
  data.expires_on = data.expires_on || null;
  save(() => request("/inventory", "POST", data).then(() => e.target.reset()), "Added batch.");
});

load();
