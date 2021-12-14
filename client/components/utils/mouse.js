import { container } from "../../nodeshow.js"
import { ACTIONS } from "../../Container.js"

let appId = 'core-editing' //Temporary, think this up

let FOCUS_TRESHOLD = 5
let focusTarget = null;
let target = null
let targetMetadata = {};

let moved = 0;
let lastX = 0;
let lastY = 0;

function findActionableAnchestor(target) {
	if (!target || target === container.parent || !container.owns(target)) {
		return null;
	}
	
	try {
		container.isOperationAllowed('container.edit', target, appId)
		container.isOperationAllowed('container.edit.pos', target, appId)
	} catch(e) {
		return null;
	}

	//ToDo: figure out how to get rid of this shitty coupling... (local permissions would be a nice solution)
	if (container.getMetadata(target, 'text-editing')) {
		return null;
	}
	
	try {
		container.isOperationAllowed(ACTIONS.setPosition, target, appId)
		return target
	} catch (e) {
		return findActionableAnchestor(target.parentNode)
	}
}

function mouseDown(e) {
	let eventType = event.type;
	target = findActionableAnchestor(event.target)

	if (target) {
		
		targetMetadata['targetOx'] = event.layerX / container.getWidth(target) 
		targetMetadata['targetOy'] = event.layerY / container.getHeight(target)

		moved = 0;
		container.emit('drag.start',{
			id:target.id,
			dx: 0,
			dy: 0,
			moved: 0, 
			targetOx: targetMetadata.targetOx,
			targetOy: targetMetadata.targetOy,
			originalEvent: event});
		event.preventDefault();
	}	
}

function mouseMove(e) {
	if (target) {
		let dx = event.screenX - lastX;
		let dy = event.screenY - lastY;

		moved += Math.sqrt(Math.pow(Math.abs(dx),2) + Math.pow(Math.abs(dy),2))
		
		
		container.emit('drag.update',{
			id:target.id,
			dx:dx,
			dy:dy,
			moved: moved, 
			targetOx: targetMetadata.targetOx,
			targetOy: targetMetadata.targetOy,
			originalEvent: event
		});

		container.emit('container.blur', {});
		focusTarget = null;
		event.preventDefault();
	}

	lastX = event.screenX;
	lastY = event.screenY;
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
			originalEvent: event
		});

		if (moved <= FOCUS_TRESHOLD) {
			container.emit('container.focus', {id:target.id})
			focusTarget = target
		}

		target = null;
		event.preventDefault();
	}
}

// container.parent.addEventListener('mouseup', mouseUp)
// container.parent.addEventListener('mousemove', mouseMove)
// container.parent.addEventListener('mousedown', mouseDown)

document.addEventListener('mouseup', mouseUp)
document.addEventListener('mousemove', mouseMove)
document.addEventListener('mousedown', mouseDown)

export class Mouse {
	#appId = null
	#handlers = {}

	constructor(appId, start, update, end, focus, blur) {
		console.log(`NEW MOUSE dragger instance created for ${appId}`)
		this.#appId = appId
		if (start) {
			this.#handlers['drag.start'] = start;	
		}

		if (update) {
			this.#handlers['drag.update'] = update;
		}

		if (end) {
			this.#handlers['drag.end'] = end;
		}

		if (focus) {
			this.#handlers['container.focus'] = focus;
		}

		if (blur) {
			this.#handlers['container.blur'] = blur;
		}
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

	getFocusTarget() {
		return focusTarget
	}
}