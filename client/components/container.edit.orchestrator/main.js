import { container } from '../../nodeshow.js'
import { MiceManager } from '../utils/mouse.js'
import { Keyboard } from '../utils/keyboard.js'
import { ACCESS_REQUIREMENT, InputAccessManagerInstance } from '../utils/inputAccessManager.js'

//ToDo: trigger text editor when a key is pressed on an empty focused container.
class ContainerEditOrchestrator {
	appId = "container.edit.orchestrator"
	#container = null;
	#enabled = false
		
	#keyboard = null;
	#mouseManager = null;

	#conflictingGroups = [];

	constructor (container) {
		this.#container = container;
		container.registerComponent(this);	
		
		this.#keyboard = new Keyboard();
		//this.#keyboard.setAction(new Set(['Control']), this, (e) => this.routeToChangePos(), true)
		this.#keyboard.setAction(new Set(['Control','1']), this, (e) => this.routeByIndex(1), true)
		this.#keyboard.setAction(new Set(['Control','2']), this, (e) => this.routeByIndex(2), true)
		this.#keyboard.setAction(new Set(['Control','3']), this, (e) => this.routeByIndex(3), true)
		this.#keyboard.setAction(new Set(['Control','4']), this, (e) => this.routeByIndex(4), true)
		this.#keyboard.setAction(new Set(['Control','5']), this, (e) => this.routeByIndex(5), true)

		this.#mouseManager = MiceManager;
		this.#mouseManager.setChangeCallback((e) => this.onMouseMgmtChange(e))
	}

	enable () {
		if (!this.#enabled) {
			this.#enabled = true
			this.#keyboard.enable();
			this.onMouseMgmtChange();
		}
	}

	disable () {
		if (this.#enabled) {
			this.#enabled = false
			this.#keyboard.disable();
		}
	}

	isEnabled () {
		return this.#enabled
	}

	onMouseMgmtChange() {
		this.#conflictingGroups = this.#mouseManager.getConflictingGroups()
		console.log(`${this.appId} - conflictingGroups`)
		console.log(this.#conflictingGroups)
	}

	// routeToChangePos() {
	// 	InputAccessManagerInstance.grant('drag.start','container.edit.pos')
	// }

	routeByIndex(i) {
		console.log(`${this.appId} - route by index ${i}`)
		console.log(this.#conflictingGroups)
		for ( const [event, listeners] of Object.entries(this.#conflictingGroups) ) {
			let grantedTo = listeners[i%listeners.length]
			console.log(`${this.appId} granted ${event} to ${grantedTo}`)
			InputAccessManagerInstance.grant(event, grantedTo)
		}		
	}
}

let ceo = new ContainerEditOrchestrator(container)
ceo.enable()