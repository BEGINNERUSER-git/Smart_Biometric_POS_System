import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Biometric POS Dashboard",
  description: "Merchant dashboard for Smart Biometric POS"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

