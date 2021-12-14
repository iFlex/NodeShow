import { container } from '../../nodeshow.js'
import { ACTIONS } from '../../Container.js'
import { Mouse } from '../utils/mouse.js'

const SELECT_MOVE_TRESHOLD = 5;
//BUG: when mouse goes out of target, moveing or sizing stops... it needs to keep happening until mouse up (release)
//happens because events stop firing
//ToDo: fire drag end event
class ContainerMover {
	container = null;
	appId = "container.edit.pos"

	touchEvents = ['touchstart','touchend', 'touchcancel', 'touchmove']
	
	#enabled = false
	#mouse = null;

	#handlers = {}
	#presenveRatio = false
	#mode = 'move' //or size
	#editableClass = 'editable:hover'
	
	selection = null;

	lastX = 0;
	lastY = 0;

	constructor (ngps) {
		this.container = ngps;
		this.#mode = 'move'

		ngps.registerComponent(this);

		this.#mouse = new Mouse(this.appId, null, (e) => this.handleDragUpdate(e), (e) => this.handleDragEnd(e));

		this.#handlers['keyDown'] = (e) => this.handleKeydown(e)
		this.#handlers['keyUp'] = (e) => this.handleKeyUp(e)
		this.#handlers['dragStart'] = (e) => e.preventDefault()
		this.#handlers[ACTIONS.create] = (e) => this.markEditable(e.detail.id)
	}

	enable() {
		if (!this.#enabled) {
			this.#enabled = true
			this.#mouse.enable();

			//ToDo: forgot what this is for, document plz
			$('*').on('dragstart', this.#handlers.dragStart);

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
			this.#mouse.disable();
			
			$('*').off('dragstart', this.#handlers.dragStart);

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

	//ToDo: consider scale for changing size
	modifyContainer(targetId, dx, dy, x, y, targetOx, targetOy) {
		let target = this.container.lookup(targetId)

		if (this.#mode == 'size') {
			let w = this.container.getWidth(target.id)
			let h = this.container.getHeight(target.id)
			
			if (this.#presenveRatio) {
				let change = this.keepRatio(target.id, w, h, dx, dy)
				dx = change.dx;
				dy = change.dy;
			}
			this.container.setWidth(target, w + dx, this.appId);
			this.container.setHeight(target, h + dy, this.appId);
		} else {
			this.container.setPosition(target, {
				top: y,
				left: x,
				originX: targetOx,
				originY: targetOy
			}, this.appId)
		} 
	}

	handleDragUpdate(e) {
		let d = e.detail;
		if (d.id == this.container.parent.id) {
			return;
		}
		
		this.modifyContainer(d.id, d.dx, d.dy, 
			d.originalEvent.pageX, d.originalEvent.pageY,
			d.targetOx, d.targetOy)
			
		if(d.dx != 0 || d.dy != 0) {
			this.selection = null;
			this.container.appEmit(this.appId,'unselected',{id:d.id, originalEvent: d.originalEvent});
		}
	}

	handleDragEnd(e) {
		if (e.detail.moved < SELECT_MOVE_TRESHOLD) {
			this.container.appEmit(this.appId,'selected',{id:e.detail.id, originalEvent: event});
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