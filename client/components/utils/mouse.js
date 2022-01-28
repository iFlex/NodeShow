/**
 * Mouse Module
 * @module Mouse
 */

import { container } from "../../nodeshow.js"
import { Container } from "../../Container.js"
import { InputAccessManagerInstance as InputAccessManager } from "./InputAccessManager.mjs"
import { InputManager } from "../utils/InputManager.js"
import { findActionableAnchestor } from "../utils/common.js"

//[TODO]: ensure click and double click events take distance from origin point into account
//[TODO]: double click should reset the timer, currently you can trigger double click incorrectly multiple times
let appId = null; //Temporary, think this up

let FOCUS_TRESHOLD = 5
let focusTarget = null;
let clickTarget = null;
let target = null
let targetMetadata = {};

let moved = 0;
let lastX = 0;
let lastY = 0;
let lastPageX = 0;
let lastPageY = 0;

let dblClickTreshold = 300;
let lastClickTime = 0;
let lastClickedButton = null;

export const EVENTS = {
	'DOWN':'mouse.down',
	'MOVE':'mouse.move',
	'UP':'mouse.up',
	'DRAG_START':'drag.start',
	'DRAG_UPDATE':'drag.update',
	'DRAG_END':'drag.end',
	'CLICK': 'container.click',
	'DOUBLE_CLICK':'container.dblclick',
	'ZOOM':'container.zoom'
}

function mouseDown(e) {
	if (!container.owns(e.target)) {
		console.log('Mouse click on not owned item')
		console.log(e)
		return null;
	}
	
	clickTarget = e.target
	
	target = findActionableAnchestor(container, e.target, appId)
	if (target) {
		focusTarget = target
		
		targetMetadata['targetOx'] = e.layerX / container.getWidth(target) 
		targetMetadata['targetOy'] = e.layerY / container.getHeight(target)

		moved = 0;
		container.emit('drag.start',{
			id:target.id,
			dx: 0,
			dy: 0,
			position: {x:e.pageX, y:e.pageY},
			moved: 0, 
			targetOx: targetMetadata.targetOx,
			targetOy: targetMetadata.targetOy,
			originalEvent: e});
		container.emit('container.blur', {});
		e.preventDefault();
	}	
}

function mouseMove(e) {
	lastPageX = e.pageX;
	lastPageY = e.pageY;
	let globPos = container.localToGlobalPosition(e.target, e.layerX, e.layerY)

	if (target) {
		let dx = e.screenX - lastX;
		let dy = e.screenY - lastY;

		moved += Math.sqrt(Math.pow(Math.abs(dx),2) + Math.pow(Math.abs(dy),2))
		
		container.emit('drag.update',{
			id:target.id,
			dx:dx,
			dy:dy,
			position: {x:e.pageX, y:e.pageY},
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
	let globPos = container.localToGlobalPosition(e.target, e.layerX, e.layerY)

	if (target) {
		clickTarget = target
		container.emit('drag.end',{
			id:target.id,
			dx: 0, //ToDo: incorrect
			dy: 0,
			position: {x:e.pageX, y:e.pageY},
			moved: moved,
			targetOx: targetMetadata.targetOx,
			targetOy: targetMetadata.targetOy, 
			originalEvent: e
		});

		target = null;
		e.preventDefault();

		//[TODO]: make this independent of drag. careful how, because it can break interfaces
		if (clickTarget){
			if (moved <= FOCUS_TRESHOLD) {
				container.emit('container.click', {id:clickTarget.id, position: {x:e.pageX, y:e.pageY}, originalEvent:e})
				let dnow = Date.now()
				if (dnow - lastClickTime <= dblClickTreshold && e.button == lastClickedButton) {
					container.emit('container.dblclick', {id:clickTarget.id, position: {x:e.pageX, y:e.pageY}, originalEvent:e})
					lastClickTime = 0;
				} else {
					lastClickTime = dnow
				}
			}
		}
	}

	lastClickedButton = e.button
}

function mouseWheel(e) {
	container.emit(EVENTS.ZOOM,{
		id:e.target.id,
		position: {x:e.pageX, y:e.pageY},
		originalEvent: e
	});
	e.preventDefault()
}

export function getCursorPosition() {
	return {
		x: lastPageX,
		y: lastPageY
	}
}

document.addEventListener('mouseup', mouseUp)
document.addEventListener('mousemove', mouseMove)
document.addEventListener('mousedown', mouseDown)

let eventRoot = document.getElementById('nodeshow-content')
eventRoot.addEventListener('mousewheel', mouseWheel)
eventRoot.addEventListener('wheel', mouseWheel)
 
let MManager = new InputManager(InputAccessManager, EVENTS);

/** @class
 *  @summary Component implementing consistent and managed access to mouse input. 
 *  @description TODO
 * */
export class Mouse {
	#appId = null
	#handlers = {}
	#mmanager = MManager
	
	constructor(appId, container) {
		console.log(`NEW MOUSE handler instance created for ${appId}`)
		this.#appId = `${appId} mouse-${Container.generateUUID()}`
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