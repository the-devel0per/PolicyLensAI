import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "./" keeps asset URLs relative, so dist/ works from any S3 website endpoint.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
