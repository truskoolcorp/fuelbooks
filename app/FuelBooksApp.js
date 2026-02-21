"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// FUELBOOKS PRO — Fuel Brokerage Accounting Platform
// Full invoicing, auto P&L, tax engine by location & fuel type
// ═══════════════════════════════════════════════════════════════════════════════

// ─── TAX ENGINE: Federal + State excise taxes by fuel type ──────────────────
const FEDERAL_FUEL_TAX = {
  "ULSD": 0.244, "Regular 87": 0.184, "Midgrade 89": 0.184, "Premium 93": 0.184,
  "E85": 0.184, "Biodiesel B20": 0.244, "Biodiesel B100": 0.244, "Jet-A": 0.219,
  "Kerosene": 0.244, "Heating Oil": 0.244, "Propane": 0.183, "CNG": 0.184,
};

const STATE_FUEL_TAX = {
  TX: { "ULSD": 0.20, "Regular 87": 0.20, "Midgrade 89": 0.20, "Premium 93": 0.20, "E85": 0.20, "Biodiesel B20": 0.20, "Biodiesel B100": 0.20, "Jet-A": 0.00, "Kerosene": 0.20, "Heating Oil": 0.20, salesTaxRate: 0.0625, name: "Texas" },
  LA: { "ULSD": 0.20, "Regular 87": 0.20, "Midgrade 89": 0.20, "Premium 93": 0.20, "E85": 0.20, "Biodiesel B20": 0.20, "Biodiesel B100": 0.20, "Jet-A": 0.00, "Kerosene": 0.20, "Heating Oil": 0.20, salesTaxRate: 0.0445, name: "Louisiana" },
  OK: { "ULSD": 0.19, "Regular 87": 0.19, "Midgrade 89": 0.19, "Premium 93": 0.19, "E85": 0.19, "Biodiesel B20": 0.19, "Biodiesel B100": 0.19, "Jet-A": 0.001, "Kerosene": 0.19, "Heating Oil": 0.19, salesTaxRate: 0.045, name: "Oklahoma" },
  NM: { "ULSD": 0.21, "Regular 87": 0.17, "Midgrade 89": 0.17, "Premium 93": 0.17, "E85": 0.17, "Biodiesel B20": 0.21, "Biodiesel B100": 0.21, "Jet-A": 0.00, "Kerosene": 0.21, "Heating Oil": 0.21, salesTaxRate: 0.05125, name: "New Mexico" },
  AR: { "ULSD": 0.285, "Regular 87": 0.245, "Midgrade 89": 0.245, "Premium 93": 0.245, "E85": 0.245, "Biodiesel B20": 0.285, "Biodiesel B100": 0.285, "Jet-A": 0.00, "Kerosene": 0.285, "Heating Oil": 0.285, salesTaxRate: 0.065, name: "Arkansas" },
  MS: { "ULSD": 0.18, "Regular 87": 0.18, "Midgrade 89": 0.18, "Premium 93": 0.18, "E85": 0.18, "Biodiesel B20": 0.18, "Biodiesel B100": 0.18, "Jet-A": 0.00, "Kerosene": 0.18, "Heating Oil": 0.18, salesTaxRate: 0.07, name: "Mississippi" },
  CA: { "ULSD": 0.389, "Regular 87": 0.579, "Midgrade 89": 0.579, "Premium 93": 0.579, "E85": 0.579, "Biodiesel B20": 0.389, "Biodiesel B100": 0.389, "Jet-A": 0.02, "Kerosene": 0.389, "Heating Oil": 0.389, salesTaxRate: 0.0725, name: "California" },
  FL: { "ULSD": 0.277, "Regular 87": 0.277, "Midgrade 89": 0.277, "Premium 93": 0.277, "E85": 0.277, "Biodiesel B20": 0.277, "Biodiesel B100": 0.277, "Jet-A": 0.043, "Kerosene": 0.277, "Heating Oil": 0.277, salesTaxRate: 0.06, name: "Florida" },
  GA: { "ULSD": 0.327, "Regular 87": 0.312, "Midgrade 89": 0.312, "Premium 93": 0.312, "E85": 0.312, "Biodiesel B20": 0.327, "Biodiesel B100": 0.327, "Jet-A": 0.01, "Kerosene": 0.327, "Heating Oil": 0.327, salesTaxRate: 0.04, name: "Georgia" },
  AZ: { "ULSD": 0.26, "Regular 87": 0.18, "Midgrade 89": 0.18, "Premium 93": 0.18, "E85": 0.18, "Biodiesel B20": 0.26, "Biodiesel B100": 0.26, "Jet-A": 0.001, "Kerosene": 0.26, "Heating Oil": 0.26, salesTaxRate: 0.056, name: "Arizona" },
};

const ALL_STATES = Object.entries(STATE_FUEL_TAX).map(([k, v]) => ({ code: k, name: v.name }));
const FUEL_TYPES = Object.keys(FEDERAL_FUEL_TAX);

function calcTaxes(fuelType, gallons, state, deliveryType = "commercial") {
  const fedRate = FEDERAL_FUEL_TAX[fuelType] || 0;
  const stateData = STATE_FUEL_TAX[state] || {};
  const stateRate = stateData[fuelType] || 0;
  const fedTax = fedRate * gallons;
  const stateTax = stateRate * gallons;
  const isExempt = deliveryType === "export" || deliveryType === "government" || (fuelType === "Jet-A" && deliveryType === "airline");
  return {
    federalRate: fedRate, stateRate, fedTax: isExempt ? 0 : fedTax, stateTax: isExempt ? 0 : stateTax,
    totalTax: isExempt ? 0 : fedTax + stateTax, combinedRate: isExempt ? 0 : fedRate + stateRate,
    exempt: isExempt, exemptReason: isExempt ? `${deliveryType} exempt` : null,
  };
}

// ─── UTILITY ────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmt4 = (n) => "$" + n.toFixed(4);
const fmtN = (n) => new Intl.NumberFormat("en-US").format(n);
const pct = (n) => (n * 100).toFixed(1) + "%";
const genId = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;
const today = () => "2026-02-21";
const addDays = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().split("T")[0]; };

// ─── INITIAL DATA ───────────────────────────────────────────────────────────
const initCustomers = [
  { id: "C-1001", name: "Lone Star Petroleum", contact: "Mike Reeves", email: "mike@lonestarpetro.com", phone: "(214) 555-0142", address: "4501 Spring Valley Rd, Dallas, TX 75244", state: "TX", terms: 10, creditLimit: 100000, taxExempt: false, deliveryType: "commercial" },
  { id: "C-1002", name: "Gulf Coast Distributors", contact: "Sandra Chen", email: "schen@gulfcoastdist.com", phone: "(713) 555-0198", address: "1200 Smith St, Houston, TX 77002", state: "TX", terms: 10, creditLimit: 75000, taxExempt: false, deliveryType: "commercial" },
  { id: "C-1003", name: "Heartland Fuel Co.", contact: "Tom Bradley", email: "tbradley@heartlandfuel.com", phone: "(405) 555-0167", address: "800 N Harvey Ave, Oklahoma City, OK 73102", state: "OK", terms: 14, creditLimit: 50000, taxExempt: false, deliveryType: "commercial" },
  { id: "C-1004", name: "Rio Grande Energy", contact: "Maria Gutierrez", email: "mgutierrez@riograndeenergy.com", phone: "(956) 555-0134", address: "201 E Van Buren St, Harlingen, TX 78550", state: "TX", terms: 7, creditLimit: 150000, taxExempt: false, deliveryType: "commercial" },
  { id: "C-1005", name: "Bayou Fuel Services", contact: "Andre Dupont", email: "adupont@bayoufuel.com", phone: "(504) 555-0189", address: "650 Poydras St, New Orleans, LA 70130", state: "LA", terms: 10, creditLimit: 60000, taxExempt: false, deliveryType: "commercial" },
  { id: "C-1006", name: "Desert Sun Aviation", contact: "Rachel Mora", email: "rmora@desertsun.aero", phone: "(602) 555-0112", address: "2700 E Sky Harbor Blvd, Phoenix, AZ 85034", state: "AZ", terms: 7, creditLimit: 200000, taxExempt: true, deliveryType: "airline" },
];

const initSuppliers = [
  { id: "S-2001", name: "Valero Energy Corp", contact: "Dispatch", email: "dispatch@valero.com", phone: "(210) 555-0100", terms: 10 },
  { id: "S-2002", name: "Marathon Petroleum", contact: "Supply Desk", email: "supply@marathon.com", phone: "(419) 555-0200", terms: 7 },
  { id: "S-2003", name: "Phillips 66", contact: "Trading Desk", email: "trading@p66.com", phone: "(281) 555-0300", terms: 10 },
  { id: "S-2004", name: "Motiva Enterprises", contact: "Bulk Sales", email: "bulk@motiva.com", phone: "(713) 555-0400", terms: 14 },
];

