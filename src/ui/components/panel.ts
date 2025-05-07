import Element, {  ElementProperties } from "./element";

interface PanelProperties extends ElementProperties {
	backgroundColor?: string
	borderColor?: string
}

export default interface Panel {
	setLayout?(left: number, top: number, width: number, height: number): void
	renderInternal?(): void
}
export default class Panel extends Element {
	private backgroundColor: string | null;
	private borderColor: string | null;
	renderOverride: (() => void) | null;

	// onClick = () => {}
	constructor(x?: number, y?: number, w?: number, h?: number) { // Formerly UI.panel
		super(x,y,w,h)
		this.type = "panel"
		this.backgroundColor = null;
		this.borderColor = null;
		this.renderOverride = null;
	}
	setProperties(p: PanelProperties) {
		this.left = p.left ?? this.left;
		this.top = p.top ?? this.top;
		this.width = p.width ?? this.width;
		this.height = p.height ?? this.height;
		this.name = p.name ?? this.name;
		this.type = p.type ?? this.type;
		this.zIndex = p.zIndex ?? this.zIndex;
		this.backgroundColor = p.backgroundColor ?? this.backgroundColor;
		this.borderColor = p.borderColor ?? this.borderColor;

		this.setSize(this.width,this.height);
		this.setPosition(this.left,this.top);

		if (this.setLayout) this.setLayout(this.left,this.top,this.width, this.height);
	}
	render(internal?: boolean): HTMLCanvasElement | undefined {
		if (!this.isVisible()) return;
		internal = !!internal;

		if (this.needsRendering){
			
			if (this.renderOverride){
				this.renderOverride();
			}else{
				this.clearCanvas();

				if (this.backgroundColor){
					this.ctx.fillStyle = this.backgroundColor;
					this.ctx.fillRect(0,0,this.width,this.height);
				}
				if (this.borderColor){
					this.ctx.fillStyle = this.borderColor;
					this.ctx.rect(0,0,this.width,this.height);
					this.ctx.stroke();
				}

				this.children.forEach(function(elm){
					elm.render();
				});

				if (this.renderInternal) this.renderInternal();
			}
		}
		
		this.needsRendering = false;
		if (internal){
			return this.canvas;
		}else{
			this.parentCtx.drawImage(this.canvas,this.left,this.top,this.width,this.height);
		}
	}
	sortZIndex() {
		// sort reverse order as children are rendered bottom to top;
		this.children.sort(function(a: Element, b: Element){
			if (a.zIndex == b.zIndex) return 0;
			if (a.zIndex === undefined || b.zIndex === undefined) return -1;
			if (a.zIndex > b.zIndex) return 1;
			return -1;
		});
	}
}