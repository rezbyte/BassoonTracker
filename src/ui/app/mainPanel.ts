import { EVENT, TRACKERMODE, VIEW } from "../../enum";
import Button from "../components/button";
import InputBox from "../components/inputbox";
import ListBox, { ListBoxItem } from "../components/listbox";
import Scale9Panel from "../components/scale9";
import { Y } from "../yascal/yascal";
import AppPanelContainer from "./panelContainer";
import Assets from "../assets";
import RadioGroup from "../components/radiogroup";
import EventBus, { RenderHook } from "../../eventBus";
import Tracker from "../../tracker";
import Panel from "../components/panel";
import Layout from "./layout";
import Input from "../input";
import Editor from "../../editor";
import { UI } from "../main";
import SpinBox from "../spinBox";
import AppSongPatternList from "./components/songPatternList";
import DiskOperations from "../diskOperations";
import Song from "../../models/song";
import host from "../../host";
import OptionsPanel from "../optionsPanel";
import { Size, TextAlignment } from "../basetypes";

export default class AppMainPanel extends AppPanelContainer {
	private currentView: VIEW | null = null;
    private currentSubView = "";
	private radioGroup: RadioGroup | undefined;
	private customPanel: Panel | undefined;
	private logo: Button;
	private tracker: Button;
	private modNameInputBox: InputBox;
	private listbox: ListBox;
	private songlistbox: AppSongPatternList;
	private patternPanel: Scale9Panel;
	private patternPanel2: Scale9Panel;
	private spinBoxPattern: SpinBox;
	private spinBoxInstrument: SpinBox;
	private spinBoxSongLength: SpinBox;
	private spinBoxSongRepeat: SpinBox;
	private spinBoxPatternLength: SpinBox;
	private spinBoxBpm: SpinBox;
	diskOperations: DiskOperations; // The former global: UI.diskOperations
	private optionsPanel: OptionsPanel;