const initLoads = [
  { id: "LD-5001", date: "2026-02-20", customerId: "C-1001", supplierId: "S-2001", fuelType: "ULSD", gallons: 8500, buyPrice: 2.34, sellPrice: 2.52, status: "delivered", carrier: "Swift Transport", bolNumber: "BOL-88901", deliveryState: "TX", deliveryType: "commercial" },
  { id: "LD-5002", date: "2026-02-20", customerId: "C-1002", supplierId: "S-2002", fuelType: "Regular 87", gallons: 8200, buyPrice: 2.18, sellPrice: 2.38, status: "in-transit", carrier: "Heartland Carriers", bolNumber: "BOL-88902", deliveryState: "TX", deliveryType: "commercial" },
  { id: "LD-5003", date: "2026-02-19", customerId: "C-1004", supplierId: "S-2003", fuelType: "Premium 93", gallons: 7800, buyPrice: 2.67, sellPrice: 2.89, status: "delivered", carrier: "Eagle Logistics", bolNumber: "BOL-88903", deliveryState: "TX", deliveryType: "commercial" },
  { id: "LD-5004", date: "2026-02-19", customerId: "C-1003", supplierId: "S-2001", fuelType: "ULSD", gallons: 8400, buyPrice: 2.33, sellPrice: 2.51, status: "delivered", carrier: "Swift Transport", bolNumber: "BOL-88904", deliveryState: "OK", deliveryType: "commercial" },
  { id: "LD-5005", date: "2026-02-18", customerId: "C-1005", supplierId: "S-2004", fuelType: "E85", gallons: 7600, buyPrice: 1.89, sellPrice: 2.12, status: "delivered", carrier: "Central Haulers", bolNumber: "BOL-88905", deliveryState: "LA", deliveryType: "commercial" },
  { id: "LD-5006", date: "2026-02-18", customerId: "C-1001", supplierId: "S-2002", fuelType: "Regular 87", gallons: 8300, buyPrice: 2.19, sellPrice: 2.39, status: "delivered", carrier: "Heartland Carriers", bolNumber: "BOL-88906", deliveryState: "TX", deliveryType: "commercial" },
  { id: "LD-5007", date: "2026-02-17", customerId: "C-1002", supplierId: "S-2003", fuelType: "ULSD", gallons: 8100, buyPrice: 2.35, sellPrice: 2.54, status: "delivered", carrier: "Eagle Logistics", bolNumber: "BOL-88907", deliveryState: "TX", deliveryType: "commercial" },
  { id: "LD-5008", date: "2026-02-06", customerId: "C-1006", supplierId: "S-2001", fuelType: "Jet-A", gallons: 15000, buyPrice: 2.78, sellPrice: 3.01, status: "delivered", carrier: "AeroHaul", bolNumber: "BOL-88890", deliveryState: "AZ", deliveryType: "airline" },
  { id: "LD-5009", date: "2026-02-10", customerId: "C-1004", supplierId: "S-2004", fuelType: "ULSD", gallons: 8200, buyPrice: 2.31, sellPrice: 2.49, status: "delivered", carrier: "Eagle Logistics", bolNumber: "BOL-88895", deliveryState: "TX", deliveryType: "commercial" },
  { id: "LD-5010", date: "2026-02-14", customerId: "C-1003", supplierId: "S-2002", fuelType: "Regular 87", gallons: 8000, buyPrice: 2.17, sellPrice: 2.36, status: "delivered", carrier: "Swift Transport", bolNumber: "BOL-88898", deliveryState: "OK", deliveryType: "commercial" },
  { id: "LD-5011", date: "2026-02-21", customerId: "C-1004", supplierId: "S-2001", fuelType: "Jet-A", gallons: 9200, buyPrice: 2.78, sellPrice: 3.01, status: "scheduled", carrier: "TBD", bolNumber: "—", deliveryState: "TX", deliveryType: "commercial" },
];

const initExpenses = [
  { id: "EXP-001", date: "2026-02-20", category: "Carrier Freight", vendor: "Swift Transport", description: "Freight LD-5001", amount: 1850, loadId: "LD-5001" },
  { id: "EXP-002", date: "2026-02-19", category: "Carrier Freight", vendor: "Eagle Logistics", description: "Freight LD-5003", amount: 2100, loadId: "LD-5003" },
  { id: "EXP-003", date: "2026-02-18", category: "Carrier Freight", vendor: "Central Haulers", description: "Freight LD-5005", amount: 1750, loadId: "LD-5005" },
  { id: "EXP-004", date: "2026-02-18", category: "Carrier Freight", vendor: "Heartland Carriers", description: "Freight LD-5006", amount: 1920, loadId: "LD-5006" },
  { id: "EXP-005", date: "2026-02-17", category: "Carrier Freight", vendor: "Eagle Logistics", description: "Freight LD-5007", amount: 1980, loadId: "LD-5007" },
  { id: "EXP-006", date: "2026-02-06", category: "Carrier Freight", vendor: "AeroHaul", description: "Freight LD-5008", amount: 3200, loadId: "LD-5008" },
  { id: "EXP-007", date: "2026-02-10", category: "Carrier Freight", vendor: "Eagle Logistics", description: "Freight LD-5009", amount: 2050, loadId: "LD-5009" },
  { id: "EXP-008", date: "2026-02-14", category: "Carrier Freight", vendor: "Swift Transport", description: "Freight LD-5010", amount: 1880, loadId: "LD-5010" },
  { id: "EXP-009", date: "2026-02-01", category: "Insurance", vendor: "Fuel Guard Insurance", description: "Monthly liability premium", amount: 3200, loadId: null },
  { id: "EXP-010", date: "2026-02-01", category: "Office", vendor: "Regus", description: "Office lease - February", amount: 2400, loadId: null },
  { id: "EXP-011", date: "2026-02-01", category: "Software", vendor: "DTN", description: "OPIS pricing subscription", amount: 895, loadId: null },
  { id: "EXP-012", date: "2026-02-12", category: "Compliance", vendor: "Texas Comptroller", description: "Motor fuel tax filing Q4", amount: 4500, loadId: null },
  { id: "EXP-013", date: "2026-02-15", category: "Professional Fees", vendor: "Baker & Associates CPA", description: "Monthly bookkeeping", amount: 1800, loadId: null },
  { id: "EXP-014", date: "2026-02-05", category: "Licensing", vendor: "DOT", description: "Carrier broker license renewal", amount: 750, loadId: null },
];

