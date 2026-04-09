import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Equity Vault — Deal Intelligence",
  description: "Autonomous deal intelligence. Profile → Score → Brief → Decide.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-vault-bg antialiased">
        <nav className="border-b border-white/5 px-6 py-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <a href="/dashboard" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <span className="text-amber-500 font-bold text-sm">EV</span>
              </div>
              <span className="text-lg font-semibold text-white">
                Equity Vault
              </span>
            </a>
            <span className="text-xs text-white/30 font-mono">v2.0.0</span>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
