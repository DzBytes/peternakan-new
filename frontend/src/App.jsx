import { useState, useEffect, useReducer, createContext, useContext, useRef } from "react";

// ─────────────────────────────────────────────────────────
//  CONTEXT & STATE
// ─────────────────────────────────────────────────────────
const AppContext = createContext();

const API_BASE = "http://localhost:3001/api";

const initialState = {
  user: null,
  cart: [],
  notifications: [],
  tabungan: [],
  pesanan: [],
  patungan: [],
  page: "landing",
  loading: false,
  showLoginModal: false,
  showRegisterModal: false,
  showCartModal: false,
  showNotifPanel: false,
  showTabunganModal: false,
  showForgotModal: false,
  tabunganFormData: { target: "", nama_qurban: "", jenis: "sapi", setoran: "" },
};

const hewan_data = [
  { id: 1, jenis: "sapi", nama: "Sapi Limosin Premium", berat: "300-350 kg", harga: 18500000, stok: 12, kategori: "qurban", img: "🐄", grade: "A", share: 7 },
  { id: 2, jenis: "sapi", nama: "Sapi Simental", berat: "250-300 kg", harga: 15000000, stok: 8, kategori: "qurban", img: "🐂", grade: "A", share: 7 },
  { id: 3, jenis: "sapi", nama: "Sapi Brahman", berat: "200-250 kg", harga: 12000000, stok: 15, kategori: "qurban", img: "🐄", grade: "B", share: 7 },
  { id: 4, jenis: "kambing", nama: "Kambing Etawa Jumbo", berat: "35-45 kg", harga: 3200000, stok: 25, kategori: "qurban_aqiqah", img: "🐐", grade: "A", share: 1 },
  { id: 5, jenis: "kambing", nama: "Kambing PE Pilihan", berat: "30-35 kg", harga: 2800000, stok: 30, kategori: "qurban_aqiqah", img: "🐑", grade: "A", share: 1 },
  { id: 6, jenis: "kambing", nama: "Kambing Kacang", berat: "20-25 kg", harga: 1800000, stok: 40, kategori: "qurban_aqiqah", img: "🐑", grade: "B", share: 1 },
  { id: 7, jenis: "kambing", nama: "Domba Garut Premium", berat: "40-50 kg", harga: 3800000, stok: 18, kategori: "aqiqah", img: "🐑", grade: "A+", share: 1 },
  { id: 8, jenis: "kambing", nama: "Domba Ekor Gemuk", berat: "35-40 kg", harga: 3200000, stok: 22, kategori: "aqiqah", img: "🐑", grade: "A", share: 1 },
];

const paket_aqiqah = [
  { id: 1, nama: "Paket Aqiqah Silver", kambing: 1, gender: "perempuan", harga: 2800000, termasuk: ["1 Kambing pilihan", "Pemotongan", "Sertifikat Aqiqah", "Pengiriman area Kota"] },
  { id: 2, nama: "Paket Aqiqah Gold", kambing: 2, gender: "laki-laki", harga: 5400000, termasuk: ["2 Kambing premium", "Pemotongan", "Sertifikat Aqiqah", "Pengiriman gratis", "Laporan foto"] },
  { id: 3, nama: "Paket Aqiqah Platinum", kambing: 2, gender: "laki-laki", harga: 7200000, termasuk: ["2 Kambing Grade A+", "Pemotongan + Masak", "Sertifikat resmi", "Pengiriman gratis", "Laporan foto + video", "Souvenir"] },
];

function reducer(state, action) {
  switch (action.type) {
    case "SET_PAGE": return { ...state, page: action.payload };
    case "LOGIN": return { ...state, user: action.payload, showLoginModal: false, notifications: [...state.notifications, { id: Date.now(), msg: `Selamat datang, ${action.payload.name}!`, type: "success", read: false }] };
      case "LOGOUT": {
        try { localStorage.removeItem('albarakah_token'); localStorage.removeItem('albarakah_user'); } catch (e) {}
        return { ...state, user: null, cart: [], tabungan: [], pesanan: [], notifications: [] };
      }
      case "SET_USER": return { ...state, user: action.payload };
    case "SET_PESANAN": return { ...state, pesanan: action.payload || [] };
    case "SET_TABUNGAN": return { ...state, tabungan: action.payload || [] };
    case "SET_PATUNGAN": return { ...state, patungan: action.payload || [] };
    case "SET_NOTIFICATIONS": return { ...state, notifications: action.payload || [] };
    case "CLEAR_CART": return { ...state, cart: [], showCartModal: false };
    case "TOGGLE_LOGIN": return { ...state, showLoginModal: !state.showLoginModal, showRegisterModal: false };
    case "TOGGLE_REGISTER": return { ...state, showRegisterModal: !state.showRegisterModal, showLoginModal: false };
    case "TOGGLE_CART": return { ...state, showCartModal: !state.showCartModal };
    case "TOGGLE_NOTIF": return { ...state, showNotifPanel: !state.showNotifPanel };
    case "TOGGLE_TABUNGAN_MODAL": return { ...state, showTabunganModal: !state.showTabunganModal };
    case "TOGGLE_FORGOT": return { ...state, showForgotModal: !state.showForgotModal, showLoginModal: false };
    case "ADD_TO_CART": {
      const ex = state.cart.find(c => c.id === action.payload.id && c.layanan === action.payload.layanan);
      const newCart = ex ? state.cart.map(c => c.id === action.payload.id && c.layanan === action.payload.layanan ? { ...c, qty: c.qty + 1 } : c) : [...state.cart, { ...action.payload, qty: 1 }];
      const toast = { id: Date.now(), msg: `${action.payload.nama} ditambahkan ke keranjang`, type: "success", read: false };
      return { ...state, cart: newCart, notifications: [...state.notifications, toast] };
    }
    case "REMOVE_FROM_CART": return { ...state, cart: state.cart.filter(c => !(c.id === action.payload.id && c.layanan === action.payload.layanan)) };
    case "UPDATE_QTY": return { ...state, cart: state.cart.map(c => c.id === action.payload.id && c.layanan === action.payload.layanan ? { ...c, qty: action.payload.qty } : c) };
    case "ADJUST_CART": return { ...state, cart: action.payload };
    case "PUSH_NOTIF": return { ...state, notifications: [...state.notifications, { id: Date.now(), msg: action.payload.msg, type: action.payload.type || 'info', read: false }] };
    case "CHECKOUT": {
      const newPesanan = { id: `ORD-${Date.now()}`, items: state.cart, total: action.payload.total, status: "Menunggu Konfirmasi", date: new Date().toLocaleDateString("id-ID"), metode: action.payload.metode };
      return { ...state, cart: [], pesanan: [...state.pesanan, newPesanan], showCartModal: false, notifications: [...state.notifications, { id: Date.now(), msg: `Pesanan ${newPesanan.id} berhasil dibuat!`, type: "success", read: false }] };
    }
    case "SET_LOADING": return { ...state, loading: true };
    case "UNSET_LOADING": return { ...state, loading: false };
    case "ADD_TABUNGAN": return { ...state, tabungan: [...state.tabungan, action.payload], showTabunganModal: false, notifications: [...state.notifications, { id: Date.now(), msg: `Tabungan Qurban "${action.payload.nama}" berhasil dibuat!`, type: "success", read: false }] };
    case "SETOR_TABUNGAN": return { ...state, tabungan: state.tabungan.map(t => t.id === action.payload.id ? { ...t, terkumpul: t.terkumpul + action.payload.amount, riwayat: [...(t.riwayat || []), { tgl: new Date().toLocaleDateString("id-ID"), jumlah: action.payload.amount }] } : t), notifications: [...state.notifications, { id: Date.now(), msg: `Setoran Rp ${action.payload.amount.toLocaleString("id-ID")} berhasil!`, type: "success", read: false }] };
    case "READ_ALL_NOTIF": return { ...state, notifications: state.notifications.map(n => ({ ...n, read: true })) };
    case "DISMISS_NOTIF": return state;
    case "UPDATE_TABUNGAN_FORM": return { ...state, tabunganFormData: { ...state.tabunganFormData, ...action.payload } };
    default: return state;
  }
}

// (persistence handled via lazy initializer and effects below)

// ─────────────────────────────────────────────────────────
//  UTILITY
// ─────────────────────────────────────────────────────────
const fmt = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

const normalizeClientRole = (role) => String(role || "PELANGGAN").toUpperCase() === "ADMIN" ? "ADMIN" : "PELANGGAN";

