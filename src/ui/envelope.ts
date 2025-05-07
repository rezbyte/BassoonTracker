import Instrument from "../models/instrument";
import Element from "./components/element";
import Scale9Panel from "./components/scale9";
import type { Envelope as EnvelopeModel } from "../models/instrument";
import { Y } from "./yascal/yascal";
import type { Drag, Touch, TouchData } from "./input";

interface Point {
	minX: number,
	maxX: number,
	minY: number,
	maxY: number,
	p: number[]
}

interface DragPoint {
	startX: number,
	startY: number,
	pX: number,
	pY: number
}

export type EnvelopeType = "volume" | "panning"

export default class Envelope extends Element {
	private background: Scale9Panel;
	//private currentInstrument: Instrument | null;
	private currentEnvelope: EnvelopeModel | null;
	private isDragging: boolean;
	private dragPoint: DragPoint | null;
	private activePoint: Point | null;
	private activePointIndex: number;
	private prevActivePointIndex: number | null;
	private xScale: number;
	private yScale: number;

	constructor(type: EnvelopeType) { // UI.Envelope
		super();
		this.type = type;
		this.background = new Scale9Panel(0,0,this.width,this.height,{
			img: Y.getImage("panel_dark"),
			left:3,
			top:3,
			right:2,
			bottom: 2
		});
		this.background.ignoreEvents = true;
		//this.currentInstrument = null;
		this.currentEnvelope = null;
		this.isDragging = false;
		this.dragPoint = null;
		this.activePoint = null;
		this.activePointIndex = -1;
		this.prevActivePointIndex = null;
		this.xScale = this.width/324;
		this.yScale = this.height/64;
	}
	
	onResize() {
		this.xScale = this.width/324;
		this.yScale = this.height/64;
	};

	onHover(data: TouchData) {
		if (!this.isDragging){
			this.activePointIndex = -1;
			this.activePoint = null;

			if (this.currentEnvelope && this.currentEnvelope.enabled){
				if (this.eventX === undefined) {
					console.error("Envelope.onDrag expected eventX to be processed!");
					return;
				}
				if (this.eventY === undefined) {
					console.error("Envelope.onDrag expected eventY to be processed!");
					return;
				}
                const x = Math.round(this.eventX/this.xScale);
                const y = Math.round((this.height - this.eventY)/this.yScale);


				for (let i = 0, max = this.currentEnvelope.count; i<max; i++){
					const point = this.currentEnvelope.points[i] || [0,0];
					if (Math.abs(x - point[0])<6 && Math.abs(y - point[1])<6){
						this.activePointIndex = i;
						this.activePoint = {
							p: this.currentEnvelope.points[i],
							minY: 0,
							maxY: 64,
							minX: 0,
							maxX: 0
						};
						if (i !== 0) {
							this.activePoint.minX = this.currentEnvelope.points[i-1][0];
							this.activePoint.maxX = 324;
							if (i<this.currentEnvelope.count-1) this.activePoint.maxX = this.currentEnvelope.points[i+1][0]
						}
						break;
					}
				}

				if (this.prevActivePointIndex !== this.activePointIndex){
					this.prevActivePointIndex = this.activePointIndex;
					this.refresh();
				}
			}
		}

	};


	onDragStart(touchData: Touch) {
		if (this.activePoint){
			this.dragPoint = {
				startX: touchData.startX,
				startY: touchData.startY,
				pX: this.activePoint.p[0],
				pY: this.activePoint.p[1]
			};
			this.isDragging = true;
		}

	};

	onDrag(touchData: Drag) {
		if (this.isDragging){
			if (this.activePoint === null) {
				console.error("Envelope.onDrag expected activePoint to be processed by onHover()!");
				return;
			}
			if (this.dragPoint === null) {
				console.error("Envelope.onDrag expected dragPoint to be processed by onDragStart()!");
				return;
			}
			const dragDeltaX = (touchData.deltaX)/this.xScale;
			const dragDeltaY = (touchData.deltaY)/this.yScale;

			let newX = this.dragPoint.pX + dragDeltaX;
			newX = Math.min(this.activePoint.maxX,newX);
			newX = Math.max(this.activePoint.minX,newX);

			let newY = this.dragPoint.pY - dragDeltaY;
			newY = Math.min(this.activePoint.maxY,newY);
			newY = Math.max(this.activePoint.minY,newY);

			this.activePoint.p[0] = newX;
			this.activePoint.p[1] = newY;

			this.refresh();
		}
	};

