import { defineConfig } from "vite";
import Spritesmith from "vite-plugin-spritesmith";
import packageJson from "./package.json";

export default defineConfig({
  plugins: [
    Spritesmith({
      watch: true,
      src: {
        cwd: "./public/skin/src/",
        glob: "**/*.png",
      },
      target: {
        image: "./public/skin/spritesheet_v4.png",
        css: [
          [
            "./public/skin/spritemap_v4.json",
            {
              format: "json",
            },
          ],
        ],
      },
      customTemplates: {
        json: (data) => {
          const result = [];
          data.sprites.forEach((sprite) => {
            result.push({
              name: sprite.name,
              x: sprite.x,
              y: sprite.y,
              width: sprite.width,
              height: sprite.height,
            });
          });
          return JSON.stringify(result, undefined, 2);
        },
      },
    }),
  ],
  define: {
    "import.meta.env.PACKAGE_VERSION": JSON.stringify(packageJson.version),
    "import.meta.env.BUILD_VERSION": JSON.stringify(packageJson.version),
  },
});
