"use client";
import { useState } from "react";
import { disconnectedFinance } from "../lib/finance-contract.mjs";
import "./finance.css";
const modules = [
  { id: "overview", name: "Overview", description: "Verified project finance will appear here after a secure, read-only source is connected." },
  { id: "loads", name: "Loads & trades", description: "Delivery records need verified customer, supplier and project links before they can support financial reports." },
  { id: "invoices", name: "Invoices & payments", description: "Invoice totals, balances and payments require complete source records. A delivered load is not evidence of an invoice or payment." },
  { id: "customers", name: "Customers & projects", description: "Customer and project identities must be explicitly verified. Similar names or addresses do not establish a project match." },
  { id: "suppliers", name: "Suppliers & expenses", description: "Supplier bills and payments require durable records and source documents. They are not available in this workspace." },
  { id: "reports", name: "Reports & tax", description: "No verified ledger or approved tax rules are connected. Financial and tax reports are unavailable." },
  { id: "documents", name: "Invoice documents", description: "Document ingestion is unavailable until secure document storage, review and duplicate controls are in place." },
];
export default function FuelBooksApp() {
  const [selected, setSelected] = useState("overview");
  // Static export: no authenticated gateway. Never put private records in public
  // HTML, accept browser-supplied finance, or seed business examples.
  const state = disconnectedFinance();
  const current = modules.find(item => item.id === selected);
  return <div className="finance-shell">
    <aside className="finance-sidebar">
      <a className="finance-brand" href="#main"><img src="/fuelbooks-mark.svg" alt="FuelBooks by Tru Skool" width="38" height="38" /><div>FuelBooks <small>AP Fuel USA · by Tru Skool</small></div></a>
      <p className="finance-nav-label">Workspace</p>
      <nav aria-label="Finance sections">{modules.map(item => <button key={item.id} type="button" className={selected === item.id ? "selected" : ""} aria-current={selected === item.id ? "page" : undefined} onClick={() => setSelected(item.id)}>{item.name}</button>)}</nav>
      <div className="finance-sidebar-note">Read-only integration preparation<br /><strong>No financial actions enabled</strong></div>
    </aside>
    <main id="main" className="finance-main">
      <header className="finance-header"><div><p className="finance-eyebrow">FuelBooks</p><h1>{current.name}</h1></div><span className="finance-status">Source not connected</span></header>
      <section className="finance-notice" aria-labelledby="source-heading"><div className="finance-notice-icon" aria-hidden="true">!</div><div><h2 id="source-heading">Verified financial data is unavailable</h2><p>{state.message}</p><p>Keep using QuickBooks for accounting. No connection, import or replacement has been completed here.</p></div></section>
      {selected === "overview" && <section className="finance-metrics" aria-label="Financial data availability">{["Invoiced", "Outstanding balance", "Payments received", "Net income"].map(label => <article className="finance-card finance-metric" key={label}><h2>{label}</h2><p>Unavailable</p><small>Verified source required</small></article>)}</section>}
      <section className="finance-card finance-section"><p className="finance-eyebrow">{current.name}</p><h2>Waiting for a verified source</h2><p>{current.description}</p><div className="finance-empty"><span aria-hidden="true">▤</span><h3>No verified records loaded</h3><p>This does not mean there are no transactions or that the balance is zero.</p></div></section>
      <section className="finance-card finance-section"><h2>What is needed to enable this view</h2><ol><li>A secure server connection with the existing AP Fuel finance access checks.</li><li>Confirmed company and project identities, with source records and timestamps.</li><li>Complete, reconciled financial records before showing balances or totals.</li></ol><p className="finance-footnote">Financial writes, payroll, invoice sending, uploads and tax calculations remain unavailable in this build.</p></section>
    </main>
  </div>;
}
