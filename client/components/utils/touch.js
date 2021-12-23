import { container } from "../../nodeshow.js"
import { ACTIONS } from "../../Container.js"
import { InputAccessManagerInstance as InputAccessManager} from "./inputAccessManager.js"
import { InputManager } from "../utils/InputManager.js"
import { findActionableAnchestor } from "../utils/common.js"

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

let appId = 'core-touch'
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
function handleStart(e) {
	if (!container.owns(e.target)) {
		console.log('Touch on not owned item')
		console.log(e)
		return null;
	}

	let eventType = e.type;
	let touch = e.touches[0]

	target = findActionableAnchestor(e.target, appId)
	if (target) {
		focusTarget = target
		
		targetMetadata['targetOx'] = touch.layerX / container.getWidth(target) 
		targetMetadata['targetOy'] = touch.layerY / container.getHeight(target)

		moved = 0;
		container.emit(EVENTS.DRAG_START,{
			id:target.id,
			dx: 0,
			dy: 0,
			moved: 0, 
			targetOx: targetMetadata.targetOx,
			targetOy: targetMetadata.targetOy,
			originalEvent: e});
		container.emit('container.blur', {});
		e.preventDefault();
	}
}

function handleMove(e) {
	
	let touch = e.touches[0]
	if (target) {
		let dx = touch.screenX - lastX;
		let dy = touch.screenY - lastY;

		moved += Math.sqrt(Math.pow(Math.abs(dx),2) + Math.pow(Math.abs(dy),2))
		
		container.emit(EVENTS.DRAG_UPDATE,{
			id:target.id,
			dx:dx,
			dy:dy,
			moved: moved, 
			targetOx: targetMetadata.targetOx,
			targetOy: targetMetadata.targetOy,
			originalEvent: e
		});

		container.emit('container.blur', {});
		e.preventDefault();
	}

	lastX = touch.screenX;
	lastY = touch.screenY;
}

function handleCancel(e) {
	handleEnd(e);
}

function handleEnd(e) {
	let touch = e.touches[0]
	if (target) {
		container.emit(EVENTS.DRAG_END,{
			id:target.id,
			dx: 0, //ToDo: incorrect
			dy: 0,
			moved: moved,
			targetOx: targetMetadata.targetOx,
			targetOy: targetMetadata.targetOy, 
			originalEvent: e
		});

		if (moved <= FOCUS_TRESHOLD) {
			container.emit('container.focus', {id:target.id})
			container.emit(EVENTS.CLICK, {id:target.id, originalEvent:e})
			//was click
			let dnow = Date.now()
			if (dnow - lastClickTime <= dblClickTreshold) {
				container.emit(EVENTS.DOUBLE_CLICK, {id:target.id, originalEvent:e})
			}
			lastClickTime = dnow
		}

		target = null;
		e.preventDefault();
	}
}

document.addEventListener("touchstart", handleStart, false);
document.addEventListener("touchend", handleEnd, false);
document.addEventListener("touchcancel", handleCancel, false);
document.addEventListener("touchmove", handleMove, false);

let TouchManager = new InputManager(InputAccessManager, EVENTS);

export class Touch {
	#appId = null
	#handlers = {}

	constructor(appId) {
		console.log(`NEW Touch manager instance created for ${appId}`)
		this.#appId = appId
	}

	enable() {
		for (const [event, callback] of Object.entries(this.#handlers)) {
			document.addEventListener(event, callback)
		}
	}

	disable() {
		for (const [event, callback] of Object.entries(this.#handlers)) {
			document.removeEventListener(event, callback)
		}
	}

	setAction(event, callback, accessReq) {
		this.#handlers[event] = callback;
	}

	getFocusTarget() {
		return focusTarget
	}
}

export { TouchManager as TouchManager }
