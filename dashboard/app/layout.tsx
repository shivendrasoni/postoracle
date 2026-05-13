import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/sidebar";
import ScrollToTop from "@/components/scroll-to-top";
import DrawerShell from "@/components/drawer/drawer-shell";
import { ComposeProvider } from "@/lib/compose-context";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

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
    <html lang="en" data-scroll-behavior="smooth" className={`${geist.className} ${geistMono.variable}`}>
      <body>
        <ComposeProvider>
          <div className="relative flex min-h-dvh">
            <Sidebar />
            <ScrollToTop />
            <main className="relative z-10 flex-1 pl-[260px]">
              <div className="mx-auto max-w-[1120px] px-10 py-12">
                {children}
              </div>
            </main>
            <DrawerShell />
          </div>
        </ComposeProvider>
      </body>
    </html>
  );
}
