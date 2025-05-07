import YascalSprite from "./sprite";

export default class Yascal {
  public sprites: Record<string, YascalSprite> = {};
  getImage(name: string): HTMLCanvasElement | undefined {
    return this.sprites[name] ? this.sprites[name].canvas : undefined;
  }

  loadImage(url: string, next?: (arg0: HTMLImageElement) => void) {
    const img = new Image();
    img.onload = function () {
      if (next) next(img);
    };
    img.onerror = function () {
      console.error("XHR error while loading " + url);
    };
    img.src = url;
  }
}

export const Y = new Yascal();
