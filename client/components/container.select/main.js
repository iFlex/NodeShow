//responsible with grouping containers in parent or making a selection
// This may be unnecessary
import { container } from '../../nodeshow.js'
import { ACTIONS } from '../../Container.js'
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { Keyboard } from '../utils/keyboard.js'
import { ContainerOverlap } from '../utils/overlap.js'
import { ACCESS_REQUIREMENT } from '../utils/inputAccessManager.js'

//[BUG]: selecting inside containers... positioning is bonkers
//[BUG]: selecting via drag selects root container as well
class ContainerGrouping {
	#container = null;
	appId = "container.select"

	#enabled = false
	#mouse = null;
	#keyboard = null;
	#overlap = null;

	#selection = []
	#canSelect = false;
	#selectParent = null;
	#selector = null;
	#startPos = null
	#selectorDescriptor = {
		nodeName:"DIV", 
		computedStyle:{
			"position":"absolute",
			"width": "10px",
			"height": "10px",
			"margin":"0px",
			"border-width":"0px",
			"padding":"0px",
			"border-color":"black",
			"border-width":"1px",
			"background-color": "blue",
			"opacity": 0.5
		}
	}

	constructor (container) {
		this.#container = container;
		container.registerComponent(this);
		
		this.#overlap = new ContainerOverlap(container);
		
		this.#mouse = new Mouse(this.appId);
		this.#mouse.setAction(MouseEvents.CLICK, (e) => this.singleSelect(e.detail.id))
		this.#mouse.setAction(MouseEvents.DRAG_START, (e) => this.handleDragStart(e), ACCESS_REQUIREMENT.SET_EXCLUSIVE)
		this.#mouse.setAction(MouseEvents.DRAG_UPDATE, (e) => this.handleDragUpdate(e), ACCESS_REQUIREMENT.DEFAULT)
		this.#mouse.setAction(MouseEvents.DRAG_END, (e) => this.handleDragEnd(e), ACCESS_REQUIREMENT.DEFAULT)
		
		this.#keyboard = new Keyboard(this.appId);
	}

	enable () {
		if (!this.#enabled) {
			this.#enabled = true
			this.#mouse.enable();	
			this.#keyboard.enable();
		}
	}

	//ToDo: the container.created event listener could attach listeners to dom children types that may then not be detached in this call, plz fix
	disable () {
		if (this.#enabled) {
			this.#enabled = false
			this.#mouse.disable();
			this.#keyboard.disable();
		}
	}

	isEnabled () {
		return this.#enabled
	}

	start () {
		this.#container.componentStartedWork(this.appId, {})
	} 

	stop () {
		this.#container.componentStoppedWork(this.appId)
		//ToDo: actually end the selection process
	}

	handleDragStart (e) {
		this.#selectParent = this.#container.lookup(e.detail.id)
		this.#startPos = {
			top:e.detail.originalEvent.pageY,
			left:e.detail.originalEvent.pageX,
		}
		this.start();
	}

	handleDragUpdate (e) {
		if (!this.#startPos) {
			return
		}

		if (!this.#selector) {
			this.#selector = this.#container.createFromSerializable(this.#selectParent, this.#selectorDescriptor, null, this.appId)
			this.#container.setPosition(this.#selector, this.#startPos, this.appId)
		}

		//update selection container
		let pos = this.#container.getPosition(this.#selector);
		
		let px = e.detail.originalEvent.pageX;
		let py = e.detail.originalEvent.pageY;
		let w = Math.abs(this.#startPos.left - px);
		let h = Math.abs(this.#startPos.top - py);
		
		if ( px < pos.left ) {
			pos.left = px;
		}
		
		if ( py < pos.top ) {
			pos.top = py;
		}

		this.#container.setPosition(this.#selector, pos, this.appId);
		this.#container.setWidth(this.#selector, w, this.appId)
		this.#container.setHeight(this.#selector, h, this.appId)
	}

	handleDragEnd (e) {
		this.stop();
		//import children into selection container
		if (!this.#selector) {
			return;
		}

		let overlapped = this.#overlap.getOverlappingSiblings(this.#selector)
		
		this.clearSelection();
		for (let entry of overlapped) {
			this.#selection.push(entry.id)
			$(this.#container.lookup(entry.id)).addClass('ns-selected')
		}
		
		this.#container.appEmit(this.appId, 'selected', {selection: this.#selection})
		this.#container.delete(this.#selector, this.appId)
		this.#selector = null;
		this.#startPos = null;
	}

	singleSelect (id) {
		this.clearSelection();
		let target = this.#container.lookup(id)
		$(target).addClass('ns-selected')
		this.#selection = [target]
		this.#container.appEmit(this.appId, 'selected', {selection: this.#selection})
	}

	getSelection() {
		return this.#selection.slice();
	}

	clearSelection() {
		for ( const item of this.#selection ) {
			$(item).removeClass('ns-selected');
		}

		this.#selection = []
	}
}

let cselect = new ContainerGrouping(container)
cselect.enable()