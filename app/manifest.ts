import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Binda Salon OS",
    short_name: "Binda OS",
    description: "Offline-first transaction capture for beauty businesses.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f5eee6",
    theme_color: "#1d1b1a",
  };
}
