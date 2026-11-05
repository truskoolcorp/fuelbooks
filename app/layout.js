export const metadata = {
  title: "FuelBooks — AP Fuel USA | by Tru Skool",
  description: "Fuel brokerage operations and accounting for AP Fuel USA, built by Tru Skool Entertainment International Corp.",
  icons: { icon: "/fuelbooks-mark.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { min-height: 100%; width: 100%; }
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
