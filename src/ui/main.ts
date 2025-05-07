import BitmapFont from "./components/bitmapfont";
import { Y } from "./yascal/yascal";
import Tracker, { TrackerState } from "../tracker";
import EventBus from "../eventBus";
import { EVENT, SELECTION } from "../enum";
import { getUrlParameter } from "../lib/util";
import Logger from "../log";
import Audio from "../audio";
import Input from "./input";
import Element from "./components/element";
import { debug } from "../main";
import MainPanel from "./mainPanel";
import { ModalDialog } from "./components/modalDialog";
import FetchService from "../fetchService";
import App from "../app";
import Assets from "./assets";
import Settings from "../settings";
import Host from "../host";
import type { MenuItem } from "./components/menu";
import type PackageJson from "../../package.json";

export let canvas: HTMLCanvasElement;
export let ctx: CanvasRenderingContext2D;

type SelectionHandler = (state: SELECTION) => boolean | undefined;

export interface Config {
  canvas: HTMLCanvasElement;
  baseUrl: string;
  callback: () => void;
  plugin: object;
  audioContext?: BaseAudioContext;
  audioDestination?: AudioNode;
  isMaster?: boolean;
  handler?: (event: EVENT, value: number) => void;
}

class _UI {
  private screenWidth: number = window.innerWidth;
  private screenHeight: number = window.innerHeight;
  private useDevicePixelRatio = false;

  children: Element[] = [];
  mainPanel: MainPanel | null;
  fontSmall: BitmapFont | undefined;
  fontMed: BitmapFont | undefined;
  fontBig: BitmapFont | undefined;
  fontFT: BitmapFont | undefined;
  fontCondensed: BitmapFont | undefined;
  fontSuperCondensed: BitmapFont | undefined;
  fontLed: BitmapFont | undefined;
  fontLedBig: BitmapFont | undefined;
  fontDark: BitmapFont | undefined;

  private maxWidth = 1200;
  private maxHeight = 2000;
  private minHeight = 200;
  private modalElement: ModalDialog | undefined;
  private needsRendering = true;
  private skipRenderSteps = 0;
  private renderStep = 0;
  private beginTime = 0;
  private beginRenderTime = 0;
  private lastRenderTime = 0;
  private beginMeasure = 0;
  private currentMeasure = 0;
  private _endMeasure = 0;
  private frames = 0;
  private fps: number = 0;
  private minFps = 100;
  private fpsList: number[] = [];
  private renderfpsList: number[] = [];
  private selection: SelectionHandler | undefined;
  private prevSelection: SelectionHandler | undefined;
  private prevEventExpired = 0;
  private maxRenderFps = 60;
  private fpsCalculated = false;
  private UICache: Partial<TrackerState> = {};
  private nowFunction: () => number;

  constructor() {
    const tracks = Number(getUrlParameter("tracks"));
    if (tracks == 8) this.maxWidth = 1200;
    if (tracks == 16) this.maxWidth = 1600;
    if (tracks >= 32) this.maxWidth = 3200;

    // some light polyfills - mainly to ensure the App can still show the "browser not supported" message
    let nowFunction;
    if (window.performance && performance.now) {
      nowFunction = function () {
        return performance.now();
      };
    } else {
      nowFunction = Date.now;
    }
    this.nowFunction = nowFunction;

    if (!window.requestAnimationFrame) {
      let lastTime = 0;
      window.requestAnimationFrame = function (callback) {
        const currTime = new Date().getTime();
        const timeToCall = Math.max(0, 16 - (currTime - lastTime));
        const id = window.setTimeout(function () {
          callback(currTime + timeToCall);
        }, timeToCall);
        lastTime = currTime + timeToCall;
        return id;
      };
    }
    this.mainPanel = null;

    EventBus.on(EVENT.clockEventExpired, () => {
      const now = nowFunction();
      if (now - this.prevEventExpired > 2000) {
        Logger.warn("throttling back");
        if (this.skipRenderSteps < 4) {
          this.skipFrame(this.skipRenderSteps + 1);
        } else {
          Logger.warn("Browser can't keep up");
        }
        this.prevEventExpired = now;
      }
    });
  }

