import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tu reseña | NFC + QR",
  description: "Acceso directo a las reseñas de Google del comercio"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}