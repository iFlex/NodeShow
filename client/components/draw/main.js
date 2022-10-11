import { ACTIONS } from '../../Container.js'
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { Touch, EVENTS as TouchEvents } from '../utils/touch.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

export class Draw {
	appId = "draw"
	#container = null;
	displayName = "Draw"
	type = 'background'
	
	#enabled = false
	#mouse = null
	#touch = null

	#handlers = {}
	
	#currentSvg = null;
	#svgPos = null;
	#lastX = 0;
	#lastY = 0;
	

	constructor (container) {
		this.#container = container;
		container.registerComponent(this);

		this.#mouse = new Mouse(this.appId);
		this.#mouse.setAction(MouseEvents.DRAG_START, (e) => this.start(e), ACCESS_REQUIREMENT.DEFAULT)
		this.#mouse.setAction(MouseEvents.DRAG_UPDATE, (e) => this.move(e), ACCESS_REQUIREMENT.DEFAULT)
		this.#mouse.setAction(MouseEvents.DRAG_END, (e) => this.stop(e), ACCESS_REQUIREMENT.DEFAULT)

		this.#touch = new Touch(this.appId);
		this.#touch.setAction(TouchEvents.DOWN, (e) => this.start(e.detail.id), ACCESS_REQUIREMENT.DEFAULT)
		this.#touch.setAction(TouchEvents.MOVE, (e) => this.move(e), ACCESS_REQUIREMENT.DEFAULT)
		this.#touch.setAction(TouchEvents.UP, (e) => this.stop(e), ACCESS_REQUIREMENT.DEFAULT)

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

			this.#container.addEventListener(ACTIONS.create, this.#handlers[ACTIONS.create])	
		}
	}

	disable() {
		if (this.#enabled) {
			this.#enabled = false
			this.#mouse.disable();
			this.#touch.disable();
			$('*').off('dragstart', this.#handlers.dragStart);

			this.#container.removeEventListener(ACTIONS.create, this.#handlers[ACTIONS.create])
		}
	}

	isEnabled() {
		return this.#enabled
	}

	createLine(x1, y1, x2, y2, color, w) {
		var aLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		aLine.setAttribute('x1', x1);
		aLine.setAttribute('y1', y1);
		aLine.setAttribute('x2', x2);
		aLine.setAttribute('y2', y2);
		//aLine.setAttribute('stroke', color);
		//aLine.setAttribute('stroke-width', w);
		aLine.setAttribute("style","stroke:rgb(255,0,0);stroke-width:2")
		return aLine;
	}

	updateLastPosFromEvent(e) {
		this.#lastX = e.detail.position.left;
		this.#lastY = e.detail.position.top;
	}

	start(e) {
		this.#currentSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    	this.#currentSvg.setAttribute('width', this.#container.getWidth(this.#container.parent));
    	this.#currentSvg.setAttribute('height', this.#container.getHeight(this.#container.parent));
		this.#currentSvg.style.position = "absolute"

    	this.#container.parent.appendChild( this.#currentSvg );

		this.updateLastPosFromEvent(e);
		this.#svgPos = this.#container.getPosition(this.#currentSvg)
	}

	move(e) {
		if (this.#currentSvg) {
			let line = this.createLine(
				this.#lastX - this.#svgPos.left, 
				this.#lastY - this.#svgPos.top, 
				e.detail.position.left - this.#svgPos.left, 
				e.detail.position.top - this.#svgPos.top, 
				"red", 5);
			this.#currentSvg.appendChild(line);
			this.updateLastPosFromEvent(e);
		}
	}

	stop() {
		this.#currentSvg = null;
	}
}