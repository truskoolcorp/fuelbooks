"use client";
import { useState, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL / INVOICE INGESTION MODULE v2 — Avila Prime Fuel Brokerage
// PDF upload → auto-parse → FL tax calc → create AR/AP records w/ PDF attached
// ═══════════════════════════════════════════════════════════════════════════════

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

// ─── FL FUEL TAX ENGINE (matches Avila Prime actual billing) ────────────────
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
  const add = (d, r) => { if (!r) return; const a = +(gal * r).toFixed(2); lines.push({ desc: d, rate: r, amount: a }); envFees += a; };
  add("Federal Excise Tax", rates.fedExcise); add("FED LUST Tax", rates.fedLUST); add("FED Superfund Recovery Fee", rates.fedSuperfund);
  add("FL Pollutant Tax", rates.flPollutant); add("FL State Fuel Tax", rates.flStateTax); add("FL Local Option Tax", rates.flLocalOption); add("FL Inspection Fee", rates.flInspectionFee);
  envFees = +envFees.toFixed(2);
  const netInvoice = +(productCost + envFees).toFixed(2);
  let salesTax = 0;
  if (rates.flSalesTaxRate) {
    const cr = rates.countyRates?.[county] ?? rates.countyRates?.["default"] ?? 0;
    const combined = rates.flSalesTaxRate + cr;
    salesTax = +(netInvoice * combined).toFixed(2);
    lines.push({ desc: `FL Sales Tax (${(rates.flSalesTaxRate*100).toFixed(0)}% + ${(cr*100).toFixed(1)}% county)`, rate: combined, amount: salesTax, isSalesTax: true });
  }
  return { lines, envFees, netInvoice, salesTax, grandTotal: +(netInvoice + salesTax).toFixed(2), productCost };
}

// ─── SMART PARSER ───────────────────────────────────────────────────────────
function identifyFuel(text) {
  const l = text.toLowerCase();
  if (l.includes("dry run")) return { type: "dry_run", label: "Dry Run" };
  if (l.includes("#2 ultra low dyed") || l.includes("dyed 15-ppm") || l.includes("dyed diesel")) return { type: "dyed_diesel", label: "#2 Ultra Low Dyed 15-PPM" };
  if (l.includes("ulsd") || l.includes("ultra low sulfur") || l.includes("#2 diesel")) return { type: "clear_diesel", label: "ULSD" };
  if (l.includes("premium") || l.includes("93 oct")) return { type: "premium", label: "Premium 93" };
  if (l.includes("regular") || l.includes("unleaded") || l.includes("87") || l.includes("gasoline")) return { type: "gasoline", label: "Regular 87" };
  if (l.includes("diesel")) return { type: "clear_diesel", label: "Diesel" };
  return null;
}

