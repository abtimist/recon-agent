import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Recon Agent",
  description: "AI-assisted transaction reconciliation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={({ baseTheme: dark } as any)}>
      <html lang="en" className="dark">
        <body className={`${inter.className} bg-background text-foreground antialiased transition-colors duration-300`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
