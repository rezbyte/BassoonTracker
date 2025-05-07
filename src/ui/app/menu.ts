import { COMMAND, EVENT } from "../../enum";
import AppPanelContainer from "./panelContainer";
import Host from "../../host";
import Menu from "../components/menu";
import EventBus from "../../eventBus";
import Layout from "./layout";
import Midi from "../../audio/midi";
import Label from "../components/label";
import Scale9Panel from "../components/scale9";
import Checkbox from "../components/checkbox";
import { Y } from "../yascal/yascal";
import Element from "../components/element";
import { UI } from "../main";
import StateManager from "../stateManager";
import VUMeter from "./components/vumeter";
import Audio from "../../audio";
import Settings from "../../settings";

export default class AppMenu extends AppPanelContainer {
    private midiLabel: Label;
    private menuBackground: Scale9Panel;
    private keyLabel: Label;
    private keyBox: Checkbox;
    private midiBox: Checkbox;
    private vumeter: VUMeter;
    
    constructor(container: Element) { // UI.app_menu
        super(32);
        this.menuBackground = new Scale9Panel(5,0,20,26,{
            img: Y.getImage("menu"),
            left:4,
            top:0,
            right:40,
            bottom: 0
        });
        this.addChild(this.menuBackground);
    
        const menu = new Menu(5,0,this.width,26,container);
        menu.name = "MainMenu";
        this.addChild(menu);
        menu.setItems([
            {label: "File" , subItems: [
                    {label: "New" , "command" : COMMAND.newFile},
                    {label: "Load Module" , "command" : COMMAND.openFile},
                    {label: "Save Module" , "command" : COMMAND.saveFile},
                    {label: "Open Random MOD Song" , "command" : COMMAND.randomSong},
                    {label: "Open Random XM Song" , "command" : COMMAND.randomSongXM}
                ]},
            {label: "Edit", subItems: [
                    {label: function(){return StateManager.getUndoLabel()} , "command" : COMMAND.undo, disabled: function(){return !StateManager.canUndo()}},
                    {label: function(){return StateManager.getRedoLabel()} , "command" : COMMAND.redo, disabled: function(){return !StateManager.canRedo()}},
                    {label: "Cut" , "command" : COMMAND.cut},
                    {label: "Copy" , "command" : COMMAND.copy},
                    {label: "Clear" , subItems: [
                            {label: "Clear Track" , "command" : COMMAND.clearTrack},
                            {label: "Clear Pattern" , "command" : COMMAND.clearPattern},
                            {label: "Clear Song" , "command" : COMMAND.clearSong},
                            {label: "Clear Instruments" , "command" : COMMAND.clearInstruments},
                        ]},
                    {label: "Paste" , "command" : COMMAND.paste},
    
                    {label: "Render Pattern 2 Sample" , "command" : COMMAND.pattern2Sample}
                ]},
            {label: "View", subItems: [
                    {label: "Main" , "command" : COMMAND.showMain},
                    {label: "Options" , "command" : COMMAND.showOptions},
                    {label: "File Operations" , "command" : COMMAND.showFileOperations},
                    {label: "Sample Editor" , "command" : COMMAND.showSampleEditor},
                    {label: "Piano" , "command" : COMMAND.togglePiano},
                    //{label: "Nibbles" , "command" : COMMAND.nibbles}, TODO: Port Nibbles
                    {label: "Performance stats" , "command" : COMMAND.showStats}
                ]},
            {label: "Help", subItems: [
                    {label: "About" , "command" : COMMAND.showAbout},
                    {label: "Documentation" , "command" : COMMAND.showHelp},
                    {label: "Sourcecode on Github" , "command" : COMMAND.showGithub}
                ]}
        ]);
    
    
        this.vumeter = new VUMeter();
        const cutOffVolume = Audio.getCutOffVolume();
        if (cutOffVolume == null) {
            console.error("AppMenu needs the cut-off volume but it is not set! Check whether Audio has been initalised correctly.");
        } else {
            this.vumeter.connect(cutOffVolume);
        }
        //vumeter.connect(Audio.masterVolume);
        //window.vumeter = vumeter;
        // note: don't attach as child to menu panel, this gets attached to main UI
        
        this.keyLabel = new Label({font: UI.fontSmall, label: "Key"});
        this.keyLabel.ignoreEvents = true;
        this.keyBox = new Checkbox(0,0,13,13);
        this.keyBox.ignoreEvents = true;
        this.midiLabel = new Label({font: UI.fontSmall, label: "Midi"});
        this.midiLabel.ignoreEvents = true;
        this.midiBox =  new Checkbox(0,0,13,13);
        this.midiBox.ignoreEvents = true;
        
        this.addChild(this.keyLabel);
        this.addChild(this.keyBox);
        this.addChild(this.midiLabel);
        this.addChild(this.midiBox);
        this.onPanelResize();

        EventBus.on(EVENT.menuLayoutChanged, () => {
            this.onPanelResize();
        });
        EventBus.on(EVENT.pianoNoteOn, () => {
            if (Settings.showKey) this.flash(this.keyBox);
        });
        EventBus.on(EVENT.midiIn, () => {
            if (Settings.showMidi) this.flash(this.midiBox);
        });
        
    }

    onPanelResize() {
        const menuMin = 250;
        let menuWidth = Math.max(Layout.col2W,menuMin);
        
        if (!Host.showInternalMenu){
            this.menuBackground.hide();
            menuWidth = 0;
        }

        let vuWidth = Layout.col5W - menuWidth;
        if (Settings.showKey || Settings.showMidi){
            vuWidth -= 50;
        }
        const vuLeft = Layout.marginLeft + menuWidth + Layout.defaultMargin + Layout.mainLeft;

		this.left = Layout.mainLeft;

        if (menuWidth) this.menuBackground.setDimensions({
            left: Layout.marginLeft,
            top: 0,
            height: 26,
            width: menuWidth
        });

        this.vumeter.setProperties({
           width: vuWidth,
           left: vuLeft
        });

        this.keyLabel.setProperties({
            top: 4,
            left: this.width - 56,
            width: 40,
            height: 20
        });
        this.keyBox.setProperties({
            top: 4,
            left: this.width - 20
        });
        
        if (Settings.showKey){
            this.keyLabel.show();
            this.keyBox.show();
        }else{
            this.keyLabel.hide();
            this.keyBox.hide();
        }

        if (Settings.showMidi){
            this.midiLabel.setProperties({
                top: 14,
                left: this.keyLabel.left,
                width: this.keyLabel.width,
                height: this.keyLabel.height
            });
            this.midiBox.setProperties({
                top: 16,
                left: this.keyBox.left,
            });
            this.midiLabel.show();
            this.midiBox.show();
        }else{
            this.midiLabel.hide();
            this.midiBox.hide();
        }
        
    };

    renderInternal() {
        if (Settings.showMidi && !Midi.isEnabled()){
            this.ctx.fillStyle = "rgba(34, 49, 85, 0.5)";
            this.ctx.fillRect(this.midiLabel.left,this.midiBox.top,50,this.midiBox.height);
        }
    }
    
    private flash(elm: Checkbox) {
        elm.setState(true);
        clearTimeout(elm.flashTimeout);
        elm.flashTimeout = setTimeout(function(){
            elm.setState(false);
        },100);
    }
}