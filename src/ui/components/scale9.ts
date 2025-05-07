import { Scale9 } from "../assets";
import { ScaleRule } from "../basetypes";
import Element, { ElementProperties } from "./element";

interface Scale9PanelProperties extends ElementProperties {
	img?: HTMLCanvasElement
	scale?: ScaleRule
	imgTop?: number
	imgBottom?: number
	imgLeft?: number
	imgRight?: number
}

export default class Scale9Panel extends Element {
	private base: Scale9;
    startDragIndex: number | undefined; // Used by listbox.ts & waveform.ts
	startLeft: number | undefined; // Used by waveform.ts

	constructor(x: number, y: number, w: number, h: number, base: Scale9) { // UI.scale9Panel
		super(x,y,w,h);
		this.type = "scale9";

		base.scale = base.scale || ScaleRule.stretch;
		//if (base) this.setProperties(base);
		this.base = base;
	}

	setProperties(p: Scale9PanelProperties) {
		//const me = this;
		//const properties = ["left","top","width","height","name","type"];

		/*if (!p){
			const result = {};
			properties.forEach(function(key){
				result[key] = me[key];
			});
			return result;
		}*/

		this.left = p.left ?? this.left;
		this.top = p.top ?? this.top;
		this.width = p.width ?? this.width;
		this.height = p.height ?? this.height;
		this.name = p.name ?? this.name;
		this.type = p.type ?? this.type;
		this.zIndex = p.zIndex ?? this.zIndex;

		if (typeof p.img !== "undefined") this.base.img=p.img;
		if (typeof p.scale !== "undefined") this.base.scale=p.scale;

		if (typeof p.imgTop !== "undefined") this.base.top=p.imgTop;
		if (typeof p.imgBottom !== "undefined") this.base.bottom=p.imgBottom;
		if (typeof p.imgLeft !== "undefined") this.base.left=p.imgLeft;
		if (typeof p.imgRight !== "undefined") this.base.right=p.imgRight;

		this.setSize(this.width,this.height);
		this.setPosition(this.left,this.top);

	};

	private createCanvas() {
		const base = this.base;
		const img = base.img;

		if (img){
			const centerW = img.width-base.left-base.right;
			const centerH = img.height-base.top-base.bottom;

			const targetCenterW = this.width-base.left-base.right;
			const targetCenterH = this.height-base.top-base.bottom;

			this.clearCanvas();

			// topleft
			if (base.top && base.left) this.ctx.drawImage(img,0,0,base.left,base.top,0,0,base.left,base.top);

			// top
			if (base.top) this.ctx.drawImage(img,base.left,0,centerW,base.top,base.left,0,targetCenterW,base.top);

			// topright
			if (base.top && base.right) this.ctx.drawImage(img,base.left+centerW,0,base.right,base.top,base.left+targetCenterW,0,base.right,base.top);


			// midLeft
			if (base.left) this.ctx.drawImage(img,0,base.top,base.left,centerH,0,base.top,base.left,targetCenterH);

			// mid
			if (base.scale === ScaleRule.stretch){
				this.ctx.drawImage(img,base.left,base.top,centerW,centerH,base.left,base.top,targetCenterW,targetCenterH);
			}


			if (base.scale === ScaleRule.repeatX){
				let tx = base.left;
				const tMax = base.left+targetCenterW;
				let tw;

				// render first row
				while (tx<tMax){
					tw = centerW;
					if (tx+tw>tMax) tw = tMax-tx;
					this.ctx.drawImage(img,base.left,base.top,tw,centerH,tx,base.top,tw,centerH);
					tx+=tw;
				}

			}

            if (base.scale === ScaleRule.repeatY){
                let ty = base.top;
                const tMax = base.top+targetCenterH;
                let th;

                // render first col
                while (ty<tMax){
                    th = centerH;
                    if (ty+th>tMax) th = tMax-ty;
                    this.ctx.drawImage(img,base.left,base.top,centerW,th,base.left,ty,centerW,th);
                    ty+=th;
                }
            }


			// midRight
			if (base.right) this.ctx.drawImage(img,base.left+centerW,base.top,base.right,centerH,base.left+targetCenterW,base.top,base.right,targetCenterH);

			// bottomLeft
			if (base.bottom && base.left) this.ctx.drawImage(img,0,base.top+centerH,base.left,base.bottom,0,base.top+targetCenterH,base.left,base.bottom);

			// bottom
			if (base.bottom) this.ctx.drawImage(img,base.left,base.top+centerH,centerW,base.bottom,base.left,base.top+targetCenterH,targetCenterW,base.bottom);

			// bottomRight
			if (base.bottom && base.right) this.ctx.drawImage(img,base.left+centerW,base.top+centerH,base.right,base.bottom,base.left+targetCenterW,base.top+targetCenterH,base.right,base.bottom);

			//myCtx.drawImage(img,0,0);
		}
	};

	render(internal: true): HTMLCanvasElement
	render(internal: false): void
	render(): void
	render(internal?: boolean): HTMLCanvasElement | void {

		internal = !!internal;
		if (!this.isVisible()) return;

		if (this.needsRendering){
			this.createCanvas();
		}
		this.needsRendering = false;

		if (internal){
			return this.canvas;
		}else{
			this.parentCtx.drawImage(this.canvas,this.left,this.top);
		}
	};
}