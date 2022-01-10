import { getSelection } from '../utils/common.js'
import { ACTIONS } from '../../Container.js'
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { Touch, EVENTS as TouchEvents } from '../utils/touch.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

//BUG: when mouse goes out of target, moveing or sizing stops... it needs to keep happening until mouse up (release)
//happens because events stop firing
//ToDo: fire drag end event
export class ContainerMover {
	container = null;
	appId = "container.edit.pos"
	displayName = "Move"
	type = 'background'
	
	#enabled = false
	#mouse = null
	#touch = null

	#handlers = {}
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
			//this.#touch.enable();
			//ToDo: forgot what this is for, document plz
			$('*').on('dragstart', this.#handlers.dragStart);

			//checking shift and ctrl
			this.container.addEventListener("keydown", this.#handlers.keyDown)
			this.container.addEventListener("keyup", this.#handlers.keyUp)
			this.container.addEventListener(ACTIONS.create, this.#handlers[ACTIONS.create])	
		}
	}

	//ToDo: the container.created event listener could attach listeners to dom children types that may then not be detached in this call, plz fix
	disable() {
		if (this.#enabled) {
			this.#enabled = false
			this.#mouse.disable();
			//this.#touch.disable();
			$('*').off('dragstart', this.#handlers.dragStart);

			//checking shift and ctrl
			this.container.removeEventListener("keydown", this.#handlers.keyDown)
			this.container.removeEventListener("keyup", this.#handlers.keyUp)
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


	//ToDo: consider scale for changing size
	modifyContainer(targetId, x, y, targetOx, targetOy) {
		let target = this.container.lookup(targetId)
		this.container.setPosition(target, {
			top: y,
			left: x,
			originX: targetOx,
			originY: targetOy
		}, this.appId)
	}

	start(id) {
		this.target = this.container.lookup(id)
		this.container.componentStartedWork(this.appId, {})
		this.#selection = new Set(getSelection(this.container))
	}

	handleDragUpdate(e) {
		if (!this.target) {
			return;
		}

		let d = e.detail;
		if (d.id == this.container.parent.id) {
			return;
		}
		
		let preTargetPos = this.container.getPosition(d.id)
		this.modifyContainer(d.id,
			d.originalEvent.pageX, d.originalEvent.pageY,
			d.targetOx, d.targetOy)
		let postTargetPos = this.container.getPosition(d.id)
		
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