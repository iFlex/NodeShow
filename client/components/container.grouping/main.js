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

	#toggle = false;
	#groupParent = null;
	#grouper = null;
	#groupDescriptor = {
		nodeName:"DIV", 
		computedStyle:{
			"position":"absolute",
			"width": "10px",
			"height": "10px",
			"background-color": "black"
		}
	}

	constructor (container) {
		this.#container = container;
		container.registerComponent(this);
		
		this.#overlap = new ContainerOverlap(container);
		this.#mouse = new Mouse(this.appId, (e) => this.handleDragStart(e), (e) => this.handleDragUpdate(e), (e) => this.handleDragEnd(e));
		this.#keyboard = new Keyboard();
		this.#keyboard.setAction(new Set(['Shift']), this, (key) => this.toggle(key), true)
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

	toggle () {
		this.#toggle = !this.#toggle
		console.log(`${this.appId} - toggle ${this.#toggle}`)
	}

	handleDragStart(e) {
		if (!this.#toggle) {
			return;
		}

		//create selection container
		this.#groupParent = this.#container.parent;
		try {
			this.#groupParent = this.#container.lookup(e.detail.id)
		} catch( ex ){
			//pass
		}
		console.log(e)
		console.log("FAKKA YOU")
		this.#grouper = this.#container.createFromSerializable(this.#groupParent, this.#groupDescriptor, null, this.appId)
		this.#container.setPosition(this.#grouper, {
			top:e.detail.originalEvent.pageY,
			left:e.detail.originalEvent.pageX,
		}, this.appId)
	}

	handleDragUpdate(e) {
		if (!this.#toggle) {
			return;
		}

		//update selection container
		let pos = this.#container.getPosition(this.#grouper);

		let px = e.detail.originalEvent.pageX;
		let py = e.detail.originalEvent.pageY;
		let w = Math.abs(pos.left - px);
		let h = Math.abs(pos.top - py);

		this.#container.setWidth(this.#grouper, w, this.appId)
		this.#container.setHeight(this.#grouper, h, this.appId)
		// if ( px < pos.left ) {
		// 	pos.left = px;
		// }
		// if( py < pos.top ) {
		// 	pos.top = py;
		// }
		//this.#container.setPosition(this.#grouper, pos, this.appId);
	}

	handleDragEnd(e) {
		if (!this.#toggle) {
			return;
		}

		//import children into selection container
		if (this.#grouper) {
			let overlapped = this.#overlap.getOverlappingSiblings(this.#grouper)
			for (let entry of overlapped) {
				let pos = this.#container.getPosition(entry.id)
				this.#container.setParent(entry.id, this.#grouper, this.appId)
				this.#container.setPosition(entry.id, pos, this.appId)
			}

			this.#grouper = null;
		}
	}
}

new ContainerGrouping(container)