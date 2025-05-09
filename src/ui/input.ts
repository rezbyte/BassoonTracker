import Tracker from "../tracker";
import Audio from "../audio";
import Element from "./components/element";
import { canvas, UI } from "./main";
import App from "../app";
import Menu from "./components/menu";
import Settings from "../settings";
import KeyboardInput from "./keyboard";
import Octave from "./octave";

export interface Touch {
  id: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  globalX: number;
  globalY: number;
  globalStartX: number;
  globalStartY: number;
  UIobject: Element | undefined;
  isMeta: boolean;
}

export interface Drag extends Touch {
  deltaX: number;
  deltaY: number;
  dragX: number;
  dragY: number;
}

export interface TouchData {
  touches: (Touch | Drag)[];
  mouseWheels: number[];
  currentMouseX: number | undefined;
  currentMouseY: number | undefined;
  mouseMoved: number | undefined;
  isTouchDown: boolean;
}

class Input {
  private readonly touchData: TouchData = {
    touches: [],
    mouseWheels: [],
    currentMouseX: undefined,
    currentMouseY: undefined,
    mouseMoved: undefined,
    isTouchDown: false,
  };
  private focusElement: Element | undefined;
  private currentEventTarget: Element | undefined;
  private resizeTimer = 0;
  private isTouched = false;
  private prevHoverTarget: Element | undefined;

  readonly octaveHandler = new Octave();
  readonly keyboard: KeyboardInput = new KeyboardInput(
    this.getFocusElement.bind(this),
    this.octaveHandler,
  );

  init() {
    // mouse, touch and key handlers

    const handleTouchDown = this.handleTouchDown.bind(this);
    const handleTouchMove = this.handleTouchMove.bind(this);
    const handleTouchUp = this.handleTouchUp.bind(this);
    const handleTouchOut = this.handleTouchOut.bind(this);

    canvas.addEventListener("mousedown", handleTouchDown, false);
    canvas.addEventListener("mousemove", handleTouchMove, false);
    canvas.addEventListener("mouseup", handleTouchUp, false);
    canvas.addEventListener("mouseout", handleTouchOut, false);

    canvas.addEventListener("touchstart", handleTouchDown, false);
    canvas.addEventListener("touchmove", handleTouchMove, false);
    canvas.addEventListener("touchend", handleTouchUp, false);

    if (window.navigator.msPointerEnabled) {
      canvas.addEventListener("MSPointerDown", handleTouchDown, false);
      canvas.addEventListener("MSPointerMove", handleTouchMove, false);
      canvas.addEventListener("MSPointerEnd", handleTouchUp, false);
    }

    const handleMouseWheel = this.handleMouseWheel.bind(this);
    canvas.addEventListener("mousewheel", handleMouseWheel, false);
    canvas.addEventListener("DOMMouseScroll", handleMouseWheel, false);
    canvas.addEventListener("wheel", handleMouseWheel, false);

    this.keyboard.addEventHandlers();

    const handleDragenter = this.handleDragenter.bind(this);
    const handleDragover = this.handleDragover.bind(this);
    const handleDrop = this.handleDrop.bind(this);
    canvas.addEventListener("dragenter", handleDragenter, false);
    canvas.addEventListener("dragover", handleDragover, false);
    canvas.addEventListener("drop", handleDrop, false);

    const handlePaste = this.handlePaste.bind(this);
    const handleCopy = this.handleCopy.bind(this);
    const handleCut = this.handleCut.bind(this);
    const handleUndo = this.handleUndo.bind(this);
    const handleDelete = this.handleDelete.bind(this);
    window.addEventListener("paste", handlePaste, false);
    window.addEventListener("copy", handleCopy, false);
    window.addEventListener("cut", handleCut, false);
    window.addEventListener("undo", handleUndo, false);
    window.addEventListener("delete", handleDelete, false);

    if (!App.isPlugin)
      window.addEventListener("resize", this.handleResize, false);

    this.handleResize();
  }

  private handleTouchDown(event: TouchEvent | MouseEvent) {
    event.preventDefault();
    window.focus();

    if (!this.isTouched) {
      // first touch - init media on IOS and Android
      // note: audioContext.resume must be called on touchup, touchdown is too soon.

      if (typeof Audio !== "undefined" && Audio.playSilence) {
        if (Audio.context && Audio.context.state !== "suspended") {
          Audio.playSilence();
          this.isTouched = true;
        }
      }
    }

    if (
      window.TouchEvent &&
      event instanceof TouchEvent &&
      event.touches.length > 0
    ) {
      const touches = event.changedTouches;
      for (const touch of touches) {
        this.initTouch(
          touch.identifier.toString(),
          touch.pageX,
          touch.pageY,
          event,
        );
      }
    } else if (event instanceof MouseEvent) {
      const touchIndex = this.getTouchIndex("notouch");
      if (touchIndex >= 0) this.touchData.touches.splice(touchIndex, 1);
      this.initTouch("notouch", event.pageX, event.pageY, event);
      //initTouch("notouch",event.clientX,event.clientY);
    }
  }

