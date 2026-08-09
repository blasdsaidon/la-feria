import React, { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  DollarSign,
  Home,
  Image as ImageIcon,
  LogOut,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

const DEFAULT_CATEGORIES = ["Remeras", "Pantalones", "Camperas", "Vestidos", "Calzado", "Accesorios"];
const NEW_PROVIDER = "__new_provider__";
const emptyProduct = { name: "", category: "Remeras", size: "", color: "", payout_price: "", sale_price: "", provider_id: "", provider_name: "" };

const money = (value) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));

const codeFor = (category) => {
  const prefix = category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  return `${prefix}-${Date.now().toString().slice(-6)}`;
};

const isOwnerRole = (role) => {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return ["owner", "dueno", "duena", "admin", "administrador", "administradora"].includes(normalized);
};

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("home");
  const [stockFormToken, setStockFormToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  const user = session?.user;
  const isOwner = isOwnerRole(profile?.role);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setView("home");
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) loadEverything();
  }, [user?.id]);

  async function loadEverything() {
    setLoading(true);
    setMessage("");
    const [profileResult, productsResult, salesResult, customersResult, providersResult, paymentsResult, categoriesResult] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("sales").select("*, sale_items(*)").order("date", { ascending: false }),
        supabase.from("customers").select("*").order("name"),
        supabase.from("providers").select("*").order("name"),
        supabase.from("provider_payments").select("*").order("date", { ascending: false }),
        supabase.from("categories").select("*").order("name"),
      ]);

    if (profileResult.error) setMessage("Falta cargar el perfil/rol de este usuario en la tabla profiles.");
    else setProfile(profileResult.data);

    setProducts(productsResult.data || []);
    setSales(salesResult.data || []);
    setCustomers(customersResult.data || []);
    setProviders(providersResult.data || []);
    setPayments(paymentsResult.data || []);
    setCategories((categoriesResult.data || []).map((item) => item.name).length ? categoriesResult.data.map((item) => item.name) : DEFAULT_CATEGORIES);
    setLoading(false);
  }

  if (!isSupabaseConfigured) return <Shell><div className="card"><h1>Falta configurar Supabase</h1><p>Completa las variables de entorno.</p></div></Shell>;
  if (loading) return <Shell><div className="empty">Cargando...</div></Shell>;
  if (!session) return <Login />;

  function openNewProduct() {
    setStockFormToken(Date.now());
    setView("stock");
  }

  return (
    <Shell className={view === "home" ? "home-shell" : ""}>
      {view !== "home" && view !== "finance" && <header className="topbar">
        <div>
          <p className="eyebrow">La Feria</p>
          <h1>{titleFor(view)}</h1>
        </div>
        <button className="icon-button" onClick={() => supabase.auth.signOut()} title="Salir"><LogOut size={18} /></button>
      </header>}

      {message && <div className="notice">{message}</div>}

      {view === "home" && <HomeView isOwner={isOwner} onLogout={() => supabase.auth.signOut()} openNewProduct={openNewProduct} profile={profile} setView={setView} />}
      {view === "stock" && <StockView categories={categories} formToken={stockFormToken} loadEverything={loadEverything} products={products} providers={providers} setMessage={setMessage} user={user} />}
      {view === "sell" && <SellView customers={customers} loadEverything={loadEverything} products={products} profile={profile} setMessage={setMessage} user={user} />}
      {view === "history" && <HistoryView sales={sales} />}
      {view === "people" && <PeopleView customers={customers} loadEverything={loadEverything} providers={providers} setMessage={setMessage} />}
      {view === "finance" && (isOwner ? <FinanceView loadEverything={loadEverything} payments={payments} products={products} providers={providers} sales={sales} setMessage={setMessage} /> : <div className="empty">Esta seccion es solo para el dueno.</div>)}

      <nav className="bottom-nav">
        <NavButton active={view === "home"} icon={Home} label="Inicio" onClick={() => setView("home")} />
        <NavButton active={view === "stock"} icon={Boxes} label="Stock" onClick={() => setView("stock")} />
        <NavButton active={view === "sell"} icon={ShoppingCart} label="Vender" onClick={() => setView("sell")} />
        <NavButton active={view === "history"} icon={ReceiptText} label="Historial" onClick={() => setView("history")} />
        <NavButton active={view === "people"} icon={Users} label="Personas" onClick={() => setView("people")} />
        {isOwner && <NavButton active={view === "finance"} icon={DollarSign} label="Finanzas" onClick={() => setView("finance")} />}
      </nav>
    </Shell>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (loginError) setError("Email o contrasena incorrectos.");
  }

  return (
    <Shell>
      <section className="login-panel">
        <div className="brand-mark"><span>LA</span><strong>FERIA</strong></div>
        <p className="eyebrow">Gestion de feria americana</p>
        <h1>La Feria</h1>
        <form onSubmit={submit} className="stack">
          <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="dueno@correo.com" /></label>
          <label>Contrasena<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="********" /></label>
          {error && <div className="error">{error}</div>}
          <button className="primary-button" disabled={loading}>{loading ? "Ingresando..." : "Ingresar"}</button>
        </form>
      </section>
    </Shell>
  );
}

