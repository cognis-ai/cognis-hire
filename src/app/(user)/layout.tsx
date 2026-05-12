import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import Providers from "@/components/providers";
import { COGNIS_BRAND } from "@/lib/cognis-brand";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: COGNIS_BRAND.name,
  description: COGNIS_BRAND.tagline,
  openGraph: {
    title: COGNIS_BRAND.name,
    description: COGNIS_BRAND.tagline,
    siteName: COGNIS_BRAND.name,
    images: [
      {
        url: COGNIS_BRAND.thumbnailUrl,
        width: 800,
        height: 600,
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/browser-user-icon.ico" />
      </head>
      <body className={inter.className}>
        <ClerkProvider dynamic>
          <Providers>
            {children}
            <Toaster
              toastOptions={{
                classNames: {
                  toast: "bg-white border-2 border-indigo-400",
                  title: "text-black",
                  description: "text-red-400",
                  actionButton: "bg-indigo-400",
                  cancelButton: "bg-orange-400",
                  closeButton: "bg-lime-400",
                },
              }}
            />
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
