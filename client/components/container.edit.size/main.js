import { container } from '../../nodeshow.js'
import { ACTIONS } from '../../Container.js'
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { ACCESS_REQUIREMENT } from '../utils/inputAccessManager.js'
import { Keyboard } from '../utils/keyboard.js'

class ContainerSizer {
	container = null;
	appId = "container.edit.size"

	#enabled = false
	#mouse = null;
	#keyboard = null;

	#presenveRatio = false
	
	constructor (ngps) {
		this.container = ngps;
		
		ngps.registerComponent(this);

		this.#mouse = new Mouse(this.appId);
		this.#mouse.setAction(MouseEvents.DRAG_START, (e) => this.handleDragStart(e), ACCESS_REQUIREMENT.SET_EXCLUSIVE)
		this.#mouse.setAction(MouseEvents.DRAG_UPDATE, (e) => this.handleDragUpdate(e), ACCESS_REQUIREMENT.DEFAULT)
		this.#mouse.setAction(MouseEvents.DRAG_END, (e) => this.handleDragEnd(e), ACCESS_REQUIREMENT.DEFAULT)

		this.#keyboard = new Keyboard();
		this.#keyboard.setAction(new Set(['Shift']), this, (e) => {
			this.#presenveRatio = true
		}, true)
		this.#keyboard.setKeyUpAction(new Set(['Shift']), this, (e) => { 
			this.#presenveRatio = false
		}, true)
	}

	enable() {
		if (!this.#enabled) {
			this.#enabled = true
			this.#mouse.enable();
			this.#keyboard.enable();
		}
	}

	//ToDo: the container.created event listener could attach listeners to dom children types that may then not be detached in this call, plz fix
	disable() {
		if (this.#enabled) {
			this.#enabled = false
			this.#mouse.disable();
			this.#keyboard.disable();
		}
	}

	isEnabled() {
		return this.#enabled
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

		let w = this.container.getWidth(target.id)
		let h = this.container.getHeight(target.id)
		
		if (this.#presenveRatio) {
			let change = this.keepRatio(target.id, w, h, dx, dy)
			dx = change.dx;
			dy = change.dy;
		}
		this.container.setWidth(target, w + dx, this.appId);
		this.container.setHeight(target, h + dy, this.appId);
	}

	handleDragStart(e) {
		this.target = this.container.lookup(e.detail.id)
	}

	handleDragUpdate(e) {
		if (!this.target) {
			return;
		}
		
		let d = e.detail;
		if (d.id == this.container.parent.id) {
			return;
		}
		
		this.modifyContainer(d.id, d.dx, d.dy, 
			d.originalEvent.pageX, d.originalEvent.pageY,
			d.targetOx, d.targetOy)
	}

	handleDragEnd(e) {
		this.target = null;
	}
}

let csizer = new ContainerSizer(container);
csizer.enable()