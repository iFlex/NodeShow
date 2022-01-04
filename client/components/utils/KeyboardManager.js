import { ACCESS_REQUIREMENT } from "./inputAccessManager.js"
import { EVENTS } from "./keyboard.js"

/** @class
 *  @summary Component managing simultaneous access to the keyboard. 
 *  @description TODO
 * */ 
export class KeyboardManager {
	#registry = {}
	#accessMgr = null;
	#changeCallback = null;
	#evid = 'keyboard'

	constructor(accessManager) {
		for (const [alias, event] of Object.entries(EVENTS)) {
			document.addEventListener(event, (e) => this.route(e))
		}

		this.#accessMgr = accessManager
	}

	setChangeCallback(cb) {
		this.#changeCallback = cb;
	}

	route(e) {
		let event = e.detail.originalEvent
		if (this.#evid in this.#registry) {
			let allowedReaders = this.#accessMgr.getAllowed(this.#evid)
			for (let listenerId of allowedReaders) {
				let details = this.#registry[this.#evid][listenerId]
				if (details) {
					details.callbacks[event.type](event)
				}
			}
		}
	}

	register(instance) {
		let id = instance.getId();
		let accessMode = instance.getAccessMode();

		if (!(this.#evid in this.#registry)) {
			this.#registry[this.#evid] = {}
		}

		this.#registry[this.#evid][id] = {
			access: accessMode,
			callbacks: instance.getHandlers()
		}

		this.#accessMgr.register(this.#evid, id, accessMode)	

		if (this.#changeCallback) {
			this.#changeCallback();
		}
	}

	unregister(instance) {
		let id = instance.getId();
		let listeners = this.#registry[this.#evid]

		if (listeners) {
			delete listeners[id]
			this.#accessMgr.unregisterAll(id)
		}
			
		if (this.#changeCallback) {
			this.#changeCallback();
		}
	}
}