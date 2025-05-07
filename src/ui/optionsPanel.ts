import { COMMAND, EVENT,  STEREOSEPARATION } from "../enum";
import Button from "./components/button";
import Label from "./components/label";
import Panel from "./components/panel";
import Scale9Panel from "./components/scale9";
import Assets from "./assets";
import { CheckboxButton } from "./components/checkboxbutton";
import EventBus from "../eventBus";
import Tracker from "../tracker";
import Layout from "./app/layout";
import Midi from "../audio/midi";
import Audio from "../audio";
import { UI } from "./main";
import Settings from "../settings";
import App from "../app";
import { LabelStruct, TextAlignment } from "./basetypes";


interface Option {
	buttons?: Button[];
	label: string; 
	labelElement?: Label;
	labels?: LabelStruct[]; 
	labelBox?: Scale9Panel;
	values: string[]; 
	valueLabels?: Record<string, LabelStruct[]>
	setValue: (index: number) => void; 
	getValue: () => number; 
	checkBoxes?: { label: string; labels: LabelStruct[]; getValue: () => boolean; handler: (active: boolean) => void; }[];
	checkBox?: CheckboxButton
}

export default class OptionsPanel extends Panel {
	private background: Scale9Panel;
	private mainLabel: Label;
	private closeButton: Button;
	private options: Option[];
	private isDisabled: boolean = false;

