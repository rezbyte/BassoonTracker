import { EVENT, PLAYTYPE } from "../../../enum";
import EventBus from "../../../eventBus";
import Element, { ElementProperties } from "../../components/element";
import Tracker from "../../../tracker";
import RadioGroup from "../../components/radiogroup";
import { Y } from "../../yascal/yascal";
import Assets from "../../assets";
import Button from "../../components/button";
import { Size, TextAlignment } from "../../basetypes";

type PatternSelectorSize = Size.big | Size.small;

interface AppSongControlProperties extends ElementProperties {
    songPatternSelector?: PatternSelectorSize
}
export default class AppSongControl extends Element {
    private radioGroup: RadioGroup;
    private playButton: Button;
    private recordButton: Button;
    private songButton: Button;
    private patternButton: Button;
    private songPatternSelector: PatternSelectorSize | undefined;
    
    constructor(x?: number, y?: number, w?: number, h?: number) { // UI.app_songControl
        super(x,y,w,h); // super(x,y,w,h,visible);
        this.type = "songControl";

        this.radioGroup = new RadioGroup();
        this.radioGroup.setItems([
            {
                label:"song",
                active:true
            },
            {
                label:"pattern",
                labels : [
                    {width: 10, label: "p"},
                    {width: 20, label: "pat"}
                ],
                active:false
            }
        ]);
        this.radioGroup.onChange = (selectedIndex) => {
            if (selectedIndex == 0){
                Tracker.setPlayType(PLAYTYPE.song);
            }else{
                Tracker.setPlayType(PLAYTYPE.pattern);
            }
        };
        this.addChild(this.radioGroup);

        this.playButton = Assets.generate("buttonDarkGreen");
        this.playButton.setProperties({
            image: Y.getImage("play_green"),
            hoverImage: Y.getImage("play_green_hover"),
            activeImage: Y.getImage("play_active_red"),
            activeBackground: Assets.buttonDarkRedActiveScale9
        });
        this.playButton.onClick = () => {
            this.playButton.toggleActive();
            if (Tracker.isPlaying()){
                Tracker.stop();
            }else{
                if (Tracker.getPlayType() == PLAYTYPE.song){
                    Tracker.playSong();
                }else{
                    Tracker.playPattern();
                }
            }
        };
        this.playButton.setProperties({
            name:"buttonPlay"
        });
        this.addChild(this.playButton);


        this.recordButton = Assets.generate("buttonDarkRed");
        this.recordButton.setProperties({
            image: Y.getImage("record"),
            hoverImage: Y.getImage("record_hover"),
            activeImage: Y.getImage("record_active")
        });
        this.recordButton.onClick = () => {
            Tracker.toggleRecord();
        };
        this.recordButton.setProperties({
            name:"buttonRecord"
        });
        this.addChild(this.recordButton);



        this.songButton = Assets.generate("buttonDark");
        this.songButton.onClick = () => {
            Tracker.setPlayType(PLAYTYPE.song)
            Tracker.playSong();
        };
        this.songButton.setProperties({
            label: "Song"
        });
        this.addChild(this.songButton);

        this.patternButton = Assets.generate("buttonDark");
        this.patternButton.onClick = () => {
            Tracker.setPlayType(PLAYTYPE.pattern)
            Tracker.playPattern();
        };
        this.patternButton.setProperties({
            label: "Pattern"
        });
        this.addChild(this.patternButton);




        EventBus.on(EVENT.recordingChange,(isRecording: boolean) => {
            this.recordButton.setActive(isRecording);
        });
        EventBus.on(EVENT.playingChange,(isPlaying: boolean) => {
            this.playButton.setActive(isPlaying);
        });

        EventBus.on(EVENT.playTypeChange,(playType: PLAYTYPE) => {
            if (playType == PLAYTYPE.song){
                this.radioGroup.setSelectedIndex(0,true);
            }else{
                this.radioGroup.setSelectedIndex(1,true);
            }
        });
    }

    setProperties (p: AppSongControlProperties) {
        this.left = p.left ?? this.left;
		this.top = p.top ?? this.top;
		this.width = p.width ?? this.width;
		this.height = p.height ?? this.height;
		this.name = p.name ?? this.name;
		this.type = p.type ?? this.type;
		this.zIndex = p.zIndex ?? this.zIndex;
        this.songPatternSelector = p.songPatternSelector ?? this.songPatternSelector

        this.setSize(this.width,this.height);
        this.setPosition(this.left,this.top);

        const buttonWidth = Math.floor(this.width/3);

        this.radioGroup.setProperties({
            left: 0,
            width: buttonWidth,
            top:0,
            height: this.height,
            align: TextAlignment.right
        });
        this.playButton.setProperties({
            left: buttonWidth,
            width: buttonWidth,
            top:0,
            height: this.height
        });
        this.recordButton.setProperties({
            left: buttonWidth*2,
            width: buttonWidth,
            top:0,
            height: this.height
        });


        if (this.songPatternSelector === Size.big){
            this.radioGroup.left = -500;
            const buttonWidth = Math.floor(this.width/4) + 1;

            this.playButton.setProperties({
                left: 0,
                width: buttonWidth
            });
            this.recordButton.setProperties({
                left: buttonWidth,
                width: buttonWidth
            });

            this.songButton.setProperties({
                left: buttonWidth*2,
                width: buttonWidth,
                top:0,
                height: this.height
            });
            this.patternButton.setProperties({
                left: buttonWidth*3,
                width: buttonWidth,
                top:0,
                height: this.height
            });

        }
    };

    private triggerChangeEvent() {
        //EventBus.trigger(EVENT.trackStateChange,{track: this.track,  solo: buttons.solo.isActive, mute: buttons.mute.isActive});
    }

    render(internal?: boolean) {
        internal = !!internal;
        if (this.needsRendering){
            this.clearCanvas();

            if (this.songPatternSelector === Size.small) this.radioGroup.render();

            this.playButton.render();
            this.recordButton.render();

            if (this.songPatternSelector === Size.big){
                this.songButton.render();
                this.patternButton.render();
            }


        }
        this.needsRendering = false;

        if (internal){
            return this.canvas;
        }else{
            this.parentCtx.drawImage(this.canvas,this.left,this.top,this.width,this.height);
        }

    };

}