function HomeView({ isOwner, onLogout, openNewProduct, profile, setView }) {
  const firstName = (profile?.full_name || "Flor").split(" ")[0];
  const quickLinks = [
    { label: "Cargar item", icon: Plus, action: openNewProduct },
    { label: "Vender", icon: ShoppingCart, action: () => setView("sell") },
    { label: "Ver stock", icon: Boxes, action: () => setView("stock") },
    { label: "Historial", icon: ReceiptText, action: () => setView("history") },
    { label: "Personas", icon: Users, action: () => setView("people") },
    ...(isOwner ? [{ label: "Finanzas", icon: DollarSign, action: () => setView("finance") }] : []),
  ];

  return (
    <div className="home-screen">
      <header className="home-header">
        <h1>Hola, {firstName} <span>🌸</span></h1>
        <button className="icon-button" onClick={onLogout} title="Salir"><LogOut size={18} /></button>
      </header>
      <div className="home-rule" />
      <section className="quick-section">
        <p>ACCESOS RÁPIDOS</p>
        <div className="quick-grid">
          {quickLinks.map((item) => <QuickCard key={item.label} {...item} />)}
        </div>
      </section>
    </div>
  );
}

function QuickCard({ action, icon: Icon, label }) {
  return (
    <button className="quick-card" onClick={action}>
      <span className="tag-hole" />
      <span className="quick-card-inner">
        <Icon size={24} />
        <strong>{label}</strong>
      </span>
    </button>
  );
}