	constructor() { // UI.OptionsPanel
		super();
		this.hide();

		this.background = new Scale9Panel(0,0,20,20,Assets.panelMainScale9);
		this.background.ignoreEvents = true;
		this.addChild(this.background);

		this.mainLabel = new Label({
			label: "Options:",
			font: UI.fontMed,
			left: 5,
			height: 18,
			top: 9,
			width: 200
		});
		this.addChild(this.mainLabel);

		//const insetPanel = new Scale9Panel(0,0,0,0,Assets.panelInsetScale9);
		//this.addChild(insetPanel);

		this.closeButton = Assets.generate("button20_20");
		this.closeButton.setLabel("x");
		this.closeButton.onClick = () => {
			App.doCommand(COMMAND.showTopMain);
		};
		this.addChild(this.closeButton);

		this.options = [
			{
				label: "VU bars",
				values: ["NONE", "COLOURS: AMIGA","TRANSPARENT"],
				valueLabels: {
					"COLOURS: AMIGA": [
						{width: 56, label: "AMIGA"},
						{width: 110, label: "COLOURS: AMIGA"}
					]
				},
				setValue: (index: number) => {
					if (index === 0){
						Settings.vubars = "none";
					}else if (index === 2){
						Settings.vubars = "trans";
					}else{
						Settings.vubars = "colour";
					}
					Settings.saveSettings();
				},
				getValue: () => {
					let result = 1;
					if (Settings.vubars === "none") result = 0;
					if (Settings.vubars === "trans") result = 2;
					return result;
				}
			},
			{
				label: "Stereo",
				values: ["Hard: Amiga", "Balanced", "None: mono"],
				setValue: (index: number) => {
					if (index === 0){
						Audio.setStereoSeparation(STEREOSEPARATION.FULL)
					}else if (index === 2){
						Audio.setStereoSeparation(STEREOSEPARATION.NONE)
					}
					else{
						Audio.setStereoSeparation(STEREOSEPARATION.BALANCED)
					}
					Settings.saveSettings();
				},
				getValue: () => {
					let result = 1;
					if (Settings.stereoSeparation === STEREOSEPARATION.NONE) result = 2;
					if (Settings.stereoSeparation === STEREOSEPARATION.FULL) result = 0;
					return result;
				}
			},
			{
				label: "Keyboard Layout",
				labels : [
					{width: 56, label: "Keyboard"},
					{width: 110, label: "Keyboard Layout"}
				],
				values: ["QWERTY","AZERTY","QWERTZ","Dvorak"],
				setValue:(index: number) => {
					if (index === 0){
						Settings.keyboardTable = "qwerty";
					}else if (index === 1){
						Settings.keyboardTable = "azerty";
					}else if (index === 2) {
						Settings.keyboardTable = "qwertz";
					}else{
						Settings.keyboardTable = "dvorak";
					}
					Settings.saveSettings();
				},
				getValue:() => {
					let result = 0;
					if (Settings.keyboardTable === "azerty") result = 1;
					if (Settings.keyboardTable === "qwertz") result = 2;
					if (Settings.keyboardTable === "dvorak") result = 3;
					return result;
				},
				checkBoxes:[{
					label : "Show Key Input",
					labels: [
						{width: 60, label: "Show"},
						{width: 100, label: "Show Key"},
						{width: 150, label: "Show Key Input"}
					],
					getValue: () => {return Settings.showKey},
					handler: (active: boolean) => {
						Settings.showKey = active;
						Settings.saveSettings();
						EventBus.trigger(EVENT.menuLayoutChanged);
					}
				}]
			},
			{
				label: "Screen refresh",
				labels : [
					{width: 56, label: "Screen"},
					{width: 100, label: "Screen refresh"}
				],
				values: ["Smooth", "Normal", "Economical" , "Low CPU"],
				setValue: (index: number) => {
					UI.skipFrame(index);
					Settings.saveSettings();
				},
				getValue: () => {
					return UI.getSkipFrame();
				},
				checkBoxes:[{
					label : "Optimize High DPI",
					labels: [
						{width: 60, label: "H-DPI"},
						{width: 100, label: "High DPI"},
						{width: 155, label: "Optimize High DPI"}
					],
					getValue: () => {return Settings.highDPI}, 
					handler: (active: boolean) => {
						Settings.highDPI = active;
						Settings.saveSettings();
						UI.scaleToDevicePixelRatio(active);
					}
				}]
			},
			{
				label: "Frequency table",
				labels : [
					{width: 56, label: "Frequency"},
					{width: 110, label: "Frequency table"}
				],
				values: ["Linear", "Amiga periods"],
				valueLabels: {
					"Amiga periods": [
						{width: 56, label: "AMIGA"},
						{width: 110, label: "Amiga periods"}
					]
				},
				setValue: (index: number) => {
					Tracker.useLinearFrequency = index === 0;
				},
				getValue: () => {
					return Tracker.useLinearFrequency ? 0 : 1;
				}
			},
			{
				label: "Dropbox: existing file",
				labels : [
					{width: 20, label: "Dropbox"},
					{width: 80, label: "Dropbox save"},
					{width: 160, label: "Dropbox existing file"}
				],
				values: ["Rename", "Overwrite"],
				setValue: (index: number) => {
					if (index === 0){
						Settings.dropboxMode = "rename";
					}else{
						Settings.dropboxMode = "overwrite";
					}
					Settings.saveSettings();
				},
				getValue: () => {
					let result = 0;
					if (Settings.dropboxMode === "overwrite") result = 1;
					return result;
				}
			},
			{
				label: "Midi-in",
				labels : [
					{width: 20, label: "Midi"},
					{width: 80, label: "Midi-in"}
				],
				values: ["Disabled", "Enabled Note", "Enabled Note-Volume"],
				valueLabels: {
					"Enabled Note": [
						{width: 80, label: "Note"},
						{width: 150, label: "Enabled Note"}
					],
					"Enabled Note-Volume": [
						{width: 80, label: "Note-Volume"},
						{width: 150, label: "Enabled Note-Volume"}
					]
				},
				setValue: (index: number) => {
					if (index === 0){
						Settings.midi = "disabled";
						Midi.disable();
					}else if (index === 1){
						Settings.midi = "enabled-note";
						Midi.enable();
					}else{
						Settings.midi = "enabled";
						Midi.enable();
					}
					Settings.saveSettings();
				},
				getValue: () => {
					let result = 0;
					if (Settings.midi === "enabled-note") result = 1;
					if (Settings.midi === "enabled") result = 2;
					return result;
				},
				checkBoxes:[{
					label : "Show Midi Input",
					labels: [
						{width: 60, label: "Show"},
						{width: 100, label: "Show Midi"},
						{width: 150, label: "Show Midi Input"}
					],
					getValue: () => {return Settings.showMidi},
					handler: (active: boolean) => {
						Settings.showMidi = active;
						Settings.saveSettings();
						EventBus.trigger(EVENT.menuLayoutChanged);
					}
				}]
			}
		];

		this.options.forEach((option) => {
			const labelBox = new Scale9Panel(0,0,20,20,Assets.panelDarkGreyScale9);
			labelBox.ignoreEvents = true;
			this.addChild(labelBox);


			const label = new Label();
			label.setProperties({
				label: option.label,
				labels: option.labels,
				font: UI.fontSmall,
				textAlign: TextAlignment.center
			});
			this.addChild(label);
			option.labelBox = labelBox;
			option.labelElement = label;

			const buttons: Button[] = [];
			//const selectedIndex = option.getValue();

			for (let i = 0; i<option.values.length; i++){
				const value = option.values[i];
				if (value){
					const button = Assets.generate("buttonKey");
					if (button == null) {
						throw new Error("Failed to generate image: buttonKey for OptionsPanel!");
					}
					if (option.valueLabels && option.valueLabels[value]){
						button.setProperties({
							label: value,
							labels: option.valueLabels[value]
						});
					}else{
						button.setProperties({
							label: value
						});
					}

					button.index = i;
					//button.option = option;
					button.onClick = () => {
						if (this.isDisabled) return;
						this.activateOption(button, option);
					}
					this.addChild(button);
					buttons.push(button);
				}

				//this.addChild(button);
				//buttons.push(button);
			}
			option.buttons = buttons;
			
			if (option.checkBoxes){
				//for (i = 0; i<option.checkBoxes.length; i++){
					const b = option.checkBoxes[0];
					const cb = new CheckboxButton({
						background: Assets.panelDarkInsetScale9,
						hoverBackground: Assets.panelInsetScale9,
						activeBackground: Assets.panelDarkInsetScale9,
						label: b.label,
						labels: b.labels,
						checkbox: true
					});
					//cb.getValue = b.getValue;
					this.addChild(cb);
					cb.onClick = () => {
						b.handler(cb.isActive);
					}
				//}
				option.checkBox = cb;
					
			}
		});

		EventBus.on(EVENT.songPropertyChange,() => {
			if (this.isVisible()){
				this.onResize();
			}
		});
	
		EventBus.on(EVENT.trackerModeChanged,() => {
			const freqOptions = this.options[4];
			if (freqOptions.buttons && freqOptions.buttons.length){
				freqOptions.buttons.forEach((button) => {
					button.setDisabled(!Tracker.inFTMode());
				});
			}
	
			const stereoOptions = this.options[1];
			if (stereoOptions.buttons && stereoOptions.buttons.length){
				stereoOptions.buttons.forEach((button) => {
					button.setDisabled(Tracker.inFTMode());
				});
			}
	
			if (this.isVisible()){
				this.onResize();
			}
		});
	}

