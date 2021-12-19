import { container } from '../../nodeshow.js'
import { ACTIONS } from '../../Container.js'
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { EVENTS as TouchEvents, Touch } from '../utils/touch.js'
import { ACCESS_REQUIREMENT } from '../utils/inputAccessManager.js'

//BUG: when mouse goes out of target, moveing or sizing stops... it needs to keep happening until mouse up (release)
//happens because events stop firing
//ToDo: fire drag end event
class ContainerMover {
	container = null;
	appId = "container.edit.pos"
	displayName = "Move"

	#enabled = false
	#mouse = null
	#touch = null

	#handlers = {}
	#editableClass = 'editable:hover'
	
	lastX = 0;
	lastY = 0;

	constructor (ngps) {
		this.container = ngps;
		
		ngps.registerComponent(this);

		this.#mouse = new Mouse(this.appId);
		this.#mouse.setAction(MouseEvents.DRAG_START, (e) => this.start(e.detail.id), ACCESS_REQUIREMENT.SET_EXCLUSIVE)
		this.#mouse.setAction(MouseEvents.DRAG_UPDATE, (e) => this.handleDragUpdate(e), ACCESS_REQUIREMENT.DEFAULT)
		this.#mouse.setAction(MouseEvents.DRAG_END, (e) => this.stop(e), ACCESS_REQUIREMENT.DEFAULT)

		this.#touch = new Touch(this.appId);
		this.#touch.setAction(MouseEvents.DRAG_START, (e) => this.start(e.detail.id), ACCESS_REQUIREMENT.SET_EXCLUSIVE)
		this.#touch.setAction(MouseEvents.DRAG_UPDATE, (e) => this.handleDragUpdate(e), ACCESS_REQUIREMENT.DEFAULT)
		this.#touch.setAction(MouseEvents.DRAG_END, (e) => this.stop(e), ACCESS_REQUIREMENT.DEFAULT)

		this.#handlers['dragStart'] = (e) => e.preventDefault()
		//this.#handlers[ACTIONS.create] = (e) => this.markEditable(e.detail.id)
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


	//ToDo: consider scale for changing size
	modifyContainer(targetId, dx, dy, x, y, targetOx, targetOy) {
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

	stop() {
		this.target = null;
		this.container.componentStoppedWork(this.appId)
	}
}

let cmover = new ContainerMover(container);
cmover.enable()