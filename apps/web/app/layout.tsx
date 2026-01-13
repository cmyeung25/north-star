import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "North Star",
  description: "Mobile-first PWA life-stage financial planner.",
  manifest: "/manifest.json",
  applicationName: "North Star",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "North Star",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
