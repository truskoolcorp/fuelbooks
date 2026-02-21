"use client";
import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// PAYROLL MODULE — Employee mgmt, pay runs, tax withholdings, payroll history
// ═══════════════════════════════════════════════════════════════════════════════

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const fmtN = (n) => new Intl.NumberFormat("en-US").format(n);
const pct = (n) => (n * 100).toFixed(1) + "%";
const genId = (p) => p + "-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();

const monoS = { fontFamily: "'IBM Plex Mono', monospace" };
const cardS = { background: "#0D1320", borderRadius: 10, border: "1px solid #161D2E", padding: "18px" };
const lblS = { fontSize: 11, color: "#6B7690", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 };
const thS = { textAlign: "left", padding: "8px 10px", color: "#5A647A", fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" };
const tdS = { padding: "9px 10px", borderBottom: "1px solid #161D2E11", fontSize: 12.5 };
const btnS = (bg, fg) => ({ background: bg, color: fg, border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });

const Ico = ({ d, size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
  </svg>
);

const Badge = ({ status }) => {
  const m = { active: ["#10B981", "#064E3B"], inactive: ["#6B7690", "#2A2F3D"], completed: ["#10B981", "#064E3B"], draft: ["#E8A525", "#5C3D0A"], processing: ["#3B82F6", "#1E3A5F"] };
  const [c, bg] = m[status] || m.active;
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 20, background: bg, color: c, fontSize: 10.5, fontWeight: 600, textTransform: "capitalize" }}>{status}</span>;
};

// ─── PAYROLL TAX ENGINE ─────────────────────────────────────────────────────
const FEDERAL_TAX_BRACKETS_2026 = [
  { min: 0, max: 11925, rate: 0.10 },
  { min: 11925, max: 48475, rate: 0.12 },
  { min: 48475, max: 103350, rate: 0.22 },
  { min: 103350, max: 197300, rate: 0.24 },
  { min: 197300, max: 250525, rate: 0.32 },
  { min: 250525, max: 626350, rate: 0.35 },
  { min: 626350, max: Infinity, rate: 0.37 },
];

const STATE_INCOME_TAX = {
  TX: { rate: 0, name: "Texas" }, FL: { rate: 0, name: "Florida" },
  NV: { rate: 0, name: "Nevada" }, WA: { rate: 0, name: "Washington" },
  CA: { rate: 0.0930, name: "California" }, NY: { rate: 0.0685, name: "New York" },
  OK: { rate: 0.0475, name: "Oklahoma" }, LA: { rate: 0.0425, name: "Louisiana" },
  AZ: { rate: 0.025, name: "Arizona" }, NM: { rate: 0.049, name: "New Mexico" },
  AR: { rate: 0.044, name: "Arkansas" }, GA: { rate: 0.055, name: "Georgia" },
  MS: { rate: 0.05, name: "Mississippi" }, CO: { rate: 0.044, name: "Colorado" },
};

const SS_RATE = 0.062;
const SS_WAGE_CAP = 168600;
const MEDICARE_RATE = 0.0145;
const MEDICARE_SURTAX_RATE = 0.009;
const MEDICARE_SURTAX_THRESHOLD = 200000;
const STANDARD_DEDUCTION_2026 = 15700;

function calcFederalWithholding(annualGross, filingStatus = "single") {
  const taxableIncome = Math.max(0, annualGross - STANDARD_DEDUCTION_2026);
  let tax = 0;
  for (const bracket of FEDERAL_TAX_BRACKETS_2026) {
    if (taxableIncome <= bracket.min) break;
    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }
  return tax;
}

function calcPayrollTaxes(grossPay, annualGross, ytdGross, state, filingStatus) {
  const annualFedTax = calcFederalWithholding(annualGross, filingStatus);
  const periodsPerYear = annualGross / grossPay || 1;
  const fedWithholding = annualFedTax / periodsPerYear;

  const ssWageRemaining = Math.max(0, SS_WAGE_CAP - ytdGross);
  const ssGross = Math.min(grossPay, ssWageRemaining);
  const ssTax = ssGross * SS_RATE;

  const medicareTax = grossPay * MEDICARE_RATE;
  const medicareSurtax = (ytdGross + grossPay) > MEDICARE_SURTAX_THRESHOLD
    ? Math.max(0, Math.min(grossPay, (ytdGross + grossPay) - MEDICARE_SURTAX_THRESHOLD)) * MEDICARE_SURTAX_RATE : 0;

  const stateRate = STATE_INCOME_TAX[state]?.rate || 0;
  const stateTax = grossPay * stateRate;

  const totalDeductions = fedWithholding + ssTax + medicareTax + medicareSurtax + stateTax;
  const netPay = grossPay - totalDeductions;

  return {
    grossPay, fedWithholding, ssTax, medicareTax, medicareSurtax, stateTax, stateRate,
    totalDeductions, netPay, effectiveRate: grossPay > 0 ? totalDeductions / grossPay : 0,
  };
}

