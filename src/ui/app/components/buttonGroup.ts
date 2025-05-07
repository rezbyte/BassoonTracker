import Panel from "../../components/panel";
import Scale9Panel from "../../components/scale9";
import Assets from "../../assets";
import Label from "../../components/label";
import { UI } from "../../main";
import { EVENT } from "../../../enum";
import EventBus from "../../../eventBus";
import Button from "../../components/button";
import NumberDisplay from "../../components/numberdisplay";
import type { SamplePropertyChangeData } from "../../waveform";

export interface ButtonInfo {
	type?: string,
	value?:  number,
	onSamplePropertyChange?: (button: Button | NumberDisplay, props: SamplePropertyChangeData) => void,
	label: string, 
	width?: number, 
	onClick?: () => void,
	onDown?: () => void,
	onUp?: () => void
}

export default class ButtonGroup extends Panel {
	private titleBar: Scale9Panel;
	private buttons: (Button | NumberDisplay)[];

	constructor(title: string, buttonsInfo: ButtonInfo[]) { // UI.buttonGroup
		super();
		this.hide();

		this.titleBar = new Scale9Panel(0,0,20,20,Assets.panelDarkGreyScale9);
		this.titleBar.ignoreEvents = true;
		this.addChild(this.titleBar);

		const titleLabel = new Label({
			label: title,
			font: UI.fontSmall,
			width: 60,
			top: 1
		});
		this.addChild(titleLabel);

		this.buttons = [];

		buttonsInfo.forEach((buttonInfo) => {
			let button: Button | NumberDisplay;
			if (buttonInfo.type === "number"){
				button = new NumberDisplay({
					autoPadding: true
				});
				button.setValue(buttonInfo.value ?? 0);
			}else{
				button = Assets.generate("buttonLight");
				button.setLabel(buttonInfo.label);
				button.onClick = buttonInfo.onClick;
			}
			button.widthParam = buttonInfo.width || 100;
			this.addChild(button);
			this.buttons.push(button);


			if (buttonInfo.onSamplePropertyChange){
				EventBus.on(EVENT.samplePropertyChange,(newProps: SamplePropertyChangeData) => {
					if (buttonInfo.onSamplePropertyChange) buttonInfo.onSamplePropertyChange(button,newProps);
				});
			}
		});
	}
	onResize(){
		this.titleBar.setSize(this.width,18);

		let buttonTop = 20;
		const buttonHeight = (this.height-buttonTop-2) / 4;
		const buttonWidth = this.width;
		let left = 0;

		this.buttons.forEach(function(button,index){
			button.setProperties({
				width: Math.floor(buttonWidth * button.widthParam/100),
				height: buttonHeight,
				left: Math.floor(left * buttonWidth/100),
				top: buttonTop
			});

			left += button.widthParam;
			if (left>95){
				left=0;
				buttonTop+=buttonHeight;
			}
		});
	};
}