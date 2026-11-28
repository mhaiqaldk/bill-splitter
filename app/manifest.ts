import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Patungan",
    short_name: "Patungan",
    description: "Split the bill by what you had.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef0eb",
    theme_color: "#eef0eb",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
