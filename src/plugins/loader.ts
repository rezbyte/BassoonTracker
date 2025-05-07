import YascalSprite from "../ui/yascal/sprite";
import { Y } from "../ui/yascal/yascal";

interface Plugin {
  name: string,
  src: string[] | undefined,
  loading?: boolean
  loaded?: boolean
  onLoad?(): void
}

class PluginLoader {
  private static pluginSources: Record<string, string[]> = {
    Nibbles: [
      "src/plugins/games/nibbles/nibbles.js",
      "src/plugins/games/nibbles/logo.png",
      "src/plugins/games/nibbles/levels.png",
      "src/plugins/games/nibbles/player1.png",
    ],
  };
  private plugins: Record<string, Plugin> = {};

  register(plugin: Plugin) {
    console.log("register");
    console.log(plugin);
    this.plugins[plugin.name] = plugin;
  };

  load(plugin: Plugin | string, next: () => void) {
    const pluginName = typeof plugin === "string" ? plugin : plugin.name;

    if (typeof (window as unknown as Record<string, Plugin>)[pluginName] === "object") {
      // already packaged
      console.log("Plugin " + pluginName + " already loaded");
      if (next) next();
    } else {
      const currentPlugin: Plugin = typeof plugin === "string" ? {
        name: plugin,
        src: PluginLoader.pluginSources[pluginName],
      } : plugin;
      const p = this.plugins[pluginName];
      if (p) {
        if (p.loading) {
          console.warn("Plugin already being loaded");
        } else {
          console.log("Plugin already loaded");
          if (next) next();
        }
      } else {
        let todo = 0;
        let done = 0;

        const loadCallback = function (e: Partial<Event> | string) {
          if (e  && typeof e === "object" && e.type === "load") {
            done++;
          } else {
            console.error("Error loading resource", e);
            done++;
          }
          //console.error(this.src);
          if (done >= todo) {
            currentPlugin.loaded = true;
            console.log("loaded", plugin);
            if (currentPlugin.onLoad) currentPlugin.onLoad();
            if (next) next();
          }
        };

        const loadScript = function (src: string): string {
          const s = document.createElement("script");
          s.type = "application/javascript";
          s.src = src;
          s.addEventListener("error", loadCallback, false);
          s.addEventListener("load", loadCallback, false);
          document.getElementsByTagName("head")[0].appendChild(s);
          return s.src;
        };

        const loadGraphics = function (src: string) {
          Y.loadImage(src, function (img) {
            const name = src.split("/").pop()?.split(".")[0];
            if (name === undefined) {
              console.error(`Bad source for plugin graphics: ${src}`);
              return;
            }
            Y.sprites[pluginName + "." + name] = new YascalSprite({
              name,
              img: img,
              width: img.width,
              height: img.height,
            });
            loadCallback({ type: "load" });
          });
        };

        if (currentPlugin.src) {
          console.log(
            "loading Plugin " +
              pluginName +
              " with " +
              currentPlugin.src.length +
              " source files"
          );
          currentPlugin.loading = true;
          todo = currentPlugin.src.length;
          done = 0;
          currentPlugin.src.forEach(function (s) {
            const ext = s.split(".").pop()?.toLowerCase();
            switch (ext) {
              case "js":
                loadScript(s);
                break;
              case "png":
                loadGraphics(s);
                break;
              default:
                console.warn("Warning, unknown loader for " + s);
                loadCallback(s);
            }
          });
        } else {
          console.warn(
            "Can't load plugin " + pluginName + ": no source files"
          );
          if (next) next();
        }
      }
    }
  };

}

export default new PluginLoader();