function StockView({ categories, formToken, loadEverything, products, providers, setMessage, user }) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyProduct);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const filtered = products.filter((item) => `${item.code} ${item.name} ${item.category} ${item.size} ${item.color}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (formToken) setShowForm(true);
  }, [formToken]);

  async function uploadPhoto(file) {
    if (!file) return "";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${user.id}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("product-photos").upload(path, file);
    if (error) throw error;
    return supabase.storage.from("product-photos").getPublicUrl(path).data.publicUrl;
  }

  async function saveProduct(event) {
    event.preventDefault();
    const productForm = event.currentTarget;
    const photoFile = productForm.photo.files[0];
    setSaving(true);
    setMessage("");
    try {
      const photoUrl = await uploadPhoto(photoFile);
      const provider = await resolveProvider(form, providers);
      const { error } = await supabase.from("products").insert({
        code: codeFor(form.category),
        name: form.name.trim(),
        category: form.category,
        size: form.size.trim(),
        color: form.color.trim(),
        payout_price: Number(form.payout_price || 0),
        sale_price: Number(form.sale_price || 0),
        provider_id: provider?.id || null,
        provider_name: provider?.name || "",
        photo_url: photoUrl || null,
        status: "disponible",
      });
      if (error) throw error;
      setForm(emptyProduct);
      setShowForm(false);
      productForm.reset();
      await loadEverything();
      setMessage("Prenda cargada.");
    } catch (error) {
      setMessage(error.message || "No se pudo cargar la prenda.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product) {
    if (product.status === "vendido") return setMessage("No se puede borrar una prenda vendida.");
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) setMessage(error.message);
    else loadEverything();
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="section-title">
          <h2>Stock</h2>
          <span>{products.filter((item) => item.status === "disponible").length} disponibles</span>
        </div>
        <div className="toolbar-line">
          <div className="search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar prenda..." />
          </div>
          <button className="square-action" onClick={() => setShowForm((value) => !value)} title="Nueva prenda">
            <Plus size={19} />
          </button>
        </div>
        <ListEmpty show={!filtered.length} text="No hay prendas para mostrar." />
        {filtered.map((product) => <ProductRow key={product.id} onOpen={() => setSelectedProduct(product)} product={product} onDelete={() => deleteProduct(product)} />)}
      </section>

      {showForm && <section className="card">
        <h2>Nueva prenda</h2>
        <form className="form-grid" onSubmit={saveProduct}>
          <label>Nombre<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Categoria<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Talle<input value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} /></label>
          <label>Color<input value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></label>
          <label>Pago proveedor<input type="number" value={form.payout_price} onChange={(event) => setForm({ ...form, payout_price: event.target.value })} /></label>
          <label>Precio venta<input type="number" required value={form.sale_price} onChange={(event) => setForm({ ...form, sale_price: event.target.value })} /></label>
          <label>Proveedor<select value={form.provider_id} onChange={(event) => setForm({ ...form, provider_id: event.target.value })}><option value="">Sin proveedor</option>{providers.map((provider) => <option value={provider.id} key={provider.id}>{provider.name}</option>)}<option value={NEW_PROVIDER}>Nuevo proveedor</option></select></label>
          {form.provider_id === NEW_PROVIDER && <label>Nombre proveedor<input required value={form.provider_name} onChange={(event) => setForm({ ...form, provider_name: event.target.value })} placeholder="Nombre del proveedor" /></label>}
          <label>Foto<input name="photo" type="file" accept="image/*" /></label>
          <button className="primary-button full" disabled={saving}><Plus size={16} /> {saving ? "Guardando..." : "Cargar prenda"}</button>
        </form>
      </section>}

      {selectedProduct && <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
    </div>
  );
}

async function resolveProvider(form, providers) {
  if (!form.provider_id) return null;
  if (form.provider_id !== NEW_PROVIDER) return providers.find((item) => item.id === form.provider_id) || null;

  const name = form.provider_name.trim();
  if (!name) return null;
  const existing = providers.find((provider) => provider.name.trim().toLowerCase() === name.toLowerCase());
  if (existing) return existing;

  const { data, error } = await supabase.from("providers").insert({ name }).select().single();
  if (error) throw error;
  return data;
}

function SellView({ customers, loadEverything, products, profile, setMessage, user }) {
  const available = products.filter((item) => item.status === "disponible");
  const [cartIds, setCartIds] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const cart = available.filter((item) => cartIds.includes(item.id));
  const total = cart.reduce((sum, item) => sum + Number(item.sale_price), 0);

  function toggle(productId) {
    setCartIds((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
  }

  async function confirmSale() {
    if (!cart.length) return;
    const customer = customers.find((item) => item.id === customerId);
    const { data: sale, error: saleError } = await supabase.from("sales").insert({
      customer_id: customer?.id || null,
      customer_name: customer?.name || "",
      seller_id: user.id,
      seller_name: profile?.full_name || user.email,
      total,
    }).select().single();
    if (saleError) return setMessage(saleError.message);

    const items = cart.map((product) => ({ sale_id: sale.id, product_id: product.id, code: product.code, name: product.name, price: product.sale_price, payout_price: product.payout_price, photo_url: product.photo_url }));
    const { error: itemsError } = await supabase.from("sale_items").insert(items);
    const { error: productsError } = await supabase.from("products").update({ status: "vendido", sale_id: sale.id, sold_at: new Date().toISOString() }).in("id", cartIds);
    if (itemsError || productsError) setMessage((itemsError || productsError).message);
    else {
      setCartIds([]);
      setCustomerId("");
      await loadEverything();
      setMessage("Venta registrada.");
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Venta actual</h2>
        <label>Cliente<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Sin cliente</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label>
        <div className="total-line"><span>{cart.length} prendas</span><strong>{money(total)}</strong></div>
        <button className="primary-button" disabled={!cart.length} onClick={confirmSale}><ReceiptText size={16} /> Confirmar venta</button>
      </section>
      <section className="card">
        <h2>Disponibles</h2>
        <ListEmpty show={!available.length} text="No hay prendas disponibles." />
        {available.map((product) => (
          <button className={`select-row ${cartIds.includes(product.id) ? "selected" : ""}`} key={product.id} onClick={() => toggle(product.id)}>
            <span>{product.code} - {product.name}</span><b>{money(product.sale_price)}</b>
          </button>
        ))}
      </section>
    </div>
  );
}

function PeopleView({ customers, providers, loadEverything, setMessage }) {
  const [active, setActive] = useState("customers");

  return (
    <div className="stack">
      <div className="tabs">
        <button className={active === "customers" ? "active" : ""} onClick={() => setActive("customers")}>Clientes</button>
        <button className={active === "providers" ? "active" : ""} onClick={() => setActive("providers")}>Proveedores</button>
      </div>
      {active === "customers" ? (
        <PersonPanel table="customers" title="Clientes" people={customers} loadEverything={loadEverything} setMessage={setMessage} />
      ) : (
        <PersonPanel table="providers" title="Proveedores" people={providers} loadEverything={loadEverything} setMessage={setMessage} />
      )}
    </div>
  );
}

function HistoryView({ sales }) {
  const activeSales = sales.filter((sale) => !sale.cancelled);

  return (
    <section className="card">
      <h2>Historial de ventas</h2>
      <ListEmpty show={!activeSales.length} text="Todavia no hay ventas cargadas." />
      {activeSales.map((sale) => (
        <div className="history-row" key={sale.id}>
          <div>
            <strong>{sale.customer_name || "Venta sin cliente"}</strong>
            <span>{new Date(sale.date).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</span>
            <small>{sale.seller_name}</small>
          </div>
          <b>{money(sale.total)}</b>
        </div>
      ))}
    </section>
  );
}

function PersonPanel({ table, title, people, loadEverything, setMessage }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const filtered = people.filter((person) => `${person.name} ${person.phone || ""} ${person.instagram || ""}`.toLowerCase().includes(query.toLowerCase()));

  async function addPerson(event) {
    event.preventDefault();
    const { error } = await supabase.from(table).insert({ name: name.trim(), phone: phone.trim(), instagram: instagram.trim() });
    if (error) setMessage(error.message);
    else {
      setName("");
      setPhone("");
      setInstagram("");
      setShowForm(false);
      await loadEverything();
      setMessage("Contacto cargado.");
    }
  }

  return (
    <section className="card">
      <div className="section-title">
        <h2>{title}</h2>
        <span>{people.length} cargados</span>
      </div>
      <div className="toolbar-line">
        <div className="search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar ${title.toLowerCase()}...`} />
        </div>
        <button className="square-action" onClick={() => setShowForm((value) => !value)} title={`Agregar ${title}`}>
          <Plus size={19} />
        </button>
      </div>
      {showForm && (
        <form className="stack compact person-form" onSubmit={addPerson}>
          <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre" />
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Telefono" />
          <input value={instagram} onChange={(event) => setInstagram(event.target.value)} placeholder="Instagram" />
          <button className="primary-button"><Plus size={16} /> Agregar</button>
        </form>
      )}
      <ListEmpty show={!filtered.length} text={`Sin ${title.toLowerCase()} para mostrar.`} />
      {filtered.map((person) => <PersonRow key={person.id} person={person} />)}
    </section>
  );
}

