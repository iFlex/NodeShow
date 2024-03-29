//responsible with grouping containers in parent or making a selection
// This may be unnecessary
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { ContainerOverlap } from '../utils/overlap.js'
import { Keyboard } from '../utils/Keyboards.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

//[TODO]: select upwards no longer works :( - fix it
export class ContainerGrouping {
	#container = null;
	appId = "container.grouping"
	displayName = 'Group'
	MAX_GROUP_AT_ONCE = 100 //[TODO]: see if you can do any black magic to make this larger without display hiccups (e.g. shadow dom maybe?)

	#enabled = false
	#mouse = null;
	#keyboard = null;
	#overlap = null;

	#groupParent = null;
	#grouper = null;
	#startPos = null
	#groupDescriptor = {
		nodeName:"DIV", 
		computedStyle:{
			"position":"absolute",
			"width": "10px",
			"height": "10px",
			"margin":"0px",
			"border-width":"0px",
			"padding":"0px",
			"background-color": "black"
		}
	}

	#colorPicker = null;
	constructor (container, colorPicker = {"overlayWith":() => {return "rgb(0,0,0)";}}) {
		this.#container = container;
		this.#colorPicker = colorPicker;
		container.registerComponent(this);
		
		this.#overlap = new ContainerOverlap(container)

		this.#mouse = new Mouse(this.appId, container);
		this.#mouse.setAction(MouseEvents.DRAG_START, (e) => this.handleDragStart(e), ACCESS_REQUIREMENT.SET_EXCLUSIVE)
		this.#mouse.setAction(MouseEvents.DRAG_UPDATE, (e) => this.handleDragUpdate(e), ACCESS_REQUIREMENT.DEFAULT)
		this.#mouse.setAction(MouseEvents.DRAG_END, (e) => this.handleDragEnd(e), ACCESS_REQUIREMENT.DEFAULT)
		
		this.#keyboard = new Keyboard(this.appId, container, ACCESS_REQUIREMENT.DEFAULT);
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

	handleDragStart(e) {
		//create selection container
		this.#groupParent = this.#container.parent;
		try {
			this.#groupParent = this.#container.lookup(e.detail.id)
		} catch( ex ){
			//pass
		}
		
		this.#startPos = {
			top: e.detail.originalEvent.y, //e.detail.position.y,
			left: e.detail.originalEvent.x //e.detail.position.x,
		}
	}

	handleDragUpdate(e) {
		if (!this.#startPos){
			return;
		}

		if (!this.#grouper) {
			this.#groupDescriptor.computedStyle["background-color"] = this.#colorPicker.overlayWith([this.#groupParent]);
			this.#grouper = this.#container.createFromSerializable(this.#groupParent, this.#groupDescriptor, null, this.appId)
			this.#container.setPosition(this.#grouper, this.#startPos, this.appId)
		}
		//update selection container
		let pos = this.#container.getPosition(this.#grouper);
		
		let px = e.detail.originalEvent.x // e.detail.position.x;
		let py = e.detail.originalEvent.y // e.detail.position.y;
		let w = Math.abs(pos.left - px);
		let h = Math.abs(pos.top - py);
		
		if ( px < pos.left ) {
			pos.left = px;
		}
		
		if ( py < pos.top ) {
			pos.top = py;
		}

		//[TODO]: reintante and fix selection
		//this.#container.setPosition(this.#grouper, pos, this.appId);
		this.#container.setWidth(this.#grouper, w, this.appId)
		this.#container.setHeight(this.#grouper, h, this.appId)
	}

	handleDragEnd(e) {
		//import children into selection container
		if (!this.#grouper) {
			return;
		}

		let overlapped = this.#overlap.getOverlappingSiblings(this.#grouper)
		let grouped = 0
		for (let entry of overlapped) {
			let pos = this.#container.getPosition(entry.id)
			this.#container.setParent(entry.id, this.#grouper, this.appId)
			this.#container.setPosition(entry.id, pos, this.appId)
			
			grouped++;
			if (grouped >= this.MAX_GROUP_AT_ONCE) {
				console.log(`${this.appId} reached maximum items to group at a time.`)
				this.#tellUser(`Grouped only ${this.MAX_GROUP_AT_ONCE} items. Grouping more than this at once degrades performance`)
				break;
			}
		}

		this.#grouper = null;
		this.#startPos = null;
	}

	#tellUser(msg) {
		let userd = this.#container.getComponent('user.dialogue')
		if (userd) {
			userd.addStackMessage(msg)
		}
	}
}