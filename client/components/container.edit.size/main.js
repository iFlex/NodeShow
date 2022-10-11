import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'
import { Keyboard } from '../utils/Keyboards.js'

export class ContainerSizer {
	container = null;
	appId = "container.edit.size"
	displayName = "Resize"
	type = 'background'
	
	#enabled = false
	#mouse = null;
	#keyboard = null;

	#presenveRatio = false
	
	constructor (container) {
		this.container = container;
		container.registerComponent(this);

		this.#mouse = new Mouse(this.appId, container);
		this.#mouse.setAction(MouseEvents.DRAG_START, (e) => this.start(e.detail.id), ACCESS_REQUIREMENT.SET_EXCLUSIVE)
		this.#mouse.setAction(MouseEvents.DRAG_UPDATE, (e) => this.handleDragUpdate(e), ACCESS_REQUIREMENT.DEFAULT)
		this.#mouse.setAction(MouseEvents.DRAG_END, (e) => this.stop(e), ACCESS_REQUIREMENT.DEFAULT)
		this.#mouse.setAction(MouseEvents.ZOOM, (e) => this.zoomRootCameraWithWheel(e.detail))

		this.#keyboard = new Keyboard(this.appId, container, ACCESS_REQUIREMENT.DEFAULT)
		this.#keyboard.setKeyDownAction(new Set(['Shift']), this, (e) => {
			this.#presenveRatio = true
		}, true, false, "Hold to preserve ration as you resize");
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

		if (dx < 0 && dy < 0) {
			sign = -1
		}
		
		return {dx:(sign * ratio * dist), dy:(sign * dist)}
	}	

	zoomRootCameraWithWheel(e) {
		let sign = 1
		if (e.originalEvent.deltaY < 0) {
			sign = -1
		}

		console.log(e)
		let options = {
			speed: 0,
			ox: `${e.position.x || 0}px`,
			oy: `${e.position.y || 0}px`
		}

		if (this.container.camera) {
			this.container.camera.zoom(sign * 0.05, options)
		}
	}

	zoomRootCamera(target, details) {
		if (this.container.camera) {
			let decider = details.dy
			if (Math.abs(details.dx) > Math.abs(details.dy)) {
				decider = details.dx
			}
			let sign = 1
			if (decider < 0) {
				sign = -1
			}
			this.container.camera.zoom(sign * 0.05)
		}
	}

	computeContainerChange(target, originalTarget, dx, dy, x, y, targetOx, targetOy) {
		let w = this.container.getWidth(target, false)
		let h = this.container.getHeight(target, false)

		if (this.#presenveRatio) {
			let change = this.keepRatio(target, w, h, dx, dy)	
			dx = change.dx;
			dy = change.dy;
		}

		w += dx
		h += dy

		return {width: w, height: h}
	}

	//ToDo: consider scale for changing size
	modifyContainer(targetId, dx, dy, x, y, targetOx, targetOy) {
		let originalTarget = this.container.lookup(targetId)
		let target = originalTarget
		let change = this.computeContainerChange(target, originalTarget, dx, dy, x, y, targetOx, targetOy)
		let keepTrying = true;
		//ToDo: find better way to chain the 2 changes (they may fail independently at differentlevels)
		while (keepTrying && target != this.container.parent) {
			change = this.computeContainerChange(target, originalTarget, dx, dy, x, y, targetOx, targetOy)
			try {
				this.container.setWidth(target, change.width, this.appId)
				break
			} catch (e) {
				keepTrying = this.container.couldBeTriedOnParent(e)
				target = this.container.getParent(target)
				
				if (!keepTrying) {
					return
				}
			}
		}

		try {
			this.container.setHeight(target, change.height, this.appId);
		} catch (e) {
			//pass
		}
	}

	start(id) {
		this.container.componentStartedWork(this.appId, {})
		this.target = this.container.lookup(id)
	}

	handleDragUpdate(e) {
		if (!this.target) {
			return;
		}
		
		let d = e.detail;
		let tnode = this.container.lookup(d.id)
		if (tnode == this.container.parent) {
			this.zoomRootCamera(tnode, d)
			return;
		} 
		
		this.modifyContainer(tnode, d.dx, d.dy, 
			d.position.x, d.position.y,
			d.targetOx, d.targetOy)
	}

	stop() {
		this.target = null;
		this.container.componentStoppedWork(this.appId, {})
	}
}