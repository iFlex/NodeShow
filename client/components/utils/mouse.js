import { container } from "../../nodeshow.js"
import { ACTIONS } from "../../Container.js"
import { InputAccessManagerInstance as InputAccessManager, ACCESS_REQUIREMENT } from "./inputAccessManager.js"
import { InputManager } from "../utils/InputManager.js"
import { findActionableAnchestor } from "../utils/common.js"

//ToDo: ensure click and double click events take distance from origin point into account
let appId = 'core-mouse' //Temporary, think this up

let FOCUS_TRESHOLD = 5
let focusTarget = null;
let target = null
let targetMetadata = {};

let moved = 0;
let lastX = 0;
let lastY = 0;

let dblClickTreshold = 300;
let lastClickTime = 0;

export const EVENTS = {
	'DOWN':'mouse.down',
	'MOVE':'mouse.move',
	'UP':'mouse.up',
	'DRAG_START':'drag.start',
	'DRAG_UPDATE':'drag.update',
	'DRAG_END':'drag.end',
	'CLICK': 'container.click',
	'DOUBLE_CLICK':'container.dblclick'
}

function mouseDown(e) {
	if (!container.owns(e.target)) {
		console.log('Mouse click on not owned item')
		console.log(e)
		return null;
	}

	let eventType = e.type;
		
	target = findActionableAnchestor(e.target, appId)
	if (target) {
		focusTarget = target
		
		targetMetadata['targetOx'] = e.layerX / container.getWidth(target) 
		targetMetadata['targetOy'] = e.layerY / container.getHeight(target)

		moved = 0;
		container.emit('drag.start',{
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

function mouseMove(e) {
	if (target) {
		let dx = e.screenX - lastX;
		let dy = e.screenY - lastY;

		moved += Math.sqrt(Math.pow(Math.abs(dx),2) + Math.pow(Math.abs(dy),2))
		
		container.emit('drag.update',{
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

	lastX = e.screenX;
	lastY = e.screenY;
}

function mouseUp(e) {	
	if (target) {
		container.emit('drag.end',{
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
			container.emit('container.click', {id:target.id, originalEvent:e})
			//was click
			let dnow = Date.now()
			if (dnow - lastClickTime <= dblClickTreshold) {
				container.emit('container.dblclick', {id:target.id, originalEvent:e})
			}
			lastClickTime = dnow
		}

		target = null;
		e.preventDefault();
	}
}

// container.parent.addEventListener('mouseup', mouseUp)
// container.parent.addEventListener('mousemove', mouseMove)
// container.parent.addEventListener('mousedown', mouseDown)

document.addEventListener('mouseup', mouseUp)
document.addEventListener('mousemove', mouseMove)
document.addEventListener('mousedown', mouseDown)
 
let MManager = new InputManager(InputAccessManager, EVENTS);

export class Mouse {
	#appId = null
	#handlers = {}
	#mmanager = MManager

	constructor(appId) {
		console.log(`NEW MOUSE handler instance created for ${appId}`)
		this.#appId = appId
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
		this.#mmanager.register(this)
	}

	disable() {
		this.#mmanager.unregister(this)
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

export { MManager as MiceManager }