	constructor() { // UI.app_mainPanel
		super(160);
		this.logo = new Button();
		this.logo.setProperties({
			background: Assets.panelInsetScale9,
			activeBackground: Assets.buttonDarkScale9,
			image: Y.getImage("logo_grey_70"),
			activeImage: Y.getImage("logo_colour_70")
		});
		this.logo.onDown = () => {
			this.logo.toggleActive();
		};
		this.addChild(this.logo);

		this.tracker = new Button();
		this.tracker.setProperties({
			background: Assets.panelInsetScale9,
			activeBackground: Assets.panelInsetScale9,
			image: Y.getImage("tracker"),
			activeImage: this.steffestVersion()
		});
		this.tracker.onDown = () => {
			this.tracker.toggleActive();
		};
		this.addChild(this.tracker);


		this.modNameInputBox = new InputBox({
			name: "modName",
			trackUndo: true,
			onChange: (value) =>{
				const song = Tracker.getSong();
				if (song == null) return;
				song.title = value;
				UI.setInfo(value);
			}
		});
		this.addChild(this.modNameInputBox);

		// instrument listbox
		this.listbox = new ListBox();
		this.listbox.setItems([
			{label: "loading ...", data: 1, index: 0}
		]);
		this.addChild(this.listbox);
		this.listbox.onClick = (touch) => {
			Input.setFocusElement(this.listbox);
			const item = this.listbox.getItemAtPosition(touch.x,touch.y);
			if (item){
				if (item.data === undefined) {
					console.error("AppMainPanel instrument listbox received a click on a valid item with no data!");
					return;
				}
				Tracker.setCurrentInstrumentIndex(item.data);
			}
		};

		this.songlistbox = new AppSongPatternList();
		this.addChild(this.songlistbox);


		// spinbox controls

		const spinbBoxFont = UI.fontFT;

		this.patternPanel = new Scale9Panel(0,0,0,0,Assets.panelInsetScale9);
		this.addChild(this.patternPanel);
		this.patternPanel2 = new Scale9Panel(0,0,0,0,Assets.panelInsetScale9);
		this.addChild(this.patternPanel2);

		this.spinBoxPattern = new SpinBox();
		this.spinBoxPattern.setProperties({
			name: "Pattern",
			label: "Pattern",
			labels:[
				{width: 10, label: "Pat."},
				{width: 140, label: "Pattern"}
			],
			value: 0,
			max: 100,
			min:0,
			font: spinbBoxFont,
			onChange: (value: number) =>{Tracker.setCurrentPattern(value);}
		});
		this.addChild(this.spinBoxPattern);

		this.spinBoxInstrument = new SpinBox({
			name: "Instrument",
			label: "Instrument",
			labels:[
				{width: 10, label: "Ins."},
				{width: 123, label: "Instr"},
				{width: 160, label: "Instrument"}
			],
			value: 1,
			max: 31,
			min:1,
			font: spinbBoxFont,
			onChange: (value: number) =>{Tracker.setCurrentInstrumentIndex(value);}
		});
		this.addChild(this.spinBoxInstrument);

		this.spinBoxSongLength = new SpinBox({
			name: "SongLength",
			label: "Song length",
			labels:[
				{width: 10, label: "Len."},
				{width: 138, label: "Length"},
				{width: 156, label: "Song len"},
				{width: 178, label: "Song length"}
			],
			value: 1,
			max: 200,
			min:1,
			font: spinbBoxFont,
			trackUndo: true,
			undoLabel: "Change Song length",
			onChange: (value: number) => {
				const song = Tracker.getSong();
				if (song == null) {
					console.error("Cannot change song length without a song loaded!");
					return;
				}
				const currentLength = song.length;
				if (currentLength>value){
					Editor.removeFromPatternTable();
				}else if(currentLength<value){
					Editor.addToPatternTable();
				}
			}
		});
		this.addChild(this.spinBoxSongLength);

		this.spinBoxSongRepeat = new SpinBox({
			name: "SongRepeat",
			label: "Song repeat",
			labels:[
				{width: 10, label: "Rep."},
				{width: 138, label: "Repeat"},
				{width: 156, label: "Song rep"},
				{width: 178, label: "Song repeat"}
			],
			value: 1,
			max: 200,
			min:1,
			font: spinbBoxFont,
			onChange : (value) => {
				const song = Tracker.getSong();
				if (song == null) {
					console.error("Song repeat spinbox tried to change the song restart position without a song loaded!");
					return;
				}
				song.restartPosition = value;
			}
		});
		this.addChild(this.spinBoxSongRepeat);

		this.spinBoxPatternLength = new SpinBox({
			name: "PatternLength",
			label: "Pattern length",
			labels:[
				{width: 10, label: "Plen"},
				{width: 138, label: "Pat len"},
				{width: 166, label: "Pattern len"},
				{width: 188, label: "Pattern length"}
			],
			value: 64,
			max: 128,
			min:1,
			font: spinbBoxFont,
			trackUndo: true,
			undoLabel: "Change Pattern length",
			onChange: (value) => {
				Tracker.setPatternLength(value);
			}
		});
		this.addChild(this.spinBoxPatternLength);

		this.spinBoxBpm = new SpinBox({
			name: "BPMLength",
			label: "BPM",
			value: 1,
			max: 400,
			min:1,
			font: spinbBoxFont,
			trackUndo: true,
			undoLabel: "Change Song Tempo",
			onChange: (value: number) => {
				Tracker.setBPM(value);
			}
		});
		this.addChild(this.spinBoxBpm);


		this.diskOperations = new DiskOperations();
		this.diskOperations.setProperties({
			name: "diskoperations",
			zIndex: 100
		});
		this.addChild(this.diskOperations);

		this.optionsPanel = new OptionsPanel();
		this.optionsPanel.setProperties({
			name: "options",
			zIndex: 100
		});
		this.addChild(this.optionsPanel);

		this.onPanelResize();
		EventBus.on(EVENT.songLoading,() => {
			this.modNameInputBox.setValue("Loading ...",true);
		});
	
		EventBus.on(EVENT.songPropertyChange,(song: Song) => {
			this.modNameInputBox.setValue(song.title,true);
			this.spinBoxSongLength.setValue(song.length,true);
			this.spinBoxInstrument.setMax(Tracker.getMaxInstruments(),true);
			this.spinBoxSongRepeat.setMax(song.length,true);
	
			if (song.restartPosition && song.restartPosition>song.length){
				song.restartPosition = song.length;
			}
			this.spinBoxSongRepeat.setValue(song.restartPosition || 1,true);
		});
	
		EventBus.on(EVENT.songBPMChange,(value: number) =>{
			this.spinBoxBpm.setValue(value,true);
		});
	
		EventBus.on(EVENT.instrumentChange, (value: number) => {
			this.listbox.setSelectedIndex(value-1);
			this.spinBoxInstrument.setValue(value,true);
		});
	
		EventBus.on(EVENT.instrumentNameChange, (instrumentIndex: number) => {
			const instrument = Tracker.getInstrument(instrumentIndex);
			if (instrument){
				const instruments = this.listbox.getItems();
				for (let i = 0, len = instruments.length; i<len;i++){
					if (instruments[i].data == instrumentIndex){
						instruments[i].label = instrumentIndex + " " + instrument.name;
						EventBus.trigger(EVENT.instrumentListChange,instruments);
						break;
					}
				}
			}
		});
	
		EventBus.on(EVENT.instrumentListChange,(items: ListBoxItem[]) =>{
			this.listbox.setItems(items);
		});
		EventBus.on(EVENT.patternChange,(value: number) =>{
			this.spinBoxPattern.setValue(value,true);
			this.spinBoxPatternLength.setValue(Tracker.getPatternLength(),true);
	
		});
	
		EventBus.on(EVENT.trackerModeChanged,(mode: TRACKERMODE) =>{
			this.spinBoxPatternLength.setDisabled(mode === TRACKERMODE.PROTRACKER);
			this.spinBoxInstrument.setMax(Tracker.getMaxInstruments());
		});
	
		EventBus.on(EVENT.pluginRenderHook, (hook: RenderHook) => {
			if (hook.target && hook.target === "main"){
				
				if (!this.customPanel){
					this.customPanel = new Panel(0,0,this.width,this.height);
					this.addChild(this.customPanel);
				}else{
					// TODO destroy customPanel?
					this.customPanel.children = [];
				}
	
				this.customPanel.renderOverride = hook.render;
				this.customPanel.renderInternal = hook.renderInternal;
				if (hook.setRenderTarget) hook.setRenderTarget(this.customPanel);
				
				this.diskOperations.hide();
				this.optionsPanel.hide();
				this.hideMain();
				this.currentView = VIEW.custom;
				this.customPanel.show();
				this.refresh();
			}
		});
	
		EventBus.on(EVENT.showView,(view: VIEW) => {
			switch (view){
				case VIEW.fileOperations:
				case VIEW.fileOperationsSaveFile:
				case VIEW.fileOperationsLoadSample:
				case VIEW.fileOperationsLoadModule:
				case VIEW.fileOperationsSaveSample:
				case VIEW.fileOperationsSaveModule:
					if (this.customPanel) this.customPanel.hide();
					this.diskOperations.setView(view);
					this.diskOperations.show();
					this.optionsPanel.hide();
					this.currentView = view;
					this.refresh();
					break;
				case VIEW.options:
					if (this.customPanel) this.customPanel.hide();
					this.diskOperations.hide();
					this.optionsPanel.show(true);
					this.currentView = VIEW.options;
					this.refresh();
					break;
				case VIEW.topMain:
				case VIEW.main:
					if (this.customPanel) this.customPanel.hide();
					this.diskOperations.hide();
					this.optionsPanel.hide();
					this.currentView = null;
					this.showMain();
					this.refresh();
					break;
			}
		});
	}
	
