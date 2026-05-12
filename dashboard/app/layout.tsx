import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Sidebar from "@/components/sidebar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PostOracle",
  description: "Content creation dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-8" style={{ marginLeft: 220 }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