  init(next?: () => void) {
    const mainCanvas = document.getElementById("canvas");
    if (mainCanvas == null) {
      console.error("Failed to get main canvas!");
      return;
    }
    if (!(mainCanvas instanceof HTMLCanvasElement)) {
      console.error("Main canvas is not a canvas element!");
      return;
    }
    canvas = mainCanvas;

    const mainContext = canvas.getContext("2d");
    if (mainContext == null) {
      console.error("Failed to get main canvas context!");
      return;
    }
    ctx = mainContext;
    ctx.imageSmoothingEnabled = false;

    let w = window.innerWidth;
    let h = window.innerHeight;

    if (w > this.maxWidth) w = this.maxWidth;
    if (h > this.maxHeight) h = this.maxHeight;

    this.screenWidth = w;
    this.screenHeight = h;
    canvas.width = this.screenWidth;
    canvas.height = this.screenHeight;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#78828F";
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Loading ...", canvas.width / 2, canvas.height / 2);

    if (debug) UI.measure("Create Main Canvas");

    Assets.preLoad(() => {
      if (debug) UI.measure("UI sprites");
      console.log("UI assets loaded");
      this.initAssets();
      Input.init();
      if (debug) UI.measure("Input Init");
      this.render();
      if (debug) UI.measure("First render");

      // check version
      const versionNumber = Host.getVersionNumber();
      if (typeof versionNumber !== "undefined") {
        FetchService.json(
          "package.json?ts=" + new Date().getTime(),
          function (result: typeof PackageJson | undefined) {
            if (result && result.version && result.version !== versionNumber) {
              console.error("app needs updating");

              const updateMessageShown =
                localStorage.getItem("updatemessageshown");
              let lastMessage =
                updateMessageShown == null
                  ? 0
                  : parseInt(updateMessageShown, 10);
              if (isNaN(lastMessage)) lastMessage = 0;

              window.reload = function () {
                localStorage.setItem(
                  "updatemessageshown",
                  new Date().getTime().toString(),
                );
                window.location.reload(true);
              };

              if (new Date().getTime() - lastMessage > 1000 * 60 * 30) {
                const message = document.createElement("div");
                message.className = "message";
                message.innerHTML =
                  'A new version of BassoonTracker is available. Please <a href="#" onclick="reload()">refresh your browser</a>';
                document.body.appendChild(message);
              }
            }
          },
        );
      }

      if (next) next();
    });
  }