	private activateOption(button: Button, option: Option) {
		if (option.buttons){
			option.buttons.forEach((child) => {
				child.setActive(false);
			});
		}
		if (button.index !== null) {
			button.setActive(true);
			option.setValue(button.index)
		}
	};

    onShow() {
        this.onResize();
    };

	onResize() {
        if(!this.isVisible())return;

		this.clearCanvas();

		this.background.setProperties({
			left: 0,
			top: 0,
			height: this.height,
			width: this.width
		});

		const startTop = 5;
		//const innerHeight = this.height-(Layout.defaultMargin*2) - startTop;

		this.closeButton.setProperties({
			top: startTop,
			left: this.width - 30
		});

		/*insetPanel.setProperties({
			left: this.left + Layout.defaultMargin,
			top: this.top + startTop,
			height: innerHeight - 6 - mainLabel.height,
			width: this.width - (Layout.defaultMargin*2) - 4
		});*/

		let optionTops = [27,103];
		let optionHeight = 20;
		let buttonHeight = 20;
		let col=0;
		let row=0;
		let useMultipleRows = false;

		const maxVisible = this.options.length;
		let maxCols = this.options.length;
		if (this.width < 600){
			//maxVisible = 3;
            useMultipleRows = true;
            optionTops = [27,103];
            optionHeight = 18;
            buttonHeight = 18;
            maxCols = 4;
        }

		const bWidth = Math.floor(( this.width - Layout.defaultMargin*(maxCols+1)) / maxCols);

		this.options.forEach((option,index) => {
			//const thisLeft = Layout["col3"+(i+1)+"X"];

			let thisLeft = Layout.defaultMargin + (col*(bWidth+Layout.defaultMargin));
			const thisTop =  optionTops[row];

			if (index>=maxVisible) thisLeft = this.width + 100;

			if (option.labelBox) {
				option.labelBox.setProperties({
					top: thisTop,
					width: bWidth,
					height: optionHeight,
					left: thisLeft
				});
			}

			if (option.labelElement) {
				option.labelElement.setProperties({
					top: thisTop+3,
					//_width: Layout.col31W,
					width: bWidth,
					height: optionHeight,
					left: thisLeft+2
				});
			}
			const selectedIndex = option.getValue();

			if (option.buttons) {
				for (let b = 0; b<option.buttons.length; b++){
					const button = option.buttons[b];
					button.setProperties({
						top: thisTop + (b*buttonHeight) + optionHeight,
						height: buttonHeight,
						width: bWidth,
						left: thisLeft
					});

					button.setActive(b === selectedIndex);
				}
			}
			
			if (option.checkBox){
				option.checkBox.setProperties({
					top: this.height - buttonHeight - 7,
					height: buttonHeight + 4,
					width: bWidth,
					left: thisLeft
				})
				const value = option.checkBoxes?.[0].getValue();
				if (value === undefined) option.checkBox.setActive();
			}

            col++;
			if (useMultipleRows && col>=4) {
				col=0;
				row++;
            }

		});
	};
}