// ─── ICONS ──────────────────────────────────────────────────────────────────
const Ico = ({ d, size = 18, color = "currentColor", ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const IC = {
  dash: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  load: ["M1 3h15v13H1z", "M16 8h4l3 3v5h-7V8z", "M5.5 18.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z", "M18.5 18.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"],
  inv: ["M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"],
  cust: ["M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2", "M9 11a4 4 0 100-8 4 4 0 000 8z", "M23 21v-2a4 4 0 00-3-3.87", "M16 3.13a4 4 0 010 7.75"],
  sup: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  exp: ["M12 1v22", "M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"],
  rpt: ["M18 20V10", "M12 20V4", "M6 20v-6"],
  tax: ["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z", "M12 6v6l4 2"],
  pnl: ["M22 12h-4l-3 9L9 3l-3 9H2"],
  plus: "M12 5v14 M5 12h14",
  x: "M18 6L6 18 M6 6l12 12",
  chk: "M20 6L9 17l-5-5",
  srch: ["M11 17.25a6.25 6.25 0 110-12.5 6.25 6.25 0 010 12.5z", "M16 16l4.5 4.5"],
  send: "M22 2L11 13 M22 2l-7 20-4-9-9-4z",
  dl: ["M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  pay: ["M20 12V8H6a2 2 0 010-4h12v4", "M4 6v12a2 2 0 002 2h14v-4", "M18 12a2 2 0 100 4 2 2 0 000-4z"],
  eye: ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z", "M12 9a3 3 0 100 6 3 3 0 000-6z"],
  fltr: "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  void: ["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z", "M4.93 4.93l14.14 14.14"],
  dup: ["M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2", "M15 2H9a1 1 0 00-1 1v2a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1z"],
  alert: ["M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z", "M12 9v4", "M12 17h.01"],
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function FuelBooksApp() {
  const [tab, setTab] = useState("dashboard");
  const [loads, setLoads] = useState(initLoads);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses] = useState(initExpenses);
  const [customers] = useState(initCustomers);
  const [suppliers] = useState(initSuppliers);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);

  // Auto-generate invoices for delivered loads on first render
  useEffect(() => {
    const inv = [];
    loads.filter(l => l.status === "delivered").forEach(l => {
      const cust = customers.find(c => c.id === l.customerId);
      const taxes = calcTaxes(l.fuelType, l.gallons, l.deliveryState, l.deliveryType);
      const fuelTotal = l.gallons * l.sellPrice;
      const lineItems = [
        { desc: `${l.fuelType} — ${fmtN(l.gallons)} gal @ ${fmt4(l.sellPrice)}/gal`, amount: fuelTotal, type: "fuel" },
      ];
      if (taxes.totalTax > 0) {
        lineItems.push({ desc: `Federal Excise Tax (${fmt4(taxes.federalRate)}/gal × ${fmtN(l.gallons)})`, amount: taxes.fedTax, type: "fedtax" });
        lineItems.push({ desc: `${STATE_FUEL_TAX[l.deliveryState]?.name || l.deliveryState} State Tax (${fmt4(taxes.stateRate)}/gal × ${fmtN(l.gallons)})`, amount: taxes.stateTax, type: "statetax" });
      }
      if (taxes.exempt) {
        lineItems.push({ desc: `Tax Exempt: ${taxes.exemptReason}`, amount: 0, type: "exempt" });
      }
      const total = fuelTotal + taxes.totalTax;
      inv.push({
        id: `INV-${3000 + inv.length + 1}`,
        loadId: l.id, customerId: l.customerId, customerName: cust?.name || "Unknown",
        date: l.date, dueDate: addDays(l.date, cust?.terms || 10), terms: cust?.terms || 10,
        lineItems, subtotal: fuelTotal, fedTax: taxes.fedTax, stateTax: taxes.stateTax,
        totalTax: taxes.totalTax, total, paid: 0, status: "outstanding",
        deliveryState: l.deliveryState, fuelType: l.fuelType, gallons: l.gallons,
        taxExempt: taxes.exempt, exemptReason: taxes.exemptReason,
      });
    });
    // Simulate some as paid
    if (inv[1]) { inv[1].paid = inv[1].total; inv[1].status = "paid"; }
    if (inv[2]) { inv[2].paid = inv[2].total; inv[2].status = "paid"; }
    if (inv[4]) { inv[4].paid = inv[4].total; inv[4].status = "paid"; }
    if (inv[5]) { inv[5].paid = inv[5].total; inv[5].status = "paid"; }
    // One overdue
    if (inv[7]) { inv[7].dueDate = "2026-02-15"; inv[7].status = "overdue"; }
    setInvoices(inv);
    // Generate payment records for paid invoices
    const pays = inv.filter(i => i.status === "paid").map((i, idx) => ({
      id: `PMT-${7000 + idx}`, invoiceId: i.id, customerId: i.customerId, customerName: i.customerName,
      date: addDays(i.date, Math.floor(Math.random() * 8) + 2), amount: i.total,
      method: ["ACH", "Wire", "Check"][idx % 3], reference: `REF-${90000 + idx}`,
    }));
    setPayments(pays);
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const recordPayment = (invoiceId, amount, method, reference) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== invoiceId) return inv;
      const newPaid = inv.paid + amount;
      return { ...inv, paid: newPaid, status: newPaid >= inv.total ? "paid" : "partial" };
    }));
    setPayments(prev => [...prev, {
      id: genId("PMT"), invoiceId, amount, method, reference, date: today(),
      customerId: invoices.find(i => i.id === invoiceId)?.customerId,
      customerName: invoices.find(i => i.id === invoiceId)?.customerName,
    }]);
    showToast(`Payment of ${fmt(amount)} recorded against ${invoiceId}`);
  };

  // ─── AUTO P&L ENGINE ────────────────────────────────────────────────
  const pnl = useMemo(() => {
    const delivered = loads.filter(l => l.status === "delivered");
    const revenue = delivered.reduce((s, l) => s + l.gallons * l.sellPrice, 0);
    const fuelCost = delivered.reduce((s, l) => s + l.gallons * l.buyPrice, 0);
    const carrierExp = expenses.filter(e => e.category === "Carrier Freight").reduce((s, e) => s + e.amount, 0);
    const cogs = fuelCost + carrierExp;
    const grossProfit = revenue - cogs;
    const taxCollected = invoices.reduce((s, i) => s + i.totalTax, 0);
    const opexByCategory = {};
    expenses.filter(e => e.category !== "Carrier Freight").forEach(e => {
      opexByCategory[e.category] = (opexByCategory[e.category] || 0) + e.amount;
    });
    const totalOpex = Object.values(opexByCategory).reduce((a, b) => a + b, 0);
    const netIncome = grossProfit - totalOpex;
    const totalGallons = delivered.reduce((s, l) => s + l.gallons, 0);
    return { revenue, fuelCost, carrierExp, cogs, grossProfit, taxCollected, opexByCategory, totalOpex, netIncome, totalGallons, loadCount: delivered.length };
  }, [loads, expenses, invoices]);

  // ─── TAX SUMMARY ────────────────────────────────────────────────────
  const taxSummary = useMemo(() => {
    const byState = {};
    const byFuel = {};
    invoices.forEach(inv => {
      const st = inv.deliveryState;
      if (!byState[st]) byState[st] = { fed: 0, state: 0, total: 0, gallons: 0, invoiceCount: 0, exempt: 0 };
      byState[st].fed += inv.fedTax;
      byState[st].state += inv.stateTax;
      byState[st].total += inv.totalTax;
      byState[st].gallons += inv.gallons;
      byState[st].invoiceCount += 1;
      if (inv.taxExempt) byState[st].exempt += 1;

      const ft = inv.fuelType;
      if (!byFuel[ft]) byFuel[ft] = { fed: 0, state: 0, total: 0, gallons: 0 };
      byFuel[ft].fed += inv.fedTax;
      byFuel[ft].state += inv.stateTax;
      byFuel[ft].total += inv.totalTax;
      byFuel[ft].gallons += inv.gallons;
    });
    const totalFed = Object.values(byState).reduce((s, v) => s + v.fed, 0);
    const totalState = Object.values(byState).reduce((s, v) => s + v.state, 0);
    return { byState, byFuel, totalFed, totalState, grandTotal: totalFed + totalState };
  }, [invoices]);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: IC.dash },
    { id: "loads", label: "Loads & Trades", icon: IC.load },
    { id: "invoices", label: "Invoices & Billing", icon: IC.inv },
    { id: "payments", label: "Payments", icon: IC.pay },
    { id: "pnl", label: "Profit & Loss", icon: IC.pnl },
    { id: "taxes", label: "Tax Center", icon: IC.tax },
    { id: "customers", label: "Customers", icon: IC.cust },
    { id: "suppliers", label: "Suppliers", icon: IC.sup },
    { id: "expenses", label: "Expenses", icon: IC.exp },
    { id: "reports", label: "Reports", icon: IC.rpt },
  ];

  const ar = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + (i.total - i.paid), 0);
  const overdue = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + (i.total - i.paid), 0);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", fontFamily: "'Outfit', sans-serif", background: "#06090F", color: "#D4DAE3", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* SIDEBAR */}
      <aside style={{ width: 232, background: "#0A0F1A", borderRight: "1px solid #161D2E", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 18px 16px", borderBottom: "1px solid #161D2E", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg, #E8A525, #C67D12)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#06090F" }}>FB</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#F4F6F9", letterSpacing: "-0.03em" }}>FuelBooks Pro</div>
            <div style={{ fontSize: 9, color: "#5A647A", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Brokerage Accounting</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 1, overflowY: "auto" }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 7, border: "none", cursor: "pointer",
              background: tab === item.id ? "rgba(232,165,37,0.10)" : "transparent",
              color: tab === item.id ? "#E8A525" : "#6B7690", fontWeight: tab === item.id ? 600 : 500,
              fontSize: 12.5, textAlign: "left", width: "100%", fontFamily: "inherit", transition: "all 0.15s",
              borderLeft: tab === item.id ? "2px solid #E8A525" : "2px solid transparent",
            }}>
              <Ico d={item.icon} size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div style={{ padding: "14px 16px", borderTop: "1px solid #161D2E", fontSize: 10, color: "#3D4659", lineHeight: 1.5 }}>
          Tru Skool Entertainment<br />International Corp.
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <header style={{ height: 56, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #161D2E", background: "#0A0F1A", flexShrink: 0 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: "#F4F6F9", margin: 0 }}>
            {navItems.find(n => n.id === tab)?.label}
          </h1>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setModal("newLoad")} style={{ ...btnStyle("#E8A525", "#06090F"), display: "flex", alignItems: "center", gap: 6 }}>
              <Ico d={IC.plus} size={14} color="#06090F" />New Load
            </button>
            <button onClick={() => setModal("newInvoice")} style={{ ...btnStyle("#2563EB", "#FFF"), display: "flex", alignItems: "center", gap: 6 }}>
              <Ico d={IC.inv} size={14} color="#FFF" />New Invoice
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
          {tab === "dashboard" && <Dashboard pnl={pnl} ar={ar} overdue={overdue} invoices={invoices} loads={loads} taxSummary={taxSummary} />}
          {tab === "loads" && <LoadsTab loads={loads} customers={customers} suppliers={suppliers} onSelect={l => setModal({ type: "loadDetail", load: l })} />}
          {tab === "invoices" && <InvoicesTab invoices={invoices} onView={inv => setModal({ type: "invoiceDetail", invoice: inv })} onPay={inv => setModal({ type: "recordPayment", invoice: inv })} />}
          {tab === "payments" && <PaymentsTab payments={payments} />}
          {tab === "pnl" && <PnLTab pnl={pnl} loads={loads} invoices={invoices} expenses={expenses} />}
          {tab === "taxes" && <TaxCenter taxSummary={taxSummary} invoices={invoices} loads={loads} customers={customers} />}
          {tab === "customers" && <CustomersTab customers={customers} invoices={invoices} />}
          {tab === "suppliers" && <SuppliersTab suppliers={suppliers} loads={loads} />}
          {tab === "expenses" && <ExpensesTab expenses={expenses} />}
          {tab === "reports" && <ReportsTab pnl={pnl} taxSummary={taxSummary} invoices={invoices} loads={loads} customers={customers} />}
        </div>
      </main>

      {/* MODALS */}
      {modal === "newLoad" && <NewLoadModal customers={customers} suppliers={suppliers} onClose={() => setModal(null)} onSave={load => { setLoads(prev => [...prev, load]); setModal(null); showToast(`Load ${load.id} created`); }} />}
      {modal === "newInvoice" && <NewInvoiceFromLoad loads={loads} customers={customers} invoices={invoices} onClose={() => setModal(null)} onSave={inv => { setInvoices(prev => [...prev, inv]); setModal(null); showToast(`Invoice ${inv.id} created for ${fmt(inv.total)}`); }} />}
      {modal?.type === "loadDetail" && <LoadDetailModal load={modal.load} customers={customers} suppliers={suppliers} onClose={() => setModal(null)} />}
      {modal?.type === "invoiceDetail" && <InvoiceDetailModal invoice={modal.invoice} onClose={() => setModal(null)} onPay={() => { setModal({ type: "recordPayment", invoice: modal.invoice }); }} />}
      {modal?.type === "recordPayment" && <RecordPaymentModal invoice={modal.invoice} onClose={() => setModal(null)} onRecord={(id, amt, method, ref) => { recordPayment(id, amt, method, ref); setModal(null); }} />}

      {/* TOAST */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, padding: "12px 20px", borderRadius: 10, background: toast.type === "success" ? "#065F46" : "#7F1D1D", color: "#F4F6F9", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 30px rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", gap: 8, animation: "slideUp 0.3s" }}>
          <Ico d={toast.type === "success" ? IC.chk : IC.alert} size={16} />
          {toast.msg}
        </div>
      )}
      <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}

const btnStyle = (bg, fg) => ({ background: bg, color: fg, border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });
const cardStyle = { background: "#0D1320", borderRadius: 10, border: "1px solid #161D2E", padding: "18px" };
const monoStyle = { fontFamily: "'IBM Plex Mono', monospace" };
const thStyle = { textAlign: "left", padding: "8px 10px", color: "#5A647A", fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" };
const tdStyle = { padding: "9px 10px", borderBottom: "1px solid #161D2E11", fontSize: 12.5 };
const labelStyle = { fontSize: 11, color: "#6B7690", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 };

function Badge({ status }) {
  const m = { delivered: ["#10B981", "#064E3B"], "in-transit": ["#3B82F6", "#1E3A5F"], scheduled: ["#E8A525", "#5C3D0A"], outstanding: ["#E8A525", "#5C3D0A"], paid: ["#10B981", "#064E3B"], overdue: ["#EF4444", "#5C1010"], partial: ["#8B5CF6", "#3B1D72"], active: ["#10B981", "#064E3B"], inactive: ["#6B7690", "#2A2F3D"], void: ["#6B7690", "#1E222E"] };
  const [c, bg] = m[status] || m.active;
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 20, background: bg, color: c, fontSize: 10.5, fontWeight: 600, textTransform: "capitalize" }}>{status.replace("-", " ")}</span>;
}

