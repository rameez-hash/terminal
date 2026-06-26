import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SalesPortal - Sales Management & Payment Tracking",
  description: "Enterprise-grade sales tracking platform with Stripe & PayPal integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} h-full`}>
      <body className={`${montserrat.className} min-h-full flex flex-col bg-white text-slate-900 antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
