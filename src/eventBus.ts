import type {COMMAND, EVENT, PLAYTYPE, TRACKERMODE, VIEW} from "./enum";
import type { NoteInfo } from "./models/note";
import type Song from "./models/song";
import type { ListBoxItem } from "./ui/components/listbox";
import type { MenuItem } from "./ui/components/menu";
import type { RadioGroupItem } from "./ui/components/radiogroup";
import type { SampleUndo } from "./ui/stateManager";
import type { SamplePropertyChangeData } from "./ui/waveform";
import type Element from "./ui/components/element";

export interface TrackStateChangeValue {
    track: number,
    solo: boolean, 
    mute: boolean, 
    wasSolo: boolean
}

export interface PatternPosChangeValue {
    current: number,
    prev?: number
}

export type StatusChange = {
    status?: string,
    showSpinner?: boolean,
    info?: string,
    source?: string | undefined,
    url?: string,
};

export type ShowEventHandlerProperties = { name: string | number, x:number, y: number, items: MenuItem[] };

export type RenderHook = {render: (() => void) | null, renderInternal?: (() => void) | undefined, target: string, setRenderTarget: (element: Element) => void };

type EventHandler<T extends EVENT> = 
T extends EVENT.instrumentChange ? (value: number) => void : 
T extends EVENT.patternChange ? (value: number) => void : 
T extends EVENT.patternPosChange ? (positions: PatternPosChangeValue) => void :
T extends EVENT.patternTableChange ? (value?: number) => void :
T extends EVENT.recordingChange ? (isRecording: boolean) => void :
T extends EVENT.cursorPositionChange ? (pos: number) => void :
T extends EVENT.trackStateChange ? (state: TrackStateChangeValue) => void :
T extends EVENT.playingChange ? (isPlaying: boolean) => void :
T extends EVENT.playTypeChange ? (playType: PLAYTYPE) => void :
T extends EVENT.songPositionChange ? (value: number) => void :
T extends EVENT.songSpeedChange ? (speed: number) => void :
T extends EVENT.songBPMChange ? (bpm: number) => void :
T extends EVENT.samplePlay ? (context: NoteInfo) => void :
T extends EVENT.screenRefresh ? () => void :
T extends EVENT.screenRender ? () => void :
T extends EVENT.songPropertyChange ? (song: Song) => void :
T extends EVENT.instrumentNameChange ? (instrumentIndex: number) => void :
T extends EVENT.command ? (command: COMMAND) => void :
T extends EVENT.pianoNoteOn ? (index: number) => void :
T extends EVENT.pianoNoteOff ? (index: number) => void :
T extends EVENT.statusChange ? (context: StatusChange) => void :
T extends EVENT.diskOperationTargetChange ? (item?: RadioGroupItem) => void :
T extends EVENT.diskOperationActionChange ? (target?: RadioGroupItem) => void :
T extends EVENT.trackCountChange ? (trackCount: number) => void :
T extends EVENT.patternHorizontalScrollChange ? (startTrack: number) => void :
T extends EVENT.songLoaded ? (song: Song) => void :
T extends EVENT.songLoading ? () => void :
T extends EVENT.trackerModeChanged ? (mode: TRACKERMODE) => void :
T extends EVENT.instrumentListChange ? (items: ListBoxItem[]) => void :
T extends EVENT.showView ? (view: VIEW) => void :
T extends EVENT.toggleView ? (view: VIEW) => void :
T extends EVENT.visibleTracksCountChange ? (count: number) => void :
T extends EVENT.filterChainCountChange ? (trackCount: number) => void :
T extends EVENT.fxPanelToggle ? (track: number) => void :
T extends EVENT.samplePropertyChange ? (newProps: SamplePropertyChangeData) => void :
T extends EVENT.sampleIndexChange ? (instrumentIndex: number) => void :
T extends EVENT.second ? () => void :
T extends EVENT.minute ? () => void :
T extends EVENT.dropboxConnect ? () => void :
T extends EVENT.dropboxConnectCancel ? () => void :
T extends EVENT.trackScopeClick ? (track: number) => void :
T extends EVENT.octaveChanged ? (value: number) => void :
T extends EVENT.skipFrameChanged ? (value: number) => void :
T extends EVENT.showContextMenu ? (properties: ShowEventHandlerProperties) => void :
T extends EVENT.hideContextMenu ? () => void  :
T extends EVENT.clockEventExpired ? () => void :
T extends EVENT.commandUndo ? () => void :
T extends EVENT.commandRedo ? () => void :
T extends EVENT.commandSelectAll ? () => void :
T extends EVENT.songEnd ? () => void :
T extends EVENT.patternEnd ? (time: number) => void :
T extends EVENT.songSpeedChangeIgnored ? (speed: number) => void :
T extends EVENT.songBPMChangeIgnored ? (bpm: number) => void :
T extends EVENT.commandProcessSample ? (action: SampleUndo) => void :
T extends EVENT.pluginRenderHook ? (hook: RenderHook) => void :
T extends EVENT.menuLayoutChanged ? () => void :
T extends EVENT.midiIn ? () => void :
never;

type EventHandlerParameters<T extends EVENT> = Parameters<EventHandler<T>>;

class EventBus {

    private allEventHandlers: EventHandler<EVENT>[][] = [];

    on<T extends EVENT>(event: T, listener: EventHandler<T>): number {
        let eventHandlers = this.allEventHandlers[event];
        if (!eventHandlers) {
            eventHandlers = [];
            this.allEventHandlers[event] = eventHandlers;
        }
        eventHandlers.push(listener);
        return eventHandlers.length;
    };
    
    off(event: EVENT, index: number) {
        const eventHandlers = this.allEventHandlers[event];
        if (eventHandlers) delete eventHandlers[index-1];
    }

    trigger<T extends EVENT>(event: T, ...context: EventHandlerParameters<T>) {
        const eventHandlers = this.allEventHandlers[event] as EventHandler<T>[];
        if (eventHandlers) {
            const len = eventHandlers.length;
            for (let i = 0; i < len; i++) {
                //if (eventHandlers[i]) eventHandlers[i](context,event);
                // @ts-ignore Not sure how to convince TypeScript we will not see the never case EventHandler
                if (eventHandlers[i]) eventHandlers[i](...context); 
            }
        }
    };
};

export default new EventBus();
