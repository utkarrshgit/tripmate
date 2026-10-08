import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Import from src with "@/..." instead of long relative paths.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
