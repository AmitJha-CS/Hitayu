import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base must match the repo name for GitHub Pages (https://<user>.github.io/Hitayu/)
export default defineConfig({
  plugins: [react()],
  base: "/Hitayu/",
});