	private steffestVersion() {
		const img = Y.getImage("steffest");
		if (img == null) {
			console.error("Need image 'steffest' to render the version image!");
			return;
		}
        //let version = typeof versionNumber == "undefined" ? "dev" : versionNumber;
		let version = host.getVersionNumber();
        if (version.indexOf(".")>0){
            const p = version.split(".");
            version = p[0]+"."+p[1];
        }
        version = "Version " + version;
        const imgCtx = img.getContext("2d");
		if (imgCtx == null) {
			console.error("Failed to get a canvas context to render the version image!");
			return;
		}

		if (UI.fontSmall == null) {
			console.error("Need fontSmall to render the version image!");
			return;
		}
        UI.fontSmall.write(imgCtx,version,44,4);
		UI.fontSmall.write(imgCtx,"By",44,13);

		return img;
	};

    onPanelResize() {
        const inputBoxHeight = 20;
        const margin = Layout.defaultMargin;

        const listBoxTop = inputBoxHeight + (margin*2);
        const logoHeight = 50;
        let panelTop = logoHeight + margin + margin;
        let panelHeight = this.height - logoHeight - (margin*4);
        let spinButtonHeight = 28;
        let spinButtonWidth = Layout.col1W-2;


        if (Layout.prefered === "col3"){
            if (!this.radioGroup) this.initSmallScreenUI();
			if (this.radioGroup == null)  {
				console.error("AppMainPanel.initSmallScreenUI() did not initialize the radio group!");
				return;
			}

			panelHeight = this.height - (margin*2);
			panelTop = margin;
			spinButtonWidth = Layout.col32W - 2;
			spinButtonHeight = 28;
			if (this.currentView === null){
				this.radioGroup.show();
			}else{
				this.radioGroup.hide();
			} 

			this.radioGroup.setDimensions({
				left: Layout.col31X,
				width: Layout.col31W,
				top: margin,
				height: panelHeight,
                visible: true
			});

			this.modNameInputBox.setDimensions({
				left: Layout.col32X,
				width: Layout.col32W,
				top: margin,
				height: inputBoxHeight
			});

			this.listbox.setDimensions({
				left: Layout.col32X,
				width: Layout.col32W,
				top: listBoxTop,
				height: this.height - listBoxTop - (margin*2)
			});

			const mainDimensions = {
				left: Layout.col32X,
				width: Layout.col32W,
				top: panelTop,
				height: panelHeight
			};

			this.songlistbox.setDimensions(mainDimensions);
			this.patternPanel.setDimensions(mainDimensions);
			this.patternPanel2.setDimensions(mainDimensions);
			this.logo.setDimensions({
                left: Layout.col32X,
                width: Layout.col32W,
                top: panelTop,
                height: Math.floor(panelHeight/2)
            });
			this.tracker.setDimensions({
                left: Layout.col32X,
                width: Layout.col32W,
                top:  Math.floor(panelHeight/2)+1,
                height: Math.floor(panelHeight/2)
            });

			const spinButtonLeft = Layout.col32X;

			this.spinBoxBpm.setDimensions({
				left:spinButtonLeft,
				top: this.patternPanel.top + 3,
				width: spinButtonWidth,
				height: spinButtonHeight
			});

			this.spinBoxSongLength.setDimensions({
				left:spinButtonLeft,
				top: this.patternPanel.top + 3 + spinButtonHeight,
				width: spinButtonWidth,
				height: spinButtonHeight
			});

			this.spinBoxSongRepeat.setDimensions({
				left:spinButtonLeft,
				top: this.patternPanel.top + 3 + spinButtonHeight*2,
				width: spinButtonWidth,
				height: spinButtonHeight
			});
			this.spinBoxSongRepeat.hide();

			this.spinBoxPattern.setDimensions({
				left:spinButtonLeft,
				top: this.patternPanel.top + 3 + spinButtonHeight*2,
				width: spinButtonWidth,
				height: spinButtonHeight
			});

			this.spinBoxPatternLength.setDimensions({
				left:spinButtonLeft,
				top: this.patternPanel.top + 3 + spinButtonHeight*3,
				width: spinButtonWidth,
				height: spinButtonHeight
			});

			this.spinBoxInstrument.setDimensions({
				left:spinButtonLeft,
				top: this.patternPanel.top + 3 + spinButtonHeight*4,
				width: spinButtonWidth,
				height: spinButtonHeight
			});

			if (this.currentView === null){
				this.logo.toggle(this.currentSubView === "about");
				this.tracker.toggle(this.currentSubView === "about");
				this.modNameInputBox.toggle(this.currentSubView === "instruments");
				this.listbox.toggle(this.currentSubView === "instruments");
				this.songlistbox.toggle(this.currentSubView === "songdata");
				this.patternPanel.toggle(this.currentSubView === "patterndata");
				this.spinBoxBpm.toggle(this.currentSubView === "patterndata");
				this.spinBoxSongLength.toggle(this.currentSubView === "patterndata");
				this.spinBoxPattern.toggle(this.currentSubView === "patterndata");
				this.spinBoxPatternLength.toggle(this.currentSubView === "patterndata");
				this.spinBoxInstrument.toggle(this.currentSubView === "patterndata");
			}
			
			this.patternPanel2.hide();



		}else{

			if (this.radioGroup) this.radioGroup.hide();

			if (this.currentView === null) this.showMain();

			this.logo.setDimensions({
				left: Layout.col1X,
				top: margin,
				width: Layout.col2W,
				height: logoHeight
			});

            this.tracker.setDimensions({
                left: Layout.col3X,
                top: margin,
                width: Layout.col1W,
                height: logoHeight
            });

			this.modNameInputBox.setDimensions({
				left: Layout.col4X,
				width: Layout.col2W,
				top: margin,
				height: inputBoxHeight
			});

			this.listbox.setDimensions({
				left: Layout.col4X,
				width: Layout.col2W,
				top: listBoxTop,
				height: this.height - listBoxTop - (margin*2)
			});

			this.songlistbox.setDimensions({
				left: Layout.col1X,
				width: Layout.col1W,
				top: panelTop,
				height: panelHeight
			});

			this.patternPanel.setDimensions({
				left: Layout.col2X,
				width: Layout.col1W,
				top: panelTop,
				height: panelHeight
			});

			this.patternPanel2.setDimensions({
				left: Layout.col3X,
				width: Layout.col1W,
				top: panelTop,
				height: panelHeight
			});

			this.spinBoxBpm.setDimensions({
				left:Layout.col2X,
				top: this.patternPanel.top + 3,
				width: spinButtonWidth,
				height: spinButtonHeight
			});

			this.spinBoxSongLength.setDimensions({
				left:Layout.col2X,
				top: this.patternPanel.top + 3 + spinButtonHeight,
				width: spinButtonWidth,
				height: spinButtonHeight
			});

			this.spinBoxSongRepeat.setDimensions({
				left:Layout.col2X,
				top: this.patternPanel.top + 3 + spinButtonHeight*2,
				width: spinButtonWidth,
				height: spinButtonHeight
			});

			this.spinBoxPattern.setDimensions({
				left:Layout.col3X,
				top: this.patternPanel.top + 3,
				width: spinButtonWidth,
				height: spinButtonHeight
			});

			this.spinBoxPatternLength.setDimensions({
				left:Layout.col3X,
				top: this.patternPanel.top + 3 + spinButtonHeight,
				width: spinButtonWidth,
				height: spinButtonHeight
			});

			this.spinBoxInstrument.setDimensions({
				left:Layout.col3X,
				top: this.patternPanel.top + 3 + spinButtonHeight*2,
				width: spinButtonWidth,
				height: spinButtonHeight
			});

        }

        this.diskOperations.setSize(this.width,this.height);
        this.optionsPanel.setSize(this.width,this.height);
        if (this.customPanel) this.customPanel.setSize(this.width,this.height);
    };
    
