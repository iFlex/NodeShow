import { getSelection } from '../utils/common.js'
import { ACTIONS } from '../../Container.js'
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { Touch, EVENTS as TouchEvents } from '../utils/touch.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

export class ContainerMover {
	container = null;
	appId = "container.edit.pos"
	displayName = "Move"
	type = 'background'
	
	#enabled = false
	#mouse = null
	#touch = null

	#handlers = {}
	//#passToAncestorExceptions = new Set(['ContainerOperationDenied'])
	#editableClass = 'editable:hover'
	#selection = []

	lastX = 0;
	lastY = 0;

	constructor (container) {
		this.container = container;
		container.registerComponent(this);

		this.#mouse = new Mouse(this.appId);
		this.#mouse.setAction(MouseEvents.DRAG_START, (e) => this.start(e.detail.id), ACCESS_REQUIREMENT.SET_EXCLUSIVE)
		this.#mouse.setAction(MouseEvents.DRAG_UPDATE, (e) => this.handleDragUpdate(e), ACCESS_REQUIREMENT.DEFAULT)
		this.#mouse.setAction(MouseEvents.DRAG_END, (e) => this.stop(e), ACCESS_REQUIREMENT.DEFAULT)

		this.#touch = new Touch(this.appId);
		this.#touch.setAction(TouchEvents.DRAG_START, (e) => this.start(e.detail.id), ACCESS_REQUIREMENT.SET_EXCLUSIVE)
		this.#touch.setAction(TouchEvents.DRAG_UPDATE, (e) => this.handleDragUpdate(e), ACCESS_REQUIREMENT.DEFAULT)
		this.#touch.setAction(TouchEvents.DRAG_END, (e) => this.stop(e), ACCESS_REQUIREMENT.DEFAULT)

		this.#handlers['dragStart'] = (e) => e.preventDefault()
		//this.#handlers[ACTIONS.create] = (e) => this.markEditable(e.detail.id)
	}

	enable() {
		if (!this.#enabled) {
			this.#enabled = true
			this.#mouse.enable();
			this.#touch.enable();
			//ToDo: forgot what this is for, document plz
			$('*').on('dragstart', this.#handlers.dragStart);

			this.container.addEventListener(ACTIONS.create, this.#handlers[ACTIONS.create])	
		}
	}

	disable() {
		if (this.#enabled) {
			this.#enabled = false
			this.#mouse.disable();
			this.#touch.disable();
			$('*').off('dragstart', this.#handlers.dragStart);

			this.container.removeEventListener(ACTIONS.create, this.#handlers[ACTIONS.create])
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

	moveRootCamera(details) {
		if (this.container.camera) {
			this.container.camera.move(-details.dx, -details.dy)
		}
	}
	
	//ToDo: Fix incredibly annoying positioning problem when dragging over non positionable elements
	modifyContainer(target, x, y, targetOx, targetOy, dx, dy) {
		let newPos = {
			top: y,
			left: x,
			originX: targetOx,
			originY: targetOy
		}
		
		let keepTrying = true;
		let depth = 0;
		while (keepTrying && target != this.container.parent) {
			try {
				if (!depth) {
					this.container.setPosition(target, newPos, this.appId)
				} else {
					this.container.move(target, dx, dy, this.appId)
				}
				break;
			} catch (e) {
				depth++;
				keepTrying = this.container.couldBeTriedOnParent(e)
				target = this.container.getParent(target)
			}
		}
	}

	start(id) {
		//this.container.componentStartedWork(this.appId, {})
		this.target = this.container.lookup(id)
		this.#selection = new Set(getSelection(this.container))
	}

	handleDragUpdate(e) {
		if (!this.target) {
			return;
		}

		let d = e.detail;
		let tnode = this.container.lookup(d.id)
		
		if (tnode == this.container.parent) {
			this.moveRootCamera(d);
			return
		}

		let preTargetPos = this.container.getPosition(tnode)
		this.modifyContainer(tnode,
			d.originalEvent.clientX, //d.position.x, //TODO: make position indicate it is the global position
			d.originalEvent.clientY, //d.position.y,
			d.targetOx, 
			d.targetOy,
			d.dx,
			d.dy)
		let postTargetPos = this.container.getPosition(tnode)
		
		let dy = postTargetPos.top - preTargetPos.top
		let dx = postTargetPos.left - preTargetPos.left
		if (this.#selection.has(d.id)) {
			//only move selection if target is part of selection 
			//(equivalent to: if all selection items are siblings with target)
			for (let id of this.#selection) {
				if (d.id != id) {
					this.container.move(id, dx, dy, this.appId)
				}
			}
		}
	}

	stop() {
		this.target = null;
		this.#selection = null;
		this.container.componentStoppedWork(this.appId)
	}
}