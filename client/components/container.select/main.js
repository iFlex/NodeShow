//responsible with grouping containers in parent or making a selection
// This may be unnecessary
import { ACTIONS } from '../../Container.js'
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { Keyboard } from '../utils/keyboard.js'
import { ContainerOverlap } from '../utils/overlap.js'
import { ACCESS_REQUIREMENT } from '../utils/inputAccessManager.js'

//[BUG]: selecting upwards no longer works - fix plz :(
export class ContainerSelect {
	#container = null;
	appId = "container.select"
	displayName = "Select"
	type = 'background'
	selectedClass = 'ns-selected'

	MAX_SELECTION_SIZE = 250;

	#enabled = false
	#mouse = null;
	#keyboard = null;
	#overlap = null;

	#selection = []
	#selectParent = null;
	#selector = null;
	#startPos = null;
	
	#selectorDescriptor = {
		nodeName:"DIV", 
		computedStyle:{
			"position":"absolute",
			"width": "10px",
			"height": "10px",
			"margin":"0px",
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
		this.#container.serializerIgnore('className', this.selectedClass)
		//This conflicts with text editor 'Escape'
		//this.#keyboard.setAction(new Set(['Escape']), this, (e) => this.clearSelection(), false);
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
			this.stop();
			this.clearSelection();
		}
	}

	isEnabled () {
		return this.#enabled
	}

	start () {
		this.#container.componentStartedWork(this.appId, {})
	} 

	stop () {
		this.#container.delete(this.#selector, this.appId)
		this.#selector = null;
		this.#container.componentStoppedWork(this.appId)
	}

	handleDragStart (e) {
		this.start();
		this.#selectParent = this.#container.lookup(e.detail.id)
		this.#startPos = {
			top: e.detail.originalEvent.pageY,
			left: e.detail.originalEvent.pageX,
			sy: e.detail.originalEvent.screenY,
			sx: e.detail.originalEvent.screenX
		}
		console.log(this.#startPos)
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
		let w = Math.abs(pos.left - e.detail.originalEvent.pageX);
		let h = Math.abs(pos.top - e.detail.originalEvent.pageY);
		
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
		//import children into selection container
		if (!this.#selector) {
			return;
		}

		let overlapped = this.#overlap.getOverlappingSiblings(this.#selector)
		
		this.clearSelection();
		for (let entry of overlapped) {
			this.#selection.push(entry.id)
			let node = this.#container.lookup(entry.id)
			$(node).addClass(this.selectedClass)

			if (this.#selection.length >= this.MAX_SELECTION_SIZE) {
				console.log(`${this.appId} - Selection overflow`)
				break;
			}
		}
		
		console.log(`${this.appId} selected ${this.#selection.length} items`)
		this.#container.appEmit(this.appId, 'selected', {selection: this.#selection})
		this.stop()
		this.#startPos = null;
	}

	singleSelect (id) {
		this.clearSelection();

		let target = this.#container.lookup(id)
		$(target).addClass(this.selectedClass)
		this.#selection = [target]
		this.#container.appEmit(this.appId, 'selected', {selection: this.#selection})
	}

	getSelection() {
		return this.#selection.slice();
	}

	clearSelection() {
		for ( const item of this.#selection ) {
			let node = this.#container.lookup(item)
			$(node).removeClass(this.selectedClass);
		}

		this.#selection = []
	}
}