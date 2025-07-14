import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "pcx",
  description: "Send money worldwide with ease, speed, and security.",
  icons: {
    icon: [
      {
        url: '/favicon-16x16.jpg',
        sizes: '16x16',
        type: 'image/jpeg',
      },
      {
        url: '/favicon-32x32.jpg',
        sizes: '32x32',
        type: 'image/jpeg',
      },
    ],
    shortcut: '/favicon-16x16.jpg',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/jpeg" sizes="16x16" href="/favicon-16x16.jpg" />
        <link rel="icon" type="image/jpeg" sizes="32x32" href="/favicon-32x32.jpg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}