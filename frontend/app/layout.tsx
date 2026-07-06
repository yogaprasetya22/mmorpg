
if (typeof window === "undefined" && !("ProgressEvent" in global)) {
  // Polyfill ProgressEvent in Node.js/SSR environment to avoid ReferenceError
  // when browser-only dependencies (like three.js/drei splat loaders) are imported.
  (global as any).ProgressEvent = class ProgressEvent {
    lengthComputable: boolean;
    loaded: number;
    total: number;
    constructor(_type: string, dict: any = {}) {
      this.lengthComputable = dict.lengthComputable || false;
      this.loaded = dict.loaded || 0;
      this.total = dict.total || 0;
    }
  };
}


import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jagres: Battle Simulator",
  description: "Advanced 3D Battle Simulation for Jagres: Clover Knight",
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