	onTouchUp(touchData: Touch) {
		this.isDragging = false;
	};

	setInstrument(instrument: Instrument) {
		//this.currentInstrument = instrument;
		if (instrument){
			if (this.type === "volume") {
				this.currentEnvelope = instrument.volumeEnvelope;
			} else if (this.type === "panning") {
				this.currentEnvelope = instrument.panningEnvelope;
			} else {
				this.currentEnvelope = null;
			}
		}else{
			this.currentEnvelope = null;
		}
		this.refresh();
	};

	render(internal?: boolean) {

		if (this.needsRendering) {

			if (this.background.width !== this.width) this.background.setSize(this.width,this.height);
			this.ctx.drawImage(this.background.render(true),0,0,this.width,this.height);

			this.ctx.lineWidth = 1;

			if (this.type === "panning"){
				this.ctx.strokeStyle = "#4a7c92";
				this.ctx.setLineDash([1, 2]);
				const y = Math.floor(this.height/2);
				this.ctx.beginPath();
				this.ctx.moveTo(0, y);
				this.ctx.lineTo(this.width, y);
				this.ctx.stroke();
			}

			if (this.currentEnvelope && this.currentEnvelope.count){

				const xScale = this.width/324;
				const yScale = this.height/64;


				this.ctx.strokeStyle = this.currentEnvelope.enabled ? 'rgba(120, 255, 50, 0.5)' : 'rgba(120, 120, 180, 0.5)';

				this.ctx.beginPath();
				this.ctx.setLineDash([]);

				for (let i = 0; i<this.currentEnvelope.count; i++){

					const co = this.currentEnvelope.points[i];
					if (co){
						const x = co[0] * xScale;
						const y = this.height - (co[1] * yScale);

						let size = 4;
						let color = this.currentEnvelope.enabled ? "#D2861B" : "#546888";

						if (i === this.activePointIndex){
							size = 6;
							color = "#FFFFFF";
						}

						this.ctx.fillStyle = color;

						if (i === 0){
							this.ctx.moveTo(x, y);
						}else{
							this.ctx.lineTo(x, y);
						}

						const h = size/2;
						this.ctx.fillRect(x-h, y-h, size, size);
					}

				}
				this.ctx.stroke();

				if (this.currentEnvelope.enabled){
					const drawLine = (x: number) => {
						this.ctx.beginPath();
						this.ctx.moveTo(x, 0);
						this.ctx.lineTo(x, this.height);
						this.ctx.stroke();
					}

					if (this.currentEnvelope.sustain){
						const sustainPoint = this.currentEnvelope.points[this.currentEnvelope.sustainPoint || 0];
						if (sustainPoint){
							this.ctx.strokeStyle = "#67b6d2";
							this.ctx.setLineDash([1, 2]);
							drawLine(sustainPoint[0] * xScale);
						}
					}

					if (this.currentEnvelope.loop){
						this.ctx.strokeStyle = "#d2b637";
						this.ctx.setLineDash([1, 2]);

						const loopStartPoint = this.currentEnvelope.points[this.currentEnvelope.loopStartPoint || 0];
						const loopEndPoint = this.currentEnvelope.points[this.currentEnvelope.loopEndPoint || 0];
						if (loopStartPoint) drawLine(loopStartPoint[0] * xScale);
						if (loopEndPoint) drawLine(loopEndPoint[0] * xScale);


					}





				}



			}

		}
		this.needsRendering = false;


		this.parentCtx.drawImage(this.canvas,this.left,this.top,this.width,this.height);
		return undefined;
	};
}

