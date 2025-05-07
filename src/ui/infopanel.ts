import Element, { ElementProperties } from "./components/element";
import EventBus, { StatusChange } from "../eventBus";
import { EVENT } from "../enum";
import Animsprite from "./components/animsprite";
import Assets from "./assets";
import Button from "./components/button";
import { UI } from "./main";
import Layout from "./app/layout";

interface InfoPanelProperties extends ElementProperties {
  setLayout?: (
    left: number,
    top: number,
    width: number,
    height: number,
  ) => void;
}

export default class InfoPanel extends Element {
  private text: string;
  private status: string;
  private moreInfoUrl: string | undefined;
  private infoButton: Button;
  private readonly spinner: Animsprite;
  constructor() {
    super();
    this.text = "";
    //let source = "";
    this.status = "";

    const infoButton = Assets.generate("buttonDark");
    if (infoButton == null) {
      throw new Error(
        "Failed to generate 'buttonDark' for an info button in an InfoPanel!",
      );
    }
    infoButton.setLabel("More info ");
    infoButton.onClick = () => {
      if (this.moreInfoUrl) window.open(this.moreInfoUrl);
    };
    this.infoButton = infoButton;
    this.addChild(this.infoButton);

    this.spinner = new Animsprite(5, 7, 20, 18, "boing", 11);
    this.addChild(this.spinner);
    this.spinner.hide();

    EventBus.on(EVENT.statusChange, (context: StatusChange) => {
      if (context) {
        if (typeof context.status !== "undefined") this.status = context.status;
        if (typeof context.info !== "undefined") {
          this.text = context.info;
          //source = context.source;
          this.moreInfoUrl = context.url;
        }
        if (typeof context.showSpinner !== "undefined") {
          this.spinner.toggle(!!context.showSpinner);
        }
      }
      this.refresh();
    });
  }
  setProperties(p: InfoPanelProperties) {
    this.left = p.left ?? this.left;
    this.top = p.top ?? this.top;
    this.width = p.width ?? this.width;
    this.height = p.height ?? this.height;
    this.name = p.name ?? this.name;
    this.type = p.type ?? this.type;
    this.zIndex = p.zIndex ?? this.zIndex;

    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);

    //if (this.setLayout) this.setLayout(this.left,this.top,this.width, this.height);
    if (this.setLayout) this.setLayout();
  }

  setLayout() {
    const width = Layout.col1W;
    let label = "More Info";
    if (width < 100) label = "info";
    if (width < 45) label = "i";

    this.infoButton.setProperties({
      width: Layout.col1W,
      height: 24,
      top: 2,
      left: Layout.col5X - 2 - this.left,
      label: label,
      font: UI.fontFT,
    });
  }

  render(internal?: boolean) {
    if (!this.isVisible()) return;

    internal = !!internal;

    if (this.needsRendering) {
      this.clearCanvas();

      if (this.moreInfoUrl) this.infoButton.render();

      let fText = this.text;
      if (this.status) fText = this.status + ": " + fText;

      let textX = 6;
      if (this.spinner.isVisible()) {
        this.spinner.render();
        textX += 20;
      }

      if (UI.fontFT == null) {
        console.error("Missing fontFT for rendering an InfoPanel!");
        return;
      }
      UI.fontFT.write(this.ctx, fText, textX, 11, 0);
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
