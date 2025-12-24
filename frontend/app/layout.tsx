// Import the types we need to describe the metadata for the whole application.
import type { Metadata } from "next";
// Import the brand fonts (Sora for primary UI, Geist Mono for code) so they load optimally.
import { Geist_Mono, Sora } from "next/font/google";
// Pull in the shared global styles that set up the palette and gradients.
import "./globals.css";
import { ThemeProvider } from "@/theme/context";

// Configure the Sora font for the primary interface text and expose it as a CSS variable.
const sora = Sora({
  variable: "--font-primary",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Keep the Geist Mono font for code blocks and technical readouts with a dedicated variable.
const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// Define the metadata that browsers and crawlers use for the default title and description.
export const metadata: Metadata = {
  title: "ChatZone",
  description: "Dream it. AI it. One chat.",
};

// Render the base HTML scaffold and attach the font variables plus smoothing helpers to the <body> tag.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
