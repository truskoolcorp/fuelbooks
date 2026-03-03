"use client";
import { useState, useRef } from "react";

// EMAIL / INVOICE INGESTION MODULE v3 — Avila Prime Fuel Brokerage
// Fixed parser tuned to actual pdf.js text extraction output
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const fmt4 = (n) => "$" + Number(n).toFixed(4);
const fmtN = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
const genId = (p) => p + "-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
const monoS = { fontFamily: "'IBM Plex Mono', monospace" };
const cardS = { background: "#0D1320", borderRadius: 10, border: "1px solid #161D2E", padding: "18px" };
const lblS = { fontSize: 11, color: "#6B7690", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 };
const thS = { textAlign: "left", padding: "8px 10px", color: "#5A647A", fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" };
const tdS = { padding: "9px 10px", borderBottom: "1px solid #161D2E11", fontSize: 12.5 };
const btnS = (bg, fg) => ({ background: bg, color: fg, border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });
const inputS = { width: "100%", padding: "8px 11px", borderRadius: 6, border: "1px solid #1E2538", background: "#080C16", color: "#D4DAE3", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box", outline: "none" };
const Ico = ({ d, size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const IC = {
  upload: ["M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
  pdf: ["M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8"],
  mail: ["M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z", "M22 6l-10 7L2 6"],
  chk: "M20 6L9 17l-5-5", x: "M18 6L6 18 M6 6l12 12",
  alert: ["M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z", "M12 9v4", "M12 17h.01"],
  eye: ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z", "M12 9a3 3 0 100 6 3 3 0 000-6z"],
  clip: ["M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"],
  srch: ["M11 17.25a6.25 6.25 0 110-12.5 6.25 6.25 0 010 12.5z", "M16 16l4.5 4.5"],
  dl: ["M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
};

// ─── FL FUEL TAX ENGINE ─────────────────────────────────────────────────────
const FL_FUEL_TAXES = {
  dyed_diesel: { fedLUST: 0.001, fedSuperfund: 0.00429, flPollutant: 0.02071, flSalesTaxRate: 0.06, countyRates: { "Palm Beach": 0.01, "Miami-Dade": 0.01, "Broward": 0.01, "Orange": 0.005, "Hendry": 0.01, "default": 0.01 }, label: "#2 Ultra Low Dyed 15-PPM" },
  clear_diesel: { fedExcise: 0.244, fedLUST: 0.001, flStateTax: 0.17, flLocalOption: 0.12, flInspectionFee: 0.00125, flPollutant: 0.02071, label: "ULSD (Clear On-Road)" },
  gasoline: { fedExcise: 0.184, fedLUST: 0.001, flStateTax: 0.1295, flLocalOption: 0.12, flInspectionFee: 0.00125, flPollutant: 0.02071, label: "Regular 87" },
  premium: { fedExcise: 0.184, fedLUST: 0.001, flStateTax: 0.1295, flLocalOption: 0.12, flInspectionFee: 0.00125, flPollutant: 0.02071, label: "Premium 93" },
  dry_run: { label: "Dry Run / No Fuel" },
};

function calcFLTaxes(cat, gal, county, price) {
  const rates = FL_FUEL_TAXES[cat];
  if (!rates || cat === "dry_run") { const c = +(gal * price).toFixed(2); return { lines: [], envFees: 0, netInvoice: c, salesTax: 0, grandTotal: c, productCost: c }; }
  const productCost = +(gal * price).toFixed(2);
  const lines = []; let envFees = 0;
  const add = (d, rt) => { if (!rt) return; const a = +(gal * rt).toFixed(2); lines.push({ desc: d, rate: rt, amount: a }); envFees += a; };
  add("Federal Excise Tax", rates.fedExcise); add("FED LUST Tax", rates.fedLUST); add("FED Superfund Recovery Fee", rates.fedSuperfund);
  add("FL Pollutant Tax", rates.flPollutant); add("FL State Fuel Tax", rates.flStateTax); add("FL Local Option Tax", rates.flLocalOption); add("FL Inspection Fee", rates.flInspectionFee);
  envFees = +envFees.toFixed(2);
  const netInvoice = +(productCost + envFees).toFixed(2);
  let salesTax = 0;
  if (rates.flSalesTaxRate) {
    const cr = rates.countyRates?.[county] ?? rates.countyRates?.["default"] ?? 0;
    const combined = rates.flSalesTaxRate + cr;
    salesTax = +(netInvoice * combined).toFixed(2);
    lines.push({ desc: "FL Sales Tax (" + (rates.flSalesTaxRate*100).toFixed(0) + "% + " + (cr*100).toFixed(1) + "% county)", rate: combined, amount: salesTax, isSalesTax: true });
  }
  return { lines, envFees, netInvoice, salesTax, grandTotal: +(netInvoice + salesTax).toFixed(2), productCost };
}

// ─── SMART PARSER v3 — handles pdf.js extraction quirks ─────────────────────
function identifyFuel(text) {
  const l = text.toLowerCase();
  if (l.includes("dry run")) return { type: "dry_run", label: "Dry Run" };
  if (l.includes("ultra low dyed") || l.includes("dyed 15-ppm") || l.includes("dyed diesel") || l.includes("#2 ultra low d")) return { type: "dyed_diesel", label: "#2 Ultra Low Dyed 15-PPM" };
  if (l.includes("ulsd") || l.includes("ultra low sulfur") || l.includes("#2 diesel")) return { type: "clear_diesel", label: "ULSD" };
  if (l.includes("premium") || l.includes("93 oct")) return { type: "premium", label: "Premium 93" };
  if (l.includes("regular") || l.includes("unleaded") || l.includes("87") || l.includes("gasoline")) return { type: "gasoline", label: "Regular 87" };
  if (l.includes("diesel")) return { type: "clear_diesel", label: "Diesel" };
  return null;
}

function parseDate(s) {
  if (!s) return null;
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + "-" + m[1].padStart(2,'0') + "-" + m[2].padStart(2,'0');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

// Helper: find all dollar amounts in text
function findAmounts(text) {
  const amounts = [];
  const re = /\$?\s?([\d,]+\.\d{2})\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (v > 0) amounts.push(v);
  }
  return amounts;
}

// Helper: find all numbers that look like gallons (1000-50000 range, with decimals)
function findGallons(text) {
  const re = /([\d,]+\.\d{1,2})\b/g;
  const candidates = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (v >= 100 && v <= 99999 && m[1].includes(',')) candidates.push(v);
  }
  return candidates;
}

// Helper: find all numbers that look like per-gallon prices ($1-$10 range, 4+ decimals)
function findUnitPrices(text) {
  const re = /(\d+\.\d{4,6})\b/g;
  const candidates = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const v = parseFloat(m[1]);
    if (v >= 0.5 && v <= 15) candidates.push(v);
  }
  return candidates;
}

function parseInvoicePDF(text, customers, suppliers) {
  const r = {
    docType: null, direction: null,
    invoiceNumber: null, invoiceDate: null, dueDate: null, deliveryDate: null,
    poNumber: null, orderNumber: null, referenceNumber: null, bolNumber: null,
    salesOrderNumber: null, accountId: null, customerNumber: null,
    salesperson: null, carrier: null,
    vendorName: null, billToName: null, shipToName: null, shipToState: "FL",
    fuelInfo: null, fuelDescription: null,
    gallons: null, unitPrice: null, lineTotal: null,
    extractedTaxLines: [], extractedNetInvoice: null, extractedSalesTax: null,
    invoiceTotal: null, paymentTerms: null,
    matchedEntity: null, matchConfidence: 0,
    confidence: 0, warnings: [], rawText: text,
  };
  if (!text || text.length < 20) { r.warnings.push("Insufficient text"); return r; }
  const lower = text.toLowerCase();

  // ── CLASSIFY: who issued this document? ────────────────────────────────────
  // pdf.js may output "Ship Via: ... Avila Prime Remit To:" or "Remit To: Avila Prime"
  // Key insight: if "Remit To" and "Avila Prime" are both present and near each other,
  // Avila Prime issued this invoice (AR). If "Bill To" references Avila Prime, it's AP.
  const hasRemitTo = lower.includes("remit to");
  const hasAvilaPrime = lower.includes("avila prime");
  const hasBillTo = lower.includes("bill to");

  // Check if Avila Prime is near Remit To (within 120 chars either direction)
  const remitAvila = hasRemitTo && hasAvilaPrime && (
    /remit\s*to[\s\S]{0,120}avila\s*prime/i.test(text) ||
    /avila\s*prime[\s\S]{0,120}remit\s*to/i.test(text)
  );
  // Check if Bill To explicitly references Avila Prime
  const billToAvila = hasBillTo && hasAvilaPrime && /bill\s*to[\s\S]{0,120}avila\s*prime/i.test(text);

  if (remitAvila && !billToAvila) {
    r.docType = "customer_invoice"; r.direction = "AR";
  } else if (billToAvila && !remitAvila) {
    r.docType = "supplier_bill"; r.direction = "AP";
  } else if (lower.includes("please ach or wire payment") && !remitAvila) {
    r.docType = "supplier_bill"; r.direction = "AP";
  } else if (hasAvilaPrime && hasRemitTo) {
    // If both present and not clearly bill-to, assume AR (Avila Prime issued it)
    r.docType = "customer_invoice"; r.direction = "AR";
  } else {
    r.docType = "supplier_bill"; r.direction = "AP";
    r.warnings.push("Defaulting to supplier bill (AP)");
  }

  // ── INVOICE NUMBER ─────────────────────────────────────────────────────────
  // Avila Prime format: "0006314-IN" (digits-IN)
  // Tropic Oil format: "IN-096738-26" (IN-digits)
  for (const p of [
    /(\d{5,}-IN)\b/i,                            // 0006314-IN
    /(IN-[\d\-]+)/i,                              // IN-096738-26
    /Invoice\s*(?:No|Number|#)[.:]*\s*([A-Z0-9][\w\-]+)/i,  // generic
  ]) {
    const m = text.match(p);
    if (m) { r.invoiceNumber = m[1].trim(); break; }
  }

  // ── DATES ──────────────────────────────────────────────────────────────────
  // Handle: "Invoice Date" then date, "Invoice Due Date 03/21/2026", "Delivery Date"
  // pdf.js may put the label and value far apart or adjacent
  const allDates = [];
  const dateRe = /(\d{1,2}\/\d{1,2}\/\d{4})/g;
  let dm;
  while ((dm = dateRe.exec(text)) !== null) allDates.push({ val: dm[1], idx: dm.index });

  // Try labeled dates first
  const invDateM = text.match(/Invoice\s*Date[:\s]*(?:\w{3}\s+)?(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (invDateM) r.invoiceDate = parseDate(invDateM[1]);

  const dueDateM = text.match(/(?:Invoice\s*)?Due\s*Date[:\s]*(?:\w{3}\s+)?(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (dueDateM) r.dueDate = parseDate(dueDateM[1]);

  const delDateM = text.match(/Delivery\s*Date[:\s]*(?:\w{3}\s+)?(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (delDateM) r.deliveryDate = parseDate(delDateM[1]);

  // Fallback: if no invoice date found, use first date in document
  if (!r.invoiceDate && allDates.length > 0) r.invoiceDate = parseDate(allDates[0].val);
  // If no due date, try to find one after "Due" keyword
  if (!r.dueDate) {
    const dueIdx = lower.indexOf("due");
    if (dueIdx >= 0) {
      const afterDue = allDates.find(d => d.idx > dueIdx);
      if (afterDue) r.dueDate = parseDate(afterDue.val);
    }
  }

  // ── REFERENCE FIELDS ───────────────────────────────────────────────────────
  const refPats = {
    poNumber: [/P\.?O\.?\s*(?:No|Number)?[.:]*\s*([\w\-]+)/i, /Customer\s*PO\s*Number[\s\S]{0,30}?([\w\-]+\s+CONTRACT[\w\s]+?)(?=\s+Net|\s+Terms)/i, /(\d+-\d+\s+CONTRACT\s+\w+)/i],
    orderNumber: [/Order\s*No[.:]*\s*([\w\-]+)/i],
    salesOrderNumber: [/Sales\s*Order\s*No[.:]*\s*(\d+)/i],
    accountId: [/Account\s*ID[:\s]*([\w\-]+)/i],
    customerNumber: [/Customer\s*Number[\s\S]{0,20}?(\d{2}-\d{5,})/i],
    salesperson: [/Salesperson[:\s]*([A-Za-z][\w\s]{1,20}?)(?:\s+Carrier|\s+Customer|\s*$)/im],
    carrier: [/Carrier[:\s]*([A-Za-z][\w\s]{1,25}?)(?:\s*$|\n)/im],
    bolNumber: [/BOL\s*(?:No)?[.:]*\s*([\w\-]+)/i],
  };
  for (const [f, pats] of Object.entries(refPats)) {
    for (const p of pats) {
      const m = text.match(p);
      if (m) { r[f] = m[1].trim(); break; }
    }
  }

  // ── PARTIES ────────────────────────────────────────────────────────────────
  if (r.direction === "AP") {
    // Supplier bill: vendor is whoever is NOT Avila Prime
    r.billToName = "Avila Prime Professional Services LLC";
    if (lower.includes("tropic oil")) r.vendorName = "Tropic Oil Company";
    else if (lower.includes("valero")) r.vendorName = "Valero Energy Corp";
    else if (lower.includes("phillips 66")) r.vendorName = "Phillips 66";
    else if (lower.includes("motiva")) r.vendorName = "Motiva Enterprises";
    else if (lower.includes("marathon petroleum")) r.vendorName = "Marathon Petroleum";
    // Ship-to for delivery state
    const stateM = text.match(/(?:South Bay|Miami|Orlando|Tampa|Jacksonville),\s*FL/i);
    if (stateM) r.shipToState = "FL";
  } else {
    // Customer invoice (AR): Avila Prime issued it, customer is Ship To
    r.vendorName = "Avila Prime Professional Services LLC";
    // Look for company names that are NOT Avila Prime
    if (lower.includes("thalle construction")) { r.shipToName = "Thalle Construction Co., Inc."; r.billToName = r.shipToName; }
    else if (lower.includes("gulf coast")) { r.shipToName = "Gulf Coast Distributors"; r.billToName = r.shipToName; }
    else {
      // Try to find Ship To entity
      const stm = text.match(/Ship\s*To[:\s]*(?:\d+\s*)?([\s\S]*?)(?=Customer|Terms|Order|Wrhse|Phone|Avila|$)/i);
      if (stm) {
        const stLines = stm[1].split(/[\n\s]{2,}/).map(l => l.trim()).filter(l => l.length > 3 && !l.match(/^\d{3}-/) && !l.toLowerCase().includes("avila"));
        if (stLines[0]) { r.shipToName = stLines[0].replace(/^ID:\s*\d+\s*/, '').trim(); r.billToName = r.shipToName; }
      }
    }
    // Extract state from address
    const stateM = text.match(/(?:South Bay|Miami|Orlando|Tampa|Jacksonville)[,\s]+([A-Z]{2})\s+\d{5}/i);
    if (stateM) r.shipToState = stateM[1];
    else if (lower.includes(", fl ")) r.shipToState = "FL";
  }

  // ── FUEL TYPE ──────────────────────────────────────────────────────────────
  r.fuelInfo = identifyFuel(text);
  if (r.fuelInfo) r.fuelDescription = r.fuelInfo.label;

  // ── GALLONS, UNIT PRICE, LINE TOTAL ────────────────────────────────────────
  // pdf.js scrambles table columns. We use multiple strategies:

  // Strategy 1: Standard format "GALS 2,232.2 2,232.2 0.0 2.7804 6,206.41"
  const avilaM = text.match(/GALS?\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+[\d.]+\s+(\d+\.\d{2,6})\s+([\d,]+\.\d{2})/i);
  if (avilaM) {
    r.gallons = parseFloat(avilaM[2].replace(/,/g,''));
    r.unitPrice = parseFloat(avilaM[3]);
    r.lineTotal = parseFloat(avilaM[4].replace(/,/g,''));
  }

  // Strategy 2: pdf.js scrambled "GALS C01 6,206.41 2.7804 2,232.2 2.0 2,232.2"
  if (!r.gallons) {
    const scrambledM = text.match(/GALS?\s+\w+\s+([\d,]+\.\d{2})\s+(\d+\.\d{4,6})\s+([\d,]+\.\d{1,2})\s+[\d.]+\s+([\d,]+\.\d{1,2})/i);
    if (scrambledM) {
      r.lineTotal = parseFloat(scrambledM[1].replace(/,/g,''));
      r.unitPrice = parseFloat(scrambledM[2]);
      r.gallons = parseFloat(scrambledM[3].replace(/,/g,''));
    }
  }

  // Strategy 3: Look near GALS keyword for gallon-like and price-like numbers
  if (!r.gallons) {
    const galsIdx = lower.indexOf("gals");
    if (galsIdx >= 0) {
      const vicinity = text.substring(Math.max(0, galsIdx - 20), galsIdx + 200);
      const gallonCandidates = findGallons(vicinity);
      const priceCandidates = findUnitPrices(vicinity);
      if (gallonCandidates.length > 0) r.gallons = gallonCandidates[0];
      if (priceCandidates.length > 0) {
        // Find the price that's NOT part of the total per-gallon (e.g. 2.80640)
        const unitP = priceCandidates.find(p => p < 5);
        if (unitP) r.unitPrice = unitP;
      }
    }
  }

  // Strategy 4: Tropic Oil format "1.0000 200.000000 200.00"
  if (!r.gallons) {
    const tropicM = text.match(/([\d,]+\.\d{4})\s+(\d+\.\d{4,8})\s+([\d,]+\.\d{2})/);
    if (tropicM) {
      r.gallons = parseFloat(tropicM[1].replace(/,/g,''));
      r.unitPrice = parseFloat(tropicM[2]);
      r.lineTotal = parseFloat(tropicM[3].replace(/,/g,''));
    }
  }

  // Calculate line total if we have gallons + price
  if (r.gallons && r.unitPrice && !r.lineTotal) {
    r.lineTotal = +(r.gallons * r.unitPrice).toFixed(2);
  }

  // ── EXTRACTED TAX LINES ────────────────────────────────────────────────────
  for (const {p, d} of [
    { p: /FED\s*LUST\s*Tax\s+(\d+\.\d+)\s+([\d,]+\.\d{2})/i, d: "FED LUST Tax" },
    { p: /FED\s*Superfund[\w\s]*\s+(\d+\.\d+)\s+([\d,]+\.\d{2})/i, d: "FED Superfund Recovery Fee" },
    { p: /FL\s*Pollutant\s*Tax\s+(\d+\.\d+)\s+([\d,]+\.\d{2})/i, d: "FL Pollutant Tax" },
  ]) {
    const m = text.match(p);
    if (m) r.extractedTaxLines.push({ desc: d, rate: parseFloat(m[1]), amount: parseFloat(m[2].replace(/,/g,'')) });
  }

  // ── TOTALS ─────────────────────────────────────────────────────────────────
  const netM = text.match(/Net\s*Invoice[:\s]*([\d,]+\.\d{2})/i);
  if (netM) r.extractedNetInvoice = parseFloat(netM[1].replace(/,/g,''));

  const stM = text.match(/Sales\s*Tax[:\s]*([\d,]+\.\d{2})/i);
  if (stM) r.extractedSalesTax = parseFloat(stM[1].replace(/,/g,''));

  const totalM = text.match(/Invoice\s*Total[:\s]*\$?\s*([\d,]+\.\d{2})/i);
  if (totalM) r.invoiceTotal = parseFloat(totalM[1].replace(/,/g,''));

  // Payment terms
  const termsM = text.match(/Net\s*(\d+)/i);
  if (termsM) r.paymentTerms = parseInt(termsM[1]);

  // ── ENTITY MATCHING ────────────────────────────────────────────────────────
  const searchName = r.direction === "AP" ? r.vendorName : (r.shipToName || r.billToName);
  const entities = r.direction === "AP" ? suppliers : customers;
  if (searchName && entities) {
    let best = null, bestS = 0;
    entities.forEach(e => {
      const en = e.name.toLowerCase(), sn = (searchName||"").toLowerCase();
      let s = 0;
      if (sn.includes(en) || en.includes(sn)) s = 100;
      else en.split(/\s+/).forEach(w => { if (w.length > 2 && sn.includes(w)) s += w.length * 3; });
      if (s > bestS) { bestS = s; best = e; }
    });
    if (best && bestS > 10) { r.matchedEntity = best; r.matchConfidence = Math.min(100, bestS); }
  }

  // ── CONFIDENCE ─────────────────────────────────────────────────────────────
  let c = 0;
  if (r.invoiceNumber) c += 10; if (r.invoiceDate) c += 10; if (r.invoiceTotal) c += 20;
  if (r.gallons) c += 15; if (r.unitPrice) c += 10; if (r.fuelInfo) c += 10;
  if (r.matchedEntity) c += 15; if (r.docType) c += 5; if (r.extractedTaxLines.length) c += 5;
  r.confidence = Math.min(100, c);
  if (!r.invoiceTotal) r.warnings.push("Could not extract invoice total");
  if (!r.gallons) r.warnings.push("Could not extract gallon quantity");
  if (!r.fuelInfo) r.warnings.push("Could not identify fuel type");
  if (!r.matchedEntity) r.warnings.push("No matching entity in system");
  return r;
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function EmailIngestModule({ customers, suppliers, invoices, onCreateInvoice, onCreateBill, onCreateExpense, onToast }) {
  const [subTab, setSubTab] = useState("ingest");
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [ed, setEd] = useState(null);
  const [history, setHistory] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfName, setPdfName] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [taxes, setTaxes] = useState(null);
  const [viewPdf, setViewPdf] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const doRecalc = (cat, gal, county, price) => {
    if (gal && price) setTaxes(calcFLTaxes(cat, parseFloat(gal), county, parseFloat(price)));
  };

  const initEdit = (result) => {
    const e = {
      direction: result.direction || "AP",
      entityId: result.matchedEntity?.id || "",
      entityName: result.matchedEntity?.name || result.vendorName || result.shipToName || "",
      invoiceNumber: result.invoiceNumber || "",
      invoiceDate: result.invoiceDate || new Date().toISOString().split("T")[0],
      dueDate: result.dueDate || "",
      deliveryDate: result.deliveryDate || "",
      poNumber: result.poNumber || "",
      orderNumber: result.orderNumber || "",
      referenceNumber: result.referenceNumber || "",
      bolNumber: result.bolNumber || "",
      salesOrderNumber: result.salesOrderNumber || "",
      carrier: result.carrier || "",
      salesperson: result.salesperson || "",
      fuelCategory: result.fuelInfo?.type || "dyed_diesel",
      fuelLabel: result.fuelInfo?.label || result.fuelDescription || "",
      gallons: result.gallons || "",
      unitPrice: result.unitPrice || "",
      lineTotal: result.lineTotal || "",
      shipToState: result.shipToState || "FL",
      county: "Palm Beach",
      netInvoice: result.extractedNetInvoice || "",
      salesTax: result.extractedSalesTax || "",
      invoiceTotal: result.invoiceTotal || "",
      paymentTerms: result.paymentTerms || 30,
      expenseCategory: "Fuel Purchase (AP)",
      useExtracted: true,
    };
    setEd(e);
    if (e.gallons && e.unitPrice) doRecalc(e.fuelCategory, e.gallons, e.county, e.unitPrice);
  };

  const handlePdf = async (file) => {
    setPdfName(file.name);
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    setIsExtracting(true);
    setParsed(null); setEd(null); setTaxes(null);
    try {
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      let txt = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i);
        const c = await pg.getTextContent();
        txt += c.items.map(x => x.str).join(" ") + "\n";
      }
      setRawText(txt);
      setIsExtracting(false);
      const result = parseInvoicePDF(txt, customers, suppliers);
      setParsed(result);
      initEdit(result);
    } catch (err) {
      console.error("PDF extraction error:", err);
      setIsExtracting(false);
      if (onToast) onToast("PDF extraction failed", "error");
    }
  };

  const handleManualParse = () => {
    const result = parseInvoicePDF(rawText, customers, suppliers);
    setParsed(result); initEdit(result);
  };

  const createRecord = () => {
    if (!ed) return;
    const total = parseFloat(ed.invoiceTotal) || 0;
    const record = { id: genId(ed.direction === "AR" ? "INV" : "BILL"), source: "pdf-ingest", pdfUrl, pdfName, ...ed, createdAt: new Date().toISOString() };

    if (ed.direction === "AR" && onCreateInvoice) {
      const gal = parseFloat(ed.gallons) || 0;
      const price = parseFloat(ed.unitPrice) || 0;
      const lt = parseFloat(ed.lineTotal) || gal * price;
      const st = parseFloat(ed.salesTax) || 0;
      const envTax = parsed?.extractedTaxLines?.reduce((s, t) => s + (t.amount||0), 0) || (taxes?.envFees||0);
      const items = [{ desc: (ed.fuelLabel||"Fuel") + " \u2014 " + (gal ? fmtN(gal)+" gal" : "") + " @ " + (price ? fmt4(price)+"/gal" : ""), amount: lt, type: "fuel" }];
      if (parsed?.extractedTaxLines?.length) parsed.extractedTaxLines.forEach(tl => { if (!tl.isSalesTax) items.push({ desc: tl.desc + " (" + fmt4(tl.rate) + "/gal)", amount: tl.amount, type: "envtax" }); });
      if (st > 0) items.push({ desc: "FL Sales Tax", amount: st, type: "salestax" });
      onCreateInvoice({ id: record.id, loadId: ed.orderNumber || "INGESTED", customerId: ed.entityId, customerName: ed.entityName, date: ed.invoiceDate, dueDate: ed.dueDate, terms: ed.paymentTerms, lineItems: items, subtotal: lt, fedTax: envTax, stateTax: st, totalTax: envTax + st, total, paid: 0, status: "outstanding", deliveryState: ed.shipToState, fuelType: ed.fuelLabel || "ULSD", gallons: gal, taxExempt: false, pdfUrl, pdfName, sourceInvoiceNumber: ed.invoiceNumber });
    } else if (ed.direction === "AP" && onCreateExpense) {
      onCreateExpense([{ id: genId("EXP"), date: ed.invoiceDate, category: ed.expenseCategory, vendor: ed.entityName, description: ("Inv " + (ed.invoiceNumber||"\u2014") + " \u00B7 " + (ed.fuelLabel||"") + " " + (ed.gallons ? fmtN(parseFloat(ed.gallons))+" gal" : "") + " " + (ed.carrier ? "via "+ed.carrier : "")).trim(), amount: total, loadId: ed.orderNumber || null, pdfUrl, pdfName, sourceInvoiceNumber: ed.invoiceNumber }]);
    }

    setHistory(prev => [record, ...prev]);
    if (onToast) onToast((ed.direction === "AR" ? "Invoice" : "Bill") + " " + record.id + " ingested \u2014 " + fmt(total) + " \u00B7 PDF attached", "success");
    setRawText(""); setParsed(null); setEd(null); setTaxes(null); setPdfUrl(null); setPdfName(null);
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer?.files?.[0]; if (f?.type === "application/pdf") handlePdf(f); };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div>
      <div style={{ display: "flex", gap: 5, marginBottom: 16 }}>
        {[{ id: "ingest", label: "Ingest Invoice / Bill" }, { id: "history", label: "Ingestion History (" + history.length + ")" }].map(st => (
          <button key={st.id} onClick={() => setSubTab(st.id)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid " + (subTab === st.id ? "#E8A525" : "#1E2538"), background: subTab === st.id ? "rgba(232,165,37,0.1)" : "transparent", color: subTab === st.id ? "#E8A525" : "#6B7690", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{st.label}</button>
        ))}
      </div>

      {subTab === "ingest" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
          {/* LEFT: Upload */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()}
              style={{ ...cardS, cursor: "pointer", borderColor: dragOver ? "#E8A525" : pdfName ? "#10B981" : "#1E2538", borderStyle: "dashed", borderWidth: 2, textAlign: "center", padding: "28px 18px", transition: "border-color 0.2s", background: dragOver ? "rgba(232,165,37,0.03)" : "#0D1320" }}>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handlePdf(e.target.files[0]); }} />
              {isExtracting ? (
                <><div style={{ fontSize: 14, fontWeight: 600, color: "#3B82F6", marginBottom: 4 }}>Extracting text from PDF...</div><div style={{ fontSize: 12, color: "#5A647A" }}>Processing with pdf.js</div></>
              ) : pdfName ? (
                <><div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}><Ico d={IC.chk} size={18} color="#10B981" /><span style={{ fontSize: 14, fontWeight: 600, color: "#10B981" }}>PDF Loaded</span></div><div style={{ ...monoS, fontSize: 12, color: "#D4DAE3" }}>{pdfName}</div><div style={{ fontSize: 11, color: "#5A647A", marginTop: 4 }}>Click or drop to replace</div></>
              ) : (
                <><Ico d={IC.upload} size={32} color="#2A3348" /><div style={{ fontSize: 14, fontWeight: 600, color: "#6B7690", marginTop: 8 }}>Drop PDF invoice or bill here</div><div style={{ fontSize: 11.5, color: "#3D4659", marginTop: 3 }}>Supports supplier bills &amp; customer invoices</div></>
              )}
            </div>
            <div style={cardS}>
              <div style={{ fontWeight: 600, fontSize: 12, color: "#6B7690", marginBottom: 8 }}>Or paste email / invoice text</div>
              <textarea value={rawText} onChange={e => { setRawText(e.target.value); setParsed(null); setEd(null); setTaxes(null); }} placeholder="Paste email body, invoice text, or forwarded bill..."
                style={{ ...inputS, height: 140, resize: "vertical", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, lineHeight: 1.5 }} />
              <button onClick={handleManualParse} disabled={!rawText.trim()} style={{ ...btnS(rawText.trim() ? "#E8A525" : "#2A303E", rawText.trim() ? "#06090F" : "#5A647A"), marginTop: 8, fontWeight: 700, opacity: rawText.trim() ? 1 : 0.5, display: "flex", alignItems: "center", gap: 6 }}>
                <Ico d={IC.srch} size={13} color={rawText.trim() ? "#06090F" : "#5A647A"} /> Parse Text
              </button>
            </div>
            {pdfUrl && (
              <div style={cardS}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#F4F6F9", display: "flex", alignItems: "center", gap: 6 }}><Ico d={IC.clip} size={14} color="#E8A525" /> Attached PDF Preview</div>
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#3B82F6", textDecoration: "none" }}>Open in tab</a>
                </div>
                <iframe src={pdfUrl} style={{ width: "100%", height: 300, border: "1px solid #1E2538", borderRadius: 6, background: "#FFF" }} title="PDF Preview" />
              </div>
            )}
          </div>

          {/* RIGHT: Parsed results */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {!parsed && !isExtracting && (
              <div style={{ ...cardS, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, textAlign: "center" }}>
                <Ico d={IC.pdf} size={44} color="#1E2538" />
                <div style={{ fontSize: 14, color: "#3D4659", marginTop: 14, fontWeight: 600 }}>Upload a PDF or paste invoice text</div>
                <div style={{ fontSize: 12, color: "#2A303E", marginTop: 4, maxWidth: 280, lineHeight: 1.5 }}>Auto-detects supplier bills vs customer invoices. FL fuel taxes auto-calculated.</div>
              </div>
            )}

            {parsed && ed && (<>
              {/* Confidence */}
              <div style={cardS}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#F4F6F9" }}>{ed.direction === "AP" ? "Supplier Bill (AP)" : "Customer Invoice (AR)"}</span>
                    <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: ed.direction === "AP" ? "#5C1010" : "#064E3B", color: ed.direction === "AP" ? "#EF4444" : "#10B981" }}>{ed.direction === "AP" ? "Avila Prime Owes Supplier" : "Customer Owes Avila Prime"}</span>
                  </div>
                  <span style={{ ...monoS, fontSize: 12, fontWeight: 700, color: parsed.confidence >= 70 ? "#10B981" : parsed.confidence >= 40 ? "#E8A525" : "#EF4444" }}>{parsed.confidence}%</span>
                </div>
                <div style={{ height: 5, background: "#1E2538", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: parsed.confidence + "%", background: parsed.confidence >= 70 ? "#10B981" : parsed.confidence >= 40 ? "#E8A525" : "#EF4444", borderRadius: 3 }} /></div>
                {parsed.warnings.length > 0 && <div style={{ marginTop: 8 }}>{parsed.warnings.map((w, i) => <div key={i} style={{ fontSize: 10.5, color: "#E8A525", padding: "1px 0", display: "flex", alignItems: "center", gap: 5 }}><Ico d={IC.alert} size={11} color="#E8A525" /> {w}</div>)}</div>}
              </div>

              {/* Editable fields */}
              <div style={cardS}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 14 }}>Extracted Data</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", ...lblS, marginBottom: 4 }}>Document Type</label>
                    <div style={{ display: "flex", gap: 5 }}>
                      {[["AP", "Supplier Bill (AP)"], ["AR", "Customer Invoice (AR)"]].map(([dir, label]) => (
                        <button key={dir} onClick={() => setEd(p => ({ ...p, direction: dir }))} style={{ flex: 1, padding: "6px", borderRadius: 5, border: "1px solid " + (ed.direction === dir ? (dir === "AP" ? "#EF4444" : "#10B981") : "#1E2538"), background: ed.direction === dir ? (dir === "AP" ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)") : "transparent", color: ed.direction === dir ? (dir === "AP" ? "#EF4444" : "#10B981") : "#5A647A", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", ...lblS, marginBottom: 4 }}>{ed.direction === "AP" ? "Supplier" : "Customer"}{parsed.matchConfidence > 0 && <span style={{ color: "#10B981", marginLeft: 4, fontSize: 10 }}>matched</span>}</label>
                    <select value={ed.entityId} onChange={e => { const ents = ed.direction === "AP" ? suppliers : customers; const ent = ents.find(x => x.id === e.target.value); setEd(p => ({ ...p, entityId: e.target.value, entityName: ent?.name || p.entityName })); }} style={{ ...inputS, appearance: "auto" }}>
                      <option value="">Select or type</option>
                      {(ed.direction === "AP" ? suppliers : customers).map(e => <option key={e.id} value={e.id}>{e.name}{e.id === parsed.matchedEntity?.id ? " \u2713" : ""}</option>)}
                    </select>
                    {!ed.entityId && ed.entityName && <div style={{ fontSize: 10, color: "#E8A525", marginTop: 3 }}>Detected: {ed.entityName}</div>}
                  </div>
                  {[["Invoice #", "invoiceNumber"], ["Invoice Date", "invoiceDate", "date"], ["Due Date", "dueDate", "date"], ["PO #", "poNumber"], ["Order #", "orderNumber"], ["BOL #", "bolNumber"], ["Carrier", "carrier"], ["Salesperson", "salesperson"]].map(([label, key, type]) => (
                    <div key={key}><label style={{ display: "block", ...lblS, marginBottom: 4 }}>{label}</label>
                      <input type={type||"text"} value={ed[key]||""} onChange={e => setEd(p => ({ ...p, [key]: e.target.value }))} style={inputS} /></div>
                  ))}
                </div>
              </div>

              {/* Product & Pricing */}
              <div style={cardS}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 14 }}>Product &amp; Pricing</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                  <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>Fuel Type</label>
                    <select value={ed.fuelCategory} onChange={e => { setEd(p => ({ ...p, fuelCategory: e.target.value, fuelLabel: FL_FUEL_TAXES[e.target.value]?.label || "" })); doRecalc(e.target.value, ed.gallons, ed.county, ed.unitPrice); }} style={{ ...inputS, appearance: "auto" }}>
                      {Object.entries(FL_FUEL_TAXES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select></div>
                  <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>Gallons</label>
                    <input type="number" step="0.1" value={ed.gallons} onChange={e => { const g = e.target.value; setEd(p => ({ ...p, gallons: g, lineTotal: (parseFloat(g) * parseFloat(p.unitPrice||0)).toFixed(2) })); doRecalc(ed.fuelCategory, g, ed.county, ed.unitPrice); }} style={{ ...inputS, ...monoS }} /></div>
                  <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>$/Gallon</label>
                    <input type="number" step="0.0001" value={ed.unitPrice} onChange={e => { const pr = e.target.value; setEd(p => ({ ...p, unitPrice: pr, lineTotal: (parseFloat(p.gallons||0) * parseFloat(pr)).toFixed(2) })); doRecalc(ed.fuelCategory, ed.gallons, ed.county, pr); }} style={{ ...inputS, ...monoS }} /></div>
                  <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>Product Total</label>
                    <input type="text" value={ed.lineTotal ? fmt(parseFloat(ed.lineTotal)) : ""} readOnly style={{ ...inputS, ...monoS, color: "#10B981", fontWeight: 600 }} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>Delivery State</label>
                    <select value={ed.shipToState} onChange={e => setEd(p => ({ ...p, shipToState: e.target.value }))} style={{ ...inputS, appearance: "auto" }}>
                      {["FL", "TX", "GA", "NC", "LA", "OK", "AZ"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select></div>
                  <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>County (FL sales tax)</label>
                    <select value={ed.county} onChange={e => { setEd(p => ({ ...p, county: e.target.value })); doRecalc(ed.fuelCategory, ed.gallons, e.target.value, ed.unitPrice); }} style={{ ...inputS, appearance: "auto" }}>
                      {["Palm Beach", "Miami-Dade", "Broward", "Orange", "Hendry"].map(c => <option key={c} value={c}>{c}</option>)}
                    </select></div>
                </div>
              </div>

              {/* Tax Comparison */}
              <div style={cardS}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9" }}>Tax Breakdown</div>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button onClick={() => setEd(p => ({ ...p, useExtracted: true }))} style={{ padding: "3px 10px", borderRadius: 4, border: "1px solid " + (ed.useExtracted ? "#E8A525" : "#1E2538"), background: ed.useExtracted ? "#E8A52515" : "transparent", color: ed.useExtracted ? "#E8A525" : "#5A647A", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Use PDF Values</button>
                    <button onClick={() => setEd(p => ({ ...p, useExtracted: false }))} style={{ padding: "3px 10px", borderRadius: 4, border: "1px solid " + (!ed.useExtracted ? "#3B82F6" : "#1E2538"), background: !ed.useExtracted ? "#3B82F615" : "transparent", color: !ed.useExtracted ? "#3B82F6" : "#5A647A", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Use Calculated</button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div style={{ padding: 12, background: "#080C16", borderRadius: 8, border: "1px solid " + (ed.useExtracted ? "#E8A52544" : "#1E2538") }}>
                    <div style={{ fontSize: 10, color: "#E8A525", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>Extracted from PDF</div>
                    {parsed.extractedTaxLines.length > 0 ? parsed.extractedTaxLines.map((tl, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11.5 }}>
                        <span style={{ color: "#8E96A8" }}>{tl.desc} ({fmt4(tl.rate)}/gal)</span>
                        <span style={{ ...monoS, color: "#D4DAE3", fontWeight: 500 }}>{fmt(tl.amount)}</span>
                      </div>
                    )) : <div style={{ fontSize: 11, color: "#3D4659" }}>No env tax lines extracted</div>}
                    {parsed.extractedSalesTax > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 3px", fontSize: 11.5, borderTop: "1px solid #1E2538", marginTop: 4 }}><span style={{ color: "#8B5CF6" }}>Sales Tax</span><span style={{ ...monoS, color: "#8B5CF6", fontWeight: 600 }}>{fmt(parsed.extractedSalesTax)}</span></div>}
                    {parsed.extractedNetInvoice && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 3px", fontSize: 11.5, borderTop: "1px solid #1E2538", marginTop: 4 }}><span style={{ color: "#6B7690" }}>Net Invoice</span><span style={{ ...monoS, color: "#D4DAE3", fontWeight: 600 }}>{fmt(parsed.extractedNetInvoice)}</span></div>}
                  </div>
                  <div style={{ padding: 12, background: "#080C16", borderRadius: 8, border: "1px solid " + (!ed.useExtracted ? "#3B82F644" : "#1E2538") }}>
                    <div style={{ fontSize: 10, color: "#3B82F6", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>Auto-Calculated (FL Engine)</div>
                    {taxes?.lines?.map((tl, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11.5 }}>
                        <span style={{ color: "#8E96A8" }}>{tl.desc}</span>
                        <span style={{ ...monoS, color: tl.isSalesTax ? "#8B5CF6" : "#D4DAE3", fontWeight: 500 }}>{fmt(tl.amount)}</span>
                      </div>
                    )) || <div style={{ fontSize: 11, color: "#3D4659" }}>Enter gallons &amp; price to calculate</div>}
                    {taxes && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 3px", fontSize: 11.5, borderTop: "1px solid #1E2538", marginTop: 4 }}><span style={{ color: "#6B7690" }}>Calculated Total</span><span style={{ ...monoS, color: "#E8A525", fontWeight: 700 }}>{fmt(taxes.grandTotal)}</span></div>}
                  </div>
                </div>
              </div>

              {/* Totals + Create */}
              <div style={cardS}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 14 }}>Invoice Total</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>Net Invoice</label><input type="number" value={ed.netInvoice} onChange={e => setEd(p => ({ ...p, netInvoice: e.target.value }))} style={{ ...inputS, ...monoS }} /></div>
                  <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>Sales Tax</label><input type="number" value={ed.salesTax} onChange={e => setEd(p => ({ ...p, salesTax: e.target.value }))} style={{ ...inputS, ...monoS, color: "#8B5CF6" }} /></div>
                  <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>Invoice Total</label><input type="number" value={ed.invoiceTotal} onChange={e => setEd(p => ({ ...p, invoiceTotal: e.target.value }))} style={{ ...inputS, ...monoS, fontSize: 15, fontWeight: 700, color: "#E8A525" }} /></div>
                </div>
                {ed.direction === "AP" && <div style={{ marginTop: 10 }}><label style={{ display: "block", ...lblS, marginBottom: 4 }}>Expense Category</label><select value={ed.expenseCategory} onChange={e => setEd(p => ({ ...p, expenseCategory: e.target.value }))} style={{ ...inputS, appearance: "auto", maxWidth: 300 }}>{["Fuel Purchase (AP)", "Carrier Freight", "Dry Run Fee", "Demurrage", "Environmental Fee", "Other"].map(c => <option key={c} value={c}>{c}</option>)}</select></div>}
                <button onClick={createRecord} disabled={!ed.invoiceTotal} style={{ ...btnS(ed.invoiceTotal ? (ed.direction === "AP" ? "#EF4444" : "#10B981") : "#2A303E", "#FFF"), marginTop: 16, fontWeight: 700, width: "100%", padding: "12px", fontSize: 13, opacity: ed.invoiceTotal ? 1 : 0.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Ico d={IC.chk} size={16} color="#FFF" />
                  {ed.direction === "AP" ? "Create Supplier Bill (AP)" : "Create Customer Invoice (AR)"}
                  {ed.invoiceTotal ? " \u2014 " + fmt(parseFloat(ed.invoiceTotal)) : ""}
                  {pdfName ? " \u00B7 PDF Attached" : ""}
                </button>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* HISTORY */}
      {subTab === "history" && (
        history.length === 0 ? (
          <div style={{ ...cardS, padding: 50, textAlign: "center" }}><Ico d={IC.mail} size={36} color="#1E2538" /><div style={{ fontSize: 14, color: "#3D4659", marginTop: 12, fontWeight: 600 }}>No ingested records yet</div></div>
        ) : (
          <div style={{ ...cardS, padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
              <thead><tr style={{ background: "#080C16" }}>{["ID", "Type", "Entity", "Invoice #", "Fuel", "Gallons", "Unit $", "Total", "Date", "PDF", ""].map(h => <th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>{history.map(rec => (
                <tr key={rec.id}>
                  <td style={{ ...tdS, ...monoS, color: "#E8A525", fontSize: 10.5 }}>{rec.id}</td>
                  <td style={tdS}><span style={{ background: rec.direction === "AP" ? "#5C1010" : "#064E3B", color: rec.direction === "AP" ? "#EF4444" : "#10B981", padding: "2px 7px", borderRadius: 3, fontSize: 9.5, fontWeight: 700 }}>{rec.direction}</span></td>
                  <td style={{ ...tdS, color: "#D4DAE3", fontWeight: 500 }}>{rec.entityName||"\u2014"}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 10.5, color: "#6B7690" }}>{rec.invoiceNumber||"\u2014"}</td>
                  <td style={tdS}>{rec.fuelLabel ? <span style={{ background: "#131A29", padding: "1px 6px", borderRadius: 3, fontSize: 10 }}>{rec.fuelLabel}</span> : "\u2014"}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#D4DAE3" }}>{rec.gallons ? fmtN(parseFloat(rec.gallons)) : "\u2014"}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#6B7690" }}>{rec.unitPrice ? fmt4(parseFloat(rec.unitPrice)) : "\u2014"}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 12, fontWeight: 600, color: rec.direction === "AP" ? "#EF4444" : "#10B981" }}>{fmt(parseFloat(rec.invoiceTotal))}</td>
                  <td style={{ ...tdS, color: "#6B7690" }}>{rec.invoiceDate}</td>
                  <td style={tdS}>{rec.pdfUrl ? <button onClick={() => setViewPdf(rec)} style={{ background: "rgba(232,165,37,0.1)", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Ico d={IC.clip} size={11} color="#E8A525" /><span style={{ fontSize: 10, color: "#E8A525", fontWeight: 600 }}>PDF</span></button> : "\u2014"}</td>
                  <td style={tdS}><button onClick={() => setViewPdf(rec)} style={{ background: "rgba(59,130,246,0.1)", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}><Ico d={IC.eye} size={12} color="#3B82F6" /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )
      )}

      {/* PDF Modal */}
      {viewPdf && (
        <div onClick={() => setViewPdf(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0D1320", borderRadius: 14, border: "1px solid #1E2538", width: 720, maxHeight: "90vh", overflow: "auto", padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#F4F6F9" }}>{viewPdf.id}</div>
                <div style={{ fontSize: 12, color: "#5A647A", marginTop: 2 }}><span style={{ color: viewPdf.direction === "AP" ? "#EF4444" : "#10B981", fontWeight: 600 }}>{viewPdf.direction}</span>{" \u00B7 "}{viewPdf.entityName} {" \u00B7 "} {viewPdf.invoiceNumber} {" \u00B7 "} {fmt(parseFloat(viewPdf.invoiceTotal))}</div>
              </div>
              <button onClick={() => setViewPdf(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><Ico d={IC.x} size={18} color="#5A647A" /></button>
            </div>
            {viewPdf.pdfUrl ? <iframe src={viewPdf.pdfUrl} style={{ width: "100%", height: 550, border: "1px solid #1E2538", borderRadius: 8, background: "#FFF" }} title="PDF" /> : <div style={{ padding: 40, textAlign: "center", color: "#3D4659" }}>No PDF attached</div>}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <span style={{ fontSize: 11, color: "#5A647A" }}>{viewPdf.pdfName||"No file"}</span>
              {viewPdf.pdfUrl && <a href={viewPdf.pdfUrl} download={viewPdf.pdfName} style={{ fontSize: 11, color: "#3B82F6", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}><Ico d={IC.dl} size={12} color="#3B82F6" /> Download</a>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
