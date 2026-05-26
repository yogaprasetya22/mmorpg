import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seal M: Battle Simulator",
  description: "Advanced 3D Battle Simulation for Seal M: Clover Knight",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="font-sans min-h-full flex flex-col transition-colors duration-500">
        {children}
      </body>
    </html>
  );
}