// ─── INITIAL DATA ───────────────────────────────────────────────────────────
const DEPARTMENTS = ["Operations", "Sales", "Finance", "Logistics", "Admin", "IT"];
const PAY_FREQUENCIES = [
  { value: "weekly", label: "Weekly (52/yr)", periods: 52 },
  { value: "biweekly", label: "Bi-Weekly (26/yr)", periods: 26 },
  { value: "semimonthly", label: "Semi-Monthly (24/yr)", periods: 24 },
  { value: "monthly", label: "Monthly (12/yr)", periods: 12 },
];

const initEmployees = [
  { id: "EMP-001", name: "Marcus Johnson", role: "Operations Manager", department: "Operations", payType: "salary", payRate: 85000, filingStatus: "single", state: "TX", startDate: "2024-03-15", active: true, ytdGross: 13461.54, ytdFedTax: 1354.65, ytdSS: 834.62, ytdMedicare: 195.19 },
  { id: "EMP-002", name: "Lisa Tran", role: "Fuel Trader", department: "Sales", payType: "salary", payRate: 92000, filingStatus: "married", state: "TX", startDate: "2024-06-01", active: true, ytdGross: 14569.23, ytdFedTax: 1263.80, ytdSS: 903.29, ytdMedicare: 211.25 },
  { id: "EMP-003", name: "Derek Williams", role: "Dispatch Coordinator", department: "Logistics", payType: "hourly", payRate: 28.50, filingStatus: "single", state: "TX", startDate: "2025-01-10", active: true, ytdGross: 8892.00, ytdFedTax: 711.70, ytdSS: 551.30, ytdMedicare: 128.93 },
  { id: "EMP-004", name: "Amanda Foster", role: "Accounts Receivable", department: "Finance", payType: "salary", payRate: 62000, filingStatus: "single", state: "TX", startDate: "2025-04-20", active: true, ytdGross: 9538.46, ytdFedTax: 834.51, ytdSS: 591.38, ytdMedicare: 138.31 },
  { id: "EMP-005", name: "Carlos Mendez", role: "CDL Driver / Carrier Liaison", department: "Logistics", payType: "hourly", payRate: 32.00, filingStatus: "married", state: "TX", startDate: "2024-08-12", active: true, ytdGross: 10240.00, ytdFedTax: 614.40, ytdSS: 634.88, ytdMedicare: 148.48 },
  { id: "EMP-006", name: "Jennifer Park", role: "Admin Assistant", department: "Admin", payType: "hourly", payRate: 22.00, filingStatus: "single", state: "TX", startDate: "2025-09-01", active: true, ytdGross: 6864.00, ytdFedTax: 549.12, ytdSS: 425.57, ytdMedicare: 99.53 },
];

