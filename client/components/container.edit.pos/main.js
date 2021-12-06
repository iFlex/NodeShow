import { container } from '../../nodeshow.js'
import { ACTIONS } from '../../Container.js'

const SELECT_MOVE_TRESHOLD = 5;
//BUG: when mouse goes out of target, moveing or sizing stops... it needs to keep happening until mouse up (release)
//happens because events stop firing
class ContainerMover {
	container = null;
	appId = "container.edit.pos"

	mouseEvents = ['mouseup','mousedown','mousemove']
	touchEvents = ['touchstart','touchend', 'touchcancel', 'touchmove']
	
	#handlers = {}
	#presenveRatio = false
	#mode = 'move' //or size
	
	#targetOx = 0;
	#targetOy = 0;
	#moved = 0;

	target = null;
	selection = null;

	lastX = 0;
	lastY = 0;

	constructor (ngps) {
		this.container = ngps;
		this.#mode = 'move'

		ngps.registerComponent(this);
	}

	enable() {
		//ToDo: forgot what this is for, document plz
		$('*').on('dragstart', function(event) { event.preventDefault(); });

		for (const event of this.mouseEvents) {
			document.addEventListener(event, e => this.handleMouseEvent(e))	
		}
		
		for (const event of this.touchEvents) {
			document.addEventListener(event, e => this.handleTouchEvent(e))	
		}

		//checking shift and ctrl
		document.addEventListener("keydown", (e) => this.handleKeydown(e))
		document.addEventListener("keyup",(e) => this.handleKeyUp(e))
	}

	//ToDo: the container.created event listener could attach listeners to dom children types that may then not be detached in this call, plz fix
	disable() {
		$('*').off('dragstart', function(event) { event.preventDefault(); });

		for (const event of this.mouseEvents) {
			document.removeEventListener(event, e => this.handleMouseEvent(e))	
		}
		
		for (const event of this.touchEvents) {
			document.removeEventListener(event, e => this.handleTouchEvent(e))	
		}
		//checking shift and ctrl
		document.removeEventListener("keydown", (e) => this.handleKeydown(e))
		document.removeEventListener("keyup",(e) => this.handleKeyUp(e))
	}

	considerScale(id, dx, dy) {

	}

	findActionableAnchestor(target) {
		if (!target) {
			return null;
		}
		
		try {
			this.container.isOperationAllowed('container.edit', target, this.appId)
			this.container.isOperationAllowed('container.edit.pos', target, this.appId)
		} catch(e) {
			return null;
		}

		try {
			this.container.isOperationAllowed(ACTIONS.setPosition, target, this.appId)
			return target
		} catch (e) {
			return this.findActionableAnchestor(target.parentNode)
		}
	}

	//ToDo: consider dragging form all corners
	keepRatio (id, w, h, dx, dy) {
		let sign = 1
		let dist = Math.sqrt((dx*dx) + (dy*dy))
		let ratio = w/h; 
		
		if (Math.abs(dx) > Math.abs(dy)) {
			if (dx < 0) {
				sign = -1
			}
		} else {
			if (dy < 0) {
				sign = -1
			}
		}
		//ToDo: figure out sign	
		if (dx < 0 && dy < 0) {
			sign = -1
		}
		
		return {dx:(sign * ratio * dist), dy:(sign * dist)}
	}

	//ToDo: consider scale
	modifyContainer(dx, dy, x, y) {
		if (this.#mode == 'size') {
			let w = this.container.getWidth(this.target.id)
			let h = this.container.getHeight(this.target.id)
			if (this.#presenveRatio) {
				let change = this.keepRatio(this.target.id, w, h, dx, dy)
				dx = change.dx;
				dy = change.dy;
			}
			this.container.setWidth(this.target.id, w + dx, this.appId);
			this.container.setHeight(this.target.id, h + dy, this.appId);
		} else {
			//this.container.move(this.target.id, dx, dy, this.appId)
			this.container.setPosition(this.target, {
				top: y,
				left: x,
				originX: this.#targetOx,
				originY: this.#targetOy
			}, this.appId)
		} 
	}

	//ToDo: drag through unmovable objects
	handleMouseEvent(event) {
		let eventType = event.type;
		if (eventType == 'mousedown' || eventType == 'touchstart') {

			this.target = this.findActionableAnchestor(event.target)
			if (this.target) {
				this.selection = event.target;
				
				this.#targetOx = event.layerX / this.container.getWidth(this.target) 
				this.#targetOy = event.layerY / this.container.getHeight(this.target)

				this.#moved = 0;
				event.preventDefault();
			}
		}
		else if (eventType == 'mouseup' || eventType == 'touchend' || eventType == 'touchcancel') {
			if (this.target) {
				if (this.#moved < SELECT_MOVE_TRESHOLD) {
					this.container.appEmit(this.appId,'selected',{id:this.target.id, originalEvent: event});
				}
				this.target = null;//ToDo: smaller ratio preserving change amount
				event.preventDefault();
			}
		}
		else if (this.target) {
			let dx = event.screenX - this.lastX;
			let dy = event.screenY - this.lastY;
			this.#moved += Math.sqrt(Math.pow(Math.abs(dx),2) + Math.pow(Math.abs(dy),2))

			this.modifyContainer(dx, dy, event.pageX, event.pageY)
			
			if(dx != 0 || dy != 0) {
				this.selection = null;
				this.container.appEmit(this.appId,'unselected',{id:this.target.id, originalEvent: event});
			}
			event.preventDefault();
		}
		
		this.lastX = event.screenX;
		this.lastY = event.screenY;
		
	}

	handleTouchEvent(event) {
		if (event.type in ['touchend', 'touchcancel']) {
			this.handleMouseEvent(event)
		} else {
			let touch = event.touches[0]
			let evt = {
				type: event.type,
				pageX: touch.pageX,
				pageY: touch.pageY,
				originalEvent: {
					screenX: touch.screenX,
					screenY: touch.screenY
				},
				target: event.target
			}

			this.handleMouseEvent(evt)
		}
	}

	getClickedContainer() {
		return this.selection;
	}

	handleKeydown(e) {
		let key = e.key
		if (key == 'Control') {
			this.#mode = 'size';
		}
		if (key == 'Shift') {
			this.#presenveRatio = true;
		}
	}

	handleKeyUp(e) {
		let key = e.key
		if (key == 'Control') {
			this.#mode = 'move';
		}
		if (key == 'Shift') {
			this.#presenveRatio = false;
		}
	}
}

let cmover = new ContainerMover(container);
cmover.enable()