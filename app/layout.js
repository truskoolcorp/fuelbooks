export const metadata = {
  title: "FuelBooks Pro — Fuel Brokerage Accounting",
  description: "Full-featured accounting platform for fuel brokerages with invoicing, P&L, and tax engine",
};
<Link href="/payroll">Payroll</Link>
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { height: 100%; width: 100%; overflow: hidden; }
          body { background: #06090F; }
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #1E2538; border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: #2A3348; }
          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          input[type="number"] { -moz-appearance: textfield; }
          select { cursor: pointer; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