  initPlugin(config: Config) {
    console.log("init plugin");
    let canvas: HTMLCanvasElement;
    if (config.canvas) {
      canvas = config.canvas;
    } else {
      const mainCanvas = document.getElementById("canvas") as HTMLCanvasElement;
      if (mainCanvas === null) {
        console.error(
          "Failed to get the Canvas element in order to initalize a plugin!",
        );
        return;
      }
      canvas = mainCanvas;

      let w = window.innerWidth;

      if (w > this.maxWidth) w = this.maxWidth;
      if (w > this.maxHeight) w = this.maxHeight;
      canvas.width = w;
      //canvas.height = window.innerHeight;
    }

    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      console.error("Failed to get a 2D Canvas context to initalize a plugin!");
      return;
    }
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    Settings.baseUrl = config.baseUrl;
    App.isPlugin = true;
    //buildNumber = Math.random(); TODO: Figure out how to use this with buildNumber in ../main.ts
    Assets.preLoad(() => {
      console.log("UI assets loaded");
      this.initAssets();
      this.render();

      Settings.readSettings();
      App.init();
      if (config.callback) config.callback();
    });
  }

  setSize(newWidth: number, newHeight: number) {
    if (newWidth > this.maxWidth) newWidth = this.maxWidth;
    if (newHeight > this.maxHeight) newHeight = this.maxHeight;
    if (newHeight < this.minHeight) newHeight = this.minHeight;

    if (newWidth !== canvas.width || newHeight !== canvas.height) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.screenWidth = newWidth;
      this.screenHeight = newHeight;

      this.scaleToDevicePixelRatio(this.useDevicePixelRatio);
      this.mainPanel?.setSize(newWidth, newHeight);
      //me.mainPanel.setLayout(0,0,newWidth,newHeight);

      if (this.modalElement) {
        this.modalElement.setProperties({
          width: newWidth,
          height: newHeight,
          left: 0,
          top: 0,
        });
      }
      this.needsRendering = true;
    }
  }

  scaleToDevicePixelRatio(active: boolean) {
    this.useDevicePixelRatio = !!active;
    if (active && devicePixelRatio > 1) {
      canvas.width = this.screenWidth * devicePixelRatio;
      canvas.height = this.screenHeight * devicePixelRatio;

      ctx.scale(devicePixelRatio, devicePixelRatio);
      ctx.imageSmoothingEnabled = false;
    } else {
      canvas.width = this.screenWidth;
      canvas.height = this.screenHeight;
    }
    canvas.style.width = this.screenWidth + "px";
    canvas.style.height = this.screenHeight + "px";

    this.mainPanel?.refresh();
  }

  private initAssets() {
    const fontImage = Y.getImage("font");
    if (fontImage == null) {
      console.error("Failed to load font image.");
      return;
    }

    this.fontSmall = new BitmapFont({
      image: fontImage,
      startX: 1,
      startY: 1,
      charWidth: 6,
      charHeight: 6,
      spaceWidth: 6,
      margin: 0,
      charsPerLine: 42,
      chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890.+-_#>",
      onlyUpperCase: true,
    });
    //window.fontSmall = this.fontSmall;

    this.fontMed = new BitmapFont({
      image: fontImage,
      startX: 1,
      startY: 110,
      charWidth: 8,
      charHeight: 8,
      spaceWidth: 8,
      margin: 1,
      charsPerLine: 26,
      lineSpacing: 1,
      chars:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789↑↓-#:.!©_?;()=/+<>&[]{}\\*%$'\"`°,",
      onlyUpperCase: true,
    });
    this.fontMed.generateColor("green", "rgba(80, 140, 0,0.9)");
    this.fontMed.generateColor("orange", "rgba(161, 82, 0,0.9)");
    //window.fontMed = this.fontMed;

    this.fontBig = new BitmapFont({
      image: fontImage,
      startX: 1,
      startY: 10,
      charWidth: 11,
      charHeight: 11,
      spaceWidth: 11,
      margin: 1,
      charsPerLine: 20,
      lineSpacing: 3,
      chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890.,-_",
      onlyUpperCase: true,
    });
    //window.fontBig = this.fontBig;

    this.fontFT = new BitmapFont({
      image: fontImage,
      startX: 1,
      startY: 145,
      charHeight: 12,
      spaceWidth: 4,
      margin: 1,
      charsPerLine: [26, 26, 40],
      lineSpacing: 0,
      chars:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890#©_-&\"'()!.,?+=*$/\\;:[]{}",
      charWidth:
        "888888883888998888888899987777757735739777757578987777777777778868864553348767888435555",
      onlyUpperCase: false,
      debug: false,
    });
    //window.fontFT = this.fontFT;

    this.fontCondensed = new BitmapFont({
      image: fontImage,
      startX: 1,
      startY: 184,
      charHeight: 10,
      spaceWidth: 5,
      margin: 0,
      charsPerLine: [26, 26, 10],
      lineSpacing: 0,
      chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
      charWidth: "6666556625656666666666666655555455245365555454566555",
      onlyUpperCase: false,
    });
    //window.fontCondensed = this.fontCondensed;

    this.fontSuperCondensed = new BitmapFont({
      image: fontImage,
      startX: 2,
      startY: 208,
      charHeight: 8,
      charWidth: 4,
      spaceWidth: 4,
      margin: 0,
      charsPerLine: 45,
      lineSpacing: 0,
      chars: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_.-#+><↑↓",
      onlyUpperCase: true,
    });
    this.fontSuperCondensed.generateColor("green", "rgba(80, 140, 0,0.9)");
    this.fontSuperCondensed.generateColor("orange", "rgba(161, 82, 0,0.9)");
    //window.fontSuperCondensed = fontSuperCondensed;

    this.fontLed = new BitmapFont({
      image: fontImage,
      startX: 107,
      startY: 68,
      charWidth: 8,
      charHeight: 13,
      spaceWidth: 8,
      margin: 0,
      charsPerLine: 20,
      chars: " 0123456789-",
    });
    //window.fontLed = fontLed;

    this.fontLedBig = new BitmapFont({
      image: fontImage,
      startX: 9,
      startY: 82,
      charWidth: 14,
      charHeight: 22,
      spaceWidth: 8,
      margin: 0,
      charsPerLine: 11,
      chars: " 0123456789",
    });
    //window.fontLedBig = fontLedBig;

    this.fontDark = new BitmapFont({
      image: fontImage,
      startX: 1,
      startY: 216,
      charHeight: 9,
      spaceWidth: 5,
      margin: 0,
      charsPerLine: [40],
      lineSpacing: 0,
      chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890():-",
      charWidth: "7777667736768777877778887746666666664434",
      onlyUpperCase: true,
    });
    //window.fontDark = fontDark;

    if (debug) UI.measure("Generate font");

    Assets.init();
    this.mainPanel = new MainPanel();
    this.children.push(this.mainPanel);
    if (debug) UI.measure("Generate Main Panel");
  }

  private render(time?: number) {
    let doRender = true;

    if (Tracker.isPlaying()) {
      const state = Tracker.getStateAtTime(Audio.context.currentTime + 0.01);
      if (state) {
        if (state.patternPos !== this.UICache.patternPos) {
          Tracker.setCurrentPatternPos(state.patternPos);
          this.UICache.patternPos = state.patternPos;
        }
        if (state.songPos !== this.UICache.songPos) {
          Tracker.setCurrentSongPosition(state.songPos);
          this.UICache.songPos = state.songPos;
        }
      }
    }
    if (this.skipRenderSteps) {
      this.renderStep++;
      doRender = this.renderStep > this.skipRenderSteps;
    }

    const startRenderTime = Audio.context ? Audio.context.currentTime : 0;

    if (doRender) {
      this.beginRenderTime = this.nowFunction();
      const renderFps = 1000 / (this.beginRenderTime - this.lastRenderTime);
      this.renderfpsList.push(renderFps);
      if (this.renderfpsList.length > 20) this.renderfpsList.shift();
      if (renderFps > this.maxRenderFps) {
        doRender = false;
      }
    }

    if (doRender && this.mainPanel) {
      this.renderStep = 0;
      this.lastRenderTime = this.beginRenderTime;
      EventBus.trigger(EVENT.screenRefresh);

      if (this.modalElement && this.modalElement.needsRendering) {
        this.mainPanel.refresh();
        this.needsRendering = true;
      }

      if (this.needsRendering) {
        this.children.forEach(function (element) {
          if (element.needsRendering) {
            element.render();
          }
        });

        EventBus.trigger(EVENT.screenRender);

        if (this.modalElement) {
          this.modalElement.render();
          this.needsRendering = false;
        }
      }
    }

    if (startRenderTime) {
      this.beginTime = this.beginTime || startRenderTime;
      this.frames++;
      if (startRenderTime > this.beginTime + 1) {
        this.fps = this.frames / (startRenderTime - this.beginTime);
        this.minFps = Math.min(this.minFps, this.fps);
        this.beginTime = startRenderTime;
        this.frames = 0;

        this.fpsList.push(this.fps);
        if (this.fpsList.length > 20) this.fpsList.shift();

        if (!this.fpsCalculated && this.fpsList.length > 5) {
          Logger.info("init " + Math.round(this._endMeasure));
          this.fpsCalculated = true;
        }

        EventBus.trigger(EVENT.second);
      }
    }

    window.requestAnimationFrame(this.render.bind(this));
  }

  setModalElement(elm: ModalDialog) {
    this.modalElement = elm;
    Input.setFocusElement(elm);
  }

  getModalElement() {
    return this.modalElement;
  }

  removeModalElement() {
    if (this.modalElement) {
      Input.clearFocusElement();
    }
    this.modalElement = undefined;
    this.mainPanel?.refresh();
    this.needsRendering = true;
  }

  setSelection(_selection: SelectionHandler) {
    this.selection = _selection;
    this.prevSelection = this.selection;
  }

  getSelection(): SelectionHandler | undefined {
    return this.selection;
  }

  clearSelection() {
    if (this.selection) {
      const doClear = this.selection(SELECTION.RESET);
      if (doClear) this.selection = undefined;
    }
  }

  copySelection(andClear?: boolean) {
    if (this.selection) {
      this.selection(SELECTION.COPY);
      if (andClear) this.selection(SELECTION.RESET);
    }
    this.selection = undefined;
  }

  cutSelection(andClear?: boolean) {
    if (this.selection) {
      this.selection(SELECTION.CUT);
      if (andClear) this.selection(SELECTION.RESET);
    }
    this.selection = undefined;
  }

  deleteSelection() {
    if (this.selection) {
      this.selection(SELECTION.DELETE);
    }
    this.selection = undefined;
  }

  pasteSelection(andClear: boolean = false) {
    if (!this.selection && this.prevSelection) {
      this.selection = this.prevSelection;
      this.selection(SELECTION.POSITION);
    }
    if (this.selection) {
      this.selection(SELECTION.PASTE);
      if (andClear) this.selection(SELECTION.RESET);
    }
    this.selection = undefined;
  }

  showContextMenu(properties: {
    name: string | number;
    x: number;
    y: number;
    items: MenuItem[];
  }) {
    EventBus.trigger(EVENT.showContextMenu, properties);
  }

  hideContextMenu() {
    EventBus.trigger(EVENT.hideContextMenu);
  }

  showDialog(
    text: string,
    onOk?: (value: string | undefined) => void,
    onCancel?: () => void,
    useInput?: boolean,
  ) {
    if (this.mainPanel === null) {
      console.error("Cannot show a dialog without the main panel initalized!");
      return;
    }
    const dialog = new ModalDialog();
    dialog.setProperties({
      width: this.mainPanel.width,
      height: this.mainPanel.height,
      top: 0,
      left: 0,
      ok: !!onOk,
      cancel: !!onCancel,
      input: !!useInput,
    });

    dialog.onClick = function (touchData) {
      if (useInput) {
        const elm = dialog.getElementAtPoint(touchData.x, touchData.y);
        if (elm.name === "dialoginput" && elm.activate) {
          elm.activate();
          return;
        }
      }
      if (onCancel) {
        const elm = dialog.getElementAtPoint(touchData.x, touchData.y);
        if (elm && elm.name) {
          if (elm.name === "okbutton") {
            if (typeof onOk === "function") onOk(dialog.inputValue);
          } else {
            if (typeof onCancel === "function") onCancel();
          }
          dialog.close();
        }
      } else {
        dialog.close();
        if (onOk) onOk(dialog.inputValue);
      }
    };

    dialog.onKeyDown = function (keyCode) {
      switch (keyCode) {
        case 13:
          const value = dialog.inputValue;
          dialog.close();
          if (onOk) onOk(value);
          return true;
        case 27:
          dialog.close();
          if (onCancel) onCancel();
          return true;
      }
    };

    dialog.setText(text);
    UI.setModalElement(dialog);
  }

  getChildren() {
    return this.children;
  }

  getEventElement(x: number, y: number): Element | undefined {
    let target: Element | undefined = undefined;
    for (const elm of this.children) {
      if (elm.isVisible() && elm.containsPoint(x, y)) {
        target = elm;
        break;
      }
    }

    if (target && target.children && target.children.length) {
      target = target.getElementAtPoint(x, y);
    }
    return target;
  }

  getInternalPoint(x: number, y: number, element: Element) {
    const offset = { left: 0, top: 0 };
    while (element.parent) {
      offset.left += element.left;
      offset.top += element.top;
      element = element.parent;
    }
    return { x: x - offset.left, y: y - offset.top };
  }

  setLoading() {
    this.setStatus("Loading", true);
    EventBus.trigger(EVENT.songLoading);
  }

  setStatus(status: string, showSpinner?: boolean) {
    EventBus.trigger(EVENT.statusChange, {
      status: status,
      showSpinner: !!showSpinner,
    });
  }

  setInfo(info: string, source?: string, url?: string) {
    EventBus.trigger(EVENT.statusChange, {
      info: info,
      source: source,
      url: url,
    });
  }

  stats() {
    return {
      fps: this.fps,
      minFps: this.minFps,
      averageFps: this.average(this.fpsList),
      averageRenderFps: this.average(this.renderfpsList),
      fpsList: this.fpsList,
      skipRenderSteps: this.skipRenderSteps,
    };
  }

  startMeasure() {
    if (Audio.context) {
      this.beginMeasure = Audio.context.currentTime;
      this.currentMeasure = this.beginMeasure;
    }
  }

  measure(message: string) {
    if (Audio.context) {
      const time = (Audio.context.currentTime - this.currentMeasure) * 1000;
      this.currentMeasure = Audio.context.currentTime;
      console.warn(message + ": " + time);
    }
  }

  endMeasure() {
    if (Audio.context) {
      this._endMeasure = (Audio.context.currentTime - this.beginMeasure) * 1000;
      if (debug) console.warn("Total time: " + this._endMeasure);
    }
  }

  getAverageFps(): number {
    return this.fpsList.length > 2 ? this.average(this.fpsList) : 60;
  }

  resetAverageFps() {
    const last = this.fpsList.pop();
    this.fpsList = last ? [last] : [];
  }

  skipFrame(value: number) {
    console.log("Setting SkipFrame to " + value);
    this.skipRenderSteps = value;
    Settings.skipFrame = value;
    EventBus.trigger(EVENT.skipFrameChanged, this.skipRenderSteps);
  }

  getSkipFrame() {
    return this.skipRenderSteps;
  }

  playRandomSong(format?: string) {
    if (this.mainPanel == null) {
      console.error("Need to initalize the UI before playing a random song!");
      return;
    }
    this.mainPanel.getDiskOperations().playRandomSong(format);
  }

  private average(arr: number[]): number {
    if (!arr.length) return 0;
    const max = arr.length;
    let total = 0;
    for (let i = 0; i < max; i++) total += arr[i];
    return total / max;
  }
}

export const UI = new _UI();