function parseDate(s) {
  if (!s) return null;
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
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

  // ── Classify: who issued this? ─────────────────────────────────────────────
  const remitAvila = /remit\s*to[\s\S]{0,30}avila/i.test(text) || (/^avila\s*prime/im.test(text) && lower.includes("invoice"));
  const billToAvila = /bill\s*to[\s\S]{0,80}avila/i.test(text);
  if (remitAvila && !billToAvila) { r.docType = "customer_invoice"; r.direction = "AR"; }
  else if (billToAvila) { r.docType = "supplier_bill"; r.direction = "AP"; }
  else if (lower.includes("please ach or wire payment") && !remitAvila) { r.docType = "supplier_bill"; r.direction = "AP"; }
  else { r.docType = "supplier_bill"; r.direction = "AP"; r.warnings.push("Defaulting to supplier bill (AP)"); }

  // ── Invoice # ──────────────────────────────────────────────────────────────
  for (const p of [/Invoice\s*(?:No|Number|#)[.:]*\s*([A-Z0-9][\w\-]+)/i, /(\d{5,}-IN)/i, /(IN-[\d\-]+)/i]) {
    const m = text.match(p); if (m) { r.invoiceNumber = m[1].trim(); break; }
  }

  // ── Dates ──────────────────────────────────────────────────────────────────
  const datePats = {
    invoiceDate: [/Invoice\s*Date[:\s]*(?:\w{3}\s+)?(\d{1,2}\/\d{1,2}\/\d{4})/i],
    dueDate: [/(?:Invoice\s*)?Due\s*(?:Date|by)[:\s]*(?:\w{3}\s+)?(\d{1,2}\/\d{1,2}\/\d{4})/i],
    deliveryDate: [/Delivery\s*Date[:\s]*(?:\w{3}\s+)?(\d{1,2}\/\d{1,2}\/\d{4})/i],
  };
  for (const [f, pats] of Object.entries(datePats)) { for (const p of pats) { const m = text.match(p); if (m) { r[f] = parseDate(m[1]); break; } } }

  // ── Reference fields ───────────────────────────────────────────────────────
  const refPats = {
    poNumber: [/P\.?O\.?\s*(?:No|Number)?[.:]*\s*([\w\-]+)/i, /Customer\s*PO\s*Number\s*([\w\-\s]+?)(?:\s+Terms|\s+Net|\s+Ship)/i],
    orderNumber: [/Order\s*No[.:]*\s*([\w\-]+)/i],
    referenceNumber: [/Reference\s*No[.:]*\s*([\w\-]+)/i],
    salesOrderNumber: [/Sales\s*Order\s*No[.:]*\s*(\d+)/i],
    accountId: [/Account\s*ID[:\s]*([\w\-]+)/i],
    customerNumber: [/Customer\s*Number[:\s]*([\w\-]+)/i],
    salesperson: [/Salesperson[:\s]*([A-Za-z][\w\s]{1,20}?)(?:\s+Carrier|\s*$|\n)/im],
    carrier: [/Carrier[:\s]*([A-Za-z][\w\s]{1,25}?)(?:\s*$|\n)/im],
    bolNumber: [/BOL\s*(?:No)?[.:]*\s*([\w\-]+)/i],
  };
  for (const [f, pats] of Object.entries(refPats)) { for (const p of pats) { const m = text.match(p); if (m) { r[f] = m[1].trim(); break; } } }

  // ── Parties ────────────────────────────────────────────────────────────────
  if (r.direction === "AP") {
    r.billToName = "Avila Prime Professional Services LLC";
    if (lower.includes("tropic oil")) r.vendorName = "Tropic Oil Company";
    else if (lower.includes("marathon")) r.vendorName = "Marathon Petroleum";
    else if (lower.includes("valero")) r.vendorName = "Valero Energy Corp";
    else if (lower.includes("phillips 66")) r.vendorName = "Phillips 66";
    else if (lower.includes("motiva")) r.vendorName = "Motiva Enterprises";
    // Ship-to location (delivery site)
    const stm = text.match(/Ship\s*To[:\s]*(?:ID:\s*\d+\s*)?([\s\S]*?)(?=Avila|Order|Reference|Salesperson|$)/i);
    if (stm) { const stateM = stm[1].match(/,\s*([A-Z]{2})\s+\d{5}/); if (stateM) r.shipToState = stateM[1]; }
  } else {
    r.vendorName = "Avila Prime Professional Services LLC";
    // Customer is in Ship To
    const stm = text.match(/Ship\s*To[:\s]*(?:\d+\s*)?([\s\S]*?)(?=Customer|Terms|Order|Wrhse|Phone|$)/i);
    if (stm) {
      const stLines = stm[1].split('\n').map(l => l.trim()).filter(l => l.length > 3 && !l.match(/^\d{3}-/));
      r.shipToName = stLines[0]?.replace(/^ID:\s*\d+\s*/, '').trim();
      const stateM = stm[1].match(/,\s*([A-Z]{2})\s+\d{5}/); if (stateM) r.shipToState = stateM[1];
    }
    if (!r.shipToName && lower.includes("thalle")) r.shipToName = "Thalle Construction Co., Inc.";
    // Also check between the header block and Ship To for customer name
    const custBlock = text.match(/(?:^|\n)([\w\s,.]+(?:CO\.|INC\.|LLC|CORP)[\w\s,.]*)\n/i);
    if (custBlock && !custBlock[1].toLowerCase().includes("avila")) r.billToName = custBlock[1].trim();
    else r.billToName = r.shipToName;
  }

  // ── Fuel ───────────────────────────────────────────────────────────────────
  r.fuelInfo = identifyFuel(text);
  if (r.fuelInfo) r.fuelDescription = r.fuelInfo.label;

  // ── Gallons & Price ────────────────────────────────────────────────────────
  // Avila Prime format: "GALS 2,232.2 2,232.2 0.0 2.7804 6,206.41"
  const avilaM = text.match(/GALS?\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+[\d.]+\s+(\d+\.\d{2,6})\s+([\d,]+\.\d{2})/i);
  if (avilaM) { r.gallons = parseFloat(avilaM[2].replace(/,/g,'')); r.unitPrice = parseFloat(avilaM[3]); r.lineTotal = parseFloat(avilaM[4].replace(/,/g,'')); }
  // Tropic Oil format: "1.0000 200.000000 200.00"
  if (!r.gallons) {
    const tropicM = text.match(/([\d,]+\.\d{4})\s+(\d+\.\d{4,8})\s+([\d,]+\.\d{2})/);
    if (tropicM) { r.gallons = parseFloat(tropicM[1].replace(/,/g,'')); r.unitPrice = parseFloat(tropicM[2]); r.lineTotal = parseFloat(tropicM[3].replace(/,/g,'')); }
  }
  if (!r.gallons) { const gm = text.match(/([\d,]+\.?\d*)\s*(?:gal)/i); if (gm) r.gallons = parseFloat(gm[1].replace(/,/g,'')); }

  // ── Extracted tax lines ────────────────────────────────────────────────────
  for (const {p, d} of [
    { p: /FED\s*LUST\s*Tax\s+(\d+\.\d+)\s+([\d,]+\.\d{2})/i, d: "FED LUST Tax" },
    { p: /FED\s*Superfund[\w\s]*\s+(\d+\.\d+)\s+([\d,]+\.\d{2})/i, d: "FED Superfund Recovery Fee" },
    { p: /FL\s*Pollutant\s*Tax\s+(\d+\.\d+)\s+([\d,]+\.\d{2})/i, d: "FL Pollutant Tax" },
  ]) { const m = text.match(p); if (m) r.extractedTaxLines.push({ desc: d, rate: parseFloat(m[1]), amount: parseFloat(m[2].replace(/,/g,'')) }); }

  // ── Totals ─────────────────────────────────────────────────────────────────
  for (const [f, pats] of Object.entries({
    extractedNetInvoice: [/Net\s*Invoice[:\s]*([\d,]+\.\d{2})/i],
    extractedSalesTax: [/Sales\s*Tax[:\s]*([\d,]+\.\d{2})/i],
    invoiceTotal: [/Invoice\s*Total[:\s]*\$?\s*([\d,]+\.\d{2})/i],
  })) { for (const p of pats) { const m = text.match(p); if (m) { r[f] = parseFloat(m[1].replace(/,/g,'')); break; } } }

  // Payment terms
  const termsM = text.match(/Net\s*(\d+)/i); if (termsM) r.paymentTerms = parseInt(termsM[1]);

  // ── Entity matching ────────────────────────────────────────────────────────
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

  // ── Confidence ─────────────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function EmailIngestModule({ customers, suppliers, invoices, onCreateInvoice, onCreateBill, onCreateExpense, onToast }) {
  const [subTab, setSubTab] = useState("ingest");
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [ed, setEd] = useState(null); // editData
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

  const initEdit = (r) => {
    const e = {
      direction: r.direction || "AP",
      entityId: r.matchedEntity?.id || "",
      entityName: r.matchedEntity?.name || r.vendorName || r.shipToName || "",
      invoiceNumber: r.invoiceNumber || "",
      invoiceDate: r.invoiceDate || new Date().toISOString().split("T")[0],
      dueDate: r.dueDate || "",
      deliveryDate: r.deliveryDate || "",
      poNumber: r.poNumber || "",
      orderNumber: r.orderNumber || "",
      referenceNumber: r.referenceNumber || "",
      bolNumber: r.bolNumber || "",
      salesOrderNumber: r.salesOrderNumber || "",
      carrier: r.carrier || "",
      salesperson: r.salesperson || "",
      fuelCategory: r.fuelInfo?.type || "dyed_diesel",
      fuelLabel: r.fuelInfo?.label || r.fuelDescription || "",
      gallons: r.gallons || "",
      unitPrice: r.unitPrice || "",
      lineTotal: r.lineTotal || "",
      shipToState: r.shipToState || "FL",
      county: "Palm Beach",
      netInvoice: r.extractedNetInvoice || "",
      salesTax: r.extractedSalesTax || "",
      invoiceTotal: r.invoiceTotal || "",
      paymentTerms: r.paymentTerms || 30,
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
      if (onToast) onToast("PDF extraction failed — try pasting text manually", "error");
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
      const items = [{ desc: `${ed.fuelLabel||"Fuel"} — ${gal ? fmtN(gal)+" gal" : ""} @ ${price ? fmt4(price)+"/gal" : ""}`, amount: lt, type: "fuel" }];
      if (parsed?.extractedTaxLines?.length) parsed.extractedTaxLines.forEach(tl => { if (!tl.isSalesTax) items.push({ desc: `${tl.desc} (${fmt4(tl.rate)}/gal)`, amount: tl.amount, type: "envtax" }); });
      if (st > 0) items.push({ desc: "FL Sales Tax", amount: st, type: "salestax" });
      onCreateInvoice({ id: record.id, loadId: ed.orderNumber || "INGESTED", customerId: ed.entityId, customerName: ed.entityName, date: ed.invoiceDate, dueDate: ed.dueDate, terms: ed.paymentTerms, lineItems: items, subtotal: lt, fedTax: envTax, stateTax: st, totalTax: envTax + st, total, paid: 0, status: "outstanding", deliveryState: ed.shipToState, fuelType: ed.fuelLabel || "ULSD", gallons: gal, taxExempt: false, pdfUrl, pdfName, sourceInvoiceNumber: ed.invoiceNumber });
    } else if (ed.direction === "AP" && onCreateExpense) {
      onCreateExpense([{ id: genId("EXP"), date: ed.invoiceDate, category: ed.expenseCategory, vendor: ed.entityName, description: `Inv ${ed.invoiceNumber||"—"} · ${ed.fuelLabel||""} ${ed.gallons ? fmtN(parseFloat(ed.gallons))+" gal" : ""} ${ed.carrier ? "via "+ed.carrier : ""}`.trim(), amount: total, loadId: ed.orderNumber || null, pdfUrl, pdfName, sourceInvoiceNumber: ed.invoiceNumber }]);
    }

    setHistory(prev => [record, ...prev]);
    if (onToast) onToast(`${ed.direction === "AR" ? "Invoice" : "Bill"} ${record.id} ingested — ${fmt(total)} · PDF attached`, "success");
    setRawText(""); setParsed(null); setEd(null); setTaxes(null); setPdfUrl(null); setPdfName(null);
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer?.files?.[0]; if (f?.type === "application/pdf") handlePdf(f); };

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div>
      <div style={{ display: "flex", gap: 5, marginBottom: 16 }}>
        {[{ id: "ingest", label: "Ingest Invoice / Bill" }, { id: "history", label: `Ingestion History (${history.length})` }].map(st => (
          <button key={st.id} onClick={() => setSubTab(st.id)} style={{ padding: "5px 14px", borderRadius: 6, border: `1px solid ${subTab === st.id ? "#E8A525" : "#1E2538"}`, background: subTab === st.id ? "rgba(232,165,37,0.1)" : "transparent", color: subTab === st.id ? "#E8A525" : "#6B7690", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{st.label}</button>
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
                <><Ico d={IC.upload} size={32} color="#2A3348" /><div style={{ fontSize: 14, fontWeight: 600, color: "#6B7690", marginTop: 8 }}>Drop PDF invoice or bill here</div><div style={{ fontSize: 11.5, color: "#3D4659", marginTop: 3 }}>Supports supplier bills (Tropic Oil, etc.) & customer invoices (Avila Prime → customer)</div></>
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
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#3B82F6", textDecoration: "none" }}>Open ↗</a>
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
                <div style={{ fontSize: 12, color: "#2A303E", marginTop: 4, maxWidth: 280, lineHeight: 1.5 }}>Auto-detects supplier bills vs customer invoices, extracts all data, calculates FL fuel taxes, and attaches the original PDF.</div>
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
                <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 14 }}>Extracted Data — Review & Confirm</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", ...lblS, marginBottom: 4 }}>Document Type</label>
                    <div style={{ display: "flex", gap: 5 }}>
                      {[["AP", "Supplier Bill (AP)"], ["AR", "Customer Invoice (AR)"]].map(([dir, label]) => (
                        <button key={dir} onClick={() => setEd(p => ({ ...p, direction: dir }))} style={{ flex: 1, padding: "6px", borderRadius: 5, border: `1px solid ${ed.direction === dir ? (dir === "AP" ? "#EF4444" : "#10B981") : "#1E2538"}`, background: ed.direction === dir ? (dir === "AP" ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)") : "transparent", color: ed.direction === dir ? (dir === "AP" ? "#EF4444" : "#10B981") : "#5A647A", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", ...lblS, marginBottom: 4 }}>{ed.direction === "AP" ? "Supplier" : "Customer"}{parsed.matchConfidence > 0 && <span style={{ color: "#10B981", marginLeft: 4, fontSize: 10 }}>✓ matched</span>}</label>
                    <select value={ed.entityId} onChange={e => { const ents = ed.direction === "AP" ? suppliers : customers; const ent = ents.find(x => x.id === e.target.value); setEd(p => ({ ...p, entityId: e.target.value, entityName: ent?.name || p.entityName })); }} style={{ ...inputS, appearance: "auto" }}>
                      <option value="">— Select —</option>
                      {(ed.direction === "AP" ? suppliers : customers).map(e => <option key={e.id} value={e.id}>{e.name}{e.id === parsed.matchedEntity?.id ? " ✓" : ""}</option>)}
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
                <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 14 }}>Product & Pricing</div>
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

              {/* Tax Comparison: Extracted vs Calculated */}
              <div style={cardS}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9" }}>Tax Breakdown</div>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button onClick={() => setEd(p => ({ ...p, useExtracted: true }))} style={{ padding: "3px 10px", borderRadius: 4, border: `1px solid ${ed.useExtracted ? "#E8A525" : "#1E2538"}`, background: ed.useExtracted ? "#E8A52515" : "transparent", color: ed.useExtracted ? "#E8A525" : "#5A647A", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Use PDF Values</button>
                    <button onClick={() => setEd(p => ({ ...p, useExtracted: false }))} style={{ padding: "3px 10px", borderRadius: 4, border: `1px solid ${!ed.useExtracted ? "#3B82F6" : "#1E2538"}`, background: !ed.useExtracted ? "#3B82F615" : "transparent", color: !ed.useExtracted ? "#3B82F6" : "#5A647A", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Use Calculated</button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div style={{ padding: 12, background: "#080C16", borderRadius: 8, border: `1px solid ${ed.useExtracted ? "#E8A52544" : "#1E2538"}` }}>
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
                  <div style={{ padding: 12, background: "#080C16", borderRadius: 8, border: `1px solid ${!ed.useExtracted ? "#3B82F644" : "#1E2538"}` }}>
                    <div style={{ fontSize: 10, color: "#3B82F6", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>Auto-Calculated (FL Engine)</div>
                    {taxes?.lines?.map((tl, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11.5 }}>
                        <span style={{ color: "#8E96A8" }}>{tl.desc}</span>
                        <span style={{ ...monoS, color: tl.isSalesTax ? "#8B5CF6" : "#D4DAE3", fontWeight: 500 }}>{fmt(tl.amount)}</span>
                      </div>
                    )) || <div style={{ fontSize: 11, color: "#3D4659" }}>Enter gallons & price to calculate</div>}
                    {taxes && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 3px", fontSize: 11.5, borderTop: "1px solid #1E2538", marginTop: 4 }}><span style={{ color: "#6B7690" }}>Calculated Total</span><span style={{ ...monoS, color: "#E8A525", fontWeight: 700 }}>{fmt(taxes.grandTotal)}</span></div>}
                  </div>
                </div>
              </div>

              {/* Final totals + create */}
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
                  {ed.invoiceTotal ? ` — ${fmt(parseFloat(ed.invoiceTotal))}` : ""}
                  {pdfName ? " · PDF Attached" : ""}
                </button>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* ── HISTORY ──────────────────────────────────────────────────────────── */}
      {subTab === "history" && (
        history.length === 0 ? (
          <div style={{ ...cardS, padding: 50, textAlign: "center" }}><Ico d={IC.mail} size={36} color="#1E2538" /><div style={{ fontSize: 14, color: "#3D4659", marginTop: 12, fontWeight: 600 }}>No ingested records yet</div></div>
        ) : (
          <div style={{ ...cardS, padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
              <thead><tr style={{ background: "#080C16" }}>{["ID", "Type", "Entity", "Invoice #", "Fuel", "Gallons", "Unit $", "Total", "Date", "PDF", ""].map(h => <th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>{history.map(r => (
                <tr key={r.id}>
                  <td style={{ ...tdS, ...monoS, color: "#E8A525", fontSize: 10.5 }}>{r.id}</td>
                  <td style={tdS}><span style={{ background: r.direction === "AP" ? "#5C1010" : "#064E3B", color: r.direction === "AP" ? "#EF4444" : "#10B981", padding: "2px 7px", borderRadius: 3, fontSize: 9.5, fontWeight: 700 }}>{r.direction}</span></td>
                  <td style={{ ...tdS, color: "#D4DAE3", fontWeight: 500 }}>{r.entityName||"—"}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 10.5, color: "#6B7690" }}>{r.invoiceNumber||"—"}</td>
                  <td style={tdS}>{r.fuelLabel ? <span style={{ background: "#131A29", padding: "1px 6px", borderRadius: 3, fontSize: 10 }}>{r.fuelLabel}</span> : "—"}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#D4DAE3" }}>{r.gallons ? fmtN(parseFloat(r.gallons)) : "—"}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#6B7690" }}>{r.unitPrice ? fmt4(parseFloat(r.unitPrice)) : "—"}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 12, fontWeight: 600, color: r.direction === "AP" ? "#EF4444" : "#10B981" }}>{fmt(parseFloat(r.invoiceTotal))}</td>
                  <td style={{ ...tdS, color: "#6B7690" }}>{r.invoiceDate}</td>
                  <td style={tdS}>{r.pdfUrl ? <button onClick={() => setViewPdf(r)} style={{ background: "rgba(232,165,37,0.1)", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Ico d={IC.clip} size={11} color="#E8A525" /><span style={{ fontSize: 10, color: "#E8A525", fontWeight: 600 }}>PDF</span></button> : "—"}</td>
                  <td style={tdS}><button onClick={() => setViewPdf(r)} style={{ background: "rgba(59,130,246,0.1)", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}><Ico d={IC.eye} size={12} color="#3B82F6" /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )
      )}

      {/* PDF Viewer Modal */}
      {viewPdf && (
        <div onClick={() => setViewPdf(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0D1320", borderRadius: 14, border: "1px solid #1E2538", width: 720, maxHeight: "90vh", overflow: "auto", padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#F4F6F9" }}>{viewPdf.id}</div>
                <div style={{ fontSize: 12, color: "#5A647A", marginTop: 2 }}><span style={{ color: viewPdf.direction === "AP" ? "#EF4444" : "#10B981", fontWeight: 600 }}>{viewPdf.direction}</span>{" · "}{viewPdf.entityName} · {viewPdf.invoiceNumber} · {fmt(parseFloat(viewPdf.invoiceTotal))}</div>
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