function Spark({ data, color = "#10B981", w = 100, h = 28 }) {
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  return <svg width={w} height={h}><polyline points={data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / r) * (h - 4) - 2}`).join(" ")} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function Dashboard({ pnl, ar, overdue, invoices, loads, taxSummary }) {
  const kpis = [
    { label: "Revenue (MTD)", val: fmt(pnl.revenue), sub: `${fmtN(pnl.totalGallons)} gal · ${pnl.loadCount} loads`, color: "#10B981", spark: [28000, 34000, 31000, 38000, pnl.revenue / 4] },
    { label: "Gross Profit", val: fmt(pnl.grossProfit), sub: `${pct(pnl.grossProfit / pnl.revenue)} margin · ${fmt(pnl.grossProfit / pnl.totalGallons)}/gal`, color: "#E8A525", spark: [5000, 6200, 5800, 7000, pnl.grossProfit / 3] },
    { label: "Net Income", val: fmt(pnl.netIncome), sub: `${pct(pnl.netIncome / pnl.revenue)} net margin`, color: pnl.netIncome >= 0 ? "#10B981" : "#EF4444", spark: [3000, 4200, 3800, 5000, pnl.netIncome / 3] },
    { label: "Accounts Receivable", val: fmt(ar), sub: overdue > 0 ? `${fmt(overdue)} overdue` : "All current", color: overdue > 0 ? "#EF4444" : "#10B981", spark: [42000, 38000, 45000, ar] },
    { label: "Tax Collected (MTD)", val: fmt(taxSummary.grandTotal), sub: `Fed ${fmt(taxSummary.totalFed)} · State ${fmt(taxSummary.totalState)}`, color: "#8B5CF6", spark: [3000, 4000, 3500, taxSummary.grandTotal] },
    { label: "Operating Expenses", val: fmt(pnl.totalOpex), sub: `${Object.keys(pnl.opexByCategory).length} categories`, color: "#EF4444", spark: [10000, 12000, 11000, pnl.totalOpex] },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {kpis.map((k, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: 10 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#F4F6F9", ...monoStyle, letterSpacing: "-0.02em" }}>{k.val}</div>
            <div style={{ fontSize: 11, color: "#5A647A", margin: "4px 0 10px" }}>{k.sub}</div>
            <Spark data={k.spark} color={k.color} />
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Recent invoices */}
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 14 }}>Recent Invoices</div>
          {invoices.slice(0, 6).map(inv => (
            <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #161D2E22" }}>
              <div>
                <span style={{ ...monoStyle, fontSize: 11, color: "#E8A525", fontWeight: 500 }}>{inv.id}</span>
                <span style={{ fontSize: 11, color: "#5A647A", marginLeft: 8 }}>{inv.customerName}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ ...monoStyle, fontSize: 12, fontWeight: 600 }}>{fmt(inv.total)}</span>
                <Badge status={inv.status} />
              </div>
            </div>
          ))}
        </div>
        {/* Tax by state */}
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 14 }}>Tax Liability by State</div>
          {Object.entries(taxSummary.byState).sort((a, b) => b[1].total - a[1].total).map(([st, data]) => (
            <div key={st} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #161D2E22" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#E8A525", background: "#1A1510", padding: "2px 8px", borderRadius: 4 }}>{st}</span>
                <span style={{ fontSize: 11, color: "#5A647A" }}>{STATE_FUEL_TAX[st]?.name}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...monoStyle, fontSize: 12, fontWeight: 600, color: "#8B5CF6" }}>{fmt(data.total)}</div>
                <div style={{ fontSize: 10, color: "#5A647A" }}>{fmtN(data.gallons)} gal · {data.invoiceCount} inv{data.exempt > 0 ? ` · ${data.exempt} exempt` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function LoadsTab({ loads, customers, suppliers, onSelect }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? loads : loads.filter(l => l.status === filter);
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["all", "scheduled", "in-transit", "delivered"].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${filter === s ? "#E8A525" : "#1E2538"}`, background: filter === s ? "rgba(232,165,37,0.1)" : "transparent", color: filter === s ? "#E8A525" : "#6B7690", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>{s}</button>
        ))}
      </div>
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#080C16" }}>
            {["Load #", "Date", "Customer", "Supplier", "Fuel", "Gallons", "Buy/gal", "Sell/gal", "Gross Margin", "Tax", "Status"].map(h => <th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map(l => {
              const cust = customers.find(c => c.id === l.customerId);
              const taxes = calcTaxes(l.fuelType, l.gallons, l.deliveryState, l.deliveryType);
              const margin = (l.sellPrice - l.buyPrice) * l.gallons;
              return (
                <tr key={l.id} onClick={() => onSelect(l)} style={{ cursor: "pointer", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(232,165,37,0.03)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ ...tdStyle, ...monoStyle, color: "#E8A525", fontWeight: 500, fontSize: 11.5 }}>{l.id}</td>
                  <td style={{ ...tdStyle, color: "#6B7690" }}>{l.date}</td>
                  <td style={{ ...tdStyle, color: "#D4DAE3", fontWeight: 500 }}>{cust?.name}</td>
                  <td style={{ ...tdStyle, color: "#6B7690" }}>{suppliers.find(s => s.id === l.supplierId)?.name}</td>
                  <td style={tdStyle}><span style={{ background: "#131A29", padding: "2px 7px", borderRadius: 4, fontSize: 10.5 }}>{l.fuelType}</span></td>
                  <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5 }}>{fmtN(l.gallons)}</td>
                  <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, color: "#6B7690" }}>{fmt4(l.buyPrice)}</td>
                  <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5 }}>{fmt4(l.sellPrice)}</td>
                  <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, color: "#10B981", fontWeight: 600 }}>{fmt(margin)}</td>
                  <td style={{ ...tdStyle, ...monoStyle, fontSize: 11, color: taxes.exempt ? "#6B7690" : "#8B5CF6" }}>{taxes.exempt ? "EXEMPT" : fmt(taxes.totalTax)}</td>
                  <td style={tdStyle}><Badge status={l.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICES & BILLING TAB
// ═══════════════════════════════════════════════════════════════════════════════
function InvoicesTab({ invoices, onView, onPay }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? invoices : invoices.filter(i => i.status === filter);
  const stats = {
    outstanding: invoices.filter(i => i.status === "outstanding").reduce((s, i) => s + i.total - i.paid, 0),
    overdue: invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.total - i.paid, 0),
    paid: invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0),
    taxCollected: invoices.reduce((s, i) => s + i.totalTax, 0),
  };
  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Outstanding", val: fmt(stats.outstanding), color: "#E8A525", count: invoices.filter(i => i.status === "outstanding").length },
          { label: "Overdue", val: fmt(stats.overdue), color: "#EF4444", count: invoices.filter(i => i.status === "overdue").length },
          { label: "Paid (MTD)", val: fmt(stats.paid), color: "#10B981", count: invoices.filter(i => i.status === "paid").length },
          { label: "Tax Collected", val: fmt(stats.taxCollected), color: "#8B5CF6", count: `${invoices.filter(i => !i.taxExempt).length} taxable` },
        ].map((s, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={labelStyle}>{s.label}</span>
              <span style={{ fontSize: 10, color: "#5A647A" }}>{s.count}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, ...monoStyle, marginTop: 6 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {["all", "outstanding", "overdue", "partial", "paid"].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${filter === s ? "#E8A525" : "#1E2538"}`, background: filter === s ? "rgba(232,165,37,0.1)" : "transparent", color: filter === s ? "#E8A525" : "#6B7690", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>{s}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#080C16" }}>
            {["Invoice #", "Date", "Due", "Customer", "Load", "State", "Subtotal", "Tax", "Total", "Paid", "Balance", "Status", "Actions"].map(h => <th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map(inv => {
              const bal = inv.total - inv.paid;
              return (
                <tr key={inv.id}>
                  <td style={{ ...tdStyle, ...monoStyle, color: "#E8A525", fontWeight: 500, fontSize: 11.5 }}>{inv.id}</td>
                  <td style={{ ...tdStyle, color: "#6B7690" }}>{inv.date}</td>
                  <td style={{ ...tdStyle, color: inv.status === "overdue" ? "#EF4444" : "#6B7690", fontWeight: inv.status === "overdue" ? 600 : 400 }}>{inv.dueDate}</td>
                  <td style={{ ...tdStyle, color: "#D4DAE3", fontWeight: 500 }}>{inv.customerName}</td>
                  <td style={{ ...tdStyle, ...monoStyle, fontSize: 11, color: "#6B7690" }}>{inv.loadId}</td>
                  <td style={tdStyle}><span style={{ background: "#131A29", padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600, color: "#8B5CF6" }}>{inv.deliveryState}</span></td>
                  <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5 }}>{fmt(inv.subtotal)}</td>
                  <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, color: inv.taxExempt ? "#5A647A" : "#8B5CF6" }}>{inv.taxExempt ? "—" : fmt(inv.totalTax)}</td>
                  <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, fontWeight: 600, color: "#F4F6F9" }}>{fmt(inv.total)}</td>
                  <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, color: "#10B981" }}>{fmt(inv.paid)}</td>
                  <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, fontWeight: 600, color: bal > 0 ? "#E8A525" : "#10B981" }}>{fmt(bal)}</td>
                  <td style={tdStyle}><Badge status={inv.status} /></td>
                  <td style={{ ...tdStyle, display: "flex", gap: 4 }}>
                    <button onClick={() => onView(inv)} style={{ background: "rgba(59,130,246,0.1)", border: "none", borderRadius: 4, padding: "4px 6px", cursor: "pointer" }} title="View">
                      <Ico d={IC.eye} size={13} color="#3B82F6" />
                    </button>
                    {inv.status !== "paid" && (
                      <button onClick={() => onPay(inv)} style={{ background: "rgba(16,185,129,0.1)", border: "none", borderRadius: 4, padding: "4px 6px", cursor: "pointer" }} title="Record Payment">
                        <Ico d={IC.pay} size={13} color="#10B981" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function PaymentsTab({ payments }) {
  const total = payments.reduce((s, p) => s + p.amount, 0);
  return (
    <div>
      <div style={{ ...cardStyle, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><span style={labelStyle}>Total Collected (MTD)</span><div style={{ fontSize: 24, fontWeight: 700, color: "#10B981", ...monoStyle, marginTop: 4 }}>{fmt(total)}</div></div>
        <div style={{ textAlign: "right" }}><span style={labelStyle}>Payments</span><div style={{ fontSize: 24, fontWeight: 700, color: "#F4F6F9", marginTop: 4 }}>{payments.length}</div></div>
      </div>
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#080C16" }}>
            {["Payment #", "Date", "Invoice", "Customer", "Amount", "Method", "Reference"].map(h => <th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id}>
                <td style={{ ...tdStyle, ...monoStyle, color: "#10B981", fontSize: 11.5, fontWeight: 500 }}>{p.id}</td>
                <td style={{ ...tdStyle, color: "#6B7690" }}>{p.date}</td>
                <td style={{ ...tdStyle, ...monoStyle, color: "#E8A525", fontSize: 11 }}>{p.invoiceId}</td>
                <td style={{ ...tdStyle, color: "#D4DAE3" }}>{p.customerName}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 12, fontWeight: 600, color: "#10B981" }}>{fmt(p.amount)}</td>
                <td style={tdStyle}><span style={{ background: "#131A29", padding: "2px 7px", borderRadius: 4, fontSize: 10.5 }}>{p.method}</span></td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11, color: "#6B7690" }}>{p.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO P&L TAB
// ═══════════════════════════════════════════════════════════════════════════════
function PnLTab({ pnl, loads, invoices, expenses }) {
  const gpPct = pnl.revenue ? pnl.grossProfit / pnl.revenue : 0;
  const niPct = pnl.revenue ? pnl.netIncome / pnl.revenue : 0;
  return (
    <div>
      <div style={{ ...cardStyle, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#F4F6F9", marginBottom: 4 }}>Profit & Loss Statement</div>
        <div style={{ fontSize: 12, color: "#5A647A", marginBottom: 20 }}>Period: February 1–21, 2026 · Auto-calculated from load, invoice & expense data</div>

        {/* Revenue */}
        <PLSection label="Revenue" />
        <PLRow label="Fuel Sales Revenue" amount={pnl.revenue} note={`${fmtN(pnl.totalGallons)} gallons across ${pnl.loadCount} loads`} />
        <PLDivider />
        <PLRow label="Total Revenue" amount={pnl.revenue} bold color="#10B981" />

        {/* COGS */}
        <PLSection label="Cost of Goods Sold" />
        <PLRow label="Cost of Fuel Purchased" amount={pnl.fuelCost} negative note={`Avg buy: ${fmt(pnl.fuelCost / pnl.totalGallons)}/gal`} />
        <PLRow label="Carrier & Freight Costs" amount={pnl.carrierExp} negative note={`${expenses.filter(e => e.category === "Carrier Freight").length} loads`} />
        <PLDivider />
        <PLRow label="Total COGS" amount={pnl.cogs} negative bold color="#EF4444" />
        <PLDivider thick />
        <PLRow label="Gross Profit" amount={pnl.grossProfit} bold color={pnl.grossProfit >= 0 ? "#10B981" : "#EF4444"} note={`${pct(gpPct)} gross margin · ${fmt(pnl.grossProfit / pnl.totalGallons)}/gal`} size={15} />

        {/* Opex */}
        <PLSection label="Operating Expenses" />
        {Object.entries(pnl.opexByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
          <PLRow key={cat} label={cat} amount={amt} negative indent />
        ))}
        <PLDivider />
        <PLRow label="Total Operating Expenses" amount={pnl.totalOpex} negative bold color="#EF4444" />

        <PLDivider thick gold />
        <PLRow label="Net Income" amount={pnl.netIncome} bold color={pnl.netIncome >= 0 ? "#10B981" : "#EF4444"} size={17} note={`${pct(niPct)} net margin`} />
      </div>

      {/* Margin breakdown by fuel type */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 14 }}>Margin by Fuel Type</div>
          {(() => {
            const ftm = {};
            loads.filter(l => l.status === "delivered").forEach(l => {
              if (!ftm[l.fuelType]) ftm[l.fuelType] = { rev: 0, cost: 0, gal: 0 };
              ftm[l.fuelType].rev += l.gallons * l.sellPrice;
              ftm[l.fuelType].cost += l.gallons * l.buyPrice;
              ftm[l.fuelType].gal += l.gallons;
            });
            return Object.entries(ftm).sort((a, b) => (b[1].rev - b[1].cost) - (a[1].rev - a[1].cost)).map(([ft, d]) => {
              const m = d.rev - d.cost;
              return (
                <div key={ft} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #161D2E22" }}>
                  <div><div style={{ fontSize: 12.5, color: "#D4DAE3" }}>{ft}</div><div style={{ fontSize: 10, color: "#5A647A" }}>{fmtN(d.gal)} gal</div></div>
                  <div style={{ textAlign: "right" }}><div style={{ ...monoStyle, fontSize: 12.5, fontWeight: 600, color: "#10B981" }}>{fmt(m)}</div><div style={{ fontSize: 10, color: "#5A647A" }}>{fmt(m / d.gal)}/gal</div></div>
                </div>
              );
            });
          })()}
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 14 }}>Margin by Customer</div>
          {(() => {
            const cm = {};
            loads.filter(l => l.status === "delivered").forEach(l => {
              if (!cm[l.customerId]) cm[l.customerId] = { rev: 0, cost: 0, gal: 0, name: "" };
              cm[l.customerId].rev += l.gallons * l.sellPrice;
              cm[l.customerId].cost += l.gallons * l.buyPrice;
              cm[l.customerId].gal += l.gallons;
              cm[l.customerId].name = initCustomers.find(c => c.id === l.customerId)?.name || l.customerId;
            });
            return Object.entries(cm).sort((a, b) => (b[1].rev - b[1].cost) - (a[1].rev - a[1].cost)).map(([id, d]) => {
              const m = d.rev - d.cost;
              return (
                <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #161D2E22" }}>
                  <div><div style={{ fontSize: 12.5, color: "#D4DAE3" }}>{d.name}</div><div style={{ fontSize: 10, color: "#5A647A" }}>{fmtN(d.gal)} gal</div></div>
                  <div style={{ textAlign: "right" }}><div style={{ ...monoStyle, fontSize: 12.5, fontWeight: 600, color: "#10B981" }}>{fmt(m)}</div><div style={{ fontSize: 10, color: "#5A647A" }}>{pct(m / d.rev)}</div></div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}

function PLSection({ label }) { return <div style={{ fontSize: 11, color: "#5A647A", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 18, marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #1E2538" }}>{label}</div>; }
function PLDivider({ thick, gold }) { return <div style={{ height: thick ? 2 : 1, background: gold ? "#E8A52533" : "#1E2538", margin: "6px 0" }} />; }
function PLRow({ label, amount, bold, negative, indent, color, note, size }) {
  const v = negative ? -Math.abs(amount) : amount;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: `3px ${indent ? 16 : 0}px` }}>
      <div>
        <span style={{ fontSize: size || 13, fontWeight: bold ? 700 : 400, color: bold ? "#F4F6F9" : "#8E96A8" }}>{label}</span>
        {note && <span style={{ fontSize: 10, color: "#5A647A", marginLeft: 8 }}>{note}</span>}
      </div>
      <span style={{ ...monoStyle, fontSize: size || 13, fontWeight: bold ? 700 : 500, color: color || (v < 0 ? "#EF4444" : "#D4DAE3") }}>
        {v < 0 ? `(${fmt(Math.abs(v))})` : fmt(v)}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAX CENTER
// ═══════════════════════════════════════════════════════════════════════════════
function TaxCenter({ taxSummary, invoices, loads, customers }) {
  return (
    <div>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 18 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Federal Excise Tax</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#8B5CF6", ...monoStyle, marginTop: 6 }}>{fmt(taxSummary.totalFed)}</div>
          <div style={{ fontSize: 11, color: "#5A647A", marginTop: 3 }}>IRS Form 720 liability</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>State Fuel Taxes</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#3B82F6", ...monoStyle, marginTop: 6 }}>{fmt(taxSummary.totalState)}</div>
          <div style={{ fontSize: 11, color: "#5A647A", marginTop: 3 }}>Due to state comptrollers</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Total Tax Liability</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#EF4444", ...monoStyle, marginTop: 6 }}>{fmt(taxSummary.grandTotal)}</div>
          <div style={{ fontSize: 11, color: "#5A647A", marginTop: 3 }}>Combined federal + state</div>
        </div>
      </div>

      {/* By State detail */}
      <div style={{ ...cardStyle, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#F4F6F9", marginBottom: 14 }}>Tax Breakdown by Delivery State</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#080C16" }}>
            {["State", "Gallons", "Federal Tax", "State Tax", "Total Tax", "Avg Rate/gal", "Invoices", "Exemptions"].map(h => <th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            {Object.entries(taxSummary.byState).sort((a, b) => b[1].total - a[1].total).map(([st, d]) => (
              <tr key={st}>
                <td style={tdStyle}><span style={{ fontWeight: 700, color: "#E8A525" }}>{st}</span> <span style={{ color: "#5A647A", fontSize: 11 }}>{STATE_FUEL_TAX[st]?.name}</span></td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5 }}>{fmtN(d.gallons)}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, color: "#8B5CF6" }}>{fmt(d.fed)}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, color: "#3B82F6" }}>{fmt(d.state)}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, fontWeight: 600, color: "#EF4444" }}>{fmt(d.total)}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, color: "#6B7690" }}>{d.gallons > 0 ? fmt4(d.total / d.gallons) : "—"}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{d.invoiceCount}</td>
                <td style={{ ...tdStyle, textAlign: "center", color: d.exempt > 0 ? "#E8A525" : "#5A647A" }}>{d.exempt || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* By Fuel type */}
      <div style={{ ...cardStyle, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#F4F6F9", marginBottom: 14 }}>Tax Breakdown by Fuel Type</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#080C16" }}>
            {["Fuel Type", "Gallons", "Fed Rate/gal", "Federal Tax", "State Tax", "Total Tax"].map(h => <th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            {Object.entries(taxSummary.byFuel).sort((a, b) => b[1].total - a[1].total).map(([ft, d]) => (
              <tr key={ft}>
                <td style={{ ...tdStyle, color: "#D4DAE3", fontWeight: 500 }}>{ft}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5 }}>{fmtN(d.gallons)}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, color: "#6B7690" }}>{fmt4(FEDERAL_FUEL_TAX[ft] || 0)}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, color: "#8B5CF6" }}>{fmt(d.fed)}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, color: "#3B82F6" }}>{fmt(d.state)}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, fontWeight: 600, color: "#EF4444" }}>{fmt(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tax Rate Reference */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#F4F6F9", marginBottom: 6 }}>Tax Rate Reference Table</div>
        <div style={{ fontSize: 11, color: "#5A647A", marginBottom: 14 }}>Federal + state excise tax rates per gallon by fuel type and delivery state. Jet-A exempt for airline deliveries.</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", minWidth: 700 }}>
            <thead><tr style={{ background: "#080C16" }}>
              <th style={thStyle}>Fuel Type</th>
              <th style={{ ...thStyle, color: "#8B5CF6" }}>Federal</th>
              {ALL_STATES.map(s => <th key={s.code} style={thStyle}>{s.code}</th>)}
            </tr></thead>
            <tbody>
              {["ULSD", "Regular 87", "Premium 93", "E85", "Biodiesel B20", "Jet-A", "Kerosene"].map(ft => (
                <tr key={ft}>
                  <td style={{ ...tdStyle, color: "#D4DAE3", fontWeight: 500, fontSize: 11.5, whiteSpace: "nowrap" }}>{ft}</td>
                  <td style={{ ...tdStyle, ...monoStyle, fontSize: 11, color: "#8B5CF6", fontWeight: 500 }}>{fmt4(FEDERAL_FUEL_TAX[ft])}</td>
                  {ALL_STATES.map(s => (
                    <td key={s.code} style={{ ...tdStyle, ...monoStyle, fontSize: 11, color: "#6B7690" }}>
                      {fmt4(STATE_FUEL_TAX[s.code]?.[ft] || 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMERS, SUPPLIERS, EXPENSES, REPORTS TABS
// ═══════════════════════════════════════════════════════════════════════════════
function CustomersTab({ customers, invoices }) {
  return (
    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: "#080C16" }}>
          {["ID", "Company", "Contact", "State", "Terms", "Credit Limit", "AR Balance", "Utilization", "Tax Status"].map(h => <th key={h} style={thStyle}>{h}</th>)}
        </tr></thead>
        <tbody>
          {customers.map(c => {
            const bal = invoices.filter(i => i.customerId === c.id && i.status !== "paid").reduce((s, i) => s + i.total - i.paid, 0);
            const util = bal / c.creditLimit;
            return (
              <tr key={c.id}>
                <td style={{ ...tdStyle, ...monoStyle, color: "#6B7690", fontSize: 11 }}>{c.id}</td>
                <td style={{ ...tdStyle, color: "#D4DAE3", fontWeight: 600 }}>{c.name}</td>
                <td style={tdStyle}><div style={{ color: "#D4DAE3", fontSize: 12 }}>{c.contact}</div><div style={{ color: "#5A647A", fontSize: 10.5 }}>{c.email}</div></td>
                <td style={tdStyle}><span style={{ background: "#131A29", padding: "1px 6px", borderRadius: 3, fontSize: 10.5, fontWeight: 600, color: "#E8A525" }}>{c.state}</span></td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5 }}>Net {c.terms}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5 }}>{fmt(c.creditLimit)}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, fontWeight: 600, color: bal > 0 ? "#E8A525" : "#10B981" }}>{fmt(bal)}</td>
                <td style={{ ...tdStyle, width: 120 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ flex: 1, height: 4, background: "#1E2538", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: pct(Math.min(util, 1)), background: util > 0.8 ? "#EF4444" : util > 0.5 ? "#E8A525" : "#10B981", borderRadius: 2 }} />
                    </div>
                    <span style={{ ...monoStyle, fontSize: 10, color: "#5A647A", minWidth: 35 }}>{pct(util)}</span>
                  </div>
                </td>
                <td style={tdStyle}>{c.taxExempt ? <span style={{ color: "#E8A525", fontSize: 10.5, fontWeight: 600 }}>EXEMPT</span> : <span style={{ color: "#5A647A", fontSize: 10.5 }}>Taxable</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SuppliersTab({ suppliers, loads }) {
  return (
    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: "#080C16" }}>
          {["ID", "Supplier", "Contact", "Terms", "Loads", "Gallons Purchased", "Total Cost", "AP Balance"].map(h => <th key={h} style={thStyle}>{h}</th>)}
        </tr></thead>
        <tbody>
          {suppliers.map(s => {
            const sLoads = loads.filter(l => l.supplierId === s.id && l.status === "delivered");
            const gal = sLoads.reduce((acc, l) => acc + l.gallons, 0);
            const cost = sLoads.reduce((acc, l) => acc + l.gallons * l.buyPrice, 0);
            return (
              <tr key={s.id}>
                <td style={{ ...tdStyle, ...monoStyle, color: "#6B7690", fontSize: 11 }}>{s.id}</td>
                <td style={{ ...tdStyle, color: "#D4DAE3", fontWeight: 600 }}>{s.name}</td>
                <td style={tdStyle}><div style={{ color: "#D4DAE3", fontSize: 12 }}>{s.contact}</div><div style={{ color: "#5A647A", fontSize: 10.5 }}>{s.email}</div></td>
                <td style={tdStyle}><span style={{ background: "#131A29", padding: "2px 7px", borderRadius: 4, fontSize: 10.5 }}>Net {s.terms}</span></td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5 }}>{sLoads.length}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5 }}>{fmtN(gal)}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5 }}>{fmt(cost)}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11.5, fontWeight: 600, color: "#EF4444" }}>{fmt(cost * 0.35)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExpensesTab({ expenses }) {
  const byCategory = {};
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14 }}>
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 12 }}>By Category</div>
        <div style={{ ...monoStyle, fontSize: 20, fontWeight: 700, color: "#E8A525", marginBottom: 14 }}>{fmt(total)}</div>
        {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
          <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #161D2E22" }}>
            <span style={{ fontSize: 12, color: "#D4DAE3" }}>{cat}</span>
            <span style={{ ...monoStyle, fontSize: 12, color: "#6B7690" }}>{fmt(amt)}</span>
          </div>
        ))}
      </div>
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#080C16" }}>
            {["ID", "Date", "Category", "Vendor", "Description", "Load", "Amount"].map(h => <th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            {expenses.map(e => (
              <tr key={e.id}>
                <td style={{ ...tdStyle, ...monoStyle, color: "#6B7690", fontSize: 11 }}>{e.id}</td>
                <td style={{ ...tdStyle, color: "#6B7690" }}>{e.date}</td>
                <td style={tdStyle}><span style={{ background: "#131A29", padding: "2px 7px", borderRadius: 4, fontSize: 10.5 }}>{e.category}</span></td>
                <td style={{ ...tdStyle, color: "#D4DAE3" }}>{e.vendor}</td>
                <td style={{ ...tdStyle, color: "#6B7690", fontSize: 11.5 }}>{e.description}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 11, color: e.loadId ? "#E8A525" : "#2A303E" }}>{e.loadId || "—"}</td>
                <td style={{ ...tdStyle, ...monoStyle, fontSize: 12, fontWeight: 600, color: "#EF4444" }}>{fmt(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsTab({ pnl, taxSummary, invoices, loads, customers }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#F4F6F9", marginBottom: 14 }}>Key Performance Indicators</div>
        {[
          ["Loads Completed", pnl.loadCount.toString()], ["Total Gallons Brokered", fmtN(pnl.totalGallons)],
          ["Revenue", fmt(pnl.revenue)], ["COGS", fmt(pnl.cogs)],
          ["Gross Profit", fmt(pnl.grossProfit)], ["Gross Margin %", pct(pnl.grossProfit / pnl.revenue)],
          ["Avg Margin/Gallon", fmt(pnl.grossProfit / pnl.totalGallons)],
          ["Avg Revenue/Load", fmt(pnl.revenue / pnl.loadCount)],
          ["Operating Expenses", fmt(pnl.totalOpex)], ["Net Income", fmt(pnl.netIncome)],
          ["Net Margin %", pct(pnl.netIncome / pnl.revenue)],
          ["Tax Collected", fmt(taxSummary.grandTotal)],
          ["Collection Rate", pct(invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0) / invoices.reduce((s, i) => s + i.total, 0))],
        ].map(([l, v], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #161D2E22" }}>
            <span style={{ fontSize: 12.5, color: "#8E96A8" }}>{l}</span>
            <span style={{ ...monoStyle, fontSize: 12.5, fontWeight: 600, color: "#F4F6F9" }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#F4F6F9", marginBottom: 14 }}>Customer Revenue Ranking</div>
        {(() => {
          const cr = {};
          loads.filter(l => l.status === "delivered").forEach(l => {
            if (!cr[l.customerId]) cr[l.customerId] = { rev: 0, margin: 0, gal: 0 };
            cr[l.customerId].rev += l.gallons * l.sellPrice;
            cr[l.customerId].margin += (l.sellPrice - l.buyPrice) * l.gallons;
            cr[l.customerId].gal += l.gallons;
          });
          return Object.entries(cr).sort((a, b) => b[1].rev - a[1].rev).map(([id, d], i) => {
            const name = customers.find(c => c.id === id)?.name || id;
            return (
              <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #161D2E22" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#131A29", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#E8A525" }}>{i + 1}</span>
                  <div><div style={{ fontSize: 12.5, color: "#D4DAE3" }}>{name}</div><div style={{ fontSize: 10, color: "#5A647A" }}>{fmtN(d.gal)} gal</div></div>
                </div>
                <div style={{ textAlign: "right" }}><div style={{ ...monoStyle, fontSize: 12.5, fontWeight: 600 }}>{fmt(d.rev)}</div><div style={{ fontSize: 10, color: "#10B981" }}>{fmt(d.margin)} margin</div></div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════════════
function Overlay({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0D1320", borderRadius: 14, border: "1px solid #1E2538", maxHeight: "88vh", overflow: "auto", position: "relative" }}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, sub, onClose }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, padding: "24px 28px 0" }}>
      <div><h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#F4F6F9" }}>{title}</h2>{sub && <div style={{ fontSize: 12, color: "#5A647A", marginTop: 3 }}>{sub}</div>}</div>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, marginTop: -2 }}><Ico d={IC.x} size={18} color="#5A647A" /></button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", options, disabled, half }) {
  const base = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #1E2538", background: "#080C16", color: "#D4DAE3", fontSize: 12.5, fontFamily: "'Outfit', sans-serif", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" };
  return (
    <div style={{ gridColumn: half ? "auto" : undefined }}>
      <label style={{ display: "block", ...labelStyle, marginBottom: 5 }}>{label}</label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={{ ...base, appearance: "auto" }} disabled={disabled}>
          <option value="">— Select —</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
          style={{ ...base, ...(disabled ? { opacity: 0.5 } : {}) }}
          onFocus={e => e.target.style.borderColor = "#E8A525"} onBlur={e => e.target.style.borderColor = "#1E2538"} />
      )}
    </div>
  );
}

// ─── NEW LOAD MODAL ─────────────────────────────────────────────────────────
function NewLoadModal({ customers, suppliers, onClose, onSave }) {
  const [f, setF] = useState({ customerId: "", supplierId: "", fuelType: "", gallons: "", buyPrice: "", sellPrice: "", carrier: "", date: today(), deliveryState: "", deliveryType: "commercial" });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const cust = customers.find(c => c.id === f.customerId);

  useEffect(() => { if (cust) { set("deliveryState", cust.state); set("deliveryType", cust.deliveryType); } }, [f.customerId]);

  const gal = parseFloat(f.gallons) || 0;
  const buy = parseFloat(f.buyPrice) || 0;
  const sell = parseFloat(f.sellPrice) || 0;
  const taxes = calcTaxes(f.fuelType, gal, f.deliveryState, f.deliveryType);
  const cost = gal * buy;
  const rev = gal * sell;
  const margin = rev - cost;

  const valid = f.customerId && f.supplierId && f.fuelType && gal > 0 && buy > 0 && sell > 0;

  const save = () => {
    onSave({ id: genId("LD"), ...f, gallons: gal, buyPrice: buy, sellPrice: sell, status: "scheduled", bolNumber: "—", invoiced: false });
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ width: 680, padding: "0 28px 24px" }}>
        <ModalHeader title="New Load / Trade Entry" sub="Enter load details — taxes auto-calculate based on fuel type and delivery state" onClose={onClose} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Customer" value={f.customerId} onChange={v => set("customerId", v)} options={customers.map(c => ({ value: c.id, label: c.name }))} />
          <Field label="Supplier" value={f.supplierId} onChange={v => set("supplierId", v)} options={suppliers.map(s => ({ value: s.id, label: s.name }))} />
          <Field label="Fuel Type" value={f.fuelType} onChange={v => set("fuelType", v)} options={FUEL_TYPES.map(t => ({ value: t, label: t }))} />
          <Field label="Gallons" value={f.gallons} onChange={v => set("gallons", v)} placeholder="e.g. 8500" type="number" />
          <Field label="Buy Price ($/gal)" value={f.buyPrice} onChange={v => set("buyPrice", v)} placeholder="e.g. 2.3400" type="number" />
          <Field label="Sell Price ($/gal)" value={f.sellPrice} onChange={v => set("sellPrice", v)} placeholder="e.g. 2.5200" type="number" />
          <Field label="Delivery State" value={f.deliveryState} onChange={v => set("deliveryState", v)} options={ALL_STATES.map(s => ({ value: s.code, label: `${s.code} — ${s.name}` }))} />
          <Field label="Delivery Type" value={f.deliveryType} onChange={v => set("deliveryType", v)} options={[{ value: "commercial", label: "Commercial" }, { value: "government", label: "Government (Exempt)" }, { value: "export", label: "Export (Exempt)" }, { value: "airline", label: "Airline (Jet-A Exempt)" }]} />
          <Field label="Carrier" value={f.carrier} onChange={v => set("carrier", v)} placeholder="Carrier name" />
          <Field label="Load Date" value={f.date} onChange={v => set("date", v)} type="date" />
        </div>

        {/* Live calculation preview */}
        <div style={{ marginTop: 18, padding: 16, background: "#080C16", borderRadius: 10, border: "1px solid #1E2538" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, textAlign: "center" }}>
            {[
              ["COST", fmt(cost), "#EF4444"], ["REVENUE", fmt(rev), "#10B981"], ["MARGIN", fmt(margin), "#E8A525"], ["MARGIN/GAL", gal > 0 ? fmt4(margin / gal) : "—", "#E8A525"],
              ["TAXES", taxes.exempt ? "EXEMPT" : fmt(taxes.totalTax), taxes.exempt ? "#6B7690" : "#8B5CF6"],
            ].map(([l, v, c], i) => (
              <div key={i}><div style={{ fontSize: 9, color: "#5A647A", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 3 }}>{l}</div><div style={{ ...monoStyle, fontSize: 14, fontWeight: 700, color: c }}>{v}</div></div>
            ))}
          </div>
          {!taxes.exempt && gal > 0 && f.fuelType && f.deliveryState && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#0D1320", borderRadius: 6, fontSize: 11, color: "#5A647A" }}>
              Federal: {fmt4(taxes.federalRate)}/gal = {fmt(taxes.fedTax)} · {STATE_FUEL_TAX[f.deliveryState]?.name || f.deliveryState} State: {fmt4(taxes.stateRate)}/gal = {fmt(taxes.stateTax)}
            </div>
          )}
          {taxes.exempt && <div style={{ marginTop: 8, fontSize: 11, color: "#E8A525", textAlign: "center" }}>Tax exempt: {taxes.exemptReason}</div>}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...btnStyle("transparent", "#6B7690"), border: "1px solid #1E2538" }}>Cancel</button>
          <button onClick={save} disabled={!valid} style={{ ...btnStyle(valid ? "#E8A525" : "#2A303E", valid ? "#06090F" : "#5A647A"), fontWeight: 700, opacity: valid ? 1 : 0.5 }}>Create Load</button>
        </div>
      </div>
    </Overlay>
  );
}

// ─── NEW INVOICE FROM LOAD ──────────────────────────────────────────────────
function NewInvoiceFromLoad({ loads, customers, invoices, onClose, onSave }) {
  const uninvoiced = loads.filter(l => l.status === "delivered" && !invoices.find(i => i.loadId === l.id));
  const [selectedLoadId, setSelectedLoadId] = useState("");
  const load = uninvoiced.find(l => l.id === selectedLoadId);
  const cust = load ? customers.find(c => c.id === load.customerId) : null;
  const taxes = load ? calcTaxes(load.fuelType, load.gallons, load.deliveryState, load.deliveryType) : null;
  const fuelTotal = load ? load.gallons * load.sellPrice : 0;
  const invoiceTotal = fuelTotal + (taxes?.totalTax || 0);

  const save = () => {
    if (!load || !cust) return;
    const lineItems = [
      { desc: `${load.fuelType} — ${fmtN(load.gallons)} gal @ ${fmt4(load.sellPrice)}/gal`, amount: fuelTotal, type: "fuel" },
    ];
    if (taxes.totalTax > 0) {
      lineItems.push({ desc: `Federal Excise Tax (${fmt4(taxes.federalRate)}/gal × ${fmtN(load.gallons)})`, amount: taxes.fedTax, type: "fedtax" });
      lineItems.push({ desc: `${STATE_FUEL_TAX[load.deliveryState]?.name} State Tax (${fmt4(taxes.stateRate)}/gal × ${fmtN(load.gallons)})`, amount: taxes.stateTax, type: "statetax" });
    }
    if (taxes.exempt) lineItems.push({ desc: `Tax Exempt: ${taxes.exemptReason}`, amount: 0, type: "exempt" });
    onSave({
      id: genId("INV"), loadId: load.id, customerId: cust.id, customerName: cust.name,
      date: today(), dueDate: addDays(today(), cust.terms), terms: cust.terms,
      lineItems, subtotal: fuelTotal, fedTax: taxes.fedTax, stateTax: taxes.stateTax,
      totalTax: taxes.totalTax, total: invoiceTotal, paid: 0, status: "outstanding",
      deliveryState: load.deliveryState, fuelType: load.fuelType, gallons: load.gallons,
      taxExempt: taxes.exempt, exemptReason: taxes.exemptReason,
    });
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ width: 620, padding: "0 28px 24px" }}>
        <ModalHeader title="Generate Invoice from Load" sub="Select a delivered, uninvoiced load — taxes auto-apply" onClose={onClose} />
        <Field label="Select Load" value={selectedLoadId} onChange={setSelectedLoadId}
          options={uninvoiced.map(l => ({ value: l.id, label: `${l.id} — ${customers.find(c => c.id === l.customerId)?.name} — ${l.fuelType} ${fmtN(l.gallons)} gal` }))} />

        {load && cust && taxes && (
          <div style={{ marginTop: 16, padding: 18, background: "#080C16", borderRadius: 10, border: "1px solid #1E2538" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 12 }}>Invoice Preview</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, marginBottom: 14 }}>
              <div><span style={{ color: "#5A647A" }}>Customer:</span> <span style={{ color: "#D4DAE3", fontWeight: 500 }}>{cust.name}</span></div>
              <div><span style={{ color: "#5A647A" }}>Terms:</span> <span style={{ color: "#D4DAE3" }}>Net {cust.terms}</span></div>
              <div><span style={{ color: "#5A647A" }}>State:</span> <span style={{ color: "#E8A525", fontWeight: 600 }}>{load.deliveryState}</span></div>
              <div><span style={{ color: "#5A647A" }}>Due Date:</span> <span style={{ color: "#D4DAE3" }}>{addDays(today(), cust.terms)}</span></div>
            </div>
            {/* Line items */}
            <div style={{ borderTop: "1px solid #1E2538", paddingTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: "#D4DAE3", fontSize: 12 }}>{load.fuelType} — {fmtN(load.gallons)} gal @ {fmt4(load.sellPrice)}/gal</span>
                <span style={{ ...monoStyle, fontSize: 12, color: "#D4DAE3" }}>{fmt(fuelTotal)}</span>
              </div>
              {!taxes.exempt && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0 4px 16px", borderLeft: "2px solid #8B5CF644" }}>
                    <span style={{ color: "#8E96A8", fontSize: 11.5 }}>Federal Excise ({fmt4(taxes.federalRate)}/gal)</span>
                    <span style={{ ...monoStyle, fontSize: 11.5, color: "#8B5CF6" }}>{fmt(taxes.fedTax)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0 4px 16px", borderLeft: "2px solid #3B82F644" }}>
                    <span style={{ color: "#8E96A8", fontSize: 11.5 }}>{STATE_FUEL_TAX[load.deliveryState]?.name} State ({fmt4(taxes.stateRate)}/gal)</span>
                    <span style={{ ...monoStyle, fontSize: 11.5, color: "#3B82F6" }}>{fmt(taxes.stateTax)}</span>
                  </div>
                </>
              )}
              {taxes.exempt && (
                <div style={{ padding: "4px 0 4px 16px", fontSize: 11, color: "#E8A525", borderLeft: "2px solid #E8A52544" }}>Tax exempt: {taxes.exemptReason}</div>
              )}
              <div style={{ borderTop: "2px solid #E8A52533", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "#F4F6F9" }}>Invoice Total</span>
                <span style={{ ...monoStyle, fontSize: 16, fontWeight: 700, color: "#E8A525" }}>{fmt(invoiceTotal)}</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...btnStyle("transparent", "#6B7690"), border: "1px solid #1E2538" }}>Cancel</button>
          <button onClick={save} disabled={!load} style={{ ...btnStyle(load ? "#2563EB" : "#2A303E", "#FFF"), fontWeight: 700, opacity: load ? 1 : 0.5 }}>Generate Invoice</button>
        </div>
      </div>
    </Overlay>
  );
}

// ─── INVOICE DETAIL MODAL ───────────────────────────────────────────────────
function InvoiceDetailModal({ invoice: inv, onClose, onPay }) {
  const bal = inv.total - inv.paid;
  return (
    <Overlay onClose={onClose}>
      <div style={{ width: 580, padding: "0 28px 24px" }}>
        <ModalHeader title={`Invoice ${inv.id}`} sub={`${inv.customerName} · ${inv.date} · Due ${inv.dueDate} (Net ${inv.terms})`} onClose={onClose} />
        <div style={{ padding: 18, background: "#080C16", borderRadius: 10, border: "1px solid #1E2538" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, marginBottom: 14 }}>
            <div><span style={{ color: "#5A647A" }}>Load:</span> <span style={{ ...monoStyle, color: "#E8A525" }}>{inv.loadId}</span></div>
            <div><span style={{ color: "#5A647A" }}>State:</span> <span style={{ color: "#E8A525", fontWeight: 600 }}>{inv.deliveryState}</span></div>
            <div><span style={{ color: "#5A647A" }}>Fuel:</span> <span style={{ color: "#D4DAE3" }}>{inv.fuelType}</span></div>
            <div><span style={{ color: "#5A647A" }}>Gallons:</span> <span style={{ ...monoStyle, color: "#D4DAE3" }}>{fmtN(inv.gallons)}</span></div>
          </div>

          {inv.lineItems.map((li, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", paddingLeft: li.type !== "fuel" ? 16 : 0, borderLeft: li.type === "fedtax" ? "2px solid #8B5CF644" : li.type === "statetax" ? "2px solid #3B82F644" : li.type === "exempt" ? "2px solid #E8A52544" : "none" }}>
              <span style={{ color: li.type === "exempt" ? "#E8A525" : li.type === "fuel" ? "#D4DAE3" : "#8E96A8", fontSize: 12 }}>{li.desc}</span>
              {li.amount > 0 && <span style={{ ...monoStyle, fontSize: 12, color: li.type === "fedtax" ? "#8B5CF6" : li.type === "statetax" ? "#3B82F6" : "#D4DAE3" }}>{fmt(li.amount)}</span>}
            </div>
          ))}

          <div style={{ borderTop: "2px solid #E8A52533", marginTop: 10, paddingTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "#5A647A" }}>Subtotal</span><span style={{ ...monoStyle, fontSize: 12 }}>{fmt(inv.subtotal)}</span>
            </div>
            {!inv.taxExempt && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#5A647A" }}>Tax</span><span style={{ ...monoStyle, fontSize: 12, color: "#8B5CF6" }}>{fmt(inv.totalTax)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, paddingTop: 6, borderTop: "1px solid #1E2538" }}>
              <span style={{ fontWeight: 700, color: "#F4F6F9" }}>Total</span><span style={{ ...monoStyle, fontSize: 15, fontWeight: 700, color: "#E8A525" }}>{fmt(inv.total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "#10B981" }}>Paid</span><span style={{ ...monoStyle, fontSize: 12, color: "#10B981" }}>{fmt(inv.paid)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, color: bal > 0 ? "#E8A525" : "#10B981" }}>Balance Due</span>
              <span style={{ ...monoStyle, fontSize: 15, fontWeight: 700, color: bal > 0 ? "#E8A525" : "#10B981" }}>{fmt(bal)}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          {bal > 0 && <button onClick={onPay} style={{ ...btnStyle("rgba(16,185,129,0.15)", "#10B981"), border: "1px solid rgba(16,185,129,0.3)" }}>Record Payment</button>}
          <button onClick={onClose} style={{ ...btnStyle("transparent", "#6B7690"), border: "1px solid #1E2538" }}>Close</button>
        </div>
      </div>
    </Overlay>
  );
}

// ─── RECORD PAYMENT MODAL ───────────────────────────────────────────────────
function RecordPaymentModal({ invoice: inv, onClose, onRecord }) {
  const bal = inv.total - inv.paid;
  const [amount, setAmount] = useState(bal.toFixed(2));
  const [method, setMethod] = useState("ACH");
  const [reference, setReference] = useState("");

  return (
    <Overlay onClose={onClose}>
      <div style={{ width: 440, padding: "0 28px 24px" }}>
        <ModalHeader title="Record Payment" sub={`${inv.id} · ${inv.customerName} · Balance: ${fmt(bal)}`} onClose={onClose} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Amount" value={amount} onChange={setAmount} type="number" placeholder={bal.toFixed(2)} />
          <Field label="Payment Method" value={method} onChange={setMethod} options={[{ value: "ACH", label: "ACH Transfer" }, { value: "Wire", label: "Wire Transfer" }, { value: "Check", label: "Check" }, { value: "Credit Card", label: "Credit Card" }]} />
          <Field label="Reference #" value={reference} onChange={setReference} placeholder="Check #, confirmation #, etc." />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...btnStyle("transparent", "#6B7690"), border: "1px solid #1E2538" }}>Cancel</button>
          <button onClick={() => onRecord(inv.id, parseFloat(amount), method, reference)} style={{ ...btnStyle("#10B981", "#06090F"), fontWeight: 700 }}>Record {fmt(parseFloat(amount) || 0)}</button>
        </div>
      </div>
    </Overlay>
  );
}

// ─── LOAD DETAIL MODAL ──────────────────────────────────────────────────────
function LoadDetailModal({ load, customers, suppliers, onClose }) {
  const cust = customers.find(c => c.id === load.customerId);
  const sup = suppliers.find(s => s.id === load.supplierId);
  const taxes = calcTaxes(load.fuelType, load.gallons, load.deliveryState, load.deliveryType);
  const cost = load.gallons * load.buyPrice;
  const rev = load.gallons * load.sellPrice;
  const margin = rev - cost;

  return (
    <Overlay onClose={onClose}>
      <div style={{ width: 560, padding: "0 28px 24px" }}>
        <ModalHeader title={`Load ${load.id}`} sub={`${load.date} · ${load.fuelType} · `} onClose={onClose} />
        <div style={{ display: "flex", gap: 6, marginBottom: 16, paddingLeft: 28 }}><Badge status={load.status} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 28px", marginBottom: 16 }}>
          {[
            ["Customer", cust?.name], ["Supplier", sup?.name], ["Fuel Type", load.fuelType],
            ["Gallons", fmtN(load.gallons)], ["Buy Price", fmt4(load.buyPrice) + "/gal"],
            ["Sell Price", fmt4(load.sellPrice) + "/gal"], ["Carrier", load.carrier],
            ["BOL #", load.bolNumber], ["Delivery State", load.deliveryState], ["Delivery Type", load.deliveryType],
          ].map(([l, v], i) => (
            <div key={i}><div style={{ ...labelStyle, marginBottom: 2 }}>{l}</div><div style={{ fontSize: 13, color: "#D4DAE3", fontWeight: 500 }}>{v}</div></div>
          ))}
        </div>
        <div style={{ margin: "0 28px", padding: 14, background: "#080C16", borderRadius: 10, border: "1px solid #1E2538", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, textAlign: "center" }}>
          {[["COST", fmt(cost), "#EF4444"], ["REVENUE", fmt(rev), "#10B981"], ["MARGIN", fmt(margin), "#E8A525"], ["TAX", taxes.exempt ? "EXEMPT" : fmt(taxes.totalTax), "#8B5CF6"]].map(([l, v, c], i) => (
            <div key={i}><div style={{ fontSize: 9, color: "#5A647A", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 2 }}>{l}</div><div style={{ ...monoStyle, fontSize: 13, fontWeight: 700, color: c }}>{v}</div></div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 28px", marginTop: 20 }}>
          <button onClick={onClose} style={{ ...btnStyle("transparent", "#6B7690"), border: "1px solid #1E2538" }}>Close</button>
        </div>
      </div>
    </Overlay>
  );
}
