import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Mezgeb መዝገብ", short_name: "Mezgeb", description: "Your daily business ledger", start_url: "/", display: "standalone", background_color: "#f5f7fa", theme_color: "#dae3ec", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] };
}