const initPayHistory = [
  {
    id: "PR-001", periodStart: "2026-01-27", periodEnd: "2026-02-09", payDate: "2026-02-14", frequency: "biweekly", status: "completed",
    entries: initEmployees.filter(e => e.active).map(emp => {
      const gross = emp.payType === "salary" ? emp.payRate / 26 : emp.payRate * 80;
      const taxes = calcPayrollTaxes(gross, emp.payType === "salary" ? emp.payRate : emp.payRate * 2080, emp.ytdGross - gross, emp.state, emp.filingStatus);
      return { employeeId: emp.id, employeeName: emp.name, hoursWorked: emp.payType === "hourly" ? 80 : null, ...taxes };
    }),
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAYROLL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function PayrollModule({ onExpenseCreate, onToast }) {
  const [subTab, setSubTab] = useState("overview");
  const [employees, setEmployees] = useState(initEmployees);
  const [payHistory, setPayHistory] = useState(initPayHistory);
  const [modal, setModal] = useState(null);

  const activeEmps = employees.filter(e => e.active);

  const totals = useMemo(() => {
    const annualPayroll = activeEmps.reduce((s, e) => s + (e.payType === "salary" ? e.payRate : e.payRate * 2080), 0);
    const ytdGross = activeEmps.reduce((s, e) => s + e.ytdGross, 0);
    const ytdFedTax = activeEmps.reduce((s, e) => s + e.ytdFedTax, 0);
    const ytdSS = activeEmps.reduce((s, e) => s + e.ytdSS, 0);
    const ytdMedicare = activeEmps.reduce((s, e) => s + e.ytdMedicare, 0);
    const lastRun = payHistory[payHistory.length - 1];
    const lastRunTotal = lastRun ? lastRun.entries.reduce((s, e) => s + e.grossPay, 0) : 0;
    const lastRunNet = lastRun ? lastRun.entries.reduce((s, e) => s + e.netPay, 0) : 0;
    return { annualPayroll, ytdGross, ytdFedTax, ytdSS, ytdMedicare, lastRunTotal, lastRunNet, headcount: activeEmps.length };
  }, [activeEmps, payHistory]);

  const runPayroll = (periodStart, periodEnd, payDate, frequency, hourEntries) => {
    const freqData = PAY_FREQUENCIES.find(f => f.value === frequency);
    const entries = activeEmps.map(emp => {
      const hours = hourEntries?.[emp.id] || (emp.payType === "hourly" ? 80 : null);
      const gross = emp.payType === "salary" ? emp.payRate / freqData.periods : emp.payRate * (hours || 0);
      const annualGross = emp.payType === "salary" ? emp.payRate : emp.payRate * 2080;
      const taxes = calcPayrollTaxes(gross, annualGross, emp.ytdGross, emp.state, emp.filingStatus);
      return { employeeId: emp.id, employeeName: emp.name, hoursWorked: hours, ...taxes };
    });

    const newRun = { id: genId("PR"), periodStart, periodEnd, payDate, frequency, status: "completed", entries };
    setPayHistory(prev => [...prev, newRun]);

    // Update YTD on employees
    setEmployees(prev => prev.map(emp => {
      const entry = entries.find(e => e.employeeId === emp.id);
      if (!entry) return emp;
      return {
        ...emp,
        ytdGross: emp.ytdGross + entry.grossPay,
        ytdFedTax: emp.ytdFedTax + entry.fedWithholding,
        ytdSS: emp.ytdSS + entry.ssTax,
        ytdMedicare: emp.ytdMedicare + entry.medicareTax,
      };
    }));

    // Create expense entries for P&L integration
    const totalGross = entries.reduce((s, e) => s + e.grossPay, 0);
    const totalEmployerSS = entries.reduce((s, e) => s + e.ssTax, 0); // employer matches
    const totalEmployerMedicare = entries.reduce((s, e) => s + e.medicareTax, 0);
    if (onExpenseCreate) {
      onExpenseCreate([
        { id: genId("EXP"), date: payDate, category: "Payroll - Wages", vendor: "Payroll", description: `Payroll ${periodStart} to ${periodEnd}`, amount: totalGross, loadId: null },
        { id: genId("EXP"), date: payDate, category: "Payroll - Employer Taxes", vendor: "IRS / State", description: `Employer payroll taxes ${periodStart} to ${periodEnd}`, amount: totalEmployerSS + totalEmployerMedicare, loadId: null },
      ]);
    }

    if (onToast) onToast(`Payroll processed: ${fmt(totalGross)} gross, ${entries.length} employees`, "success");
    return newRun;
  };

  const subTabs = [
    { id: "overview", label: "Overview" },
    { id: "employees", label: "Employees" },
    { id: "run", label: "Run Payroll" },
    { id: "history", label: "Pay History" },
    { id: "taxes", label: "Tax Summary" },
  ];

  return (
    <div>
      {/* Sub-nav */}
      <div style={{ display: "flex", gap: 5, marginBottom: 16 }}>
        {subTabs.map(st => (
          <button key={st.id} onClick={() => setSubTab(st.id)} style={{ padding: "5px 14px", borderRadius: 6, border: `1px solid ${subTab === st.id ? "#E8A525" : "#1E2538"}`, background: subTab === st.id ? "rgba(232,165,37,0.1)" : "transparent", color: subTab === st.id ? "#E8A525" : "#6B7690", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{st.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => setModal("addEmployee")} style={{ ...btnS("#2563EB", "#FFF"), display: "flex", alignItems: "center", gap: 5, fontSize: 11.5 }}>
          <Ico d="M12 5v14 M5 12h14" size={13} color="#FFF" />Add Employee
        </button>
      </div>

      {subTab === "overview" && <PayrollOverview totals={totals} employees={activeEmps} payHistory={payHistory} />}
      {subTab === "employees" && <EmployeeRoster employees={employees} onEdit={emp => setModal({ type: "editEmployee", emp })} />}
      {subTab === "run" && <RunPayroll employees={activeEmps} onRun={runPayroll} />}
      {subTab === "history" && <PayHistory payHistory={payHistory} onView={run => setModal({ type: "payRunDetail", run })} />}
      {subTab === "taxes" && <PayrollTaxSummary employees={employees} payHistory={payHistory} />}

      {modal === "addEmployee" && <AddEmployeeModal onClose={() => setModal(null)} onSave={emp => { setEmployees(prev => [...prev, emp]); setModal(null); if (onToast) onToast(`Employee ${emp.name} added`); }} />}
      {modal?.type === "editEmployee" && <AddEmployeeModal employee={modal.emp} onClose={() => setModal(null)} onSave={updated => { setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e)); setModal(null); if (onToast) onToast(`${updated.name} updated`); }} />}
      {modal?.type === "payRunDetail" && <PayRunDetailModal run={modal.run} onClose={() => setModal(null)} />}
    </div>
  );
}

// ─── OVERVIEW ───────────────────────────────────────────────────────────────
function PayrollOverview({ totals, employees, payHistory }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Active Employees", val: totals.headcount.toString(), color: "#3B82F6" },
          { label: "Annual Payroll", val: fmt(totals.annualPayroll), color: "#E8A525" },
          { label: "YTD Gross Paid", val: fmt(totals.ytdGross), color: "#10B981" },
          { label: "Last Run (Gross)", val: fmt(totals.lastRunTotal), color: "#8B5CF6" },
        ].map((k, i) => (
          <div key={i} style={cardS}>
            <div style={lblS}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.color, ...monoS, marginTop: 6 }}>{k.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={cardS}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 12 }}>Employee Compensation</div>
          {employees.sort((a, b) => (b.payType === "salary" ? b.payRate : b.payRate * 2080) - (a.payType === "salary" ? a.payRate : a.payRate * 2080)).map(emp => {
            const annual = emp.payType === "salary" ? emp.payRate : emp.payRate * 2080;
            return (
              <div key={emp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #161D2E22" }}>
                <div>
                  <div style={{ fontSize: 12.5, color: "#D4DAE3" }}>{emp.name}</div>
                  <div style={{ fontSize: 10, color: "#5A647A" }}>{emp.role} · {emp.department}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...monoS, fontSize: 12.5, fontWeight: 600, color: "#F4F6F9" }}>{fmt(annual)}<span style={{ fontSize: 10, color: "#5A647A" }}>/yr</span></div>
                  <div style={{ fontSize: 10, color: "#5A647A" }}>{emp.payType === "hourly" ? fmt(emp.payRate) + "/hr" : "Salary"}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={cardS}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 12 }}>YTD Tax Withholdings</div>
          {[
            ["Federal Income Tax", fmt(totals.ytdFedTax), "#EF4444"],
            ["Social Security (Employee)", fmt(totals.ytdSS), "#E8A525"],
            ["Social Security (Employer Match)", fmt(totals.ytdSS), "#E8A525"],
            ["Medicare (Employee)", fmt(totals.ytdMedicare), "#3B82F6"],
            ["Medicare (Employer Match)", fmt(totals.ytdMedicare), "#3B82F6"],
            ["State Income Tax", fmt(0), "#6B7690"],
          ].map(([l, v, c], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #161D2E22" }}>
              <span style={{ fontSize: 12, color: "#8E96A8" }}>{l}</span>
              <span style={{ ...monoS, fontSize: 12, fontWeight: 600, color: c }}>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", borderTop: "2px solid #E8A52533", marginTop: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#F4F6F9" }}>Total Tax Burden</span>
            <span style={{ ...monoS, fontSize: 14, fontWeight: 700, color: "#EF4444" }}>{fmt(totals.ytdFedTax + totals.ytdSS * 2 + totals.ytdMedicare * 2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EMPLOYEE ROSTER ────────────────────────────────────────────────────────
function EmployeeRoster({ employees, onEdit }) {
  return (
    <div style={{ ...cardS, padding: 0, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
        <thead><tr style={{ background: "#080C16" }}>
          {["ID", "Employee", "Role", "Dept", "Pay Type", "Rate", "State", "Filing", "YTD Gross", "Status", ""].map(h => <th key={h} style={thS}>{h}</th>)}
        </tr></thead>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.id}>
              <td style={{ ...tdS, ...monoS, color: "#6B7690", fontSize: 11 }}>{emp.id}</td>
              <td style={{ ...tdS, color: "#D4DAE3", fontWeight: 600 }}>{emp.name}</td>
              <td style={{ ...tdS, color: "#8E96A8" }}>{emp.role}</td>
              <td style={tdS}><span style={{ background: "#131A29", padding: "1px 6px", borderRadius: 3, fontSize: 10 }}>{emp.department}</span></td>
              <td style={tdS}><span style={{ background: emp.payType === "salary" ? "#1E3A5F" : "#3B1D72", color: emp.payType === "salary" ? "#3B82F6" : "#8B5CF6", padding: "2px 7px", borderRadius: 3, fontSize: 10, fontWeight: 600 }}>{emp.payType}</span></td>
              <td style={{ ...tdS, ...monoS, fontSize: 11.5, fontWeight: 600 }}>{emp.payType === "salary" ? fmt(emp.payRate) + "/yr" : fmt(emp.payRate) + "/hr"}</td>
              <td style={tdS}><span style={{ background: "#131A29", padding: "1px 5px", borderRadius: 3, fontSize: 10, fontWeight: 600, color: "#E8A525" }}>{emp.state}</span></td>
              <td style={{ ...tdS, fontSize: 11, color: "#6B7690", textTransform: "capitalize" }}>{emp.filingStatus}</td>
              <td style={{ ...tdS, ...monoS, fontSize: 11.5, color: "#10B981", fontWeight: 600 }}>{fmt(emp.ytdGross)}</td>
              <td style={tdS}><Badge status={emp.active ? "active" : "inactive"} /></td>
              <td style={tdS}><button onClick={() => onEdit(emp)} style={{ background: "rgba(59,130,246,0.1)", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 10, color: "#3B82F6", fontWeight: 600, fontFamily: "inherit" }}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── RUN PAYROLL ────────────────────────────────────────────────────────────
function RunPayroll({ employees, onRun }) {
  const [frequency, setFrequency] = useState("biweekly");
  const [periodStart, setPeriodStart] = useState("2026-02-10");
  const [periodEnd, setPeriodEnd] = useState("2026-02-23");
  const [payDate, setPayDate] = useState("2026-02-28");
  const [hours, setHours] = useState({});
  const [preview, setPreview] = useState(null);

  const freqData = PAY_FREQUENCIES.find(f => f.value === frequency);

  const calcPreview = () => {
    const entries = employees.map(emp => {
      const h = hours[emp.id] || (emp.payType === "hourly" ? 80 : null);
      const gross = emp.payType === "salary" ? emp.payRate / freqData.periods : emp.payRate * (h || 0);
      const annualGross = emp.payType === "salary" ? emp.payRate : emp.payRate * 2080;
      const taxes = calcPayrollTaxes(gross, annualGross, emp.ytdGross, emp.state, emp.filingStatus);
      return { employeeId: emp.id, employeeName: emp.name, role: emp.role, payType: emp.payType, hoursWorked: h, ...taxes };
    });
    setPreview(entries);
  };

  const processPayroll = () => {
    onRun(periodStart, periodEnd, payDate, frequency, hours);
    setPreview(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Config */}
      <div style={cardS}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#F4F6F9", marginBottom: 14 }}>Pay Run Configuration</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>Frequency</label>
            <select value={frequency} onChange={e => setFrequency(e.target.value)} style={{ width: "100%", padding: "8px 11px", borderRadius: 6, border: "1px solid #1E2538", background: "#080C16", color: "#D4DAE3", fontSize: 12, fontFamily: "inherit", appearance: "auto" }}>
              {PAY_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          {[["Period Start", periodStart, setPeriodStart], ["Period End", periodEnd, setPeriodEnd], ["Pay Date", payDate, setPayDate]].map(([label, val, setVal]) => (
            <div key={label}><label style={{ display: "block", ...lblS, marginBottom: 4 }}>{label}</label>
              <input type="date" value={val} onChange={e => setVal(e.target.value)} style={{ width: "100%", padding: "8px 11px", borderRadius: 6, border: "1px solid #1E2538", background: "#080C16", color: "#D4DAE3", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
          ))}
        </div>
      </div>

      {/* Hours entry for hourly employees */}
      {employees.some(e => e.payType === "hourly") && (
        <div style={cardS}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 12 }}>Hours Entry (Hourly Employees)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {employees.filter(e => e.payType === "hourly").map(emp => (
              <div key={emp.id} style={{ padding: 12, background: "#080C16", borderRadius: 8, border: "1px solid #1E2538" }}>
                <div style={{ fontSize: 12.5, color: "#D4DAE3", fontWeight: 500, marginBottom: 2 }}>{emp.name}</div>
                <div style={{ fontSize: 10, color: "#5A647A", marginBottom: 8 }}>{emp.role} · {fmt(emp.payRate)}/hr</div>
                <input type="number" value={hours[emp.id] || 80} onChange={e => setHours({ ...hours, [emp.id]: parseFloat(e.target.value) || 0 })}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 5, border: "1px solid #1E2538", background: "#0D1320", color: "#D4DAE3", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }} />
                <div style={{ fontSize: 10, color: "#5A647A", marginTop: 4 }}>Est. gross: <span style={{ color: "#10B981", ...monoS }}>{fmt(emp.payRate * (hours[emp.id] || 80))}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={calcPreview} style={{ ...btnS("#E8A525", "#06090F"), fontWeight: 700 }}>Preview Payroll</button>
        {preview && <button onClick={processPayroll} style={{ ...btnS("#10B981", "#06090F"), fontWeight: 700 }}>✓ Process & Finalize</button>}
      </div>

      {/* Preview */}
      {preview && (
        <div style={{ ...cardS, padding: 0, overflow: "auto" }}>
          <div style={{ padding: "14px 16px", fontWeight: 700, fontSize: 13, color: "#F4F6F9", borderBottom: "1px solid #161D2E" }}>Payroll Preview — {periodStart} to {periodEnd}</div>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead><tr style={{ background: "#080C16" }}>
              {["Employee", "Type", "Hours", "Gross Pay", "Fed Tax", "SS (6.2%)", "Medicare", "State Tax", "Total Deductions", "Net Pay"].map(h => <th key={h} style={thS}>{h}</th>)}
            </tr></thead>
            <tbody>
              {preview.map(e => (
                <tr key={e.employeeId}>
                  <td style={{ ...tdS, color: "#D4DAE3", fontWeight: 500 }}>{e.employeeName}</td>
                  <td style={tdS}><span style={{ background: e.payType === "salary" ? "#1E3A5F" : "#3B1D72", color: e.payType === "salary" ? "#3B82F6" : "#8B5CF6", padding: "1px 6px", borderRadius: 3, fontSize: 10 }}>{e.payType}</span></td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#6B7690" }}>{e.hoursWorked || "—"}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11.5, fontWeight: 600, color: "#F4F6F9" }}>{fmt(e.grossPay)}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#EF4444" }}>{fmt(e.fedWithholding)}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#E8A525" }}>{fmt(e.ssTax)}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#3B82F6" }}>{fmt(e.medicareTax)}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#6B7690" }}>{fmt(e.stateTax)}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#EF4444", fontWeight: 600 }}>{fmt(e.totalDeductions)}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 12, fontWeight: 700, color: "#10B981" }}>{fmt(e.netPay)}</td>
                </tr>
              ))}
              {/* Totals row */}
              <tr style={{ background: "#080C16" }}>
                <td style={{ ...tdS, fontWeight: 700, color: "#F4F6F9" }} colSpan={3}>TOTALS</td>
                <td style={{ ...tdS, ...monoS, fontSize: 12, fontWeight: 700, color: "#F4F6F9" }}>{fmt(preview.reduce((s, e) => s + e.grossPay, 0))}</td>
                <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#EF4444", fontWeight: 600 }}>{fmt(preview.reduce((s, e) => s + e.fedWithholding, 0))}</td>
                <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#E8A525", fontWeight: 600 }}>{fmt(preview.reduce((s, e) => s + e.ssTax, 0))}</td>
                <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#3B82F6", fontWeight: 600 }}>{fmt(preview.reduce((s, e) => s + e.medicareTax, 0))}</td>
                <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#6B7690", fontWeight: 600 }}>{fmt(preview.reduce((s, e) => s + e.stateTax, 0))}</td>
                <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#EF4444", fontWeight: 700 }}>{fmt(preview.reduce((s, e) => s + e.totalDeductions, 0))}</td>
                <td style={{ ...tdS, ...monoS, fontSize: 13, fontWeight: 700, color: "#10B981" }}>{fmt(preview.reduce((s, e) => s + e.netPay, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── PAY HISTORY ────────────────────────────────────────────────────────────
function PayHistory({ payHistory, onView }) {
  return (
    <div style={{ ...cardS, padding: 0, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: "#080C16" }}>
          {["Run ID", "Period", "Pay Date", "Frequency", "Employees", "Gross Total", "Total Deductions", "Net Total", "Status", ""].map(h => <th key={h} style={thS}>{h}</th>)}
        </tr></thead>
        <tbody>
          {payHistory.map(run => {
            const gross = run.entries.reduce((s, e) => s + e.grossPay, 0);
            const ded = run.entries.reduce((s, e) => s + e.totalDeductions, 0);
            return (
              <tr key={run.id}>
                <td style={{ ...tdS, ...monoS, color: "#E8A525", fontSize: 11, fontWeight: 500 }}>{run.id}</td>
                <td style={{ ...tdS, fontSize: 11.5, color: "#D4DAE3" }}>{run.periodStart} → {run.periodEnd}</td>
                <td style={{ ...tdS, color: "#6B7690" }}>{run.payDate}</td>
                <td style={tdS}><span style={{ background: "#131A29", padding: "2px 6px", borderRadius: 3, fontSize: 10, textTransform: "capitalize" }}>{run.frequency}</span></td>
                <td style={{ ...tdS, textAlign: "center" }}>{run.entries.length}</td>
                <td style={{ ...tdS, ...monoS, fontSize: 12, fontWeight: 600, color: "#F4F6F9" }}>{fmt(gross)}</td>
                <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#EF4444" }}>{fmt(ded)}</td>
                <td style={{ ...tdS, ...monoS, fontSize: 12, fontWeight: 700, color: "#10B981" }}>{fmt(gross - ded)}</td>
                <td style={tdS}><Badge status={run.status} /></td>
                <td style={tdS}><button onClick={() => onView(run)} style={{ background: "rgba(59,130,246,0.1)", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 10, color: "#3B82F6", fontWeight: 600, fontFamily: "inherit" }}>View</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── PAYROLL TAX SUMMARY ────────────────────────────────────────────────────
function PayrollTaxSummary({ employees, payHistory }) {
  const activeEmps = employees.filter(e => e.active);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={cardS}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 14 }}>Employee YTD Tax Detail</div>
        {activeEmps.map(emp => (
          <div key={emp.id} style={{ padding: "10px 0", borderBottom: "1px solid #161D2E22" }}>
            <div style={{ fontSize: 12.5, color: "#D4DAE3", fontWeight: 600, marginBottom: 6 }}>{emp.name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {[["Gross", fmt(emp.ytdGross), "#F4F6F9"], ["Fed Tax", fmt(emp.ytdFedTax), "#EF4444"], ["SS", fmt(emp.ytdSS), "#E8A525"], ["Medicare", fmt(emp.ytdMedicare), "#3B82F6"]].map(([l, v, c], i) => (
                <div key={i}><div style={{ fontSize: 9, color: "#5A647A", fontWeight: 600, letterSpacing: "0.06em" }}>{l}</div><div style={{ ...monoS, fontSize: 11, fontWeight: 600, color: c }}>{v}</div></div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={cardS}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#F4F6F9", marginBottom: 14 }}>Employer Tax Obligations</div>
        <div style={{ fontSize: 12, color: "#8E96A8", marginBottom: 14, lineHeight: 1.6 }}>
          Employer must match employee Social Security (6.2%) and Medicare (1.45%) contributions. Total employer cost is in addition to gross wages.
        </div>
        {[
          ["FICA - Social Security (Employer)", fmt(activeEmps.reduce((s, e) => s + e.ytdSS, 0)), "6.2% of wages up to $168,600"],
          ["FICA - Medicare (Employer)", fmt(activeEmps.reduce((s, e) => s + e.ytdMedicare, 0)), "1.45% of all wages"],
          ["FUTA (estimated)", fmt(activeEmps.length * 42 * 0.006), "0.6% on first $7,000/employee"],
          ["SUTA TX (estimated)", fmt(activeEmps.reduce((s, e) => s + e.ytdGross, 0) * 0.021), "2.1% (new employer rate)"],
        ].map(([l, v, note], i) => (
          <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #161D2E22" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontSize: 12.5, color: "#D4DAE3" }}>{l}</span>
              <span style={{ ...monoS, fontSize: 12.5, fontWeight: 600, color: "#EF4444" }}>{v}</span>
            </div>
            <div style={{ fontSize: 10, color: "#5A647A" }}>{note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MODALS ─────────────────────────────────────────────────────────────────
function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0D1320", borderRadius: 14, border: "1px solid #1E2538", maxHeight: "88vh", overflow: "auto" }}>{children}</div>
    </div>
  );
}

function AddEmployeeModal({ employee, onClose, onSave }) {
  const [f, setF] = useState(employee || {
    id: genId("EMP"), name: "", role: "", department: "Operations", payType: "salary", payRate: "",
    filingStatus: "single", state: "TX", startDate: "2026-02-21", active: true,
    ytdGross: 0, ytdFedTax: 0, ytdSS: 0, ytdMedicare: 0,
  });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const inputS = { width: "100%", padding: "8px 11px", borderRadius: 6, border: "1px solid #1E2538", background: "#080C16", color: "#D4DAE3", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <Overlay onClose={onClose}>
      <div style={{ width: 580, padding: "24px 26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#F4F6F9" }}>{employee ? "Edit" : "Add"} Employee</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><Ico d="M18 6L6 18 M6 6l12 12" size={16} color="#5A647A" /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            ["Full Name", "name", "text"], ["Job Title", "role", "text"],
          ].map(([label, key, type]) => (
            <div key={key}><label style={{ display: "block", ...lblS, marginBottom: 4 }}>{label}</label>
              <input type={type} value={f[key]} onChange={e => set(key, e.target.value)} style={inputS} />
            </div>
          ))}
          <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>Department</label>
            <select value={f.department} onChange={e => set("department", e.target.value)} style={{ ...inputS, appearance: "auto" }}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select></div>
          <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>Pay Type</label>
            <select value={f.payType} onChange={e => set("payType", e.target.value)} style={{ ...inputS, appearance: "auto" }}>
              <option value="salary">Salary</option><option value="hourly">Hourly</option>
            </select></div>
          <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>{f.payType === "salary" ? "Annual Salary" : "Hourly Rate"}</label>
            <input type="number" value={f.payRate} onChange={e => set("payRate", parseFloat(e.target.value) || "")} style={inputS} /></div>
          <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>Filing Status</label>
            <select value={f.filingStatus} onChange={e => set("filingStatus", e.target.value)} style={{ ...inputS, appearance: "auto" }}>
              <option value="single">Single</option><option value="married">Married Filing Jointly</option><option value="head">Head of Household</option>
            </select></div>
          <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>Work State</label>
            <select value={f.state} onChange={e => set("state", e.target.value)} style={{ ...inputS, appearance: "auto" }}>
              {Object.entries(STATE_INCOME_TAX).map(([k, v]) => <option key={k} value={k}>{k} — {v.name} ({pct(v.rate)})</option>)}
            </select></div>
          <div><label style={{ display: "block", ...lblS, marginBottom: 4 }}>Start Date</label>
            <input type="date" value={f.startDate} onChange={e => set("startDate", e.target.value)} style={inputS} /></div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ ...btnS("transparent", "#6B7690"), border: "1px solid #1E2538" }}>Cancel</button>
          <button onClick={() => f.name && f.role && f.payRate && onSave({ ...f, payRate: parseFloat(f.payRate) })} style={{ ...btnS("#10B981", "#06090F"), fontWeight: 700 }}>
            {employee ? "Save Changes" : "Add Employee"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function PayRunDetailModal({ run, onClose }) {
  const gross = run.entries.reduce((s, e) => s + e.grossPay, 0);
  return (
    <Overlay onClose={onClose}>
      <div style={{ width: 700, padding: "24px 26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#F4F6F9" }}>Pay Run {run.id}</h2>
            <div style={{ fontSize: 12, color: "#5A647A", marginTop: 2 }}>{run.periodStart} → {run.periodEnd} · Pay Date: {run.payDate}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><Ico d="M18 6L6 18 M6 6l12 12" size={16} color="#5A647A" /></button>
        </div>
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#080C16" }}>
              {["Employee", "Gross", "Fed Tax", "SS", "Medicare", "State", "Deductions", "Net Pay"].map(h => <th key={h} style={thS}>{h}</th>)}
            </tr></thead>
            <tbody>
              {run.entries.map(e => (
                <tr key={e.employeeId}>
                  <td style={{ ...tdS, color: "#D4DAE3", fontWeight: 500 }}>{e.employeeName}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, fontWeight: 600 }}>{fmt(e.grossPay)}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#EF4444" }}>{fmt(e.fedWithholding)}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#E8A525" }}>{fmt(e.ssTax)}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#3B82F6" }}>{fmt(e.medicareTax)}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#6B7690" }}>{fmt(e.stateTax)}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 11, color: "#EF4444", fontWeight: 600 }}>{fmt(e.totalDeductions)}</td>
                  <td style={{ ...tdS, ...monoS, fontSize: 12, fontWeight: 700, color: "#10B981" }}>{fmt(e.netPay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, padding: "12px 16px", background: "#080C16", borderRadius: 8 }}>
          <span style={{ fontWeight: 700, color: "#F4F6F9" }}>Totals</span>
          <div style={{ display: "flex", gap: 20 }}>
            <span style={{ fontSize: 12, color: "#5A647A" }}>Gross: <span style={{ ...monoS, fontWeight: 700, color: "#F4F6F9" }}>{fmt(gross)}</span></span>
            <span style={{ fontSize: 12, color: "#5A647A" }}>Net: <span style={{ ...monoS, fontWeight: 700, color: "#10B981" }}>{fmt(run.entries.reduce((s, e) => s + e.netPay, 0))}</span></span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={onClose} style={{ ...btnS("transparent", "#6B7690"), border: "1px solid #1E2538" }}>Close</button>
        </div>
      </div>
    </Overlay>
  );
}
