export interface Sprite {
	img?: HTMLImageElement,
	name: string,
	x?: number,
	y?: number,
	width?: number,
	height?: number,
}

export default class YascalSprite {
	canvas = document.createElement("canvas");
	private ctx = this.canvas.getContext("2d");

	constructor(initialProperties: Sprite) {
		if (initialProperties){
			if (this.ctx == null) {
				console.error(`Failed to initialize canvas for Yascal Sprite: ${initialProperties.img}`)
				return;
			}
			if (initialProperties.width){
				this.canvas.width = initialProperties.width;
				this.canvas.height = initialProperties.height || initialProperties.width;
			}
			if (initialProperties.img){
				const x=initialProperties.x||0;
				const y=initialProperties.y||0;
				const w=this.canvas.width;
				const h=this.canvas.height;
				this.ctx.drawImage(initialProperties.img,x,y,w,h,0,0,w,h);
			}
		}
	}
};