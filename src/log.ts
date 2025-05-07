import { createSlug } from "./lib/util";
import FetchService from "./fetchService";
import { UI, canvas } from "./ui/main";

class Logger {
  private readonly baseUrl = "https://www.stef.be/bassoontracker/api/log/";

  info(message: string) {
    this.log("info", message);
  }
  warn(message: string) {
    console.warn(message);
    this.log("warn", message);
  }
  error(message: string) {
    console.error(message);
    this.log("error", message);
  }

  log(scope: "warn" | "error" | "info", message: string) {
    const stats = UI.stats();
    const version =
      typeof import.meta.env.PACKAGE_VERSION == "undefined"
        ? "dev"
        : import.meta.env.PACKAGE_VERSION;
    message = createSlug(message);
    FetchService.get(
      this.baseUrl +
        scope +
        "/" +
        message +
        "/" +
        stats.averageFps +
        "/" +
        stats.skipRenderSteps +
        "/" +
        version +
        "/" +
        canvas.width +
        "x" +
        canvas.height +
        "/" +
        stats.averageRenderFps +
        "/" +
        devicePixelRatio,
      function () {
        //console.log(result);
      },
    );
  }
}

export default new Logger();
