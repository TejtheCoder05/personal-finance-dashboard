import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DataSourceProvider } from "@/components/DataSourceProvider";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinanceIQ | Personal Finance Dashboard",
  description:
    "ML-powered personal finance analytics, transaction categorization, and anomaly detection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variables live on <html> so the token layer in globals.css can
    // resolve them from :root.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <AuthProvider>
          <DataSourceProvider>{children}</DataSourceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
