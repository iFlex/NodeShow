import { container } from '../../nodeshow.js'
import { ACTIONS } from '../../Container.js'

const SELECT_MOVE_TRESHOLD = 5;
//BUG: when mouse goes out of target, moveing or sizing stops... it needs to keep happening until mouse up (release)
//happens because events stop firing
//ToDo: fire drag end event
class ContainerMover {
	container = null;
	appId = "container.edit.pos"

	mouseEvents = ['mouseup','mousedown','mousemove']
	touchEvents = ['touchstart','touchend', 'touchcancel', 'touchmove']
	
	#enabled = false
	#handlers = {}
	#presenveRatio = false
	#mode = 'move' //or size
	#editableClass = 'editable:hover'
	
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

		this.#handlers['handleTouchEvent'] = (e) => this.handleTouchEvent(e)
		this.#handlers['handleMouseEvent'] = (e) => this.handleMouseEvent(e)
		this.#handlers['keyDown'] = (e) => this.handleKeydown(e)
		this.#handlers['keyUp'] = (e) => this.handleKeyUp(e)
		this.#handlers['dragStart'] = (e) => e.preventDefault()
		this.#handlers[ACTIONS.create] = (e) => this.markEditable(e.detail.id)
	}

	enable() {
		if (!this.#enabled) {
			this.#enabled = true

			//ToDo: forgot what this is for, document plz
			$('*').on('dragstart', this.#handlers.dragStart);

			for (const event of this.mouseEvents) {
				document.addEventListener(event, this.#handlers.handleMouseEvent)	
			}
			
			for (const event of this.touchEvents) {
				document.addEventListener(event, this.#handlers.handleTouchEvent)	
			}

			//checking shift and ctrl
			document.addEventListener("keydown", this.#handlers.keyDown)
			document.addEventListener("keyup", this.#handlers.keyUp)
			document.addEventListener(ACTIONS.create, this.#handlers[ACTIONS.create])	
		}
	}

	//ToDo: the container.created event listener could attach listeners to dom children types that may then not be detached in this call, plz fix
	disable() {
		if (this.#enabled) {
			this.#enabled = false
			$('*').off('dragstart', this.#handlers.dragStart);

			for (const event of this.mouseEvents) {
				document.removeEventListener(event, this.#handlers.handleMouseEvent)	
			}
			
			for (const event of this.touchEvents) {
				document.removeEventListener(event, this.#handlers.handleTouchEvent)	
			}
			//checking shift and ctrl
			document.removeEventListener("keydown", this.#handlers.keyDown)
			document.removeEventListener("keyup", this.#handlers.keyUp)
			document.removeEventListener(ACTIONS.create, this.#handlers[ACTIONS.create])
		}
	}

	isEnabled() {
		return this.#enabled
	}

	markEditable(id) {
		try {
			let container = this.container.lookup(id)
			this.container.isOperationAllowed('container.edit', container, this.appId)
			$(container).addClass(this.#editableClass)
		} catch (e) {
			console.error(`${this.appId}: Failed to mark as editable ${id}`)
			console.error(e)
		}
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
				this.container.appEmit(this.appId,'drag.start',{
					id:this.target.id, 
					targetOx: this.#targetOx,
					targetOy: this.#targetOy,
					originalEvent: event});
			}
		}
		else if (eventType == 'mouseup' || eventType == 'touchend' || eventType == 'touchcancel') {
			if (this.target) {
				this.container.appEmit(this.appId,'drag.end',{
					id:this.target.id, 
					originalEvent: event
				});
				
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
			this.container.appEmit(this.appId,'drag.update',{
				id:this.target.id, 
				dx:dx,
				dy:dy,
				originalEvent: event
			});
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