function PersonRow({ person }) {
  const initial = person.name?.trim()?.charAt(0)?.toUpperCase() || "?";
  return (
    <div className="person-row">
      <div className="avatar">{initial}</div>
      <div>
        <strong>{person.name}</strong>
        <span>{person.phone || person.instagram || "Sin contacto"}</span>
      </div>
    </div>
  );
}

function FinanceView({ products, providers, payments, sales, loadEverything, setMessage }) {
  const [tab, setTab] = useState("summary");
  const [period, setPeriod] = useState("today");
  const balances = useMemo(() => providers.map((provider) => {
    const sold = products.filter((product) => product.provider_id === provider.id && product.status === "vendido").reduce((sum, product) => sum + Number(product.payout_price), 0);
    const paid = payments.filter((payment) => payment.provider_id === provider.id).reduce((sum, payment) => sum + Number(payment.amount), 0);
    return { ...provider, sold, paid, pending: Math.max(0, sold - paid) };
  }), [products, providers, payments]);
  const filteredSales = useMemo(() => sales.filter((sale) => !sale.cancelled && isInPeriod(sale.date, period)), [sales, period]);
  const soldTotal = filteredSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const providerTotal = filteredSales.reduce((sum, sale) => {
    const items = sale.sale_items || [];
    return sum + items.reduce((itemSum, item) => itemSum + Number(item.payout_price || 0), 0);
  }, 0);
  const profit = soldTotal - providerTotal;
  const pendingTotal = balances.reduce((sum, provider) => sum + provider.pending, 0);

  async function pay(providerId, amount) {
    const { error } = await supabase.from("provider_payments").insert({ provider_id: providerId, amount: Number(amount) });
    if (error) setMessage(error.message);
    else {
      await loadEverything();
      setMessage("Pago registrado.");
    }
  }

  return (
    <div className="finance-screen">
      <header className="finance-header">
        <h1>Finanzas</h1>
        <div className="home-rule" />
      </header>

      <div className="finance-tabs">
        <button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>Resumen</button>
        <button className={tab === "providers" ? "active" : ""} onClick={() => setTab("providers")}>Proveedores</button>
      </div>

      {tab === "summary" ? (
        <section className="finance-summary">
          <div className="period-tabs">
            {[
              ["today", "Hoy"],
              ["week", "Semana"],
              ["month", "Mes"],
              ["year", "Año"],
              ["all", "Todo"],
            ].map(([id, label]) => <button key={id} className={period === id ? "active" : ""} onClick={() => setPeriod(id)}>{label}</button>)}
          </div>

          <div className="finance-grid">
            <FinanceMetric label="Vendido" value={money(soldTotal)} />
            <FinanceMetric label="A proveedores" value={money(providerTotal)} />
            <FinanceMetric label="Ganancia" value={money(profit)} tone="success" wide prefix="↗" />
            <FinanceMetric label="Pendiente de pago a proveedores (total)" value={money(pendingTotal)} tone="danger" wide />
          </div>

          <section className="finance-history">
            <p>HISTORIAL ({filteredSales.length})</p>
            <ListEmpty show={!filteredSales.length} text="No hay ventas registradas en este periodo." />
            {filteredSales.map((sale) => (
              <div className="history-row" key={sale.id}>
                <div>
                  <strong>{sale.customer_name || "Venta sin cliente"}</strong>
                  <span>{new Date(sale.date).toLocaleDateString("es-AR")} - {sale.seller_name}</span>
                </div>
                <b>{money(sale.total)}</b>
              </div>
            ))}
          </section>
        </section>
      ) : (
        <section className="finance-providers">
          <ListEmpty show={!balances.length} text="No hay proveedores cargados." />
          {balances.map((provider) => <PaymentRow key={provider.id} provider={provider} onPay={pay} />)}
        </section>
      )}
    </div>
  );
}

