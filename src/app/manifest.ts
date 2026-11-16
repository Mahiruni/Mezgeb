import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Mezgeb መዝገብ", short_name: "Mezgeb", description: "Your daily business ledger", start_url: "/", display: "standalone", background_color: "#f5f7ff", theme_color: "#e0e5fb", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] };
}
