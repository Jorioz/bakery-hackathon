import { useState, type ReactNode } from "react";
import { api, isLiveWorkspace, type LiveWorkspaceName } from "./api";
import { expiryLabel, formatMoney, titleCase } from "./api/format";
import { useApi, type AsyncState } from "./hooks/useApi";
import type { RecipeView, WorkspaceView } from "./models";

const A = "/assets";

type Flavor = {
  name: string;
  price: string;
  cost: string;
  type: "Original" | "Weekly";
  sold: number;
  revenue: string;
  margin: string;
  sellThrough: number;
  waste: string;
  status: string;
  image: string;
};

const flavors: Flavor[] = [
  { name: "Coffee Cream Parfait", price: "$5.50", cost: "$1.90", type: "Original", sold: 38, revenue: "$209", margin: "65%", sellThrough: 100, waste: "$0", status: "Sold out", image: "flavor-latte-kitty.png" },
  { name: "Strawberry Shortcake Parfait", price: "$7.00", cost: "$2.60", type: "Weekly", sold: 24, revenue: "$168", margin: "63%", sellThrough: 96, waste: "$5", status: "Sold out", image: "flavor-strawberry.png" },
  { name: "Golden Caramel Parfait", price: "$4.50", cost: "$1.40", type: "Original", sold: 31, revenue: "$139", margin: "69%", sellThrough: 88, waste: "$6", status: "Near expiry", image: "flavor-golden-croissant.png" },
  { name: "Matcha Cloud Parfait", price: "$6.00", cost: "$2.20", type: "Weekly", sold: 19, revenue: "$114", margin: "63%", sellThrough: 76, waste: "$13", status: "Sitting", image: "flavor-matcha-blob.png" },
  { name: "Blueberry Lemon Parfait", price: "$4.00", cost: "$1.60", type: "Original", sold: 14, revenue: "$56", margin: "60%", sellThrough: 56, waste: "$14", status: "Near expiry", image: "flavor-blueberry-jelly.png" },
];

const voteItems = [
  { name: "Coffee Cream Parfait", votes: 63, image: "flavor-latte-kitty.png", note: "Sold out this week" },
  { name: "Chocolate Mochi Parfait", votes: 51, image: "flavor-choco-mochi.png", note: "Was a weekly special" },
  { name: "Salted Caramel Parfait", votes: 44, image: "flavor-pretzel.png", note: "Original · High margin" },
  { name: "Matcha Cloud Parfait", votes: 38, image: "flavor-matcha-blob.png", note: "Sitting in stock" },
];

const nav = ["Overview", "Flavor Lab", "Recipes", "Inventory", "Suppliers", "Orders", "Taxes", "Sales & Votes"];

function Icon({ src }: { src: string }) {
  return <img aria-hidden="true" className="icon" src={`${A}/${src}`} />;
}