function FinanceMetric({ label, prefix = "", tone = "", value, wide = false }) {
  return (
    <div className={`finance-card ${wide ? "wide" : ""} ${tone}`}>
      <span className="finance-hole" />
      <span>{label}</span>
      <strong>{prefix && <em>{prefix}</em>} {value}</strong>
    </div>
  );
}

function isInPeriod(dateValue, period) {
  if (period === "all") return true;
  const date = new Date(dateValue);
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "week") {
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  }
  if (period === "month") start.setDate(1);
  if (period === "year") {
    start.setMonth(0);
    start.setDate(1);
  }
  return date >= start;
}

function PaymentRow({ provider, onPay }) {
  const [amount, setAmount] = useState("");
  return (
    <div className="payment-row">
      <div><strong>{provider.name}</strong><span>Vendido {money(provider.sold)} - Pagado {money(provider.paid)}</span></div>
      <b className={provider.pending > 0 ? "danger" : "success"}>{money(provider.pending)}</b>
      <input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Monto" />
      <button disabled={!Number(amount)} onClick={() => { onPay(provider.id, amount); setAmount(""); }}>Pagar</button>
    </div>
  );
}

function ProductRow({ product, onDelete, onOpen }) {
  return (
    <div className="product-row" onClick={onOpen} onKeyDown={(event) => event.key === "Enter" && onOpen()} role="button" tabIndex={0}>
      {product.photo_url ? <img src={product.photo_url} alt="" /> : <div className="photo-placeholder" />}
      <div><strong>{product.name}</strong><span>{product.code} - {product.category} - {product.size || "s/t"} - {product.color || "s/c"}</span></div>
      <b>{money(product.sale_price)}</b>
      <span className={`status ${product.status}`}>{product.status}</span>
      <button className="icon-button subtle" onClick={(event) => { event.stopPropagation(); onDelete(); }} title="Borrar"><Trash2 size={16} /></button>
    </div>
  );
}

