//responsible with grouping containers in parent or making a selection
// This may be unnecessary
import { container } from '../../nodeshow.js'
import { ACTIONS } from '../../Container.js'
import { Mouse } from '../utils/mouse.js'
import { ContainerOverlap } from '../utils/overlap.js'
import { Keyboard } from '../utils/keyboard.js'

class ContainerGrouping {
	#container = null;
	appId = "container.grouping"

	#enabled = false
	#mouse = null;
	#keyboard = null;
	#overlap = null;

	#canGroup = false;
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

	constructor (container) {
		this.#container = container;
		container.registerComponent(this);
		
		this.#overlap = new ContainerOverlap(container);
		this.#mouse = new Mouse(this.appId, (e) => this.handleDragStart(e), (e) => this.handleDragUpdate(e), (e) => this.handleDragEnd(e));
		
		this.#keyboard = new Keyboard(this.#container, this.appId);
		this.#keyboard.setAction(new Set(['Shift']), this, (key) => this.enableGrouping(key), true)
		this.#keyboard.setKeyUpAction(new Set(['Shift']), this, (key) => this.disableGrouping(key), true)
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

	enableGrouping () {
		this.#canGroup = true
	}

	disableGrouping () {
		this.#canGroup = false
	}

	handleDragStart(e) {
		if (!this.#canGroup) {
			return;
		}

		//create selection container
		this.#groupParent = this.#container.parent;
		try {
			this.#groupParent = this.#container.lookup(e.detail.id)
		} catch( ex ){
			//pass
		}
		
		this.#startPos = {
			top:e.detail.originalEvent.pageY,
			left:e.detail.originalEvent.pageX,
		}
		this.#grouper = this.#container.createFromSerializable(this.#groupParent, this.#groupDescriptor, null, this.appId)
		this.#container.setPosition(this.#grouper, this.#startPos, this.appId)
	}

	handleDragUpdate(e) {
		if (!this.#grouper){
			return;
		}

		//update selection container
		let pos = this.#container.getPosition(this.#grouper);
		
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

		this.#container.setPosition(this.#grouper, pos, this.appId);
		this.#container.setWidth(this.#grouper, w, this.appId)
		this.#container.setHeight(this.#grouper, h, this.appId)
	}

	handleDragEnd(e) {
		//import children into selection container
		if (!this.#grouper) {
			return;
		}
		let overlapped = this.#overlap.getOverlappingSiblings(this.#grouper)
		for (let entry of overlapped) {
			let pos = this.#container.getPosition(entry.id)
			this.#container.setParent(entry.id, this.#grouper, this.appId)
			this.#container.setPosition(entry.id, pos, this.appId)
		}

		this.#grouper = null;
	}
}

new ContainerGrouping(container)