    getCurrentView(): VIEW | null {
        return this.currentView;
    };

    private initSmallScreenUI() {
		this.currentSubView = "patterndata";
		this.radioGroup = new RadioGroup();
		this.radioGroup.setProperties({
			align: TextAlignment.right,
			size: Size.medium,
			divider: "line",
			highLightSelection:true,
            zIndex: 1
		});
		this.radioGroup.setItems([
			{
				label:"About",
				active:false
			},
			{
				label:"Song data",
				labels : [
					{width: 30, label: "song"}
				],
				active:false
			},
			{
				label:"Pattern data",
				labels : [
					{width: 40, label: "pattern"}
				],
				active:true
			},
			{
				label:"Instruments",
				labels : [
					{width: 30, label: "Instr"}
				],
				active:false
			}
		]);
		this.radioGroup.onChange = (selectedIndex) => {
			this.currentSubView = "about";
			if (selectedIndex === 1) this.currentSubView = "songdata";
			if (selectedIndex === 2) this.currentSubView = "patterndata";
			if (selectedIndex === 3) this.currentSubView = "instruments";
			this.onPanelResize();

		};
		this.addChild(this.radioGroup);
		this.sortZIndex();
    }
    
    private hideMain() {
		this.logo.hide();
		this.tracker.hide();
		this.modNameInputBox.hide();
		this.spinBoxBpm.hide();
		this.spinBoxInstrument.hide();
		this.spinBoxSongRepeat.hide();
		this.listbox.hide();
		this.songlistbox.hide();
		this.spinBoxSongLength.hide();
		this.spinBoxPattern.hide();
		this.spinBoxPatternLength.hide();
		this.patternPanel.hide();
		this.patternPanel2.hide();
		if (this.radioGroup) this.radioGroup.hide();
	}

	private showMain() {
		this.logo.show();
		this.tracker.show();
		this.modNameInputBox.show();
		this.spinBoxBpm.show();
		this.spinBoxInstrument.show();
		this.spinBoxSongRepeat.show();
		this.listbox.show();
		this.songlistbox.show();
		this.spinBoxSongLength.show();
		this.spinBoxPattern.show();
		this.spinBoxPatternLength.show();
		this.patternPanel.show();
		this.patternPanel2.show();

		if (Layout.prefered === "col3") {
			if (this.radioGroup) this.radioGroup.show();
		}else{
			if (this.radioGroup) this.radioGroup.hide();
		}
	}

}