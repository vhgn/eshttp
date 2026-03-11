import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
	plugins: [
		tsconfigPaths({ projects: ["./tsconfig.json"] }),
		tailwindcss(),
		tanstackStart({
			prerender: {
				enabled: true,
			},
			pages: [
				{
					path: "/",
					prerender: {
						enabled: true,
						crawlLinks: false,
					},
				},
			],
		}),
		viteReact(),
	],
});

export default config;
