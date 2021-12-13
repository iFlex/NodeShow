// touchEvents = ['touchstart','touchend', 'touchcancel', 'touchmove']

// import { container } from "../../nodeshow.js"
// import { ACTIONS } from "../../Container.js"

// let appId = 'core-editing' //Temporary, think this up

// let target = null
// let targetMetadata = {};

// let moved = 0;
// let lastX = 0;
// let lastY = 0;

// function findActionableAnchestor(target) {
// 	if (!target || target === container.parent) {
// 		return null;
// 	}
	
// 	try {
// 		container.isOperationAllowed('container.edit', target, appId)
// 		container.isOperationAllowed('container.edit.pos', target, appId)
// 	} catch(e) {
// 		return null;
// 	}

// 	//ToDo: figure out how to get rid of this shitty coupling... (local permissions would be a nice solution)
// 	if (container.getMetadata(target, 'text-editing')) {
// 		return null;
// 	}
	
// 	try {
// 		container.isOperationAllowed(ACTIONS.setPosition, target, appId)
// 		return target
// 	} catch (e) {
// 		return findActionableAnchestor(target.parentNode)
// 	}
// }

// function mouseDown(e) {
	
// 	let eventType = event.type;
// 	target = findActionableAnchestor(event.target)
// 	if (target) {
		
// 		targetMetadata['targetOx'] = event.layerX / container.getWidth(target) 
// 		targetMetadata['targetOy'] = event.layerY / container.getHeight(target)

// 		moved = 0;
// 		event.preventDefault();
// 		container.emit('drag.start',{
// 			id:target.id,
// 			dx: 0,
// 			dy: 0,
// 			moved: 0, 
// 			targetOx: targetMetadata.targetOx,
// 			targetOy: targetMetadata.targetOy,
// 			originalEvent: event});
// 	}	
// }

// function mouseMove(e) {
// 	if (target) {
// 		let dx = event.screenX - lastX;
// 		let dy = event.screenY - lastY;

// 		moved += Math.sqrt(Math.pow(Math.abs(dx),2) + Math.pow(Math.abs(dy),2))
		
// 		event.preventDefault();

// 		container.emit('drag.update',{
// 			id:target.id,
// 			dx:dx,
// 			dy:dy,
// 			moved: moved, 
// 			targetOx: targetMetadata.targetOx,
// 			targetOy: targetMetadata.targetOy,
// 			originalEvent: event
// 		});
// 	}

// 	lastX = event.screenX;
// 	lastY = event.screenY;
// }

// //ToDo: deprecate and move to Touch.js
// 	handleTouchEvent(event) {
// 		if (event.type in ['touchend', 'touchcancel']) {
// 			this.handleMouseEvent(event)
// 		} else {
// 			let touch = event.touches[0]
// 			let evt = {
// 				type: event.type,
// 				pageX: touch.pageX,
// 				pageY: touch.pageY,
// 				originalEvent: {
// 					screenX: touch.screenX,
// 					screenY: touch.screenY
// 				},
// 				target: event.target
// 			}

// 			this.handleMouseEvent(evt)
// 		}
// 	}

// function mouseUp(e) {
	
// 	if (target) {
// 		container.emit('drag.end',{
// 			id:target.id,
// 			dx: 0, //ToDo: incorrect
// 			dy: 0,
// 			moved: moved,
// 			targetOx: targetMetadata.targetOx,
// 			targetOy: targetMetadata.targetOy, 
// 			originalEvent: event
// 		});
		
		
// 		target = null;
// 		event.preventDefault();
// 	}
// }

// document.addEventListener('mouseup', mouseUp)
// document.addEventListener('mousemove', mouseMove)
// document.addEventListener('mousedown', mouseDown)

// export class Mouse {
// 	#appId = null
// 	#handlers = {}

// 	constructor(appId, start, update, end) {
// 		console.log(`Mouse dragger instance created for ${appId}`)
// 		this.#appId = appId
// 		if (start) {
// 			this.#handlers['drag.start'] = start;	
// 		}

// 		if (update) {
// 			this.#handlers['drag.update'] = update;
// 		}

// 		if(end) {
// 			this.#handlers['drag.end'] = end;
// 		}
// 	}

// 	enable() {
// 		for (const [event, callback] of Object.entries(this.#handlers)) {
// 			document.addEventListener(event, callback)
// 		}
// 	}

// 	disabled() {
// 		for (const [event, callback] of Object.entries(this.#handlers)) {
// 			document.removeEventListener(event, callback)
// 		}
// 	}
// }