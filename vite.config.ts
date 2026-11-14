import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const projectRoot = realpathSync(fileURLToPath(new URL(".", import.meta.url)));
process.chdir(projectRoot);

export default defineConfig({
  root: projectRoot,
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
  },
});