  private initTouch(
    id: string,
    pageX: number,
    pageY: number,
    event: TouchEvent | MouseEvent,
  ) {
    this.touchData.isTouchDown = true;

    const rect = canvas.getBoundingClientRect();
    const x = pageX - rect.left + window.pageXOffset;
    const y = pageY - rect.top + window.pageYOffset;

    this.currentEventTarget = UI.getModalElement();
    if (this.currentEventTarget) {
      this.currentEventTarget.eventX = x;
      this.currentEventTarget.eventY = y;
    } else {
      this.currentEventTarget = UI.getEventElement(x, y);
    }

    if (
      this.currentEventTarget &&
      this.focusElement &&
      this.focusElement.deActivate &&
      this.focusElement.name !== this.currentEventTarget.name
    ) {
      this.focusElement.deActivate(this.currentEventTarget);
    }

    const touchX = this.currentEventTarget
      ? (this.currentEventTarget.eventX ?? x)
      : x;
    const touchY = this.currentEventTarget
      ? (this.currentEventTarget.eventY ?? y)
      : y;

    const thisTouch: Touch = {
      id: id,
      x: touchX,
      y: touchY,
      startX: touchX,
      startY: touchY,
      globalX: x,
      globalY: y,
      globalStartX: x,
      globalStartY: y,
      UIobject: this.currentEventTarget,

      isMeta: event.shiftKey || event.metaKey || event.ctrlKey || event.altKey,
    };

    this.touchData.touches.push(thisTouch);

    if (thisTouch.UIobject) {
      if (thisTouch.UIobject.onDragStart)
        thisTouch.UIobject.onDragStart(thisTouch);
      if (thisTouch.UIobject.onDown) thisTouch.UIobject.onDown(thisTouch);

      //console.log(thisTouch.UIobject);
    }
  }

