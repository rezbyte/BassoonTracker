import BitmapFont from "./components/bitmapfont";
import Button from "./components/button";
import NumberDisplay, {
  NumberDisplayProperties,
} from "./components/numberdisplay";
import ticker from "./ticker";
import Assets from "./assets";
import { LabelStruct, Size } from "./basetypes";

type SpinBoxSize = Size.medium | Size.big;

interface SpinBoxProperties extends NumberDisplayProperties {
  size?: SpinBoxSize;
  label?: string;
  labels?: LabelStruct[];
  font?: BitmapFont;
}
export default class SpinBox extends NumberDisplay {
  private size: SpinBoxSize = Size.medium;
  private label = "";
  private labels: LabelStruct[] = [];
  private buttonDown: Button;
  private buttonUp: Button;
  private labelFont: BitmapFont | undefined;

  constructor(initialProperties?: SpinBoxProperties) {
    // UI.spinBox
    super(initialProperties);
    this.type = "spinBox";

    this.buttonDown = Assets.generate("button20_20");
    this.buttonDown.onDown = () => {
      if (this.isDisabled) return;
      this.updateValue(this.getValue() - this.step);
      ticker.onEachTick4(() => {
        this.updateValue(this.getValue() - this.step);
      }, 10);
    };
    this.buttonDown.onTouchUp = () => {
      ticker.onEachTick4();
    };

    this.buttonDown.setProperties({
      name: "buttonDown",
      label: "↓",
    });
    this.addChild(this.buttonDown);

    this.buttonUp = Assets.generate("button20_20");
    this.buttonUp.onDown = () => {
      if (this.isDisabled) return;
      this.updateValue(this.getValue() + this.step);
      ticker.onEachTick4(() => {
        this.updateValue(this.getValue() + this.step);
      }, 10);
    };
    this.buttonUp.onTouchUp = () => {
      ticker.onEachTick4();
    };
    this.buttonUp.setProperties({
      name: "buttonUp",
      label: "↑",
    });
    this.addChild(this.buttonUp);
    if (initialProperties) this.setProperties(initialProperties);
  }

  setProperties(properties: SpinBoxProperties) {
    this.setPropertiesValues(properties);
    if (typeof properties.size != "undefined") this.size = properties.size;
    if (typeof properties.label != "undefined") this.label = properties.label;
    if (typeof properties.labels != "undefined")
      this.labels = properties.labels;
    if (typeof properties.font != "undefined") this.labelFont = properties.font;
    if (typeof properties.step != "undefined") this.step = properties.step;
    //if (typeof properties.disabled != "undefined") disabled = !!properties.disabled;
    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);
  }

  renderInternal() {
    if (this.label) {
      if (this.labelFont) {
        this.labelFont.write(this.ctx, this.label, 6, 11, 0);
      } else {
        this.ctx.fillStyle = "white";
        this.ctx.fillText(this.label, 10, 10);
      }
    }

    this.buttonUp.render();
    this.buttonDown.render();

    //if (this.needsRendering){
    //this.clearCanvas();

    //if (size === "big"){
    //this.ctx.drawImage(Y.getImage(backGroundImage),buttonUp.left - 36,-1,34+2,this.height+1);

    //window.fontLedBig.write(this.ctx,padValue(),buttonUp.left - 36,2,0);
    //window.fontLedBig.write(this.ctx,padValue(),buttonUp.left - 31,4,0);

    //}else{

    /*
				var padding = 2;
				 
				
				var valueX = buttonUp.left - 32 - 10 - 4;
				var valueY = 2;
				var valueW = 40;
				var valueH = 24 + padding*2;


				if (padLength === 2){
					valueW = 24;
					valueX += 16;
				}

				if (padLength === 3){
					valueW = 32;
					valueX += 8;
				}

				if (padLength === 5){
					valueW = 48;
					valueX -= 8;
				}
				
				valueW += padding*2;
				valueX -= padding;
				valueY -= padding;
				
				

				this.ctx.drawImage(Y.getImage(backGroundImage),valueX,valueY,valueW,valueH);

				valueX +=4;
				valueY = 7;
				window.fontLed.write(this.ctx,padValue(),valueX,valueY,0);

				if (isCursorVisible){
					this.ctx.fillStyle = "rgba(255,201,65,0.7)";
					var charWidth = 8;
					var cursorX = valueX + cursorPos*charWidth;
					this.ctx.fillRect(cursorX,4,2,this.height-8);
				}
				*/
    //}

    //body.style.backgroundColor  ="rgba(255,201,65,0.7)";

    //var b = buttonUp.render(true);
    //this.ctx.drawImage(b,10,10,50,30);
    //}
  }

  onResize() {
    //this.setPadLength(Math.floor(this.width/9) - 1);

    if (this.labels) {
      this.labels.forEach((item) => {
        if (this.width >= item.width) this.label = item.label;
      });
    }

    if (this.size === Size.big) {
      this.buttonUp.setProperties({
        left: this.width - this.buttonDown.width,
        height: Math.floor(this.height / 2),
        top: 0,
      });
      this.buttonDown.setProperties({
        left: this.buttonUp.left,
        height: this.buttonUp.height,
        top: this.height - this.buttonUp.height,
      });

      this.paddingLeft = 2;
      this.paddingRight = this.buttonUp.width;
      this.paddingBottom = -1;
      this.paddingTop = -1;
    } else {
      this.buttonDown.setProperties({
        left: this.width - this.buttonDown.width,
        top: 3,
      });
      this.buttonUp.setProperties({
        left: this.width - this.buttonUp.width - this.buttonDown.width,
        top: 3,
      });

      this.paddingLeft = this.buttonUp.left - this.padLength * 8 - 10 - 4;
      this.paddingRight = this.buttonUp.width + this.buttonDown.width + 1;
      this.paddingBottom = this.height - this.buttonUp.height - 8;
    }
  }
}
