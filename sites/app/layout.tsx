import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ServiceHub - Agendamentos e CRM",
  description: "CRM operacional com agenda, funil, cobranca e automacoes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
