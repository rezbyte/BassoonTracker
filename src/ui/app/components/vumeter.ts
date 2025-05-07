import { EVENT } from "../../../enum";
import Panel from "../../components/panel";
import { Y } from "../../yascal/yascal";
import EventBus from "../../../eventBus";
import Audio from "../../../audio";

interface VUMeterProperties {
  width?: number;
  left?: number;
}
export default class VUMeter extends Panel {
  private analyserLeft: AnalyserNode | undefined;
  private analyserRight: AnalyserNode | undefined;
  private connected: boolean;
  private dataArray: Uint8Array | undefined;
  private vuWidth: number;
  private vuHeight: number;
  private dotWidth: number;
  private margin: number;
  private middleMargin: number;
  private base: HTMLCanvasElement;
  private baseActive: HTMLCanvasElement;
  private baseCtx: CanvasRenderingContext2D;
  private baseActiveCtx: CanvasRenderingContext2D;
  private dotGreen: HTMLCanvasElement;
  private dotGreenActive: HTMLCanvasElement;
  private dotYellow: HTMLCanvasElement;
  private dotYellowActive: HTMLCanvasElement;
  private dotRed: HTMLCanvasElement;
  private dotRedActive: HTMLCanvasElement;

  constructor() {
    // UI.vumeter
    super();
    this.left = 400;
    this.top = 9;

    if (Audio.context) {
      this.analyserLeft = Audio.context.createAnalyser();
      this.analyserLeft.minDecibels = -90;
      this.analyserLeft.maxDecibels = -10;
      this.analyserLeft.smoothingTimeConstant = 0.85;

      this.analyserRight = Audio.context.createAnalyser();
      this.analyserRight.minDecibels = -90;
      this.analyserRight.maxDecibels = -10;
      this.analyserRight.smoothingTimeConstant = 0.85;

      this.analyserLeft.fftSize = 32;
      this.analyserRight.fftSize = 32;
      const bufferLength = this.analyserLeft.fftSize;
      this.dataArray = new Uint8Array(bufferLength);
    }
    this.connected = false;

    this.vuWidth = 500;
    this.vuHeight = 6;
    this.dotWidth = 10;
    this.margin = 2;
    this.middleMargin = 4;

    this.base = document.createElement("canvas");
    this.baseActive = document.createElement("canvas");
    this.baseCtx = VUMeter.getContext(this.base);
    this.baseActiveCtx = VUMeter.getContext(this.baseActive);

    this.dotGreen = VUMeter.getImage("vu_green");
    this.dotGreenActive = VUMeter.getImage("vu_green_active");
    this.dotYellow = VUMeter.getImage("vu_yellow");
    this.dotYellowActive = VUMeter.getImage("vu_yellow_active");
    this.dotRed = VUMeter.getImage("vu_red");
    this.dotRedActive = VUMeter.getImage("vu_red_active");
    this.setSize(this.vuWidth, this.vuHeight * 2 + this.middleMargin);
    this.buildVu();

    this.needsRendering = true;
    EventBus.on(EVENT.screenRender, () => {
      this.render();
    });
  }

  private static getImage(imageName: string): HTMLCanvasElement {
    const image = Y.getImage(imageName);
    if (image == null) {
      throw new Error(`Failed to get image: ${imageName} for VUMeter!`);
    }
    return image;
  }

  private static getContext(
    canvas: HTMLCanvasElement,
  ): CanvasRenderingContext2D {
    const context = canvas.getContext("2d");
    if (context == null) {
      throw new Error(`Failed to get a canvas context for a VUMeter!`);
    }
    return context;
  }

  private buildVu() {
    this.base.width = this.baseActive.width = this.vuWidth;
    this.base.height = this.baseActive.height = this.vuHeight;
    const dots = Math.floor(this.vuWidth / (this.dotWidth + this.margin));

    this.baseCtx.clearRect(0, 0, this.base.width, this.base.height);
    this.baseActiveCtx.clearRect(
      0,
      0,
      this.baseActive.width,
      this.baseActive.height,
    );

    for (let i = 0; i < dots; i++) {
      let img = this.dotGreen;
      let imgActive = this.dotGreenActive;
      if (i >= dots / 3) {
        img = this.dotYellow;
        imgActive = this.dotYellowActive;
      }
      if (i >= dots / 1.5) {
        img = this.dotRed;
        imgActive = this.dotRedActive;
      }

      this.baseCtx.drawImage(
        img,
        i * (this.dotWidth + this.margin),
        0,
        this.dotWidth,
        this.vuHeight,
      );
      this.baseActiveCtx.drawImage(
        imgActive,
        i * (this.dotWidth + this.margin),
        0,
        this.dotWidth,
        this.vuHeight,
      );
    }
    this.ctx.fillStyle = "#253352";
  }

  connect(audioNode: AudioNode) {
    if (Audio.context && this.analyserLeft && this.analyserRight) {
      const splitter = Audio.context.createChannelSplitter(2);
      audioNode.connect(splitter);
      splitter.connect(this.analyserLeft, 0);
      splitter.connect(this.analyserRight, 1);
      this.connected = true;
    }
  }

  setProperties(properties: VUMeterProperties) {
    this.vuWidth = properties.width ?? this.vuWidth;
    this.left = properties.left ?? this.left;

    this.setSize(this.vuWidth, this.vuHeight * 2 + this.middleMargin);
    this.buildVu();
  }

  render(internal?: boolean) {
    if (!this.connected) return;

    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.drawImage(this.base, 0, 0);
    this.ctx.drawImage(this.base, 0, this.vuHeight + this.middleMargin);

    const wLeft =
      this.dataArray && this.analyserLeft
        ? this.getW(this.analyserLeft, this.dataArray)
        : null;
    const wRight =
      this.dataArray && this.analyserRight
        ? this.getW(this.analyserRight, this.dataArray)
        : null;

    if (wLeft)
      this.ctx.drawImage(
        this.baseActive,
        0,
        0,
        wLeft,
        this.vuHeight,
        0,
        0,
        wLeft,
        this.vuHeight,
      );
    if (wRight)
      this.ctx.drawImage(
        this.baseActive,
        0,
        0,
        wRight,
        this.vuHeight,
        0,
        this.vuHeight + this.middleMargin,
        wRight,
        this.vuHeight,
      );

    //this.ctx.fillStyle = "green";
    //this.ctx.clearRect(400,4,400,20);
    //this.ctx.fillRect(400,4,400 * wLeft,8);
    //this.ctx.fillRect(400,16,400 * wRight,8);

    this.parentCtx.drawImage(this.canvas, this.left, this.top);

    //console.error(range);

    //console.error(dataArray[0]);
    return undefined;
  }

  private getW(analyser: AnalyserNode, buffer: Uint8Array): number {
    analyser.getByteTimeDomainData(buffer);
    const rangeLeft = VUMeter.getDynamicRange(buffer) * (Math.E - 1);
    return Math.min(Math.floor(rangeLeft * this.vuWidth), this.vuWidth);
  }

  private static getDynamicRange(buffer: Uint8Array): number {
    const len = buffer.length;
    let min = 128;
    let max = 128;

    for (let i = 0; i < len; i++) {
      const instrument = buffer[i];
      if (instrument < min) min = instrument;
      else if (instrument > max) max = instrument;
    }

    return (max - min) / 255;
  }
}