function ProductDetailModal({ product, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const qrPayload = product.code;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrPayload, {
      margin: 1,
      width: 180,
      color: { dark: "#1B1F2A", light: "#FFFFFF" },
    }).then((url) => {
      if (active) setQrDataUrl(url);
    });
    return () => { active = false; };
  }, [qrPayload]);

  return (
    <div className="modal-backdrop">
      <section className="product-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{product.code}</p>
            <h2>{product.name}</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="Cerrar"><X size={18} /></button>
        </header>

        <div className="product-photo-large">
          {product.photo_url ? <img src={product.photo_url} alt={product.name} /> : <ImageIcon size={42} />}
        </div>

        <div className="detail-list">
          <span>Categoria <strong>{product.category}</strong></span>
          <span>Talle <strong>{product.size || "s/t"}</strong></span>
          <span>Color <strong>{product.color || "s/c"}</strong></span>
          <span>Proveedor <strong>{product.provider_name || "Sin proveedor"}</strong></span>
          <span>Pago prov. <strong>{money(product.payout_price)}</strong></span>
          <span>Venta <strong>{money(product.sale_price)}</strong></span>
        </div>

        <div className="label-preview">
          <div>
            <Tag size={18} />
            <strong>Etiqueta</strong>
            <span>{product.code}</span>
          </div>
          {qrDataUrl ? <img src={qrDataUrl} alt="QR del producto" /> : <QrCode size={54} />}
        </div>

        <button className="primary-button" onClick={() => printLabel(product, qrDataUrl)} disabled={!qrDataUrl}>
          <Printer size={16} /> Imprimir etiqueta
        </button>
      </section>
    </div>
  );
}

function printLabel(product, qrDataUrl) {
  const printWindow = window.open("", "_blank", "width=420,height=520");
  if (!printWindow) return;
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Etiqueta ${product.code}</title>
        <style>
          @page { size: 58mm 38mm; margin: 3mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #1B1F2A;
            font-family: Arial, sans-serif;
          }
          .label {
            width: 52mm;
            height: 32mm;
            border: 1px solid #1B1F2A;
            display: grid;
            grid-template-columns: 1fr 22mm;
            gap: 2mm;
            padding: 3mm;
            align-items: center;
          }
          .brand {
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.08em;
          }
          .code {
            margin-top: 2mm;
            font-family: "Courier New", monospace;
            font-size: 12px;
            font-weight: 800;
          }
          .name {
            margin-top: 1mm;
            font-size: 10px;
            font-weight: 700;
          }
          .price {
            margin-top: 2mm;
            font-size: 15px;
            font-weight: 900;
          }
          img { width: 22mm; height: 22mm; }
        </style>
      </head>
      <body>
        <div class="label">
          <div>
            <div class="brand">LA FERIA</div>
            <div class="code">${escapeHtml(product.code)}</div>
            <div class="name">${escapeHtml(product.name)}</div>
            <div class="price">${money(product.sale_price)}</div>
          </div>
          <img src="${qrDataUrl}" />
        </div>
        <script>
          window.onload = () => { window.print(); window.close(); };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function Metric({ label, value }) {
  return <section className="metric"><span>{label}</span><strong>{value}</strong></section>;
}

function NavButton({ active, icon: Icon, label, onClick }) {
  return <button className={active ? "active" : ""} onClick={onClick}><Icon size={18} /><span>{label}</span></button>;
}

function ListEmpty({ show, text }) {
  return show ? <div className="empty">{text}</div> : null;
}

function Shell({ children, className = "" }) {
  return <main className={`app-shell ${className}`}>{children}</main>;
}

function titleFor(view) {
  return { home: "Inicio", stock: "Stock", sell: "Vender", history: "Historial", people: "Personas", finance: "Finanzas" }[view];
}