function Header({ active, onNavigate }: { active: string; onNavigate: (item: string) => void }) {
  return (
    <header className="topbar">
      <a className="brand" href="#main" aria-label="Grandma's Parfait home">
        <img src={`${A}/e7037.png`} alt="" />
        <strong>Grandma&apos;s Bakery</strong>
      </a>
      <nav className="primary-nav" aria-label="Main navigation">
        {nav.map((item) => (
          <button
            className={active === item ? "nav-button active" : "nav-button"}
            key={item}
            onClick={() => onNavigate(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="header-actions">
        <span className="live"><span /> Verifone connected</span>
        <button className="icon-button" aria-label="Open settings">
          <Icon src="7cea4.svg" />
        </button>
      </div>
    </header>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function FlavorTable({ filter }: { filter: string }) {
  const shown = flavors.filter((flavor) => filter === "All Flavors" || flavor.type === filter);
  return (
    <div className="table-wrap" role="region" aria-label="Flavor sales table" tabIndex={0}>
      <table>
        <thead>
          <tr>
            <th>Flavor</th><th>Type</th><th>Sold</th><th>Revenue</th><th>Margin</th><th>Sell-through</th><th>Waste</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((flavor) => (
            <tr key={flavor.name}>
              <td>
                <div className="flavor-name">
                  <img src={`${A}/${flavor.image}`} alt="" />
                  <span><b>{flavor.name}</b><small>{flavor.price} · cost {flavor.cost}</small></span>
                </div>
              </td>
              <td><span className={`tag ${flavor.type === "Weekly" ? "yellow" : ""}`}>{flavor.type}</span></td>
              <td><b>{flavor.sold}</b></td>
              <td><b>{flavor.revenue}</b></td>
              <td className="positive"><b>{flavor.margin}</b></td>
              <td>
                <b className={flavor.sellThrough < 70 ? "danger-text" : flavor.sellThrough < 85 ? "warning-text" : "positive"}>{flavor.sellThrough}%</b>
                <div className="mini-track"><span style={{ width: `${flavor.sellThrough}%` }} /></div>
              </td>
              <td className={flavor.waste === "$0" ? "positive" : "danger-text"}><b>{flavor.waste}</b></td>
              <td><span className={`status ${flavor.status.replace(" ", "-").toLowerCase()}`}>{flavor.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Votes() {
  const [votes, setVotes] = useState(voteItems);
  const [message, setMessage] = useState("");
  function addVote(index: number) {
    setVotes((current) => current.map((item, i) => i === index ? { ...item, votes: item.votes + 1 } : item));
    setMessage(`Vote added for ${votes[index].name}.`);
  }
  return (
    <aside className="votes-panel" aria-labelledby="votes-title">
      <div className="votes-heading">
        <div><h2 id="votes-title">Customer Flavor Votes</h2><span>128 votes this week</span></div>
        <button className="secondary-button">Share poll</button>
      </div>
      <div className="vote-tabs"><button className="active">Comeback votes</button><button>Recurring loves</button></div>
      <p className="helper">Customers voted for the flavors they want back. Select a flavor to add your vote.</p>
      <p className="sr-only" aria-live="polite">{message}</p>
      <ol className="vote-list">
        {votes.map((item, index) => (
          <li key={item.name}>
            <button className="vote-row" onClick={() => addVote(index)} aria-label={`Vote for ${item.name}, currently ${item.votes} votes`}>
              <span className="rank">{index + 1}</span>
              <img src={`${A}/${item.image}`} alt="" />
              <span className="vote-info">
                <span><b>{item.name}</b><strong>{item.votes} votes</strong></span>
                <span className="vote-track"><i style={{ width: `${(item.votes / 70) * 100}%` }} /></span>
                <small>{item.note}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="poll-note">Select any flavor above to record one customer vote.</div>
    </aside>
  );
}

function ExpiryCard() {
  const state = useApi((signal) => api.inventory.get(signal), []);
  const [handled, setHandled] = useState<string[]>([]);
  const items = state.data ? api.inventory.expiringSoon(state.data.stock).filter((item) => !handled.includes(item.name)) : [];
  return (
    <article className="card expiry-card">
      <div className="card-title"><h2>Ingredients approaching expiry</h2><span>{items.length} items</span></div>
      {state.loading && <p className="empty-state">Loading stock…</p>}
      {state.error && <p className="danger-text">{state.error} <button onClick={state.reload}>Try again</button></p>}
      {items.map((item) => (
        <div className="expiry-item" key={item.name}>
          <span className="food-dot" />
          <span><b>{titleCase(item.name)}</b><small>{item.stockLabel} in stock{item.expiredBatches ? ` · ${item.expiredBatches} expired batch` : ` · Expires ${item.nextExpiry}`}</small></span>
          <strong>{item.expiredBatches ? "Expired" : expiryLabel(item.nextExpiry)}</strong>
          <button onClick={() => setHandled((all) => [...all, item.name])}>Used</button>
        </div>
      ))}
      {state.data && items.length === 0 && <p className="empty-state">All expiring ingredients have been handled.</p>}
    </article>
  );
}

function NextSpecialCard({ onOrder }: { onOrder: (name: string) => void }) {
  const state = useApi(() => api.specials.scout(), []);
  return (
    <article className="card special-card">
      <div className="card-title"><h2>Best next weekly special</h2><span>Recommended</span></div>
      <AsyncView state={state} label="flyer deals" hint="Checking this week’s live flyers…">
        {(scout) => {
          const top = scout.specials[0];
          if (!top) return <p className="empty-state">No active specials yet.</p>;
          const deal = top.bestDeal;
          return (
            <>
              <div className="special-body">
                <img src={`${A}/${top.image}`} alt="" />
                <div><h3>{top.name}</h3><p>{deal ? `${titleCase(deal.ingredient)} is ${Math.round(deal.discountPct)}% off at ${deal.merchant}` : "No add-ins on sale this week"}</p></div>
              </div>
              <div className="recommendations"><span>{top.addinsOnSale.length} of {top.addins.length} add-ins on sale</span>{deal && <span>{deal.merchant}</span>}</div>
              <button className="primary-button" onClick={() => onOrder(top.name)}>Add to Flavor Lab</button>
            </>
          );
        }}
      </AsyncView>
    </article>
  );
}

function SalesDashboard({ onOrder }: { onOrder: (name: string) => void }) {
  const [filter, setFilter] = useState("All Flavors");
  const [synced, setSynced] = useState(false);
  return (
    <div className="sales-layout">
      <main id="main" className="main-content">
        <div className="page-heading">
          <div>
            <h1>Sales &amp; Flavor Votes</h1>
            <p>A simple view of sales, sell-through, waste, and customer comeback votes.</p>
          </div>
          <div className="heading-actions">
            <button className="secondary-button"><Icon src="85cf9.svg" /> Export</button>
            <button className="primary-button" onClick={() => setSynced(true)}><Icon src="e8774.svg" /> Reconcile sales</button>
          </div>
        </div>
        <div className="summary-pills">
          <span>Week of Jun 9–15</span><span>128 customer votes</span><span>Sales and votes are sample data</span>
        </div>
        <section className="metrics" aria-label="Weekly sales summary">
          <Metric label="Verifone sales" value="$1,284" detail="Up 12% from last week" />
          <Metric label="Average margin" value="64%" detail="Ingredient cost $462" />
          <Metric label="Waste value" value="$38" detail="Sample figure" tone="danger-text" />
          <Metric label="Sell-through" value="88%" detail="4 items sold out this week" />
        </section>
        <div className="sync-banner" role="status">
          <span className="sync-dot" />
          {synced ? "Sales reconciled just now. All 47 transactions matched." : "Verifone sync complete — last reconciled today at 9:02 AM. All 47 transactions matched."}
          <button>View log</button>
        </div>
        <section aria-labelledby="flavor-sales-title">
          <h2 className="sr-only" id="flavor-sales-title">Flavor sales</h2>
          <div className="filter-tabs" role="group" aria-label="Filter flavors">
            {["All Flavors", "Original", "Weekly"].map((item) => (
              <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item === "Weekly" ? "Weekly Specials" : item}</button>
            ))}
          </div>
          <FlavorTable filter={filter} />
        </section>
        <section className="bottom-grid">
          <ExpiryCard />
          <NextSpecialCard onOrder={onOrder} />
        </section>
      </main>
      <Votes />
    </div>
  );
}

type WorkspaceData = WorkspaceView;

const moduleData: Record<string, WorkspaceData> = {
  Overview: {
    title: "Good morning",
    intro: "Your complete view of today’s sales, stock, suppliers, and bills.",
    primaryAction: "Record a new sale",
    pills: ["Monday, Jul 14", "2 urgent actions", "Verifone synced"],
    metrics: [
      { label: "Today’s revenue", value: "$847", detail: "Up 18% from yesterday" },
      { label: "Average order", value: "$5.96", detail: "Weekly average $5.56" },
      { label: "Sell-through", value: "83%", detail: "Strawberry cream is lagging" },
      { label: "Bills due", value: "$354", detail: "2 payments need attention", tone: "danger-text" },
    ],
    notice: "Verifone is fully reconciled. No differences were found in today’s 31 transactions.",
    tabs: ["Today", "This Week", "Needs Attention"],
    tableTitle: "Today’s priorities",
    columns: ["Priority", "Area", "Due", "Value", "Status", "Action"],
    rows: [
      { name: "Use heavy cream", detail: "1.4L remaining · expires tomorrow", cells: ["Inventory", "Today", "$18 at risk"], status: "Urgent", action: "Use now" },
      { name: "FreshCo delivery", detail: "Mango, cream and butter · 18 items", cells: ["Orders", "10–11 AM", "$284.50"], status: "Arriving", action: "View" },
      { name: "Mango supplier deal", detail: "20% off · deal ends Friday", cells: ["Suppliers", "Friday", "Save $24"], status: "Deal", action: "Order" },
      { name: "Strawberry Parfait comeback", detail: "63 customer votes this week", cells: ["Flavor Lab", "This week", "67% margin"], status: "Popular", action: "Create" },
    ],
    sideTitle: "Quick view",
    sideIntro: "The most useful information for your next decision.",
    sideItems: [
      { title: "Mango Yuzu Parfait", detail: "97% sold through · 34 sold today", badge: "Trending", image: "flavor-golden-croissant.png" },
      { title: "Heavy cream", detail: "Use before tomorrow", badge: "Use first" },
      { title: "SweetRoot bill", detail: "$158 · four days overdue", badge: "Pay now" },
    ],
  },
  Orders: {
    title: "Orders, Bills & Tax",
    intro: "Track incoming stock, pay supplier bills, and review auto-filled tax details.",
    primaryAction: "New purchase order",
    pills: ["3 upcoming deliveries", "2 bills due", "Tax auto-filled"],
    metrics: [
      { label: "Open orders", value: "$893", detail: "Across 3 suppliers" },
      { label: "Bills due", value: "$354", detail: "One payment is overdue", tone: "danger-text" },
      { label: "Tax credits", value: "$87.40", detail: "From matched supplier bills" },
      { label: "Next delivery", value: "Today", detail: "Sunshine Dairy · 10–11 AM" },
    ],
    notice: "Cream is low. Sunshine Dairy can add two cartons to today’s delivery before 9:30 AM.",
    tabs: ["Purchase Orders", "Bills & Payments", "Tax Summary"],
    tableTitle: "Upcoming deliveries",
    columns: ["Supplier", "Order", "Items", "Total", "Delivery", "Action"],
    rows: [
      { name: "Sunshine Dairy Co.", detail: "Cream, butter and milk", cells: ["PO #2241", "18 items", "$284.50"], status: "Today 10–11", action: "Receive" },
      { name: "Golden Grain Supplies", detail: "Flour, oats and almonds", cells: ["PO #2242", "24 items", "$196.00"], status: "Tomorrow", action: "Confirm" },
      { name: "Berry & Bloom Farm", detail: "Strawberries, blueberries and mango", cells: ["PO #2239", "30 items", "$412.80"], status: "Thursday", action: "View" },
      { name: "SweetRoot Co.", detail: "Sugar and vanilla · invoice #558", cells: ["Bill", "2 items", "$158.00"], status: "Overdue", action: "Pay now" },
    ],
    sideTitle: "Bills & payments",
    sideIntro: "Payments requiring review or confirmation.",
    sideItems: [
      { title: "SweetRoot Co.", detail: "Invoice #558 · 4 days overdue", badge: "$158.00" },
      { title: "Golden Grain", detail: "Invoice #612 · due Jul 16", badge: "$196.00" },
      { title: "Cafe Essentials", detail: "Receipt matched and verified", badge: "Paid" },
    ],
  },
};

function AsyncView<T>({ state, label, hint, children }: { state: AsyncState<T>; label: string; hint?: string; children: (data: T) => ReactNode }) {
  if (state.loading) return <div className="state-box" role="status">Loading {label}…{hint && <small>{hint}</small>}</div>;
  if (state.error || !state.data) return (
    <div className="state-box error" role="alert">
      <b>Couldn’t load {label}</b><span>{state.error}</span>
      <button className="secondary-button" onClick={state.reload}>Try again</button>
    </div>
  );
  return <>{children(state.data)}</>;
}

function WorkspacePage({ data, onAction }: { data: WorkspaceData; onAction: (label: string) => void }) {
  const [tab, setTab] = useState(data.tabs[0]);
  const rows = data.rows.filter((row) => !row.tabs || row.tabs.includes(tab));
  return (
    <div className="workspace-layout">
      <main className="workspace-main" id="main">
        <div className="page-heading">
          <div><h1>{data.title}</h1><p>{data.intro}</p></div>
          <div className="heading-actions">
            <button className="secondary-button"><Icon src="85cf9.svg" /> Export</button>
            <button className="primary-button" onClick={() => onAction(data.primaryAction)}>{data.primaryAction}</button>
          </div>
        </div>
        <div className="summary-pills">{data.pills.map((pill) => <span key={pill}>{pill}</span>)}</div>
        <section className="metrics" aria-label={`${data.title} summary`}>
          {data.metrics.map((metric) => <Metric {...metric} key={metric.label} />)}
        </section>
        <div className="sync-banner workspace-notice" role="status"><span className="sync-dot" />{data.notice}<button onClick={() => onAction("View recommendation")}>Review</button></div>
        <section aria-labelledby="workspace-table-title">
          <div className="section-bar">
            <div><h2 id="workspace-table-title">{data.tableTitle}</h2><p>Updated from your latest stock, supplier, and sales information.</p></div>
            <div className="filter-tabs compact" role="group" aria-label={`Filter ${data.tableTitle}`}>
              {data.tabs.map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</button>)}
            </div>
          </div>
          <div className="table-wrap workspace-table" role="region" aria-label={data.tableTitle} tabIndex={0}>
            <table>
              <thead><tr>{data.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={`${row.name}-${row.detail}`}>
                  <td><span className="primary-cell"><b>{row.name}</b><small>{row.detail}</small></span></td>
                  {row.cells.map((cell, index) => <td key={`${cell}-${index}`}>{cell}</td>)}
                  <td><span className={`status ${row.tone ? `tone-${row.tone}` : row.status.toLowerCase().replaceAll(" ", "-")}`}>{row.status}</span></td>
                  <td><button className="table-action" onClick={() => onAction(`${row.action}: ${row.name}`)}>{row.action}</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={data.columns.length} className="empty-row">Nothing to show here.</td></tr>}</tbody>
            </table>
          </div>
        </section>
      </main>
      <aside className="workspace-side">
        <div className="side-heading"><h2>{data.sideTitle}</h2><span>{data.sideItems.length}</span></div>
        <p>{data.sideIntro}</p>
        <div className="side-list">{data.sideItems.map((item) => (
          <button className="side-item" key={item.title} onClick={() => onAction(item.title)}>
            {item.image ? <img src={`${A}/${item.image}`} alt="" /> : <span className="side-marker" />}
            <span><b>{item.title}</b><small>{item.detail}</small></span>
            <strong>{item.badge}</strong>
          </button>
        ))}</div>
        <div className="side-summary"><span>Need help?</span><h3>One task at a time</h3><p>Choose any row or card to see clear next steps before anything is saved.</p><button className="secondary-button">Show guided help</button></div>
      </aside>
    </div>
  );
}

/** Workspaces backed by the API; the rest (Overview, Orders) still use sample data. */
function LiveWorkspace({ name, onAction }: { name: LiveWorkspaceName; onAction: (label: string) => void }) {
  const state = useApi(() => api.workspaces[name](), [name]);
  return (
    <AsyncView state={state} label={name} hint={name === "Flavor Lab" ? "Checking this week’s live flyers — this can take a few seconds." : undefined}>
      {(data) => <WorkspacePage key={name} data={data} onAction={onAction} />}
    </AsyncView>
  );
}

function RecipesPage({ onAction }: { onAction: (label: string) => void }) {
  const state = useApi((signal) => api.recipes.list(signal), []);
  return <AsyncView state={state} label="recipes">{(recipes) => <RecipesContent recipes={recipes} onAction={onAction} />}</AsyncView>;
}

function RecipesContent({ recipes, onAction }: { recipes: RecipeView[]; onAction: (label: string) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Recipes");
  const [selectedName, setSelectedName] = useState(recipes[0]?.name ?? "");
  const categories = ["All Recipes", "Original", "Weekly Special"];
  const selected = recipes.find((recipe) => recipe.name === selectedName) ?? recipes[0];
  const shown = recipes.filter((recipe) => (category === "All Recipes" || recipe.category === category) && recipe.name.toLowerCase().includes(query.toLowerCase()));
  const costs = recipes.flatMap((recipe) => (recipe.costEach === null ? [] : [recipe.costEach]));
  const averageCost = costs.length ? formatMoney(costs.reduce((sum, cost) => sum + cost, 0) / costs.length) : "—";
  const weekly = recipes.filter((recipe) => recipe.category === "Weekly Special").length;
  const ready = recipes.filter((recipe) => (recipe.servings ?? 0) > 0).length;
  const attention = recipes.filter((recipe) => !recipe.stockOk).length;
  if (!selected) return <main className="recipes-main" id="main"><div className="empty-recipes"><h2>No recipes yet</h2><p>Add specials in the admin kitchen page.</p></div></main>;
  return (
    <div className="recipes-layout">
      <main className="recipes-main" id="main">
        <div className="page-heading">
          <div><h1>Recipes</h1><p>Every parfait, its ingredients, and what it costs at today’s best prices.</p></div>
          <div className="heading-actions"><button className="primary-button" onClick={() => onAction("Create a new recipe")}>New recipe</button></div>
        </div>
        <div className="summary-pills"><span>{recipes.length} recipes</span><span>{recipes.length - weekly} originals</span><span>{weekly} weekly specials</span></div>
        <section className="metrics" aria-label="Recipe summary">
          <Metric label="Active recipes" value={String(recipes.length)} detail="Not retired" />
          <Metric label="Average cost each" value={averageCost} detail="At the best-priced retailer" />
          <Metric label="Ready to make" value={String(ready)} detail="Enough unexpired stock" />
          <Metric label="Need attention" value={String(attention)} detail="Low or out of stock" tone={attention ? "danger-text" : undefined} />
        </section>
        <div className="recipe-tools">
          <label className="search-box"><span className="sr-only">Search recipes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes by name" /></label>
          <div className="filter-tabs compact" role="group" aria-label="Filter recipes">{categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
        </div>
        <section className="recipe-grid" aria-label="Recipe library">
          {shown.map((recipe) => (
            <button className={selected.name === recipe.name ? "recipe-card selected" : "recipe-card"} key={recipe.name} onClick={() => setSelectedName(recipe.name)}>
              <img src={`${A}/${recipe.image}`} alt="" />
              <span className="recipe-card-body">
                <span className="recipe-card-top"><span className="tag yellow">{recipe.category}</span><strong>{recipe.costEachLabel} each</strong></span>
                <b>{recipe.name}</b>
                <small>{recipe.ingredients.length} ingredients</small>
                <span className={recipe.stockOk ? "stock-ok" : "stock-warning"}>{recipe.stockLabel}</span>
              </span>
            </button>
          ))}
          {shown.length === 0 && <div className="empty-recipes"><h2>No recipes found</h2><p>Try a different name or category.</p></div>}
        </section>
      </main>
      <aside className="recipe-detail" aria-live="polite">
        <div className="detail-hero"><img src={`${A}/${selected.image}`} alt="" /><span><small>{selected.category}</small><h2>{selected.name}</h2><p>{selected.ingredients.length} ingredients per parfait</p></span></div>
        <div className="detail-costs"><span><small>Cost each</small><b>{selected.costEachLabel}</b></span><span><small>Servings</small><b>{selected.servings ?? "—"}</b></span><span><small>Stock</small><b>{selected.stockLabel}</b></span></div>
        <section className="detail-section"><div className="card-title"><h3>Ingredients</h3><span>Per parfait</span></div><ul>{selected.ingredients.map((item) => <li className="line" key={item.name}><span>{titleCase(item.name)}</span><b>{item.amountLabel}</b></li>)}</ul></section>
        <section className="detail-section"><div className="card-title"><h3>Best prices</h3></div><ul>{selected.ingredients.map((item) => <li className="line" key={item.name}><span>{titleCase(item.name)}</span><b>{item.priceLabel}</b></li>)}</ul></section>
        <div className="detail-actions"><button className="secondary-button" onClick={() => onAction(`Edit ${selected.name}`)}>Edit recipe</button><button className="primary-button" onClick={() => onAction(`Start a batch of ${selected.name}`)}>Start batch</button></div>
      </aside>
    </div>
  );
}

const taxExpenses = [
  { id: 1, date: "Jul 12", supplier: "Sunshine Dairy", category: "Ingredients", amount: 284.5, tax: 22.76, status: "Matched" },
  { id: 2, date: "Jul 11", supplier: "SweetRoot Co.", category: "Ingredients", amount: 158, tax: 12.64, status: "Review" },
  { id: 3, date: "Jul 10", supplier: "Cafe Essentials", category: "Packaging", amount: 67.2, tax: 5.38, status: "Matched" },
  { id: 4, date: "Jul 8", supplier: "Verifone", category: "Processing fees", amount: 86.4, tax: 6.91, status: "Matched" },
];

function TaxesPage({ onAction }: { onAction: (label: string) => void }) {
  const [period, setPeriod] = useState("Jul 1–13, 2025");
  const [included, setIncluded] = useState(taxExpenses.map((item) => item.id));
  const [filed, setFiled] = useState(false);
  const inputCredits = taxExpenses.filter((item) => included.includes(item.id)).reduce((sum, item) => sum + item.tax, 0);
  const salesTax = 421;
  const owing = salesTax - inputCredits;
  const toggleExpense = (id: number) => setIncluded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return (
    <div className="tax-layout">
      <main className="tax-main" id="main">
        <div className="page-heading">
          <div><h1>Taxes</h1><p>Prepare, review, and file your sales tax using matched sales and supplier receipts.</p></div>
          <div className="heading-actions"><button className="secondary-button" onClick={() => onAction("Download tax working paper")}>Download report</button><button className="primary-button" onClick={() => setFiled(true)}>Review &amp; file</button></div>
        </div>
        <div className="tax-period-row">
          <label><span>Filing period</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option>Jul 1–13, 2025</option><option>Jun 1–30, 2025</option><option>Apr 1–Jun 30, 2025</option></select></label>
          <span className="auto-status"><span /> Auto-filled from Verifone and matched bills</span>
        </div>
        <section className="metrics" aria-label="Tax summary">
          <Metric label="Taxable sales" value="$4,210" detail="47 matched transactions" />
          <Metric label="Sales tax collected" value="$421.00" detail="From Verifone receipts" />
          <Metric label="Input tax credits" value={`$${inputCredits.toFixed(2)}`} detail={`${included.length} deductible expenses`} />
          <Metric label="Net tax owing" value={`$${owing.toFixed(2)}`} detail="Due Jul 28, 2025" tone="warning-text" />
        </section>
        {filed ? <div className="tax-success" role="status"><b>Your tax return is ready to file.</b><span>All totals have been checked. Confirm your government account details to complete filing.</span><button onClick={() => onAction(`File tax return for ${period}`)}>Continue to filing</button></div> : <div className="sync-banner workspace-notice" role="status"><span className="sync-dot" />All Verifone sales are matched. One supplier receipt needs your review before filing.<button onClick={() => toggleExpense(2)}>Review receipt</button></div>}
        <section>
          <div className="section-bar"><div><h2>Deductible business expenses</h2><p>Select the expenses to include as input tax credits.</p></div><span className="selection-count">{included.length} of {taxExpenses.length} included</span></div>
          <div className="table-wrap workspace-table tax-table" role="region" aria-label="Deductible expenses" tabIndex={0}>
            <table><thead><tr><th>Include</th><th>Date &amp; supplier</th><th>Category</th><th>Expense</th><th>Tax credit</th><th>Status</th></tr></thead>
              <tbody>{taxExpenses.map((expense) => <tr key={expense.id}>
                <td><input className="tax-checkbox" type="checkbox" checked={included.includes(expense.id)} onChange={() => toggleExpense(expense.id)} aria-label={`Include ${expense.supplier} expense`} /></td>
                <td><span className="primary-cell"><b>{expense.supplier}</b><small>{expense.date} · Receipt attached</small></span></td>
                <td>{expense.category}</td><td>${expense.amount.toFixed(2)}</td><td className="positive"><b>${expense.tax.toFixed(2)}</b></td>
                <td><span className={`status ${expense.status.toLowerCase()}`}>{expense.status}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="tax-breakdown">
          <div><h2>How your amount is calculated</h2><p>Sales tax collected</p><p>Minus deductible input tax credits</p><strong>Estimated tax to pay</strong></div>
          <div className="tax-amounts"><span>$421.00</span><span>− ${inputCredits.toFixed(2)}</span><b>${owing.toFixed(2)}</b></div>
        </section>
      </main>
      <aside className="tax-side">
        <div className="side-heading"><h2>Filing checklist</h2><span>4</span></div>
        <p>Complete these checks before you submit the return.</p>
        <ol className="checklist">
          <li className="done"><span>1</span><div><b>Sales reconciled</b><small>47 Verifone transactions matched</small></div></li>
          <li className="done"><span>2</span><div><b>Supplier bills added</b><small>Four expenses are available</small></div></li>
          <li className={included.includes(2) ? "done" : ""}><span>3</span><div><b>Review SweetRoot receipt</b><small>Confirm the $12.64 tax credit</small></div></li>
          <li className={filed ? "done" : ""}><span>4</span><div><b>Review and file</b><small>Due Jul 28, 2025</small></div></li>
        </ol>
        <div className="tax-help"><span>Plain-language help</span><h3>What is an input tax credit?</h3><p>It is tax you paid on business purchases. It lowers the amount of sales tax you need to send.</p><button className="secondary-button">Read tax help</button></div>
        <p className="tax-disclaimer">Figures are estimates based on matched records. Review them or ask your tax professional before filing.</p>
      </aside>
    </div>
  );
}

type PurchaseItem = { id: number; ingredient: string; quantity: number; price: number };

const purchaseCatalog: Record<string, number> = {
  "Heavy cream · 2L": 11.8,
  "Fresh strawberries · 500g": 3.2,
  "Frozen mango · 1kg": 4.68,
  "Coconut cream · 1L": 2.4,
  "Matcha powder · 250g": 12.75,
};

function PurchaseOrderModal({ onClose }: { onClose: () => void }) {
  const [supplier, setSupplier] = useState("Sunshine Dairy Co.");
  const [delivery, setDelivery] = useState("2025-07-16");
  const [items, setItems] = useState<PurchaseItem[]>([{ id: 1, ingredient: "Heavy cream · 2L", quantity: 2, price: 11.8 }]);
  const [notes, setNotes] = useState("Please call before delivery.");
  const [created, setCreated] = useState(false);
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const tax = subtotal * 0.08;
  const updateItem = (id: number, changes: Partial<PurchaseItem>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  const addItem = () => setItems((current) => [...current, { id: Date.now(), ingredient: "Fresh strawberries · 500g", quantity: 1, price: 3.2 }]);
  const removeItem = (id: number) => setItems((current) => current.filter((item) => item.id !== id));
  if (created) return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal purchase-modal success-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-success-title">
        <span className="success-mark">Done</span><span className="modal-kicker">Purchase order created</span>
        <h2 id="purchase-success-title">PO #2244 is ready</h2><p>The ${ (subtotal + tax).toFixed(2) } order for {supplier} has been saved and is ready to send.</p>
        <div className="order-success-details"><span>Delivery requested</span><b>{delivery}</b><span>Items</span><b>{items.length}</b></div>
        <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Close</button><button className="primary-button" onClick={onClose}>Send to supplier</button></div>
      </section>
    </div>
  );
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close purchase order">×</button>
        <span className="modal-kicker">New order</span><h2 id="purchase-title">Create purchase order</h2><p>Add the ingredients you need, check the total, and save the order before sending it.</p>
        <div className="purchase-fields">
          <label>Supplier<select value={supplier} onChange={(event) => setSupplier(event.target.value)}><option>Sunshine Dairy Co.</option><option>FreshFarm</option><option>SweetRoots</option><option>Golden Grain Supplies</option></select></label>
          <label>Requested delivery<input type="date" value={delivery} onChange={(event) => setDelivery(event.target.value)} /></label>
        </div>
        <div className="purchase-items-heading"><h3>Order items</h3><button onClick={addItem}>+ Add ingredient</button></div>
        <div className="purchase-items">
          {items.map((item) => <div className="purchase-item" key={item.id}>
            <label><span>Ingredient</span><select value={item.ingredient} onChange={(event) => updateItem(item.id, { ingredient: event.target.value, price: purchaseCatalog[event.target.value] })}>{Object.keys(purchaseCatalog).map((name) => <option key={name}>{name}</option>)}</select></label>
            <label><span>Quantity</span><input min="1" type="number" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Math.max(1, Number(event.target.value)) })} /></label>
            <span className="line-total"><small>Line total</small><b>${(item.quantity * item.price).toFixed(2)}</b></span>
            <button className="remove-item" onClick={() => removeItem(item.id)} disabled={items.length === 1} aria-label={`Remove ${item.ingredient}`}>×</button>
          </div>)}
        </div>
        <label className="purchase-notes">Order notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <div className="purchase-summary"><span>Subtotal<b>${subtotal.toFixed(2)}</b></span><span>Estimated tax (8%)<b>${tax.toFixed(2)}</b></span><strong>Order total<b>${(subtotal + tax).toFixed(2)}</b></strong></div>
        <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={() => setCreated(true)} disabled={!items.length}>Create purchase order</button></div>
      </section>
    </div>
  );
}

function Modal({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close dialog">×</button>
        <span className="modal-kicker">Ready for review</span>
        <h2 id="dialog-title">{title}</h2>
        <p>Check the details before continuing. You can safely close this window without making changes.</p>
        <label>Notes (optional)<textarea placeholder="Add a note here" /></label>
        <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={onClose}>Confirm</button></div>
      </section>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("Sales & Votes");
  const [modal, setModal] = useState("");
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to main content</a>
      <Header active={active} onNavigate={setActive} />
      {active === "Sales & Votes" ? <SalesDashboard onOrder={(name) => setModal(`Add ${name} to Flavor Lab?`)} /> : active === "Recipes" ? <RecipesPage onAction={setModal} /> : active === "Taxes" ? <TaxesPage onAction={setModal} /> : isLiveWorkspace(active) ? <LiveWorkspace name={active} onAction={setModal} /> : <WorkspacePage key={active} data={moduleData[active]} onAction={setModal} />}
      {(modal === "Create purchase order" || modal === "New purchase order") ? <PurchaseOrderModal onClose={() => setModal("")} /> : modal && <Modal title={modal} onClose={() => setModal("")} />}
    </div>
  );
}
