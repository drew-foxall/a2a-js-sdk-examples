import type { Metadata } from "next";
import { Geist_Mono, Nunito_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { DebugConsole } from "@/components/debug";
import { InspectorProvider, ThemeProvider } from "@/context";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "A2A Inspector (Beta)",
  description: "Inspect and debug A2A protocol agents - Beta release",
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning className={nunitoSans.variable}>
      <body className={`${nunitoSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <InspectorProvider>
            {children}
            <DebugConsole />
          </InspectorProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
