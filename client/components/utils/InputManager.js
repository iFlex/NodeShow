import { ACCESS_REQUIREMENT } from "./inputAccessManager.js"
 
export class InputManager {
	#registry = {}
	#accessMgr = null;
	#changeCallback = null;

	constructor(accessManager, EVENTS) {
		for (const [alias, event] of Object.entries(EVENTS)) {
			document.addEventListener(event, (e) => this.route(e))
		}

		this.#accessMgr = accessManager
	}

	setChangeCallback(cb) {
		this.#changeCallback = cb;
	}

	route(e) {
		let evid = e.type
		if (evid in this.#registry) {
			let allowedReaders = this.#accessMgr.getAllowed(evid)
			// console.log(`Allowed readers for ${evid}`)
			// console.log(allowedReaders)
			for (let listenerId of allowedReaders) {
				let details = this.#registry[evid][listenerId]
				if (details) {
					details.callback(e)
				}
			}
		}
	}

	register(instance) {
		let id = instance.getId();
		let events = instance.getEvents();

		for (const [event, details] of Object.entries(events)) {
			if (!(event in this.#registry)) {
				this.#registry[event] = {}
			}

			this.#registry[event][id] = details
			this.#accessMgr.register(event, id, details.access)	
		}

		if (this.#changeCallback) {
			this.#changeCallback();
		}
	}

	unregister(instance) {
		let id = instance.getId();

		for (const [event, listeners] of Object.entries(this.#registry)) {
			if (id in listeners) {
				delete listeners[id]
				this.#accessMgr.unregisterAll(id)
			}
		}

		if (this.#changeCallback) {
			this.#changeCallback();
		}
	}

	getConflictingGroups() {
		let groups = {}
		for ( const [event, listeners] of Object.entries(this.#registry) ) {
			let group = []
			for ( const [id, data] of Object.entries(listeners) ) {
				if (data.access > ACCESS_REQUIREMENT.DEFAULT) {
					group.push(id)
				}
			}

			if (group.length > 0) {
				groups[event] = group
			}
		}

		return groups
	}
}