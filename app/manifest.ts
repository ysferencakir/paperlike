import type { MetadataRoute } from "next";

// Required for `output: "export"` — a route handler with no static params
// otherwise defaults to dynamic rendering, which the static exporter rejects.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Paperlike — EPUB/PDF Okuyucu",
    short_name: "Paperlike",
    description: "E-ink hissiyatlı, yerel ve çevrimdışı öncelikli EPUB/PDF okuyucu.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fbfaf8",
    theme_color: "#fbfaf8",
    categories: ["books", "education", "productivity"],
    lang: "tr",
    icons: [
      {
        src: "/icons/paperlike.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/paperlike-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
