/**
 * Touch Module
 * @module Touch
 */

import { container } from "../../nodeshow.js"
import { Container } from "../../Container.js"
import { InputAccessManagerInstance as InputAccessManager} from "./InputAccessManager.mjs"
import { InputManager } from "../utils/InputManager.js"
import { findActionableAnchestor } from "../utils/common.js"
import { MiceManager } from "./mouse.js"

export const EVENTS = {
	'DOWN':'touch.down',
	'MOVE':'touch.move',
	'UP':'touch.up',
	'DRAG_START':'drag.start',
	'DRAG_UPDATE':'drag.update',
	'DRAG_END':'drag.end',
	'CLICK': 'container.touch.click',
	'DOUBLE_CLICK':'container.touch.dblclick',
	'ZOOM':'',
	'ROTATE':''
}

let appId = null
let FOCUS_TRESHOLD = 5
let focusTarget = null;
let target = null
let targetMetadata = {};

let moved = 0;
let lastX = 0;
let lastY = 0;

let dblClickTreshold = 300;
let lastClickTime = 0;

//ignore multitouch for now
//[TODO]: figure out why it doesn't work
function handleStart(e) {
	let touch = e.touches[0]
	if (!container.owns(touch.target)) {
		console.log('Touch on not owned item')
		console.log(e)
		return null;
	}

	target = findActionableAnchestor(container, touch.target, appId)
	if (target) {
		//e.preventDefault();
		focusTarget = target
		
		targetMetadata['targetOx'] = touch.layerX / container.getWidth(target) 
		targetMetadata['targetOy'] = touch.layerY / container.getHeight(target)

		moved = 0;
		container.emit(EVENTS.DRAG_START,{
			id:target.id,
			dx: 0,
			dy: 0,
			position: getTranslatedCursorPosition(touch.pageX,touch.pageY,container),
			moved: 0, 
			targetOx: targetMetadata.targetOx,
			targetOy: targetMetadata.targetOy,
			originalEvent: e});
		container.emit('container.blur', {});
	}
}

function handleMove(e) {
	let touch = e.touches[0]
	if (target) {
		//e.preventDefault();
		let dx = touch.screenX - lastX;
		let dy = touch.screenY - lastY;

		moved += Math.sqrt(Math.pow(Math.abs(dx),2) + Math.pow(Math.abs(dy),2))
		
		container.emit(EVENTS.DRAG_UPDATE,{
			id:target.id,
			dx:dx,
			dy:dy,
			position: getTranslatedCursorPosition(touch.pageX,touch.pageY,container),
			moved: moved, 
			targetOx: targetMetadata.targetOx,
			targetOy: targetMetadata.targetOy,
			originalEvent: e
		});

		container.emit('container.blur', {});
	}

	lastX = touch.screenX;
	lastY = touch.screenY;
}

function handleCancel(e) {
	handleEnd(e);
}

function handleEnd(e) {
	if (target) {
		//e.preventDefault();
		let position = getTranslatedCursorPosition(touch.pageX,touch.pageY,container);
		
		container.emit(EVENTS.DRAG_END,{
			id:target.id,
			dx: 0, //ToDo: incorrect
			dy: 0,
			position: position,
			moved: moved,
			targetOx: targetMetadata.targetOx,
			targetOy: targetMetadata.targetOy, 
			originalEvent: e
		});

		if (moved <= FOCUS_TRESHOLD) {
			container.emit('container.focus', {id:target.id})
			container.emit(EVENTS.CLICK, {id:target.id, position: position, originalEvent:e})
			//was click
			let dnow = Date.now()
			if (dnow - lastClickTime <= dblClickTreshold) {
				container.emit(EVENTS.DOUBLE_CLICK, {id:target.id, position: position, originalEvent:e})
			}
			lastClickTime = dnow
		}
		target = null;
	}
}

function actLikeMouse(evt) {
  if (evt.touches.length > 1 || (evt.type == "touchend" && evt.touches.length > 0))
    return;

  //evt.preventDefault();
  //evt.stopPropagation();
  
  var type = null;
  var touch = null;

  switch (evt.type) {
    case "touchstart":
      type = "mousedown";
      touch = evt.changedTouches[0];
      break;
    case "touchmove":
      type = "mousemove";
      touch = evt.changedTouches[0];
      break;
    case "touchend":
      type = "mouseup";
      touch = evt.changedTouches[0];
      break;
  }

  let newEvt = new MouseEvent(type,{
  	screenX: touch.screenX,
  	screenY: touch.screenY,
  	clientX: touch.clientX,
  	clientY: touch.clientY,
  	ctrlKey: evt.ctrlKey,
  	shiftKey: evt.shiftKey,
  	altKey: evt.altKey,
  	metaKey: evt.metaKey,
  	button: 0
  }); 
  
  touch.target.originalTarget.dispatchEvent(newEvt);
}

let eventRoot = document.getElementById('nodeshow-content')

eventRoot.addEventListener("touchstart", actLikeMouse, false);
eventRoot.addEventListener("touchend", actLikeMouse, false);
eventRoot.addEventListener("touchmove", actLikeMouse, false);

eventRoot.addEventListener("touchstart", handleStart, false);
eventRoot.addEventListener("touchend", handleEnd, false);
eventRoot.addEventListener("touchcancel", handleCancel, false);
eventRoot.addEventListener("touchmove", handleMove, false);


let TouchManager = new InputManager(InputAccessManager, EVENTS);

/** @class
 *  @summary Component implementing consistent and managed access to touch input. 
 *  @description TODO
 * */
export class Touch {
	#appId = null
	#handlers = {}
	#manager = MiceManager //TouchManager

	constructor(appId, container) {
		console.log(`NEW Touch manager instance created for ${appId}`)
		this.#appId = `${appId} touch-${Container.generateUUID()}`
	}

	getId() {
		return this.#appId
	}

	getEvents() {
		let result = {}
		for ( const [key, value] of Object.entries(this.#handlers) ) {
			result[key] = value
		}
		return result
	}

	enable() {
		this.#manager.register(this)
	}

	disable() {
		this.#manager.unregister(this)
	}

	setAction(event, callback, accessReq) {
		this.#handlers[event] = {
			callback:callback,
			access: accessReq
		}
	}

	getFocusTarget() {
		return focusTarget
	}
}

export { TouchManager as TouchManager }