  private handleTouchMove(event: TouchEvent | MouseEvent) {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();

    if (
      window.TouchEvent &&
      event instanceof TouchEvent &&
      event.touches.length > 0
    ) {
      const touches = event.changedTouches;

      for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        this.updateTouch(
          this.getTouchIndex(touch.identifier.toString()),
          touch.pageX - rect.left,
          touch.pageY - rect.top,
        );
      }
    } else if (event instanceof MouseEvent) {
      const _x = event.pageX - rect.left;
      const _y = event.pageY - rect.top;
      this.updateTouch(this.getTouchIndex("notouch"), _x, _y);
      this.touchData.currentMouseX = _x;
      this.touchData.currentMouseY = _y;
      this.touchData.mouseMoved = new Date().getTime();

      if (Settings.useHover) {
        const hoverEventTarget = UI.getEventElement(_x, _y);
        if (hoverEventTarget && hoverEventTarget.onHover)
          hoverEventTarget.onHover(this.touchData);

        if (this.prevHoverTarget && this.prevHoverTarget != hoverEventTarget) {
          if (this.prevHoverTarget.onHoverExit)
            this.prevHoverTarget.onHoverExit(this.touchData, hoverEventTarget);
        }
        this.prevHoverTarget = hoverEventTarget;
      }
    }
  }

  private updateTouch(touchIndex: number, x: number, y: number) {
    if (touchIndex >= 0) {
      const thisTouch = this.touchData.touches[touchIndex] as Drag;

      thisTouch.globalX = x - window.pageXOffset;
      thisTouch.globalY = y - window.pageYOffset;

      thisTouch.deltaX = thisTouch.globalX - thisTouch.globalStartX;
      thisTouch.deltaY = thisTouch.globalY - thisTouch.globalStartY;

      thisTouch.x = thisTouch.startX + thisTouch.deltaX;
      thisTouch.y = thisTouch.startY + thisTouch.deltaY;

      this.touchData.touches.splice(touchIndex, 1, thisTouch);

      if (this.touchData.isTouchDown && thisTouch.UIobject) {
        if (thisTouch.UIobject.onDrag) {
          thisTouch.dragX = x;
          thisTouch.dragY = y;
          thisTouch.UIobject.onDrag(thisTouch);
        }
      }
    }
  }

  private handleTouchUp(event: TouchEvent | MouseEvent) {
    if (!this.isTouched) {
      if (Audio && Audio.checkState) Audio.checkState();
    }

    this.touchData.isTouchDown = false;

    if (event && window.TouchEvent && event instanceof TouchEvent) {
      const touches = event.changedTouches;

      for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        this.endTouch(this.getTouchIndex(touch.identifier.toString()));
      }

      if (event.touches.length === 0) {
        this.resetInput();
      }
    } else {
      this.endTouch(this.getTouchIndex("notouch"));
      this.resetInput();
    }
  }

  private endTouch(touchIndex: number) {
    if (touchIndex >= 0) {
      const thisTouch = this.touchData.touches[touchIndex];
      const deltaX = thisTouch.startX - thisTouch.x;
      const deltaY = thisTouch.startY - thisTouch.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      let clearSelection = true;
      if (thisTouch.UIobject) {
        const elm = thisTouch.UIobject;
        if (elm instanceof Menu && elm.keepSelection) clearSelection = false;

        if (distance < 8 && elm.onClick) {
          elm.onClick(thisTouch);
        }

        if (elm.onTouchUp) elm.onTouchUp(thisTouch);
      }

      if (clearSelection && distance < 8) UI.clearSelection();

      this.touchData.touches.splice(touchIndex, 1);
    }
  }

  private resetInput() {
    //Input.isDown(false);
    //Input.isUp(false);
    //Input.isLeft(false);
    //Input.isRight(false);
  }

  private handleTouchOut(event: MouseEvent) {
    if (this.touchData.isTouchDown) {
      this.handleTouchUp(event);
    }
  }

  private handleMouseWheel(event: WheelEvent) {
    event.preventDefault();
    const x = this.touchData.currentMouseX;
    const y = this.touchData.currentMouseY;
    if (x && y) {
      const target = UI.getEventElement(x, y);

      if (target && target.onMouseWheel) {
        const deltaY: number = event.deltaY || -event.detail;
        //const deltaX = event.deltaX || 0;

        this.touchData.mouseWheels.unshift(deltaY);
        if (this.touchData.mouseWheels.length > 10)
          this.touchData.mouseWheels.pop();

        target.onMouseWheel(this.touchData);
      }
    }
  }

  private handleDragenter(e: DragEvent) {
    e.stopPropagation();
    e.preventDefault();
  }

  private handleDragover(e: DragEvent) {
    e.stopPropagation();
    e.preventDefault();
  }

  private handleDrop(e: DragEvent) {
    e.stopPropagation();
    e.preventDefault();

    const dt = e.dataTransfer;
    if (dt == null) return;

    const files = dt.files;

    Tracker.handleUpload(files);
  }

  private handleResize() {
    if (!App.isPlugin) {
      // throttle resize events - resizing is expensive as all the canvas cache needs to be regenerated
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(function () {
        UI.setSize(window.innerWidth, window.innerHeight);
      }, 100);
    }
  }

  private handlePaste() {
    UI.pasteSelection(true);
  }

  private handleCopy() {
    UI.copySelection(true);
  }

  private handleCut() {
    console.error("cut");
    UI.cutSelection(true);
  }
  private handleUndo() {
    console.error("undo");
  }

  private handleDelete() {
    console.error("delete");
  }

  getTouchIndex(id: string): number {
    for (let i = 0; i < this.touchData.touches.length; i++) {
      if (this.touchData.touches[i].id === id) {
        return i;
      }
    }
    return -1;
  }

  setFocusElement(element: Element) {
    const name = element.name || element.type;
    if (this.focusElement) {
      const fName = this.focusElement.name || this.focusElement.type;
      if (fName === name) {
        console.log(name + " already has focus");
        return;
      } else {
        if (this.focusElement.deActivate) this.focusElement.deActivate();
      }
    }
    this.focusElement = element;
    if (name) {
      console.log("setting focus to " + name);
    } else {
      console.warn(
        "Warning: setting focus to an unnamed element can cause unexpected results",
      );
    }
    //if (element.activate) element.activate();
  }

  clearFocusElement(element?: Element) {
    if (element) {
      if (!element.name)
        console.warn(
          "Please specify a name for the target object when removing focus",
        );
      const name = element.name || element.type;
      if (name) console.log("removing focus from " + name);
      if (element.deActivate) element.deActivate();
      if (this.focusElement && this.focusElement.name === element.name) {
        this.focusElement = undefined;
      }
    } else {
      if (this.focusElement && this.focusElement.deActivate)
        this.focusElement.deActivate();
      this.focusElement = undefined;
    }
  }

  getFocusElement(): Element | undefined {
    return this.focusElement;
  }
}

export default new Input();
