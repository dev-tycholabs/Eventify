import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import { serverConfig } from "@/config/wagmi-server";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ErrorBoundary, ToastProvider, Header, GeolocationProvider } from "@/components";
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
  title: "Eventify",
  description: "Blockchain-based event ticketing platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const cookie = headersList.get("cookie");
  const initialState = cookieToInitialState(serverConfig, cookie);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Web3Provider initialState={initialState}>
          <AuthProvider>
            <GeolocationProvider>
              <Header />
              <ErrorBoundary>{children}</ErrorBoundary>
              <ToastProvider />
            </GeolocationProvider>
          </AuthProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
