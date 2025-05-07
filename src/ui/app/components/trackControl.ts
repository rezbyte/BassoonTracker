import { EVENT } from "../../../enum";
import BitmapFont from "../../components/bitmapfont";
import Button from "../../components/button";
import Element, { ElementProperties } from "../../components/element";
import { Y } from "../../yascal/yascal";
import Assets from "../../assets";
import EventBus from "../../../eventBus";

interface TrackControlProperties extends ElementProperties {
  track?: number;
  solo?: boolean;
  mute?: boolean;
  visible?: boolean;
}
export default class TrackControl extends Element {
  private font: BitmapFont | undefined;
  private track: number;
  private label: string;
  private soloButton: Button;
  private muteButton: Button;
  private fxButton: Button;

  constructor(x?: number, y?: number, w?: number, h?: number) {
    // UI.trackControl
    super(x, y, w, h); // UI.element(x,y,w,h,visible);
    this.type = "trackControl";
    this.track = 0;

    this.label = "";

    this.soloButton = Assets.generate("buttonDark");
    this.soloButton.setProperties({
      activeImage: Y.getImage("solo.png"),
      activeBackground: Assets.buttonDarkGreenActiveScale9,
    });
    this.soloButton.onClick = () => {
      const wasSolo = this.soloButton.isActive;
      this.soloButton.toggleActive();
      if (this.muteButton.isActive) this.muteButton.toggleActive();
      this.triggerChangeEvent(wasSolo);
    };
    this.soloButton.setProperties({
      name: "buttonSolo",
      label: "S",
    });
    this.addChild(this.soloButton);

    this.muteButton = Assets.generate("buttonDark");
    this.muteButton.setProperties({
      activeImage: Y.getImage("mute"),
      activeBackground: Assets.buttonDarkRedActiveScale9,
    });
    this.muteButton.onClick = this.mute.bind(this);
    this.muteButton.setProperties({
      name: "buttonMute",
      label: "M",
    });
    this.addChild(this.muteButton);

    this.fxButton = Assets.generate("buttonDark");
    this.fxButton.onClick = () => {
      this.fxButton.toggleActive();
      EventBus.trigger(EVENT.fxPanelToggle, this.track);
    };
    this.fxButton.setProperties({
      name: "buttonFX",
      label: "FX",
    });
    this.addChild(this.fxButton);
    EventBus.on(EVENT.trackScopeClick, (track: number) => {
      if (track === this.track && this.muteButton.onClick) {
        this.mute();
      }
    });
  }

  private mute() {
    this.muteButton.toggleActive();
    if (this.soloButton.isActive) this.soloButton.toggleActive();
    this.triggerChangeEvent();
  }

  setProperties(p: TrackControlProperties) {
    this.left = p.left ?? this.left;
    this.top = p.top ?? this.top;
    this.width = p.width ?? this.width;
    this.height = p.height ?? this.height;
    this.name = p.name ?? this.name;
    this.type = p.type ?? this.type;
    this.zIndex = p.zIndex ?? this.zIndex;
    this.track = p.track ?? this.track;

    if (p.solo !== undefined) {
      if (this.muteButton.isActive) this.muteButton.setActive(false);
      this.soloButton.setActive(p.solo);
      this.triggerChangeEvent();
    }
    if (p.mute !== undefined) {
      if (this.soloButton.isActive) this.soloButton.setActive(false);
      this.muteButton.setActive(p.mute);
      this.triggerChangeEvent();
    }
    this.visible = p.visible ?? this.visible;

    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);

    const buttonWidth = Math.floor(this.width / 3) + 1;

    this.soloButton.setProperties({
      left: 0,
      width: buttonWidth,
      top: 0,
      height: this.height,
    });
    this.muteButton.setProperties({
      left: buttonWidth - 1,
      width: buttonWidth,
      top: 0,
      height: this.height,
    });
    this.fxButton.setProperties({
      left: buttonWidth * 2 - 2,
      width: buttonWidth,
      top: 0,
      height: this.height,
    });
  }

  private triggerChangeEvent(wasSolo: boolean = false) {
    EventBus.trigger(EVENT.trackStateChange, {
      track: this.track,
      solo: this.soloButton.isActive,
      mute: this.muteButton.isActive,
      wasSolo: wasSolo,
    });
  }

  render(internal?: boolean) {
    if (!this.isVisible()) return;
    internal = !!internal;

    if (this.needsRendering) {
      this.clearCanvas();
      if (this.font) {
        this.font.write(this.ctx, this.label.toUpperCase(), 6, 11, 0);
      } else {
        this.ctx.fillStyle = "white";
        this.ctx.fillText(this.label, 10, 10);
      }

      this.soloButton.render();
      this.muteButton.render();
      this.fxButton.render();

      // arrow glyphs

      //const buttonCenterX = Math.floor((buttonUp.width - 8)/2);
      //const buttonCenterY = Math.floor((buttonUp.height - 8)/2);
      //window.fontMed.write(this.ctx,"↑",buttonUp.left + buttonCenterX,buttonUp.top + buttonCenterY,0);
      //window.fontMed.write(this.ctx,"↓",buttonDown.left + buttonCenterX,buttonDown.top + buttonCenterY,0);

      //const b = buttonUp.render(true);
      //this.ctx.drawImage(b,10,10,50,30);
    }
    this.needsRendering = false;

    if (internal) {
      return this.canvas;
    } else {
      this.parentCtx.drawImage(
        this.canvas,
        this.left,
        this.top,
        this.width,
        this.height,
      );
    }
  }
}