const roleFromToken = (token) => {
  try {
    const payload = JSON.parse(atob(String(token || "").split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/") || ""));
    return payload.role;
  } catch (e) {
    return null;
  }
};

const ensureSnapScript = async (data) => {
  const snapUrl = data.isProduction ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
  const existing = document.querySelector('script[data-midtrans-snap="true"]');
  if (window.snap && existing?.src === snapUrl && existing?.getAttribute('data-client-key') === data.clientKey) return;
  if (existing) existing.remove();
  window.snap = undefined;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = snapUrl;
    s.setAttribute('data-client-key', data.clientKey || '');
    s.setAttribute('data-midtrans-snap', 'true');
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
};

const animalIcon = (jenis) => {
  const j = String(jenis || "").toLowerCase();
  if (j === "sapi") return "🐄";
  if (j === "domba") return "🐑";
  return "🐐";
};

const mapHewanFromApi = (h) => ({
  id: h.ID_HEWAN,
  jenis: String(h.JENIS || "").toLowerCase(),
  nama: h.NAMA,
  berat: h.BERAT_INFO,
  harga: Number(h.HARGA || 0),
  stok: Number(h.STOK || 0),
  kategori: String(h.KATEGORI || "").toLowerCase(),
  img: animalIcon(h.JENIS),
  grade: h.GRADE || "A",
  share: Number(h.SHARE || 1),
});

const mapPesananFromApi = (p) => {
  const total = Number(p.TOTAL || 0);
  const paid = Number(p.TOTAL_DIBAYAR || p.TOTAL_SETORAN || p.TOTAL_PEMBAYARAN || 0);
  return {
    id: `ORD-${p.ID_PESANAN}`,
    rawId: p.ID_PESANAN,
    layanan: p.JENIS_LAYANAN,
    items: [{ nama: p.NAMA_HEWAN || "-", qty: 1, harga: total }],
    total,
    totalBayar: paid,
    sisa: Math.max(total - paid, 0),
    status: p.STATUS,
    statusBayar: p.STATUS_BAYAR || "",
    metode: p.METODE_PEMBAYARAN_TERAKHIR || p.METODE_BAYAR || "-",
    date: p.TGL_PESAN ? new Date(p.TGL_PESAN).toLocaleDateString("id-ID") : "-",
  };
};

const mapTabunganFromApi = (t) => ({
  id: t.ID_TABUNGAN,
  nama: t.NAMA_TABUNGAN,
  jenis: String(t.JENIS_TARGET || "KAMBING").toLowerCase(),
  target: Number(t.TARGET_NOMINAL || 0),
  terkumpul: Number(t.TERKUMPUL_REAL || t.TERKUMPUL || 0),
  dibuat: t.TGL_BUAT ? new Date(t.TGL_BUAT).toLocaleDateString("id-ID") : "-",
  idHewan: t.ID_HEWAN,
  namaHewan: t.NAMA_HEWAN_TARGET,
});

const mapNotifFromApi = (n) => ({
  id: n.ID_NOTIFIKASI,
  msg: n.PESAN || n.JUDUL,
  type: n.TIPE === "PAYMENT" ? "success" : "info",
  read: n.IS_READ === "Y",
});

const orderStatusLabel = (status) => ({
  "Dikonfirmasi": "Pembayaran Disetujui",
  "Dibatalkan": "Pembayaran Dibatalkan",
  "Menunggu Pembayaran": "Menunggu Pembayaran",
  "Menunggu Pembayaran Setoran": "Menunggu Setoran",
  "Cicilan Aktif": "Setoran Berjalan",
  "Diproses": "Sedang Diproses",
  "Selesai": "Selesai",
  "Menunggu Konfirmasi": "Menunggu Konfirmasi",
}[status] || status || "-");

const paymentStatusLabel = (status) => ({
  "LUNAS": "Pembayaran Disetujui",
  "Gagal": "Pembayaran Dibatalkan",
  "Menunggu Pembayaran": "Menunggu Pembayaran",
}[status] || status || "-");

const orderStatusOptions = [
  "Menunggu Konfirmasi",
  "Menunggu Pembayaran",
  "Menunggu Pembayaran Setoran",
  "Cicilan Aktif",
  "Dikonfirmasi",
  "Diproses",
  "Selesai",
  "Dibatalkan",
];

const toInputDate = (value) => {
  if (!value) return "";
  return String(value).slice(0, 10);
};

// ─────────────────────────────────────────────────────────
//  COMPONENTS
// ─────────────────────────────────────────────────────────

function Badge({ count }) {
  if (!count) return null;
  return <span style={{ position: "absolute", top: -6, right: -6, background: "#e53e3e", color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{count > 9 ? "9+" : count}</span>;
}

function Modal({ show, onClose, title, children, width = 480 }) {
  if (!show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: width, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #f0f0f0" }}>
          <h3 style={{ margin: 0, fontSize: 18, color: "#1a202c", fontFamily: "'Playfair Display', serif" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#718096", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", size = "md", fullWidth = false, disabled = false, style: extra = {} }) {
  const styles = {
    primary: { background: "linear-gradient(135deg, #2d6a4f, #40916c)", color: "#fff", border: "none" },
    secondary: { background: "linear-gradient(135deg, #c47a1a, #e08b20)", color: "#fff", border: "none" },
    outline: { background: "transparent", color: "#2d6a4f", border: "2px solid #2d6a4f" },
    danger: { background: "#e53e3e", color: "#fff", border: "none" },
    ghost: { background: "#f7fafc", color: "#2d3748", border: "1px solid #e2e8f0" },
  };
  const sizes = { sm: { padding: "6px 14px", fontSize: 13 }, md: { padding: "10px 22px", fontSize: 14 }, lg: { padding: "14px 32px", fontSize: 16 } };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...styles[variant], ...sizes[size], borderRadius: 10, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, width: fullWidth ? "100%" : "auto", transition: "all 0.2s", fontFamily: "inherit", ...extra }}>
      {children}
    </button>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "", required = false }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#4a5568" }}>{label}{required && <span style={{ color: "#e53e3e" }}> *</span>}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", transition: "border 0.2s" }}
        onFocus={e => e.target.style.borderColor = "#2d6a4f"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#4a5568" }}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", background: "#fff", cursor: "pointer" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  NAVBAR
// ─────────────────────────────────────────────────────────
function Navbar() {
  const { state, dispatch, bellPulse } = useContext(AppContext);
  const unread = state.notifications.filter(n => !n.read).length;
  const cartCount = state.cart.reduce((s, c) => s + c.qty, 0);
  const navLinks = [
    { label: "Beranda", page: "landing" },
    { label: "Qurban", page: "qurban" },
    { label: "Aqiqah", page: "aqiqah" },
    { label: "Tabungan", page: "tabungan" },
    { label: "Tentang", page: "about" },
    ...((!state.user || normalizeClientRole(state.user.role) === "ADMIN") ? [{ label: "Admin", page: "admin" }] : []),
  ];
  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 900, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e8f5e9", boxShadow: "0 2px 20px rgba(45,106,79,0.08)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", height: 68, gap: 32 }}>
        {/* Logo */}
        <div onClick={() => dispatch({ type: "SET_PAGE", payload: "landing" })} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 42, height: 42, background: "linear-gradient(135deg, #2d6a4f, #40916c)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🐄</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 17, color: "#1a202c", lineHeight: 1.1 }}>Al-Barakah</div>
            <div style={{ fontSize: 10, color: "#52b788", fontWeight: 600, letterSpacing: 1 }}>AQIQAH & QURBAN</div>
          </div>
        </div>
        {/* Nav Links */}
        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          {navLinks.map(l => (
            <button key={l.page} onClick={() => dispatch({ type: "SET_PAGE", payload: l.page })}
              style={{ background: state.page === l.page ? "#e8f5e9" : "none", border: "none", color: state.page === l.page ? "#2d6a4f" : "#4a5568", padding: "8px 14px", borderRadius: 8, fontWeight: state.page === l.page ? 700 : 500, cursor: "pointer", fontSize: 14, fontFamily: "inherit", transition: "all 0.15s" }}>
              {l.label}
            </button>
          ))}
        </div>
        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Notif */}
          {state.user && (
            <div style={{ position: "relative" }}>
              <button onClick={() => dispatch({ type: "TOGGLE_NOTIF" })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, padding: "6px", color: "#4a5568", transform: bellPulse ? 'translateY(-3px) scale(1.12)' : 'none', transition: 'transform 0.32s' }}>🔔</button>
              <Badge count={unread} />
            </div>
          )}
          {/* Cart */}
          <div style={{ position: "relative" }}>
            <button onClick={() => dispatch({ type: "TOGGLE_CART" })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, padding: "6px", color: "#4a5568" }}>🛒</button>
            <Badge count={cartCount} />
          </div>
          {/* Auth */}
          {state.user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => dispatch({ type: "SET_PAGE", payload: "dashboard" })} style={{ display: "flex", alignItems: "center", gap: 8, background: "#e8f5e9", border: "none", borderRadius: 10, padding: "7px 14px", cursor: "pointer", fontWeight: 600, color: "#2d6a4f", fontSize: 13 }}>
                👤 {normalizeClientRole(state.user.role) === "ADMIN" ? "Admin" : state.user.name.split(" ")[0]}
              </button>
              <Btn variant="ghost" size="sm" onClick={() => dispatch({ type: "LOGOUT" })}>Keluar</Btn>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="outline" size="sm" onClick={() => dispatch({ type: "TOGGLE_LOGIN" })}>Masuk</Btn>
              <Btn variant="primary" size="sm" onClick={() => dispatch({ type: "TOGGLE_REGISTER" })}>Daftar</Btn>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────
//  NOTIFIKASI PANEL
// ─────────────────────────────────────────────────────────
function NotifPanel() {
  const { state, dispatch } = useContext(AppContext);
  if (!state.showNotifPanel) return null;
  return (
    <div style={{ position: "fixed", top: 72, right: 24, zIndex: 950, background: "#fff", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.18)", width: 340, border: "1px solid #e8f5e9", overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", background: "#f0fff4", borderBottom: "1px solid #e8f5e9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, color: "#2d6a4f", fontSize: 15 }}>🔔 Notifikasi</span>
        <button onClick={() => dispatch({ type: "READ_ALL_NOTIF" })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#52b788", fontWeight: 600 }}>Tandai Semua</button>
      </div>
      {state.notifications.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#a0aec0" }}>Belum ada notifikasi</div>
      ) : (
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {[...state.notifications].reverse().map(n => (
            <div key={n.id} style={{ padding: "12px 18px", borderBottom: "1px solid #f7fafc", background: n.read ? "#fff" : "#f0fff4", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18 }}>{n.type === "success" ? "✅" : "ℹ️"}</span>
              <span style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.4 }}>{n.msg}</span>
              {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#52b788", flexShrink: 0, marginTop: 4 }}></span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  TOAST (Popup) - muncul ketika item ditambahkan ke keranjang
// ─────────────────────────────────────────────────────────
function ToastItem({ t }) {
  const { toastIds, setToastIds } = useContext(AppContext);
  useEffect(() => {
    const id = setTimeout(() => setToastIds(ids => ids.filter(x => x !== t.id)), 3000);
    return () => clearTimeout(id);
  }, []);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", background: "#fff", borderRadius: 12, padding: "10px 14px", boxShadow: "0 12px 30px rgba(0,0,0,0.12)", border: "1px solid #e6ffef", minWidth: 260, transformOrigin: 'right top', animation: 'toastIn 360ms cubic-bezier(.2,.9,.3,1)' }}>
      <div style={{ fontSize: 18 }}>{t.type === "success" ? "✅" : "ℹ️"}</div>
      <div style={{ flex: 1, fontSize: 13, color: "#2d6a4f" }}>{t.msg}</div>
      <button onClick={() => setToastIds(ids => ids.filter(x => x !== t.id))} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#718096" }}>×</button>
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(-10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
    </div>
  );
}

function Toasts() {
  const { state, toastIds } = useContext(AppContext);
  const toasts = state.notifications.filter(n => toastIds.includes(n.id)).slice(-4);
  if (!toasts.length) return null;
  return (
    <div style={{ position: "fixed", top: 84, right: 20, zIndex: 1200, display: "flex", flexDirection: "column", gap: 10 }}>
      {toasts.map(t => <ToastItem key={t.id} t={t} />)}
    </div>
  );
}

function SpinnerOverlay() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)', zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 96, height: 96, borderRadius: 18, background: 'linear-gradient(135deg,#fff,#f7fafc)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ width: 56, height: 56, borderRadius: 28, border: '6px solid rgba(45,106,79,0.12)', borderTopColor: '#2d6a4f', animation: 'spin 1s linear infinite' }}></div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  LOGIN MODAL
// ─────────────────────────────────────────────────────────
function LoginModal() {
  const { state, dispatch } = useContext(AppContext);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [needVerify, setNeedVerify] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  const handle = async () => {
    if (!email || !pw) { setErr("Email dan password wajib diisi"); return; }
    setLoading(true); setErr("");
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needVerify) { setNeedVerify(true); }
        setErr(data.error || "Login gagal");
      } else {
        localStorage.setItem("albarakah_token", data.token);
        const loginUser = { ...data.user, role: normalizeClientRole(data.user?.role) };
        try { localStorage.setItem('albarakah_user', JSON.stringify(loginUser)); } catch (e) {}
        dispatch({ type: "LOGIN", payload: loginUser });
        setEmail(""); setPw(""); setErr("");
      }
    } catch { setErr("Tidak dapat terhubung ke server"); }
    setLoading(false);
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/resend-verification`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setResendMsg(data.message || "Email dikirim ulang");
    } catch { setResendMsg("Gagal mengirim ulang"); }
    setLoading(false);
  };

  return (
    <Modal show={state.showLoginModal} onClose={() => { dispatch({ type: "TOGGLE_LOGIN" }); setErr(""); setNeedVerify(false); setResendMsg(""); }} title="Masuk ke Akun Anda">
      {err && (
        <div style={{ background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#c53030", fontSize: 13 }}>
          {err}
          {needVerify && (
            <div style={{ marginTop: 8 }}>
              <span onClick={handleResend} style={{ color: "#2d6a4f", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
                Kirim ulang email verifikasi
              </span>
            </div>
          )}
        </div>
      )}
      {resendMsg && <div style={{ background: "#f0fff4", border: "1px solid #c6f6d5", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#276749", fontSize: 13 }}>{resendMsg}</div>}
      <Input label="Email" value={email} onChange={setEmail} type="email" placeholder="email@example.com" required />
      <Input label="Password" value={pw} onChange={setPw} type="password" placeholder="••••••••" required />
      <div style={{ textAlign: "right", marginBottom: 16, marginTop: -8 }}>
        <span onClick={() => { dispatch({ type: "TOGGLE_LOGIN" }); dispatch({ type: "TOGGLE_FORGOT" }); }} style={{ fontSize: 13, color: "#2d6a4f", cursor: "pointer", fontWeight: 600 }}>Lupa password?</span>
      </div>
      <Btn variant="primary" fullWidth onClick={handle} disabled={loading} style={{ marginTop: 4 }}>{loading ? "Memproses..." : "Masuk"}</Btn>
      <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#718096" }}>
        Belum punya akun?{" "}
        <span onClick={() => { dispatch({ type: "TOGGLE_LOGIN" }); dispatch({ type: "TOGGLE_REGISTER" }); }} style={{ color: "#2d6a4f", fontWeight: 700, cursor: "pointer" }}>Daftar sekarang</span>
      </p>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────
//  REGISTER MODAL
// ─────────────────────────────────────────────────────────
function RegisterModal() {
  const { state, dispatch } = useContext(AppContext);
  const [form, setForm] = useState({ name: "", email: "", phone: "", pw: "", pw2: "" });
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!form.name || !form.email || !form.phone || !form.pw) { setErr("Semua field wajib diisi"); return; }
    if (form.pw !== form.pw2) { setErr("Password tidak cocok"); return; }
    if (form.pw.length < 8) { setErr("Password minimal 8 karakter"); return; }
    setLoading(true); setErr("");
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: form.name, email: form.email, no_hp: form.phone, password: form.pw })
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Registrasi gagal"); }
      else {
        setSuccess("✅ Registrasi berhasil! Cek email Anda untuk verifikasi akun sebelum login.");
        setForm({ name: "", email: "", phone: "", pw: "", pw2: "" });
      }
    } catch { setErr("Tidak dapat terhubung ke server"); }
    setLoading(false);
  };

  return (
    <Modal show={state.showRegisterModal} onClose={() => { dispatch({ type: "TOGGLE_REGISTER" }); setErr(""); setSuccess(""); }} title="Buat Akun Baru">
      {err && <div style={{ background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#c53030", fontSize: 13 }}>{err}</div>}
      {success ? (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📧</div>
          <div style={{ background: "#f0fff4", border: "1px solid #c6f6d5", borderRadius: 10, padding: "16px 20px", color: "#276749", fontSize: 14, lineHeight: 1.7 }}>{success}</div>
          <Btn variant="primary" fullWidth onClick={() => { dispatch({ type: "TOGGLE_REGISTER" }); dispatch({ type: "TOGGLE_LOGIN" }); }} style={{ marginTop: 20 }}>Masuk ke Akun</Btn>
        </div>
      ) : (
        <>
          <Input label="Nama Lengkap" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
          <Input label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" required />
          <Input label="No. HP / WhatsApp" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="08xxxxxxxxxx" required />
          <Input label="Password" value={form.pw} onChange={v => setForm({ ...form, pw: v })} type="password" required />
          <Input label="Konfirmasi Password" value={form.pw2} onChange={v => setForm({ ...form, pw2: v })} type="password" required />
          <Btn variant="primary" fullWidth onClick={handle} disabled={loading} style={{ marginTop: 8 }}>{loading ? "Mendaftar..." : "Daftar Sekarang"}</Btn>
        </>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────
//  FORGOT PASSWORD MODAL
// ─────────────────────────────────────────────────────────
function ForgotPasswordModal() {
  const { state, dispatch } = useContext(AppContext);
  const [emailFp, setEmailFp] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!emailFp) return;
    setLoading(true); setMsg("");
    try {
      await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailFp })
      });
      setMsg("Jika email terdaftar, link reset password telah dikirim. Cek inbox atau folder spam Anda.");
    } catch { setMsg("Tidak dapat terhubung ke server"); }
    setLoading(false);
  };

  return (
    <Modal show={state.showForgotModal} onClose={() => { dispatch({ type: "TOGGLE_FORGOT" }); setMsg(""); setEmailFp(""); }} title="🔑 Lupa Password">
      {!msg ? (
        <>
          <p style={{ color: "#4a5568", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>Masukkan email yang terdaftar. Kami akan mengirimkan link untuk reset password.</p>
          <Input label="Email" value={emailFp} onChange={setEmailFp} type="email" placeholder="email@example.com" required />
          <Btn variant="primary" fullWidth onClick={handle} disabled={loading} style={{ marginTop: 8 }}>{loading ? "Mengirim..." : "Kirim Link Reset"}</Btn>
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#718096" }}>
            Ingat password?{" "}
            <span onClick={() => { dispatch({ type: "TOGGLE_FORGOT" }); dispatch({ type: "TOGGLE_LOGIN" }); }} style={{ color: "#2d6a4f", fontWeight: 700, cursor: "pointer" }}>Masuk</span>
          </p>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📧</div>
          <div style={{ background: "#f0fff4", border: "1px solid #c6f6d5", borderRadius: 10, padding: "14px 18px", color: "#276749", fontSize: 14, lineHeight: 1.7 }}>{msg}</div>
          <Btn variant="outline" onClick={() => { dispatch({ type: "TOGGLE_FORGOT" }); dispatch({ type: "TOGGLE_LOGIN" }); }} style={{ marginTop: 20 }}>← Kembali ke Login</Btn>
        </div>
      )}
    </Modal>
  );
}


// ─────────────────────────────────────────────────────────
//  CART MODAL
// ─────────────────────────────────────────────────────────
function CartModal() {
  const { state, dispatch, refreshAccountData } = useContext(AppContext);
  const [metode, setMetode] = useState("tunai");
  const [setoranAwal, setSetoranAwal] = useState("");
  const [step, setStep] = useState(1);
  const [penerima, setPenerima] = useState("");
  const [alamatKirim, setAlamatKirim] = useState("");
  const [phoneKirim, setPhoneKirim] = useState("");
  const [catatan, setCatatan] = useState("");
  const [patunganEmails, setPatunganEmails] = useState("");
  const total = state.cart.reduce((s, c) => s + c.harga * c.qty, 0);
  const hasPatungan = state.cart.some(c => c.layanan === "Qurban" && c.is_patungan === "Y");
  const loadSnap = ensureSnapScript;
  const checkout = () => {
    if (!state.user) { dispatch({ type: "TOGGLE_CART" }); dispatch({ type: "TOGGLE_LOGIN" }); return; }
    (async () => {
      dispatch({ type: 'SET_LOADING' });
      try {
        const token = localStorage.getItem('albarakah_token');
        // determine layanan from cart (AQIQAH if any item kategori === 'aqiqah')
        const layanan = state.cart.some(i => (i.kategori || '').toLowerCase().includes('aqiqah') || (i.layanan||'').toLowerCase().includes('aqiqah')) ? 'AQIQAH' : 'QURBAN';
        const isSetoran = metode === 'setoran_tunai' || metode === 'setoran_midtrans';
        const isMidtrans = metode === 'midtrans' || metode === 'setoran_midtrans';
        const nominalSetoran = parseInt(setoranAwal || "0", 10);

        if (isSetoran && layanan !== 'QURBAN') {
          alert('Setoran/cicilan pesanan hanya tersedia untuk qurban.');
          return;
        }
        if (isSetoran && (!nominalSetoran || nominalSetoran <= 0 || nominalSetoran > total)) {
          alert('Nominal setoran awal harus lebih dari 0 dan tidak boleh melebihi total pesanan.');
          return;
        }

        const endpoint = isMidtrans ? `${API_BASE}/payment/snap` : `${API_BASE}/payment/cash`;
        const tipe_bayar = metode === 'setoran_tunai' ? 'CICILAN_TUNAI' : metode === 'setoran_midtrans' ? 'CICILAN_MIDTRANS' : metode === 'tunai' ? 'TUNAI' : 'MIDTRANS';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            items: state.cart,
            tgl_pelaksanaan: null,
            alamat_kirim: alamatKirim,
            nama: penerima,
            phone: phoneKirim,
            catatan,
            layanan,
            tipe_bayar,
            nominal_setoran_awal: isSetoran ? nominalSetoran : undefined,
            patungan_members: hasPatungan ? patunganEmails : undefined,
          })
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.code === "STALE_SESSION") {
            dispatch({ type: "LOGOUT" });
            dispatch({ type: "TOGGLE_LOGIN" });
          }
          alert(data.error || 'Gagal membuat transaksi');
          return;
        }

        if (!isMidtrans) {
          dispatch({ type: "CLEAR_CART" });
          await refreshAccountData?.();
          setStep(1);
          setSetoranAwal("");
          setPatunganEmails("");
          alert(`Pesanan dibuat. ID: ORD-${data.id_pesanan}`);
          return;
        }

        await loadSnap(data);
        window.snap.pay(data.token, {
          onSuccess: async function(result){
            dispatch({ type: "CLEAR_CART" });
            await refreshAccountData?.();
            setStep(1);
            setSetoranAwal("");
            setPatunganEmails("");
            alert('Pembayaran berhasil. Terima kasih!');
          },
          onPending: async function(result){
            dispatch({ type: "CLEAR_CART" });
            await refreshAccountData?.();
            setStep(1);
            setSetoranAwal("");
            setPatunganEmails("");
            alert('Pembayaran pending. Mohon selesaikan pembayaran.');
          },
          onError: function(result){ console.error('Midtrans error', result); alert('Terjadi kesalahan saat pembayaran'); },
          onClose: function(){ /* pengguna menutup popup */ }
        });
      } catch (e) { console.error(e); alert('Gagal memproses pembayaran'); dispatch({ type: 'UNSET_LOADING' }); }
      finally { dispatch({ type: 'UNSET_LOADING' }); }
    })();
  };
  return (
    <Modal show={state.showCartModal} onClose={() => dispatch({ type: "TOGGLE_CART" })} title={step === 1 ? "🛒 Keranjang Belanja" : "💳 Konfirmasi Pesanan"} width={540}>
      {step === 1 ? (
        <>
          {state.cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}>
              <div style={{ fontSize: 56 }}>🛒</div>
              <p>Keranjang masih kosong</p>
            </div>
          ) : (
            <>
              {state.cart.map(item => (
                <div key={`${item.id}-${item.layanan}`} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: "1px solid #f0f0f0", alignItems: "center" }}>
                  <div style={{ fontSize: 36 }}>{item.img}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#1a202c" }}>{item.nama}</div>
                    <div style={{ fontSize: 12, color: "#718096" }}>{item.layanan}</div>
                    <div style={{ fontWeight: 700, color: "#2d6a4f", fontSize: 14 }}>{fmt(item.harga)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => item.qty > 1 ? dispatch({ type: "UPDATE_QTY", payload: { id: item.id, layanan: item.layanan, qty: item.qty - 1 } }) : dispatch({ type: "REMOVE_FROM_CART", payload: item })} style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#f7fafc", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center" }}>{item.qty}</span>
                    <button onClick={() => dispatch({ type: "UPDATE_QTY", payload: { id: item.id, layanan: item.layanan, qty: item.qty + 1 } })} style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#f7fafc", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", fontWeight: 700, fontSize: 16, borderTop: "2px solid #2d6a4f", marginTop: 8 }}>
                <span>Total</span><span style={{ color: "#2d6a4f" }}>{fmt(total)}</span>
              </div>
              <Btn variant="primary" fullWidth onClick={() => setStep(2)}>Lanjut ke Pembayaran</Btn>
            </>
          )}
          {state.user && state.pesanan.length > 0 && (
            <div style={{ marginTop: 18, background: "#f7fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 800, color: "#1a202c", marginBottom: 10 }}>Informasi Pesanan & Pembayaran</div>
              {state.pesanan.slice(0, 3).map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid #edf2f7" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#2d6a4f", fontSize: 13 }}>{p.id}</div>
                    <div style={{ color: "#718096", fontSize: 12 }}>{p.items.map(i => i.nama).join(", ")}</div>
                    <div style={{ color: "#718096", fontSize: 12 }}>Metode: {p.metode}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{fmt(p.total)}</div>
                    <div style={{ color: p.statusBayar === "Gagal" || p.status === "Dibatalkan" ? "#c53030" : p.statusBayar === "LUNAS" ? "#2d6a4f" : "#2a4a7f", fontSize: 12, fontWeight: 800 }}>{p.statusBayar ? paymentStatusLabel(p.statusBayar) : orderStatusLabel(p.status)}</div>
                    <div style={{ color: "#718096", fontSize: 11 }}>Pesanan: {orderStatusLabel(p.status)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ background: "#f0fff4", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: "#2d6a4f", marginBottom: 12, fontSize: 15 }}>Ringkasan Pesanan</div>
            {state.cart.map(c => (
              <div key={`${c.id}-${c.layanan}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#4a5568" }}>
                <span>{c.nama} ×{c.qty}</span><span style={{ fontWeight: 600 }}>{fmt(c.harga * c.qty)}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px dashed #52b788", marginTop: 10, paddingTop: 10, fontWeight: 700, fontSize: 15, display: "flex", justifyContent: "space-between" }}>
              <span>Total</span><span style={{ color: "#2d6a4f" }}>{fmt(total)}</span>
            </div>
          </div>
          <Input label="Nama Penerima" value={penerima} onChange={setPenerima} placeholder="Nama penerima / pemesan" />
          <Input label="Alamat Pengiriman" value={alamatKirim} onChange={setAlamatKirim} placeholder="Alamat pengiriman lengkap" />
          <Input label="No. HP / WhatsApp" value={phoneKirim} onChange={setPhoneKirim} placeholder="08xxxxxxxxxx" />
          <Input label="Catatan (opsional)" value={catatan} onChange={setCatatan} placeholder="Mis. waktu pengiriman" />
          {hasPatungan && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <Input label="Email Peserta Patungan" value={patunganEmails} onChange={setPatunganEmails} placeholder="Pisahkan dengan koma, maksimal 6 email" />
              <div style={{ fontSize: 12, color: "#92400e", marginTop: -8 }}>Peserta akan menerima permintaan konfirmasi patungan di dashboard mereka.</div>
            </div>
          )}
          <Select label="Metode Pembayaran" value={metode} onChange={setMetode} options={[
            { value: "tunai", label: "Uang Tunai (Lunas / Testing)" },
            { value: "setoran_tunai", label: "Setoran Qurban Tunai" },
            { value: "midtrans", label: "Midtrans Online" },
            { value: "setoran_midtrans", label: "Setoran Qurban Midtrans" },
          ]} />
          {(metode === "setoran_tunai" || metode === "setoran_midtrans") && (
            <Input label="Nominal Setoran Awal (Rp)" value={setoranAwal} onChange={setSetoranAwal} type="number" placeholder="contoh: 1000000" required />
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn variant="ghost" onClick={() => setStep(1)}>← Kembali</Btn>
            <Btn variant="secondary" fullWidth onClick={checkout}>✓ Konfirmasi Pesanan</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────
//  HEWAN CARD
// ─────────────────────────────────────────────────────────
function HewanCard({ hewan, layanan = "Qurban" }) {
  const { state, dispatch } = useContext(AppContext);
  const addCart = () => {
    if (!state.user) { dispatch({ type: "TOGGLE_LOGIN" }); return; }

    // For Qurban Sapi patungan: backend expects is_patungan='Y'
    // and will decrement stock using JUMLAH (qty) per your rule.
    const isPatungan = layanan === "Qurban" && hewan.jenis === "sapi";

    dispatch({
      type: "ADD_TO_CART",
      payload: {
        ...hewan,
        layanan,
        is_patungan: isPatungan ? 'Y' : 'N',
      }
    });
  };
  const gradeColor = { "A+": "#7b2ff7", "A": "#2d6a4f", "B": "#c47a1a" };
  return (
    <div style={{ background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 20px rgba(45,106,79,0.08)", border: "1px solid #e8f5e9", transition: "transform 0.2s, box-shadow 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(45,106,79,0.16)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(45,106,79,0.08)"; }}>
      <div style={{ background: "linear-gradient(135deg, #d8f3dc, #b7e4c7)", height: 140, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, position: "relative" }}>
        {hewan.img}
        <span style={{ position: "absolute", top: 12, right: 12, background: gradeColor[hewan.grade] || "#2d6a4f", color: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>Grade {hewan.grade}</span>
        {hewan.stok < 5 && <span style={{ position: "absolute", top: 12, left: 12, background: "#e53e3e", color: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>Stok Terbatas!</span>}
      </div>
      <div style={{ padding: 18 }}>
        <h4 style={{ margin: "0 0 4px", fontSize: 15, color: "#1a202c", fontFamily: "'Playfair Display', serif" }}>{hewan.nama}</h4>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#718096" }}>⚖️ {hewan.berat} · Stok: {hewan.stok} ekor</p>
        {layanan === "Qurban" && hewan.jenis === "sapi" && <p style={{ margin: "0 0 10px", fontSize: 11, color: "#52b788", fontWeight: 600 }}>👥 Bisa patungan {hewan.share} orang</p>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#2d6a4f" }}>{fmt(hewan.harga)}</div>
            {hewan.jenis === "sapi" && layanan === "Qurban" && <div style={{ fontSize: 11, color: "#a0aec0" }}>atau {fmt(Math.round(hewan.harga / hewan.share))}/orang</div>}
          </div>
          <Btn variant="primary" size="sm" onClick={addCart}>+ Pesan</Btn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  LANDING PAGE
// ─────────────────────────────────────────────────────────
function LandingPage() {
  const { dispatch, hewanList } = useContext(AppContext);
  const featuredHewan = hewanList?.length ? hewanList : hewan_data;
  const stats = [
    { label: "Hewan Tersedia", val: "500+", icon: "🐄" },
    { label: "Pelanggan Puas", val: "10.000+", icon: "😊" },
    { label: "Tahun Berpengalaman", val: "15+", icon: "🏆" },
    { label: "Kota Layanan", val: "50+", icon: "📍" },
  ];
  const features = [
    { icon: "🐄", title: "Qurban Sapi & Kambing", desc: "Pilihan hewan berkualitas grade A, bersertifikat halal dan sehat" },
    { icon: "👶", title: "Aqiqah Terpercaya", desc: "Paket aqiqah lengkap untuk putra maupun putri Anda" },
    { icon: "🏦", title: "Tabungan Qurban", desc: "Sisihkan sedikit setiap bulan untuk persiapan qurban Anda" },
    { icon: "🔔", title: "Notifikasi Real-time", desc: "Update status pesanan langsung ke HP Anda" },
    { icon: "🚛", title: "Pengiriman Terjadwal", desc: "Penjadwalan pemotongan dan pengiriman yang fleksibel" },
    { icon: "📋", title: "Sertifikat Digital", desc: "Sertifikat aqiqah/qurban resmi yang dapat diunduh" },
  ];
  return (
    <div>
      {/* Hero */}
      <div style={{ minHeight: "100vh", background: "linear-gradient(145deg, #081c15 0%, #1b4332 50%, #2d6a4f 100%)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "100px 24px 60px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 50%, rgba(82,183,136,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(64,145,108,0.2) 0%, transparent 50%)" }}></div>
        <div style={{ maxWidth: 700, position: "relative" }}>
          <div style={{ background: "rgba(82,183,136,0.15)", border: "1px solid rgba(82,183,136,0.3)", borderRadius: 100, padding: "8px 20px", fontSize: 13, color: "#74c69d", fontWeight: 600, display: "inline-block", marginBottom: 24, letterSpacing: 1 }}>
            ✨ PETERNAKAN HALAL BERSERTIFIKAT
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 800, color: "#fff", margin: "0 0 20px", lineHeight: 1.2 }}>
            Qurban & Aqiqah<br /><span style={{ color: "#74c69d" }}>Berkah Terbaik</span><br />untuk Keluarga Anda
          </h1>
          <p style={{ fontSize: 18, color: "#a8d8b9", margin: "0 0 40px", lineHeight: 1.6 }}>
            Hewan pilihan berkualitas premium, proses halal terjamin,<br />layanan profesional dari peternakan terpercaya.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Btn variant="secondary" size="lg" onClick={() => dispatch({ type: "SET_PAGE", payload: "qurban" })}>🐄 Pesan Qurban</Btn>
            <Btn variant="outline" size="lg" onClick={() => dispatch({ type: "SET_PAGE", payload: "aqiqah" })} style={{ borderColor: "#74c69d", color: "#74c69d" }}>👶 Paket Aqiqah</Btn>
          </div>
          <div style={{ display: "flex", gap: 32, justifyContent: "center", marginTop: 56, flexWrap: "wrap" }}>
            {stats.map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32 }}>{s.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "'Playfair Display', serif" }}>{s.val}</div>
                <div style={{ fontSize: 12, color: "#74c69d", fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ background: "#f9fafb", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, color: "#1a202c", marginBottom: 12 }}>Layanan Unggulan Kami</h2>
          <p style={{ color: "#718096", fontSize: 16, marginBottom: 52 }}>Kami hadir untuk memudahkan ibadah Anda</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            {features.map(f => (
              <div key={f.title} style={{ background: "#fff", borderRadius: 16, padding: 28, textAlign: "left", border: "1px solid #e8f5e9", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 24px rgba(45,106,79,0.12)"; e.currentTarget.style.borderColor = "#52b788"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#e8f5e9"; }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ margin: "0 0 8px", fontSize: 17, fontFamily: "'Playfair Display', serif", color: "#1a202c" }}>{f.title}</h3>
                <p style={{ margin: 0, color: "#718096", fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hewan Featured */}
      <div style={{ padding: "80px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: "#1a202c", margin: 0 }}>Pilihan Hewan Unggulan</h2>
              <p style={{ color: "#718096", marginTop: 8, marginBottom: 0 }}>Semua hewan telah melewati pemeriksaan kesehatan ketat</p>
            </div>
            <Btn variant="outline" onClick={() => dispatch({ type: "SET_PAGE", payload: "qurban" })}>Lihat Semua →</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {featuredHewan.slice(0, 4).map(h => <HewanCard key={h.id} hewan={h} />)}
          </div>
        </div>
      </div>

      {/* CTA Tabungan */}
      <div style={{ background: "linear-gradient(135deg, #1b4332, #2d6a4f)", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🏦</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, color: "#fff", margin: "0 0 16px" }}>Mulai Tabungan Qurban</h2>
          <p style={{ color: "#a8d8b9", fontSize: 16, marginBottom: 36 }}>Rencanakan ibadah qurban Anda dari sekarang. Sisihkan sedikit setiap bulan agar tidak memberatkan di hari H.</p>
          <Btn variant="secondary" size="lg" onClick={() => dispatch({ type: "SET_PAGE", payload: "tabungan" })}>Buka Tabungan Sekarang</Btn>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: "#0d1b2a", color: "#a0aec0", padding: "48px 24px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40, marginBottom: 40 }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#fff", marginBottom: 12 }}>🐄 Al-Barakah</div>
              <p style={{ fontSize: 13, lineHeight: 1.7 }}>Peternakan aqiqah dan qurban terpercaya dengan pengalaman 15 tahun melayani masyarakat.</p>
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, marginBottom: 12 }}>Layanan</div>
              {["Qurban Sapi", "Qurban Kambing", "Aqiqah", "Tabungan Qurban"].map(l => <div key={l} style={{ fontSize: 13, marginBottom: 6, cursor: "pointer" }}>{l}</div>)}
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, marginBottom: 12 }}>Kontak</div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>📞 +62 812 3456 7890</div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>✉️ info@albarakah.id</div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>📍 Bandung, Jawa Barat</div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #2d3748", paddingTop: 20, textAlign: "center", fontSize: 12 }}>
            © 2025 Al-Barakah Peternakan. Semua hak dilindungi.
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  QURBAN PAGE
// ─────────────────────────────────────────────────────────
function QurbanPage() {
  const { hewanList } = useContext(AppContext);
  const [filter, setFilter] = useState("all");
  const [jadwal, setJadwal] = useState([]);
  useEffect(() => {
    fetch(`${API_BASE}/jadwal`).then(r => r.json()).then(d => Array.isArray(d) && setJadwal(d)).catch(() => {});
  }, []);
  const listHewan = hewanList?.length ? hewanList : hewan_data;
  const filtered = listHewan.filter(h => {
    if (filter === "all") return h.kategori !== "aqiqah";
    return (h.jenis === filter || (filter === "kambing" && h.jenis === "domba")) && h.kategori !== "aqiqah";
  });
  return (
    <div style={{ paddingTop: 80 }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #1b4332, #2d6a4f)", padding: "60px 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, color: "#fff", margin: "0 0 12px" }}>🐄 Pemesanan Qurban</h1>
        <p style={{ color: "#a8d8b9", fontSize: 16 }}>Pilih hewan qurban terbaik untuk ibadah Anda</p>
      </div>
      {/* Filter */}
      <div style={{ background: "#fff", padding: "20px 24px", borderBottom: "1px solid #e8f5e9", display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        {[{ v: "all", l: "Semua Hewan" }, { v: "sapi", l: "🐄 Sapi" }, { v: "kambing", l: "🐐 Kambing/Domba" }].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)} style={{ padding: "8px 20px", borderRadius: 20, border: "2px solid", borderColor: filter === f.v ? "#2d6a4f" : "#e2e8f0", background: filter === f.v ? "#2d6a4f" : "#fff", color: filter === f.v ? "#fff" : "#4a5568", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit" }}>
            {f.l}
          </button>
        ))}
      </div>

      {/* Info Patungan */}
      <div style={{ background: "#fffbeb", borderBottom: "1px solid #fde68a", padding: "14px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", fontSize: 14, color: "#92400e" }}>
          💡 <strong>Info Patungan Sapi:</strong> Qurban sapi dapat dilakukan secara patungan maksimal 7 orang. Harga yang tertera adalah harga 1 ekor sapi penuh.
        </div>
      </div>

      {/* Grid */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
          {filtered.map(h => <HewanCard key={h.id} hewan={h} layanan="Qurban" />)}
        </div>
      </div>

      {/* Jadwal */}
      <div style={{ background: "#f0fff4", padding: "60px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1a202c", marginBottom: 24 }}>📅 Jadwal Pemotongan</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {(jadwal.length ? jadwal : [
              { TANGGAL: "2026-06-17", TEMPAT: "Peternakan Pusat Al-Barakah" },
              { TANGGAL: "2026-06-18", TEMPAT: "Masjid Al-Ikhlas" },
              { TANGGAL: "2026-06-19", TEMPAT: "Peternakan Cabang" },
            ]).map(j => (
              <div key={`${j.TANGGAL}-${j.TEMPAT}`} style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #b7e4c7" }}>
                <div style={{ fontWeight: 700, color: "#1a202c", marginBottom: 6 }}>📅 {new Date(j.TANGGAL).toLocaleDateString("id-ID")}</div>
                <div style={{ fontSize: 13, color: "#4a5568" }}>📍 {j.TEMPAT}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  AQIQAH PAGE
// ─────────────────────────────────────────────────────────
function AqiqahPage() {
  const { state, dispatch, hewanList } = useContext(AppContext);
  const [formAqiqah, setFormAqiqah] = useState({ namaAnak: "", tglLahir: "", jenisKelamin: "laki-laki", namaAyah: "", alamat: "", tglAqiqah: "", catatan: "" });
  const [selectedPaket, setSelectedPaket] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const handlePilihPaket = (p) => {
    if (!state.user) { dispatch({ type: "TOGGLE_LOGIN" }); return; }
    setSelectedPaket(p); setShowForm(true);
  };
  const handleSubmit = () => {
    if (!formAqiqah.namaAnak || !formAqiqah.tglLahir) return;
    const daftarHewan = hewanList?.length ? hewanList : hewan_data;
    const hewanAqiqah = daftarHewan.find(h => h.kategori !== "qurban" && (h.jenis === "kambing" || h.jenis === "domba")) || daftarHewan.find(h => h.kategori !== "qurban");
    selectedPaket.id_hewan = hewanAqiqah?.id || selectedPaket.id;
    dispatch({ type: "ADD_TO_CART", payload: { ...selectedPaket, img: "🐑", jenis: "kambing", layanan: `Aqiqah – ${formAqiqah.namaAnak}`, kategori: "aqiqah" } });
    setShowForm(false);
    dispatch({ type: "TOGGLE_CART" });
  };
  const aqiqahHewan = (hewanList?.length ? hewanList : hewan_data).filter(h => h.kategori !== "qurban");
  return (
    <div style={{ paddingTop: 80 }}>
      <div style={{ background: "linear-gradient(135deg, #44006b, #6b2fa0)", padding: "60px 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, color: "#fff", margin: "0 0 12px" }}>👶 Layanan Aqiqah</h1>
        <p style={{ color: "#e9d8fd", fontSize: 16 }}>Rayakan kelahiran buah hati dengan aqiqah yang berkah</p>
      </div>

      {/* Info Aqiqah */}
      <div style={{ background: "#faf5ff", padding: "40px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 48 }}>
            {[
              { icon: "👦", title: "Aqiqah Laki-laki", desc: "2 ekor kambing (sunnah). Bisa 1 ekor jika tidak mampu." },
              { icon: "👧", title: "Aqiqah Perempuan", desc: "1 ekor kambing yang memenuhi syarat aqiqah." },
              { icon: "⏰", title: "Waktu Pelaksanaan", desc: "Hari ke-7, ke-14, atau ke-21 dari kelahiran." },
              { icon: "📜", title: "Syarat Hewan", desc: "Kambing sehat, tidak cacat, usia min. 1 tahun." },
            ].map(info => (
              <div key={info.title} style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e9d8fd" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>{info.icon}</div>
                <h4 style={{ margin: "0 0 6px", color: "#44006b", fontFamily: "'Playfair Display', serif" }}>{info.title}</h4>
                <p style={{ margin: 0, fontSize: 13, color: "#4a5568", lineHeight: 1.6 }}>{info.desc}</p>
              </div>
            ))}
          </div>

          {/* Paket Aqiqah */}
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1a202c", marginBottom: 24 }}>Pilih Paket Aqiqah</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginBottom: 48 }}>
            {paket_aqiqah.map(p => (
              <div key={p.id} style={{ background: "#fff", borderRadius: 18, overflow: "hidden", border: p.id === 2 ? "2px solid #6b2fa0" : "1px solid #e9d8fd", boxShadow: p.id === 2 ? "0 8px 32px rgba(107,47,160,0.18)" : "none", position: "relative" }}>
                {p.id === 2 && <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "#6b2fa0", color: "#fff", fontSize: 12, fontWeight: 700, textAlign: "center", padding: "6px 0", letterSpacing: 1 }}>⭐ PALING POPULER</div>}
                <div style={{ padding: p.id === 2 ? "44px 24px 24px" : 24 }}>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#1a202c", margin: "0 0 8px" }}>{p.nama}</h3>
                  <div style={{ fontSize: 11, color: "#718096", marginBottom: 16 }}>Untuk aqiqah {p.gender === "laki-laki" ? "👦 Putra (2 kambing)" : "👧 Putri (1 kambing)"}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#44006b", marginBottom: 20 }}>{fmt(p.harga)}</div>
                  <div style={{ marginBottom: 20 }}>
                    {p.termasuk.map(t => <div key={t} style={{ fontSize: 13, color: "#4a5568", marginBottom: 6 }}>✓ {t}</div>)}
                  </div>
                  <Btn variant={p.id === 2 ? "primary" : "outline"} fullWidth onClick={() => handlePilihPaket(p)} style={p.id === 2 ? { background: "linear-gradient(135deg, #44006b, #6b2fa0)" } : { borderColor: "#6b2fa0", color: "#6b2fa0" }}>Pilih Paket</Btn>
                </div>
              </div>
            ))}
          </div>

          {/* Hewan Aqiqah */}
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1a202c", marginBottom: 24 }}>Atau Pilih Hewan Sendiri</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {aqiqahHewan.map(h => <HewanCard key={h.id} hewan={h} layanan="Aqiqah" />)}
          </div>
        </div>
      </div>

      {/* Form Aqiqah Modal */}
      <Modal show={showForm} onClose={() => setShowForm(false)} title={`📋 Data Aqiqah – ${selectedPaket?.nama}`} width={520}>
        <div style={{ background: "#faf5ff", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, color: "#44006b" }}>
          Paket: <strong>{selectedPaket?.nama}</strong> · {fmt(selectedPaket?.harga || 0)}
        </div>
        <Input label="Nama Anak" value={formAqiqah.namaAnak} onChange={v => setFormAqiqah({ ...formAqiqah, namaAnak: v })} required />
        <Input label="Tanggal Lahir" value={formAqiqah.tglLahir} onChange={v => setFormAqiqah({ ...formAqiqah, tglLahir: v })} type="date" required />
        <Select label="Jenis Kelamin" value={formAqiqah.jenisKelamin} onChange={v => setFormAqiqah({ ...formAqiqah, jenisKelamin: v })} options={[{ value: "laki-laki", label: "Laki-laki (2 Kambing)" }, { value: "perempuan", label: "Perempuan (1 Kambing)" }]} />
        <Input label="Nama Ayah / Wali" value={formAqiqah.namaAyah} onChange={v => setFormAqiqah({ ...formAqiqah, namaAyah: v })} />
        <Input label="Tanggal Pelaksanaan" value={formAqiqah.tglAqiqah} onChange={v => setFormAqiqah({ ...formAqiqah, tglAqiqah: v })} type="date" required />
        <Input label="Alamat Pengiriman" value={formAqiqah.alamat} onChange={v => setFormAqiqah({ ...formAqiqah, alamat: v })} />
        <Btn variant="primary" fullWidth onClick={handleSubmit} style={{ marginTop: 8, background: "linear-gradient(135deg, #44006b, #6b2fa0)" }}>
          Tambahkan ke Keranjang
        </Btn>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  TABUNGAN PAGE
// ─────────────────────────────────────────────────────────
function TabunganPage() {
  const { state, dispatch, refreshAccountData, hewanList } = useContext(AppContext);
  const [setorId, setSetorId] = useState(null);
  const [setorAmt, setSetorAmt] = useState("");
  const [setorMethod, setSetorMethod] = useState("tunai");
  const [riwayatSetoran, setRiwayatSetoran] = useState({});
  const f = state.tabunganFormData;
  const daftarHewan = hewanList?.length ? hewanList : hewan_data;
  const cocokTarget = (h) => h.jenis === f.jenis || (f.jenis === "kambing" && h.jenis === "domba");
  const targetHewan = daftarHewan.find(h => cocokTarget(h) && h.kategori !== "aqiqah") || daftarHewan.find(cocokTarget);
  const targetHarga = targetHewan?.harga || (f.jenis === "sapi" ? 18500000 : 3200000);
  const handleBuat = async () => {
    if (!state.user) { dispatch({ type: "TOGGLE_LOGIN" }); return; }
    if (!f.nama_qurban || !f.target) return;
    dispatch({ type: 'SET_LOADING' });
    try {
      const token = localStorage.getItem('albarakah_token');
      const hewanTarget = targetHewan;
      const res = await fetch(`${API_BASE}/tabungan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          nama_tabungan: f.nama_qurban,
          jenis_target: f.jenis,
          target_nominal: parseInt(f.target, 10),
          id_hewan: hewanTarget?.id || null,
        })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Gagal membuat tabungan'); return; }
      dispatch({ type: "UPDATE_TABUNGAN_FORM", payload: { nama_qurban: "", target: "", setoran: "" } });
      await refreshAccountData?.();
      dispatch({ type: "PUSH_NOTIF", payload: { msg: "Tabungan qurban berhasil dibuat", type: "success" } });
    } catch (e) {
      console.error(e);
      alert('Gagal membuat tabungan');
    } finally {
      dispatch({ type: 'UNSET_LOADING' });
    }
  };
  const handleSetor = () => {
    if (!setorAmt || isNaN(setorAmt)) return;
    (async () => {
      dispatch({ type: 'SET_LOADING' });
      try {
        const token = localStorage.getItem('albarakah_token');
        const endpoint = setorMethod === "midtrans" ? `${API_BASE}/payment/setor/snap` : `${API_BASE}/payment/setor/cash`;
        const res = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ id_tabungan: setorId, nominal: parseInt(setorAmt, 10) })
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Gagal mencatat setoran'); return; }

        if (setorMethod === "tunai") {
          setSetorId(null); setSetorAmt("");
          await refreshAccountData?.();
          alert('Setoran tunai berhasil dicatat.');
          return;
        }

        await ensureSnapScript(data);
        window.snap.pay(data.token, {
          onSuccess: async function(result){
            setSetorId(null); setSetorAmt("");
            await refreshAccountData?.();
            alert('Pembayaran setoran berhasil. Terima kasih!');
          },
          onPending: async function(result){
            setSetorId(null); setSetorAmt("");
            await refreshAccountData?.();
            alert('Pembayaran pending. Mohon selesaikan pembayaran.');
          },
          onError: function(result){ console.error('Midtrans error', result); alert('Terjadi kesalahan saat pembayaran'); },
          onClose: function(){ }
        });
      } catch (e) { console.error(e); alert('Gagal memproses pembayaran'); dispatch({ type: 'UNSET_LOADING' }); }
      finally { dispatch({ type: 'UNSET_LOADING' }); }
    })();
  };
  useEffect(() => {
    (async () => {
      if (!state.user || !state.tabungan.length) return;
      const token = localStorage.getItem('albarakah_token');
      const next = {};
      for (const t of state.tabungan) {
        try {
          const res = await fetch(`${API_BASE}/setoran/tabungan/${t.id}`, { headers: { "Authorization": `Bearer ${token}` } });
          if (res.ok) next[t.id] = await res.json();
        } catch (e) { /* ignore */ }
      }
      setRiwayatSetoran(next);
    })();
  }, [state.user?.id, state.tabungan]);
  return (
    <div style={{ paddingTop: 80 }}>
      <div style={{ background: "linear-gradient(135deg, #1a365d, #2a4a7f)", padding: "60px 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, color: "#fff", margin: "0 0 12px" }}>🏦 Tabungan Qurban</h1>
        <p style={{ color: "#bee3f8", fontSize: 16 }}>Rencanakan ibadah qurban Anda dari sekarang. Cicil sedikit demi sedikit!</p>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          {/* Buat Tabungan */}
          <div>
            <div style={{ background: "#fff", borderRadius: 20, padding: 28, border: "1px solid #bee3f8", boxShadow: "0 4px 20px rgba(26,54,93,0.08)" }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#1a365d", margin: "0 0 24px" }}>+ Buka Tabungan Baru</h3>
              {!state.user && (
                <div style={{ background: "#ebf8ff", border: "1px solid #bee3f8", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, color: "#2c5282" }}>
                  ℹ️ Silakan <strong style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => dispatch({ type: "TOGGLE_LOGIN" })}>masuk</strong> terlebih dahulu untuk membuat tabungan.
                </div>
              )}
              <Input label="Nama / Alias Tabungan" value={f.nama_qurban} onChange={v => dispatch({ type: "UPDATE_TABUNGAN_FORM", payload: { nama_qurban: v } })} placeholder="contoh: Qurban Keluarga 2025" required />
              <Select label="Jenis Hewan Target" value={f.jenis} onChange={v => dispatch({ type: "UPDATE_TABUNGAN_FORM", payload: { jenis: v } })} options={[{ value: "sapi", label: "🐄 Sapi" }, { value: "kambing", label: "🐐 Kambing/Domba" }]} />
              <div style={{ background: "#ebf8ff", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#2c5282" }}>
                💡 Estimasi harga {f.jenis}: mulai <strong>{fmt(targetHarga)}</strong>
              </div>
              <Input label="Target Tabungan (Rp)" value={f.target} onChange={v => dispatch({ type: "UPDATE_TABUNGAN_FORM", payload: { target: v } })} type="number" placeholder={`Disarankan minimal ${fmt(targetHarga)}`} required />
              <Btn variant="primary" fullWidth onClick={handleBuat} disabled={!state.user} style={{ background: "linear-gradient(135deg, #1a365d, #2a4a7f)" }}>
                Buat Tabungan
              </Btn>
            </div>

            {/* Simulasi */}
            <div style={{ background: "#f0fff4", borderRadius: 16, padding: 24, marginTop: 20, border: "1px solid #c6f6d5" }}>
              <h4 style={{ fontFamily: "'Playfair Display', serif", color: "#2d6a4f", margin: "0 0 16px" }}>🧮 Simulasi Tabungan</h4>
              <div style={{ fontSize: 14, color: "#4a5568", lineHeight: 2 }}>
                <div>Target: <strong>{fmt(parseInt(f.target) || targetHarga)}</strong></div>
                <div>Tabung 6 bln: <strong style={{ color: "#2d6a4f" }}>{fmt(Math.round((parseInt(f.target) || targetHarga) / 6))}/bulan</strong></div>
                <div>Tabung 12 bln: <strong style={{ color: "#2d6a4f" }}>{fmt(Math.round((parseInt(f.target) || targetHarga) / 12))}/bulan</strong></div>
                <div>Tabung 24 bln: <strong style={{ color: "#2d6a4f" }}>{fmt(Math.round((parseInt(f.target) || targetHarga) / 24))}/bulan</strong></div>
              </div>
            </div>
          </div>

          {/* Daftar Tabungan */}
          <div>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#1a202c", margin: "0 0 20px" }}>Tabungan Saya</h3>
            {state.tabungan.length === 0 ? (
              <div style={{ background: "#f7fafc", borderRadius: 16, padding: 48, textAlign: "center", border: "1px dashed #cbd5e0" }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>🏦</div>
                <p style={{ color: "#a0aec0", margin: 0 }}>Belum ada tabungan aktif</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {state.tabungan.map(t => {
                  const pct = Math.min(100, Math.round((t.terkumpul / t.target) * 100));
                  return (
                    <div key={t.id} style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #bee3f8", boxShadow: "0 2px 12px rgba(26,54,93,0.06)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: "#1a365d" }}>{t.nama}</div>
                          <div style={{ fontSize: 12, color: "#718096" }}>{t.jenis === "sapi" ? "🐄" : "🐐"} {t.jenis} · Dibuat {t.dibuat}</div>
                        </div>
                        <span style={{ background: pct >= 100 ? "#c6f6d5" : "#ebf8ff", color: pct >= 100 ? "#276749" : "#2c5282", borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>{pct}%</span>
                      </div>
                      {/* Progress Bar */}
                      <div style={{ background: "#e2e8f0", borderRadius: 99, height: 8, marginBottom: 10, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "linear-gradient(90deg, #48bb78, #38a169)" : "linear-gradient(90deg, #3182ce, #2b6cb0)", borderRadius: 99, transition: "width 0.5s" }}></div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4a5568", marginBottom: 14 }}>
                        <span>Terkumpul: <strong style={{ color: "#2c5282" }}>{fmt(t.terkumpul)}</strong></span>
                        <span>Target: <strong>{fmt(t.target)}</strong></span>
                      </div>
                      {setorId === t.id ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <input type="number" value={setorAmt} onChange={e => setSetorAmt(e.target.value)} placeholder="Jumlah setoran (Rp)" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid #3182ce", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                          <select value={setorMethod} onChange={e => setSetorMethod(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #3182ce", fontSize: 13, fontFamily: "inherit", background: "#fff" }}>
                            <option value="tunai">Tunai</option>
                            <option value="midtrans">Midtrans</option>
                          </select>
                          <Btn variant="primary" size="sm" onClick={handleSetor} style={{ background: "#2a4a7f" }}>Setor</Btn>
                          <Btn variant="ghost" size="sm" onClick={() => setSetorId(null)}>Batal</Btn>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <Btn variant="primary" size="sm" onClick={() => setSetorId(t.id)} style={{ background: "linear-gradient(135deg, #1a365d, #2a4a7f)" }}>+ Setor Dana</Btn>
                          {t.riwayat?.length > 0 && <span style={{ fontSize: 12, color: "#718096", alignSelf: "center" }}>{t.riwayat.length}× setoran</span>}
                        </div>
                      )}
                      {(riwayatSetoran[t.id] || []).length > 0 && (
                        <div style={{ marginTop: 14, background: "#f7fafc", borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#4a5568", marginBottom: 8 }}>History Setoran</div>
                          {(riwayatSetoran[t.id] || []).slice(0, 5).map(s => (
                            <div key={s.ID_SETORAN} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid #edf2f7" }}>
                              <span>{new Date(s.TGL_SETOR).toLocaleDateString("id-ID")} • {s.METODE}</span>
                              <span style={{ fontWeight: 800, color: s.STATUS === "LUNAS" ? "#2d6a4f" : s.STATUS === "Gagal" ? "#c53030" : "#c47a1a" }}>{fmt(s.NOMINAL)} - {s.STATUS}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────
function DashboardPage() {
  const { state, dispatch, printReceipt, refreshAccountData } = useContext(AppContext);
  const [setorOrderId, setSetorOrderId] = useState(null);
  const [setorOrderAmt, setSetorOrderAmt] = useState("");
  const [setorOrderMethod, setSetorOrderMethod] = useState("tunai");
  const respondPatungan = async (id, status) => {
    dispatch({ type: 'SET_LOADING' });
    try {
      const token = localStorage.getItem('albarakah_token');
      const res = await fetch(`${API_BASE}/patungan/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Gagal memperbarui patungan"); return; }
      await refreshAccountData?.();
      alert(status === "DISETUJUI" ? "Patungan disetujui" : "Patungan ditolak");
    } catch (e) {
      alert("Gagal memproses patungan");
    } finally {
      dispatch({ type: 'UNSET_LOADING' });
    }
  };
  const handleSetorPesanan = async (order) => {
    const nominal = parseInt(setorOrderAmt || "0", 10);
    if (!nominal || nominal <= 0) { alert("Nominal setoran tidak valid"); return; }
    dispatch({ type: 'SET_LOADING' });
    try {
      const token = localStorage.getItem('albarakah_token');
      const endpoint = setorOrderMethod === "midtrans" ? `${API_BASE}/payment/setor/snap` : `${API_BASE}/payment/setor/cash`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id_pesanan: order.rawId, nominal })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Gagal mencatat setoran"); return; }

      if (setorOrderMethod === "tunai") {
        setSetorOrderId(null); setSetorOrderAmt("");
        await refreshAccountData?.();
        alert("Setoran tunai pesanan berhasil dicatat.");
        return;
      }

      await ensureSnapScript(data);
      window.snap.pay(data.token, {
        onSuccess: async function(){
          setSetorOrderId(null); setSetorOrderAmt("");
          await refreshAccountData?.();
          alert("Pembayaran setoran berhasil.");
        },
        onPending: async function(){
          setSetorOrderId(null); setSetorOrderAmt("");
          await refreshAccountData?.();
          alert("Pembayaran setoran pending.");
        },
        onError: function(result){ console.error("Midtrans error", result); alert("Terjadi kesalahan saat pembayaran"); },
        onClose: function(){}
      });
    } catch (e) {
      console.error(e);
      alert("Gagal memproses setoran");
    } finally {
      dispatch({ type: 'UNSET_LOADING' });
    }
  };
  if (!state.user) return (
    <div style={{ paddingTop: 120, textAlign: "center" }}>
      <p>Silakan masuk terlebih dahulu</p>
      <Btn variant="primary" onClick={() => dispatch({ type: "TOGGLE_LOGIN" })}>Masuk</Btn>
    </div>
  );
  if (normalizeClientRole(state.user.role) === "ADMIN") return <AdminPage />;
  const statusColor = { "Menunggu Konfirmasi": "#ed8936", "Menunggu Pembayaran": "#ed8936", "Menunggu Pembayaran Setoran": "#ed8936", "Cicilan Aktif": "#2a4a7f", "Dikonfirmasi": "#3182ce", "Diproses": "#805ad5", "Selesai": "#38a169", "Dibatalkan": "#e53e3e" };
  return (
    <div style={{ paddingTop: 80, background: "#f7fafc", minHeight: "100vh" }}>
      <div style={{ background: "linear-gradient(135deg, #1a202c, #2d3748)", padding: "40px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, #2d6a4f, #40916c)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>👤</div>
            <div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#fff", margin: 0, fontSize: 26 }}>{state.user.name}</h2>
              <p style={{ color: "#a0aec0", margin: 0, fontSize: 14 }}>{state.user.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
        {/* Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 40 }}>
          {[
            { label: "Total Pesanan", val: state.pesanan.length, icon: "📦", color: "#2d6a4f" },
            { label: "Tabungan Aktif", val: state.tabungan.length, icon: "🏦", color: "#2a4a7f" },
            { label: "Item di Keranjang", val: state.cart.reduce((s, c) => s + c.qty, 0), icon: "🛒", color: "#6b2fa0" },
            { label: "Notifikasi", val: state.notifications.filter(n => !n.read).length, icon: "🔔", color: "#e08b20" },
          ].map(c => (
            <div key={c.label} style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #e2e8f0", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.val}</div>
              <div style={{ fontSize: 12, color: "#718096", fontWeight: 600 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {state.patungan.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, border: "1px solid #e2e8f0", marginBottom: 24 }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, margin: "0 0 16px", color: "#1a202c" }}>Undangan Patungan Qurban</h3>
            {state.patungan.map(inv => (
              <div key={inv.ID_PATUNGAN} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid #edf2f7", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 800, color: "#2d6a4f" }}>ORD-{inv.ID_PESANAN} - {inv.NAMA_HEWAN || "Qurban Sapi"}</div>
                  <div style={{ color: "#718096", fontSize: 13 }}>Dari {inv.NAMA_PEMINTA} • Porsi {fmt(inv.NOMINAL_PORSI)}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: inv.STATUS === "MENUNGGU" ? "#c47a1a" : inv.STATUS === "DISETUJUI" ? "#2d6a4f" : "#c53030" }}>{inv.STATUS}</span>
                  {inv.STATUS === "MENUNGGU" && (
                    <>
                      <Btn size="sm" variant="primary" onClick={() => respondPatungan(inv.ID_PATUNGAN, "DISETUJUI")}>Setuju</Btn>
                      <Btn size="sm" variant="danger" onClick={() => respondPatungan(inv.ID_PATUNGAN, "DITOLAK")}>Tolak</Btn>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pesanan */}
        <div style={{ background: "#fff", borderRadius: 18, padding: 28, border: "1px solid #e2e8f0", marginBottom: 24 }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, margin: "0 0 20px", color: "#1a202c" }}>📦 Riwayat Pesanan</h3>
          {state.pesanan.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#a0aec0" }}>
              <div style={{ fontSize: 48 }}>📦</div>
              <p>Belum ada pesanan</p>
              <Btn variant="primary" size="sm" onClick={() => dispatch({ type: "SET_PAGE", payload: "qurban" })}>Pesan Sekarang</Btn>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#f7fafc" }}>
                    {["ID Pesanan", "Tanggal", "Item", "Total", "Terbayar", "Metode", "Status"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#718096", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.pesanan.map(p => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#2d6a4f", fontFamily: "monospace" }}>{p.id}</td>
                      <td style={{ padding: "12px 14px", color: "#4a5568" }}>{p.date}</td>
                      <td style={{ padding: "12px 14px", color: "#4a5568" }}>{p.items.map(i => i.nama).join(", ")}</td>
                      <td style={{ padding: "12px 14px", fontWeight: 700 }}>{fmt(p.total)}</td>
                      <td style={{ padding: "12px 14px", color: "#4a5568" }}>
                        <div style={{ fontWeight: 700, color: p.sisa > 0 ? "#2a4a7f" : "#2d6a4f" }}>{fmt(p.totalBayar)}</div>
                        {p.sisa > 0 && <div style={{ fontSize: 12, color: "#718096" }}>Sisa {fmt(p.sisa)}</div>}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#4a5568", textTransform: "capitalize" }}>{p.metode}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ background: (statusColor[p.status] || "#718096") + "20", color: statusColor[p.status] || "#718096", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>{orderStatusLabel(p.status)}</span>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                          <Btn variant="outline" size="sm" onClick={() => printReceipt(p)}>Cetak Struk</Btn>
                          {p.layanan === "QURBAN" && p.sisa > 0 && setorOrderId !== p.rawId && (
                            <Btn variant="primary" size="sm" onClick={() => { setSetorOrderId(p.rawId); setSetorOrderAmt(""); }}>+ Setor</Btn>
                          )}
                        </div>
                        {setorOrderId === p.rawId && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                            <input type="number" value={setorOrderAmt} onChange={e => setSetorOrderAmt(e.target.value)} placeholder="Nominal setoran" style={{ width: 130, padding: "7px 10px", borderRadius: 8, border: "1.5px solid #cbd5e0", fontSize: 12 }} />
                            <select value={setorOrderMethod} onChange={e => setSetorOrderMethod(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #cbd5e0", fontSize: 12, background: "#fff" }}>
                              <option value="tunai">Tunai</option>
                              <option value="midtrans">Midtrans</option>
                            </select>
                            <Btn variant="primary" size="sm" onClick={() => handleSetorPesanan(p)}>Simpan</Btn>
                            <Btn variant="ghost" size="sm" onClick={() => setSetorOrderId(null)}>Batal</Btn>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tabungan Summary */}
        {state.tabungan.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, margin: 0, color: "#1a202c" }}>🏦 Tabungan Qurban</h3>
              <Btn variant="outline" size="sm" onClick={() => dispatch({ type: "SET_PAGE", payload: "tabungan" })}>Kelola</Btn>
            </div>
            {state.tabungan.map(t => {
              const pct = Math.min(100, Math.round((t.terkumpul / t.target) * 100));
              return (
                <div key={t.id} style={{ marginBottom: 16, padding: "16px", background: "#f7fafc", borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>{t.nama}</span>
                    <span style={{ fontSize: 13, color: "#2a4a7f", fontWeight: 700 }}>{pct}% · {fmt(t.terkumpul)} / {fmt(t.target)}</span>
                  </div>
                  <div style={{ background: "#e2e8f0", borderRadius: 99, height: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #3182ce, #2b6cb0)", borderRadius: 99 }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  ABOUT PAGE
// ─────────────────────────────────────────────────────────
function AdminTable({ headers, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f7fafc" }}>
            {headers.map(h => <th key={h} style={{ padding: "11px 12px", textAlign: "left", color: "#4a5568", whiteSpace: "nowrap", borderBottom: "1px solid #e2e8f0" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      <style>{`td{padding:10px 12px;border-bottom:1px solid #edf2f7;vertical-align:top} small{color:#718096}`}</style>
    </div>
  );
}

function AdminPage() {
  const { state, dispatch } = useContext(AppContext);
  const emptyHewan = { JENIS: "KAMBING", NAMA: "", BERAT_INFO: "", HARGA: "", STOK: 0, GRADE: "A", SHARE: 1, KATEGORI: "qurban_aqiqah", STATUS: "A" };
  const emptyJadwal = { tanggal: "", tempat: "" };
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("albarakah_admin_token") || "");
  const [adminLogin, setAdminLogin] = useState({ email: "admin@albarakah.local", password: "admin12345" });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [adminMsg, setAdminMsg] = useState("");
  const [hewanForm, setHewanForm] = useState(emptyHewan);
  const [editHewanId, setEditHewanId] = useState(null);
  const [jadwalForm, setJadwalForm] = useState(emptyJadwal);
  const [editJadwalId, setEditJadwalId] = useState(null);
  const sessionAdminToken = normalizeClientRole(state.user?.role) === "ADMIN" ? localStorage.getItem("albarakah_token") : adminToken;
  const [data, setData] = useState({
    dashboard: { summary: {}, lowStock: [], recentOrders: [] },
    midtrans: {}, hewan: [], pesanan: [], pembayaran: [], pelanggan: [], tabungan: [], patungan: [], jadwal: [],
    laporan: { daily: [], service: [], stock: [] },
  });

  const adminFetch = async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sessionAdminToken}`, ...(options.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("albarakah_admin_token");
        setAdminToken("");
      }
      throw new Error(body.error || "Gagal memuat data admin");
    }
    return body;
  };

  const loadAdminData = async () => {
    if (!sessionAdminToken) return;
    setLoadingAdmin(true);
    try {
      const [dashboard, midtrans, hewan, pesanan, pembayaran, pelanggan, tabungan, patungan, jadwal, laporan] = await Promise.all([
        adminFetch("/admin/dashboard"), adminFetch("/admin/midtrans-status"), adminFetch("/admin/hewan"), adminFetch("/admin/pesanan"),
        adminFetch("/admin/pembayaran"), adminFetch("/admin/pelanggan"), adminFetch("/admin/tabungan"), adminFetch("/admin/patungan"),
        adminFetch("/admin/jadwal"), adminFetch("/admin/laporan"),
      ]);
      setData({ dashboard, midtrans, hewan, pesanan, pembayaran, pelanggan, tabungan, patungan, jadwal, laporan });
    } catch (e) { setAdminMsg(e.message); }
    finally { setLoadingAdmin(false); }
  };

  useEffect(() => { loadAdminData(); }, [sessionAdminToken]);

  const loginAdmin = async () => {
    setLoadingAdmin(true); setAdminMsg("");
    try {
      const res = await fetch(`${API_BASE}/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(adminLogin) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Login admin gagal");
      localStorage.setItem("albarakah_admin_token", body.token);
      setAdminToken(body.token);
    } catch (e) { setAdminMsg(e.message); }
    finally { setLoadingAdmin(false); }
  };

  const saveHewan = async () => {
    setLoadingAdmin(true); setAdminMsg("");
    try {
      await adminFetch(editHewanId ? `/admin/hewan/${editHewanId}` : "/admin/hewan", { method: editHewanId ? "PUT" : "POST", body: JSON.stringify(hewanForm) });
      setHewanForm(emptyHewan); setEditHewanId(null); await loadAdminData(); setAdminMsg("Data hewan berhasil disimpan");
    } catch (e) { setAdminMsg(e.message); }
    finally { setLoadingAdmin(false); }
  };

  const updateOrder = async (id, status) => {
    setLoadingAdmin(true);
    try { await adminFetch(`/admin/pesanan/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }); await loadAdminData(); setAdminMsg(`Status ORD-${id} diperbarui`); }
    catch (e) { setAdminMsg(e.message); }
    finally { setLoadingAdmin(false); }
  };

  const updatePayment = async (id, status) => {
    setLoadingAdmin(true);
    try { await adminFetch(`/admin/pembayaran/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }); await loadAdminData(); setAdminMsg(`Pembayaran #${id} diperbarui`); }
    catch (e) { setAdminMsg(e.message); }
    finally { setLoadingAdmin(false); }
  };

  const updateCustomer = async (id, status) => {
    setLoadingAdmin(true);
    try { await adminFetch(`/admin/pelanggan/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }); await loadAdminData(); setAdminMsg(`Pelanggan #${id} diperbarui`); }
    catch (e) { setAdminMsg(e.message); }
    finally { setLoadingAdmin(false); }
  };

  const deleteHewan = async (id) => {
    if (!window.confirm("Nonaktifkan data hewan ini?")) return;
    setLoadingAdmin(true);
    try { await adminFetch(`/admin/hewan/${id}`, { method: "DELETE" }); await loadAdminData(); setAdminMsg("Hewan dinonaktifkan"); }
    catch (e) { setAdminMsg(e.message); }
    finally { setLoadingAdmin(false); }
  };

  const saveJadwal = async () => {
    setLoadingAdmin(true); setAdminMsg("");
    try {
      await adminFetch(editJadwalId ? `/admin/jadwal/${editJadwalId}` : "/admin/jadwal", {
        method: editJadwalId ? "PUT" : "POST",
        body: JSON.stringify(jadwalForm),
      });
      setJadwalForm(emptyJadwal); setEditJadwalId(null); await loadAdminData(); setAdminMsg("Jadwal pemotongan berhasil disimpan");
    } catch (e) { setAdminMsg(e.message); }
    finally { setLoadingAdmin(false); }
  };

  const editJadwal = (j) => {
    setEditJadwalId(j.ID_JADWAL);
    setJadwalForm({ tanggal: toInputDate(j.TANGGAL), tempat: j.TEMPAT || "" });
    setActiveTab("jadwal");
  };

  const deleteJadwal = async (id) => {
    if (!window.confirm("Nonaktifkan jadwal pemotongan ini?")) return;
    setLoadingAdmin(true); setAdminMsg("");
    try {
      await adminFetch(`/admin/jadwal/${id}`, { method: "DELETE" });
      await loadAdminData();
      setAdminMsg("Jadwal pemotongan dinonaktifkan");
    } catch (e) { setAdminMsg(e.message); }
    finally { setLoadingAdmin(false); }
  };

  const sendReminder = async (t) => {
    setLoadingAdmin(true); setAdminMsg("");
    try {
      const terkumpul = Number(t.TERKUMPUL_REAL || t.TERKUMPUL || 0);
      const target = Number(t.TARGET_NOMINAL || 0);
      const sisa = Math.max(target - terkumpul, 0);
      await adminFetch("/admin/notifikasi", {
        method: "POST",
        body: JSON.stringify({
          id_pelanggan: t.ID_PELANGGAN,
          judul: "Pengingat Setoran Qurban",
          pesan: `Setoran tabungan ${t.NAMA_TABUNGAN} mendekati batas. Terkumpul ${fmt(terkumpul)}, sisa ${fmt(sisa)} dari target ${fmt(target)}.`,
          tipe: "TABUNGAN",
        }),
      });
      setAdminMsg(`Pengingat setoran dikirim ke ${t.NAMA_LENGKAP}`);
    } catch (e) { setAdminMsg(e.message); }
    finally { setLoadingAdmin(false); }
  };

  const logoutAdmin = () => {
    localStorage.removeItem("albarakah_admin_token");
    setAdminToken("");
    if (normalizeClientRole(state.user?.role) === "ADMIN") dispatch({ type: "LOGOUT" });
  };

  const tabs = [["dashboard", "Dashboard"], ["pesanan", "Pesanan"], ["hewan", "Stok Hewan"], ["pembayaran", "Pembayaran"], ["pelanggan", "Pelanggan"], ["tabungan", "Tabungan"], ["patungan", "Patungan"], ["jadwal", "Jadwal"], ["laporan", "Laporan"]];
  const pill = (text, color = "#2d6a4f") => <span style={{ background: `${color}18`, color, borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{text}</span>;

  if (state.user && normalizeClientRole(state.user.role) !== "ADMIN") return (
    <div style={{ paddingTop: 110, minHeight: "100vh", background: "#f7fafc" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 28, boxShadow: "0 10px 28px rgba(0,0,0,0.08)" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 24, color: "#1a202c" }}>Akses Admin Ditolak</h1>
        <p style={{ margin: "0 0 20px", color: "#718096", fontSize: 14 }}>Panel admin hanya bisa dibuka oleh akun yang terdaftar dengan role admin.</p>
        <Btn variant="primary" onClick={() => dispatch({ type: "SET_PAGE", payload: "landing" })}>Kembali ke Beranda</Btn>
      </div>
    </div>
  );

  if (!sessionAdminToken) return (
    <div style={{ paddingTop: 110, minHeight: "100vh", background: "#f7fafc" }}>
      <div style={{ maxWidth: 440, margin: "0 auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 28, boxShadow: "0 10px 28px rgba(0,0,0,0.08)" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, color: "#1a202c" }}>Admin Al-Barakah</h1>
        <p style={{ margin: "0 0 22px", color: "#718096", fontSize: 14 }}>Kelola stok, transaksi, pembayaran, pelanggan, dan laporan.</p>
        {adminMsg && <div style={{ background: "#fff5f5", border: "1px solid #fed7d7", color: "#c53030", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13 }}>{adminMsg}</div>}
        <Input label="Email Admin" value={adminLogin.email} onChange={v => setAdminLogin({ ...adminLogin, email: v })} />
        <Input label="Password" value={adminLogin.password} onChange={v => setAdminLogin({ ...adminLogin, password: v })} type="password" />
        <Btn variant="primary" fullWidth onClick={loginAdmin} disabled={loadingAdmin}>{loadingAdmin ? "Memproses..." : "Masuk Admin"}</Btn>
        <Btn variant="ghost" fullWidth onClick={() => dispatch({ type: "SET_PAGE", payload: "landing" })} style={{ marginTop: 10 }}>Kembali</Btn>
      </div>
    </div>
  );

  const s = data.dashboard.summary || {};
  return (
    <div style={{ paddingTop: 68, minHeight: "100vh", background: "#f7fafc" }}>
      <div style={{ background: "#111827", color: "#fff", padding: "22px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div><h1 style={{ margin: 0, fontSize: 24 }}>Admin Peternakan</h1><div style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>{normalizeClientRole(state.user?.role) === "ADMIN" ? `Akun admin: ${state.user.name} (${state.user.email})` : "Operasional aqiqah, qurban, pembayaran, dan laporan"}</div></div>
          <div style={{ display: "flex", gap: 8 }}><Btn variant="ghost" size="sm" onClick={loadAdminData} disabled={loadingAdmin}>Refresh</Btn><Btn variant="danger" size="sm" onClick={logoutAdmin}>Keluar Admin</Btn></div>
        </div>
      </div>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        {adminMsg && <div style={{ background: "#ebf8ff", border: "1px solid #bee3f8", color: "#2c5282", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13 }}>{adminMsg}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>{tabs.map(([key, label]) => <button key={key} onClick={() => setActiveTab(key)} style={{ border: "1px solid #cbd5e0", background: activeTab === key ? "#1f2937" : "#fff", color: activeTab === key ? "#fff" : "#2d3748", borderRadius: 8, padding: "8px 13px", fontWeight: 700, cursor: "pointer" }}>{label}</button>)}</div>

        {activeTab === "dashboard" && <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 18 }}>
            {[["Pelanggan", s.pelanggan || 0, "#2d6a4f"], ["Stok Aktif", s.hewan || 0, "#2a4a7f"], ["Pesanan", s.pesanan || 0, "#6b2fa0"], ["Pemasukan", fmt(s.pemasukan || 0), "#c47a1a"], ["Perlu Tindak Lanjut", s.butuh_tindak_lanjut || 0, "#c53030"]].map(([label, value, color]) => <div key={label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}><div style={{ color: "#718096", fontSize: 12, fontWeight: 700 }}>{label}</div><div style={{ color, fontSize: 25, fontWeight: 900, marginTop: 6 }}>{value}</div></div>)}
          </div>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18, marginBottom: 18 }}>
            <h3 style={{ margin: "0 0 12px" }}>Status Midtrans</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>{pill(data.midtrans.ready ? "Key terisi" : "Key belum lengkap", data.midtrans.ready ? "#2d6a4f" : "#c53030")}{pill(data.midtrans.isProduction ? "Mode Production" : "Mode Sandbox", data.midtrans.isProduction ? "#c47a1a" : "#2a4a7f")}{pill(`Server: ${data.midtrans.serverKeyMode || "-"}`)}{pill(`Client: ${data.midtrans.clientKeyMode || "-"}`)}{pill(`Mode dari: ${data.midtrans.modeSource || "-"}`, "#2a4a7f")}</div>
            <div style={{ fontSize: 12, color: "#4a5568", lineHeight: 1.7 }}>
              <div><strong>Snap JS:</strong> {data.midtrans.snapScriptUrl || "-"}</div>
              <div><strong>Notification URL:</strong> {data.midtrans.notificationUrl || "-"}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}><div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}><h3 style={{ margin: "0 0 12px" }}>Stok Rendah</h3>{data.dashboard.lowStock.length === 0 ? <p style={{ color: "#718096" }}>Tidak ada stok rendah.</p> : data.dashboard.lowStock.map(h => <div key={h.ID_HEWAN} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #edf2f7" }}><span>{h.NAMA}</span><strong>{h.STOK}</strong></div>)}</div><div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}><h3 style={{ margin: "0 0 12px" }}>Pesanan Terbaru</h3>{data.dashboard.recentOrders.map(o => <div key={o.ID_PESANAN} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #edf2f7", gap: 12 }}><span>ORD-{o.ID_PESANAN} - {o.NAMA_LENGKAP}</span>{pill(orderStatusLabel(o.STATUS), o.STATUS === "Dibatalkan" ? "#c53030" : "#2d6a4f")}</div>)}</div></div>
        </>}

        {activeTab === "hewan" && <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18 }}><div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}><h3 style={{ margin: "0 0 14px" }}>{editHewanId ? "Edit Hewan" : "Tambah Hewan"}</h3><Select label="Jenis" value={hewanForm.JENIS} onChange={v => setHewanForm({ ...hewanForm, JENIS: v })} options={[{ value: "SAPI", label: "Sapi" }, { value: "KAMBING", label: "Kambing" }, { value: "DOMBA", label: "Domba" }]} /><Input label="Nama" value={hewanForm.NAMA} onChange={v => setHewanForm({ ...hewanForm, NAMA: v })} /><Input label="Berat Info" value={hewanForm.BERAT_INFO} onChange={v => setHewanForm({ ...hewanForm, BERAT_INFO: v })} /><Input label="Harga" type="number" value={hewanForm.HARGA} onChange={v => setHewanForm({ ...hewanForm, HARGA: v })} /><Input label="Stok" type="number" value={hewanForm.STOK} onChange={v => setHewanForm({ ...hewanForm, STOK: v })} /><Input label="Grade" value={hewanForm.GRADE} onChange={v => setHewanForm({ ...hewanForm, GRADE: v })} /><Input label="Share" type="number" value={hewanForm.SHARE} onChange={v => setHewanForm({ ...hewanForm, SHARE: v })} /><Select label="Kategori" value={hewanForm.KATEGORI} onChange={v => setHewanForm({ ...hewanForm, KATEGORI: v })} options={[{ value: "qurban", label: "Qurban" }, { value: "aqiqah", label: "Aqiqah" }, { value: "qurban_aqiqah", label: "Qurban & Aqiqah" }]} /><Select label="Status" value={hewanForm.STATUS} onChange={v => setHewanForm({ ...hewanForm, STATUS: v })} options={[{ value: "A", label: "Aktif" }, { value: "N", label: "Nonaktif" }]} /><Btn fullWidth onClick={saveHewan} disabled={loadingAdmin}>Simpan</Btn>{editHewanId && <Btn variant="ghost" fullWidth onClick={() => { setEditHewanId(null); setHewanForm(emptyHewan); }} style={{ marginTop: 8 }}>Batal Edit</Btn>}</div><AdminTable headers={["ID", "Jenis", "Nama", "Harga", "Stok", "Kategori", "Status", "Aksi"]}>{data.hewan.map(h => <tr key={h.ID_HEWAN}><td>{h.ID_HEWAN}</td><td>{h.JENIS}</td><td>{h.NAMA}</td><td>{fmt(h.HARGA)}</td><td>{h.STOK}</td><td>{h.KATEGORI}</td><td>{h.STATUS}</td><td><Btn size="sm" variant="outline" onClick={() => { setEditHewanId(h.ID_HEWAN); setHewanForm(h); }}>Edit</Btn><Btn size="sm" variant="danger" onClick={() => deleteHewan(h.ID_HEWAN)} style={{ marginLeft: 6 }}>Nonaktif</Btn></td></tr>)}</AdminTable></div>}

        {activeTab === "pesanan" && <AdminTable headers={["ID", "Pelanggan", "Layanan", "Hewan", "Total", "Terbayar", "Status", "Pembayaran", "Ubah Status"]}>{data.pesanan.map(p => <tr key={p.ID_PESANAN}><td>ORD-{p.ID_PESANAN}</td><td>{p.NAMA_LENGKAP}<br /><small>{p.NO_HP || p.EMAIL}</small></td><td>{p.JENIS_LAYANAN}</td><td>{p.NAMA_HEWAN || "-"}</td><td>{fmt(p.TOTAL)}</td><td>{fmt(p.TOTAL_DIBAYAR)}<br /><small>Sisa {fmt(p.SISA_BAYAR)}</small></td><td>{pill(orderStatusLabel(p.STATUS), p.STATUS === "Dibatalkan" ? "#c53030" : "#2d6a4f")}</td><td>{p.STATUS_BAYAR || "-"}<br /><small>{p.METODE_BAYAR}</small></td><td><select value={p.STATUS} onChange={e => updateOrder(p.ID_PESANAN, e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e0" }}>{orderStatusOptions.map(o => <option key={o} value={o}>{orderStatusLabel(o)}</option>)}</select></td></tr>)}</AdminTable>}

        {activeTab === "pembayaran" && <AdminTable headers={["ID", "Pesanan", "Pelanggan", "Nominal", "Metode", "Status", "Ref", "Approval"]}>{data.pembayaran.map(p => <tr key={p.ID_PEMBAYARAN}><td>{p.ID_PEMBAYARAN}</td><td>{p.ID_PESANAN ? `ORD-${p.ID_PESANAN}` : "-"}</td><td>{p.NAMA_LENGKAP || "-"}</td><td>{fmt(p.NOMINAL)}</td><td>{p.METODE}</td><td>{p.STATUS}</td><td>{p.REF_BAYAR || "-"}</td><td><select value={p.STATUS} onChange={e => updatePayment(p.ID_PEMBAYARAN, e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e0" }}><option value="Menunggu Pembayaran">Menunggu</option><option value="LUNAS">Disetujui / Lunas</option><option value="Gagal">Dibatalkan</option></select></td></tr>)}</AdminTable>}

        {activeTab === "pelanggan" && <AdminTable headers={["ID", "Nama", "Email", "HP", "Status", "Pesanan", "Transaksi", "Ubah"]}>{data.pelanggan.map(p => <tr key={p.ID_PELANGGAN}><td>{p.ID_PELANGGAN}</td><td>{p.NAMA_LENGKAP}</td><td>{p.EMAIL}</td><td>{p.NO_HP || "-"}</td><td>{p.STATUS}</td><td>{p.TOTAL_PESANAN}</td><td>{fmt(p.TOTAL_TRANSAKSI)}</td><td><select value={p.STATUS} onChange={e => updateCustomer(p.ID_PELANGGAN, e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e0" }}><option value="A">Aktif</option><option value="P">Pending</option><option value="N">Nonaktif</option></select></td></tr>)}</AdminTable>}

        {activeTab === "tabungan" && <AdminTable headers={["ID", "Pelanggan", "Nama Tabungan", "Target", "Terkumpul", "Sisa", "Hewan Target", "Status", "Notifikasi"]}>{data.tabungan.map(t => {
          const terkumpul = Number(t.TERKUMPUL_REAL || t.TERKUMPUL || 0);
          const target = Number(t.TARGET_NOMINAL || 0);
          const sisa = Math.max(target - terkumpul, 0);
          return <tr key={t.ID_TABUNGAN}><td>{t.ID_TABUNGAN}</td><td>{t.NAMA_LENGKAP}<br /><small>{t.EMAIL}</small></td><td>{t.NAMA_TABUNGAN}</td><td>{fmt(target)}</td><td>{fmt(terkumpul)}</td><td>{fmt(sisa)}</td><td>{t.NAMA_HEWAN_TARGET || t.JENIS_TARGET}</td><td>{t.STATUS === "A" ? "Aktif" : "Selesai"}</td><td><Btn size="sm" variant="secondary" onClick={() => sendReminder(t)} disabled={loadingAdmin || t.STATUS !== "A"}>Kirim Pengingat</Btn></td></tr>;
        })}</AdminTable>}

        {activeTab === "patungan" && <AdminTable headers={["Pesanan", "Peminta", "Peserta", "Nominal Porsi", "Status Patungan", "Status Pesanan", "Tanggal"]}>{data.patungan.map(p => <tr key={p.ID_PATUNGAN}><td>ORD-{p.ID_PESANAN}</td><td>{p.NAMA_PEMINTA}</td><td>{p.NAMA_TUJUAN || p.EMAIL_TUJUAN || "-"}</td><td>{fmt(p.NOMINAL_PORSI)}</td><td>{pill(p.STATUS, p.STATUS === "DITOLAK" ? "#c53030" : p.STATUS === "DISETUJUI" ? "#2d6a4f" : "#c47a1a")}</td><td>{orderStatusLabel(p.STATUS_PESANAN)}</td><td>{p.TGL_BUAT ? new Date(p.TGL_BUAT).toLocaleDateString("id-ID") : "-"}</td></tr>)}</AdminTable>}

        {activeTab === "jadwal" && <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}>
            <h3 style={{ margin: "0 0 14px" }}>{editJadwalId ? "Edit Jadwal" : "Tambah Jadwal"}</h3>
            <Input label="Tanggal Pemotongan" type="date" value={jadwalForm.tanggal} onChange={v => setJadwalForm({ ...jadwalForm, tanggal: v })} />
            <Input label="Tempat" value={jadwalForm.tempat} onChange={v => setJadwalForm({ ...jadwalForm, tempat: v })} placeholder="Contoh: Kandang Utama Al-Barakah" />
            <Btn fullWidth onClick={saveJadwal} disabled={loadingAdmin}>Simpan Jadwal</Btn>
            {editJadwalId && <Btn variant="ghost" fullWidth onClick={() => { setEditJadwalId(null); setJadwalForm(emptyJadwal); }} style={{ marginTop: 8 }}>Batal Edit</Btn>}
          </div>
          <AdminTable headers={["ID", "Tanggal", "Tempat", "Aksi"]}>{data.jadwal.map(j => <tr key={j.ID_JADWAL}><td>{j.ID_JADWAL}</td><td>{j.TANGGAL ? new Date(j.TANGGAL).toLocaleDateString("id-ID") : "-"}</td><td>{j.TEMPAT}</td><td><Btn size="sm" variant="outline" onClick={() => editJadwal(j)}>Edit</Btn><Btn size="sm" variant="danger" onClick={() => deleteJadwal(j.ID_JADWAL)} style={{ marginLeft: 6 }}>Hapus</Btn></td></tr>)}</AdminTable>
        </div>}

        {activeTab === "laporan" && <div style={{ display: "grid", gap: 18 }}><AdminTable headers={["Tanggal", "Pemasukan", "Pengeluaran", "Laba/Rugi"]}>{data.laporan.daily.map(r => <tr key={r.PERIODE_TANGGAL}><td>{new Date(r.PERIODE_TANGGAL).toLocaleDateString("id-ID")}</td><td>{fmt(r.PEMASUKAN)}</td><td>{fmt(r.PENGELUARAN)}</td><td>{fmt(r.LABA_RUGI)}</td></tr>)}</AdminTable><AdminTable headers={["Layanan", "Total Pesanan", "Pemasukan"]}>{data.laporan.service.map(r => <tr key={r.JENIS_LAYANAN}><td>{r.JENIS_LAYANAN}</td><td>{r.TOTAL_PESANAN}</td><td>{fmt(r.PEMASUKAN)}</td></tr>)}</AdminTable><AdminTable headers={["Jenis Hewan", "Total Stok", "Varian"]}>{data.laporan.stock.map(r => <tr key={r.JENIS}><td>{r.JENIS}</td><td>{r.TOTAL_STOK}</td><td>{r.JUMLAH_VARIAN}</td></tr>)}</AdminTable></div>}
      </div>
    </div>
  );
}

function AboutPage() {
  return (
    <div style={{ paddingTop: 80 }}>
      <div style={{ background: "linear-gradient(135deg, #1b4332, #2d6a4f)", padding: "80px 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, color: "#fff", margin: "0 0 16px" }}>Tentang Al-Barakah</h1>
        <p style={{ color: "#a8d8b9", fontSize: 18, maxWidth: 600, margin: "0 auto" }}>Peternakan aqiqah dan qurban terpercaya dengan komitmen menghadirkan hewan berkualitas dan layanan terbaik.</p>
      </div>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginBottom: 60 }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1a202c", marginBottom: 16 }}>Visi Kami</h2>
            <p style={{ color: "#4a5568", lineHeight: 1.8 }}>Menjadi platform pengelolaan peternakan aqiqah dan qurban terdepan di Indonesia, dengan mengutamakan kemudahan, keamanan, dan kepercayaan pelanggan dalam setiap transaksi ibadah.</p>
          </div>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1a202c", marginBottom: 16 }}>Misi Kami</h2>
            <ul style={{ color: "#4a5568", lineHeight: 2, paddingLeft: 20 }}>
              <li>Menyediakan hewan qurban dan aqiqah berkualitas</li>
              <li>Memberikan pelayanan digital yang mudah dan transparan</li>
              <li>Memastikan setiap transaksi halal dan terpercaya</li>
              <li>Mendukung peternak lokal yang berkelanjutan</li>
            </ul>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            { icon: "🏆", title: "Bersertifikat Halal MUI", desc: "Semua proses pemotongan bersertifikat resmi MUI" },
            { icon: "🩺", title: "Hewan Sehat Terverifikasi", desc: "Diperiksa dokter hewan berpengalaman setiap hari" },
            { icon: "🌿", title: "Lingkungan Ramah", desc: "Peternakan dengan standar kesejahteraan hewan terjaga" },
          ].map(c => (
            <div key={c.title} style={{ background: "#f0fff4", borderRadius: 14, padding: 24, textAlign: "center", border: "1px solid #c6f6d5" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{c.icon}</div>
              <h4 style={{ fontFamily: "'Playfair Display', serif", color: "#2d6a4f", margin: "0 0 8px" }}>{c.title}</h4>
              <p style={{ margin: 0, fontSize: 13, color: "#4a5568", lineHeight: 1.6 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  MAIN APP
// ─────────────────────────────────────────────────────────
export default function App() {
  // Lazy initializer: restore persisted slices from localStorage
  const init = (initial) => {
    try {
      const user = JSON.parse(localStorage.getItem('albarakah_user') || 'null');
      const cart = JSON.parse(localStorage.getItem('albarakah_cart') || '[]');
      const notifications = JSON.parse(localStorage.getItem('albarakah_notif') || '[]');
      const pesanan = JSON.parse(localStorage.getItem('albarakah_pesanan') || '[]');
      const tabungan = JSON.parse(localStorage.getItem('albarakah_tabungan') || '[]');
      const tokenRole = roleFromToken(localStorage.getItem('albarakah_token'));
      return { ...initial, user: user ? { ...user, role: normalizeClientRole(tokenRole || user.role) } : initial.user, cart, notifications, pesanan, tabungan };
    } catch (e) { return initial; }
  };

  const [state, dispatch] = useReducer(reducer, initialState, init);
  const [hewanList, setHewanList] = useState(hewan_data);
  const [toastIds, setToastIds] = useState([]);
  const [bellPulse, setBellPulse] = useState(false);
  const prevNotifsRef = useRef(state.notifications);

  const refreshHewan = async () => {
    try {
      const res = await fetch(`${API_BASE}/hewan`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setHewanList(data.map(mapHewanFromApi));
    } catch (e) { /* fallback ke seed lokal */ }
  };

  const refreshAccountData = async () => {
    if (!state.user?.id) return;
    const token = localStorage.getItem('albarakah_token');
    if (!token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [pesananRes, tabunganRes, notifRes, patunganRes] = await Promise.all([
        fetch(`${API_BASE}/pesanan/${state.user.id}`, { headers }),
        fetch(`${API_BASE}/tabungan/${state.user.id}`, { headers }),
        fetch(`${API_BASE}/notifikasi/${state.user.id}`, { headers }),
        fetch(`${API_BASE}/patungan/invitations`, { headers }),
      ]);
      if (pesananRes.ok) {
        const rows = await pesananRes.json();
        dispatch({ type: "SET_PESANAN", payload: rows.map(mapPesananFromApi) });
      }
      if (tabunganRes.ok) {
        const rows = await tabunganRes.json();
        dispatch({ type: "SET_TABUNGAN", payload: rows.map(mapTabunganFromApi) });
      }
      if (notifRes.ok) {
        const rows = await notifRes.json();
        dispatch({ type: "SET_NOTIFICATIONS", payload: rows.map(mapNotifFromApi) });
      }
      if (patunganRes.ok) {
        const rows = await patunganRes.json();
        dispatch({ type: "SET_PATUNGAN", payload: rows });
      }
      await refreshHewan();
    } catch (e) { /* biarkan data lokal tetap tampil */ }
  };

  useEffect(() => {
    const prev = prevNotifsRef.current || [];
    if (state.notifications.length > prev.length) {
      const added = state.notifications.slice(prev.length).map(n => n.id);
      setToastIds(ids => [...ids, ...added]);
      setBellPulse(true);
      const t = setTimeout(() => setBellPulse(false), 800);
      return () => clearTimeout(t);
    }
    prevNotifsRef.current = state.notifications;
  }, [state.notifications]);

  useEffect(() => {
    refreshHewan();
  }, []);

  useEffect(() => {
    refreshAccountData();
  }, [state.user?.id]);

  // Auto-close notif panel on outside actions
  useEffect(() => {
    if (state.showNotifPanel) {
      const t = setTimeout(() => dispatch({ type: "TOGGLE_NOTIF" }), 8000);
      return () => clearTimeout(t);
    }
  }, [state.showNotifPanel]);

  // Persist important slices to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('albarakah_cart', JSON.stringify(state.cart || []));
      localStorage.setItem('albarakah_notif', JSON.stringify(state.notifications || []));
      localStorage.setItem('albarakah_pesanan', JSON.stringify(state.pesanan || []));
      localStorage.setItem('albarakah_tabungan', JSON.stringify(state.tabungan || []));
      if (state.user) localStorage.setItem('albarakah_user', JSON.stringify(state.user));
      else { localStorage.removeItem('albarakah_user'); localStorage.removeItem('albarakah_token'); }
    } catch (e) { /* ignore */ }
  }, [state.cart, state.notifications, state.pesanan, state.tabungan, state.user]);

  // Check stock when cart changes and adjust cart + notify user if needed
  useEffect(() => {
    (async () => {
      try {
        if (!state.cart || !state.cart.length) return;
        const items = state.cart.map(i => ({ id: i.id_hewan || i.id, qty: i.qty }));
        const res = await fetch(`${API_BASE}/stock/check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
        const data = await res.json();
        if (!res.ok) return;
        let changed = false;
        const newCart = state.cart.map(c => {
          const itemId = c.id_hewan || c.id;
          const info = data.items.find(x => x.id === itemId);
          if (!info) return c;
          if (!info.available) {
            changed = true;
            return null; // remove
          }
          if (info.stok < c.qty) {
            changed = true;
            return { ...c, qty: info.stok };
          }
          return c;
        }).filter(Boolean);
        if (changed) {
          dispatch({ type: 'ADJUST_CART', payload: newCart });
          // build notification messages
          const msgs = [];
          for (const orig of state.cart) {
            const itemId = orig.id_hewan || orig.id;
            const info = data.items.find(x => x.id === itemId);
            if (!info) msgs.push({ msg: `${orig.nama} telah habis stok dan dihapus dari keranjang`, type: 'danger' });
            else if (info.stok < orig.qty) msgs.push({ msg: `${orig.nama} jumlah dikurangi menjadi ${info.stok} karena stok terbatas`, type: 'info' });
          }
          for (const m of msgs) dispatch({ type: 'PUSH_NOTIF', payload: m });
        }
      } catch (e) { /* ignore */ }
    })();
  }, [state.cart]);

  const pages = { landing: LandingPage, qurban: QurbanPage, aqiqah: AqiqahPage, tabungan: TabunganPage, dashboard: DashboardPage, about: AboutPage, admin: AdminPage };
  const PageComponent = pages[state.page] || LandingPage;

  // Print receipt function (exposed via context)
  const printReceipt = (order) => {
    try {
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Struk ${order.id}</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:20px;color:#111}h2{margin:0 0 12px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{padding:8px;border-bottom:1px solid #eee;text-align:left}tfoot td{font-weight:700}</style></head><body>` +
        `<h2>Al-Barakah - Struk Pembayaran</h2><p>ID: ${order.id}</p><p>Tanggal: ${order.date}</p><p>Metode: ${order.metode}</p>` +
        `<table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>` +
        `${order.items.map(i => `<tr><td>${i.nama}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">Rp ${(i.harga * i.qty).toLocaleString('id-ID')}</td></tr>`).join('')}` +
        `</tbody><tfoot><tr><td></td><td style="text-align:right">Total</td><td style="text-align:right">Rp ${order.total.toLocaleString('id-ID')}</td></tr></tfoot></table><p style="margin-top:18px">Terima kasih telah berbelanja di Al-Barakah.</p></body></html>`;
      const w = window.open('', '_blank', 'width=600,height=800');
      if (!w) { alert('Popup terblokir. Izinkan popup agar bisa mencetak struk.'); return; }
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 400);
    } catch (e) { console.error('Print error', e); alert('Tidak dapat mencetak struk'); }
  };

  return (
    <AppContext.Provider value={{ state, dispatch, bellPulse, toastIds, setToastIds, printReceipt, hewanList, refreshAccountData }}>
      <div style={{ fontFamily: "'Lato', sans-serif", minHeight: "100vh", background: "#fff" }}>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Lato:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <Navbar />
        <NotifPanel />
        <Toasts />
        <LoginModal />
        <RegisterModal />
        <CartModal />
        <ForgotPasswordModal />
        <PageComponent />
        {state.loading && <SpinnerOverlay />}
      </div>
    </AppContext.Provider>
  );
}
