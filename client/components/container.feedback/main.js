import { ACTIONS } from '../../Container.js'

export class ContainerFeedback {
	appId = "container.feedback"
	#container = null;
	#enabled = false
	#handlers = {}
	#syncing = {}
	#interface = null;
	
	#TIME_TILL_MARKED_UNSYNC = 500

	constructor (container) {
		this.#container = container;
		container.registerComponent(this);	
		
		this.#handlers[ACTIONS.syncronizing] = (e) => this.onSyncing(e.detail.id);
		this.#handlers[ACTIONS.syncronized] = (e) => this.onSynced(e.detail.id);
		this.#handlers[ACTIONS.connected] = (e) => this.onConnected();
		this.#handlers[ACTIONS.disconnected] = (e) => this.onDisconnected();

		this.#container.loadStyle("style.css", this.appId)
		this.#interface = this.#container.createFromSerializable(document.body, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"0px",
				"position":"absolute",
				"width":"100%",
				"height":"auto"
			},
			"data":{
		    	"ignore":true,
		    	"containerPermissions":{
					"container.broadcast":{"*":false},
					"container.bridge":{"*":false}
				}
		    },
		},
		null,
		this.appId)
		this.#container.loadHtml(this.#interface, "loader.html", this.appId)
		this.#container.hide(this.#interface)
		
		//TODO: make this only tick if queue has elements
		setInterval((e) => {
			this.step()
		}, 1000);
	}

	enable () {
		if (!this.#enabled) {
			this.#enabled = true
			for (const [ev, hndl] of Object.entries(this.#handlers)) {
				this.#container.addEventListener(ev, hndl)
			}
		}
	}

	disable () {
		if (this.#enabled) {
			this.#enabled = false
			for (const [ev, hndl] of Object.entries(this.#handlers)) {
				this.#container.removeEventListener(ev, hndl)
			}
		}
	}

	isEnabled () {
		return this.#enabled
	}

	step() {
		let now = Date.now()
		for (let [id, since] of Object.entries(this.#syncing)) {
			let delta = now - since
			if (delta > this.#TIME_TILL_MARKED_UNSYNC) {
				this.markAsSyncing(id)
			}
		}
	}

	onConnected() {
		console.log(`${this.appId} connection with server reestablished`)
		this.#container.hide(this.#interface);
	}

	onDisconnected() {
		console.log(`${this.appId} lost connection with server`)
		this.#container.show(this.#interface);
	}

	onSyncing(id) {
		this.#syncing[id] = Date.now()	
	}

	makeLoaderId(id) {
		return `${id}-loader`
	}

	//[TODO]: show main loader rather than on every single container
	markAsSyncing(id) {
		// try {
		// 	if (!this.#container.getMetadata(id, 'syncing')) {
		// 		let clone = document.getElementById('nscf-infinite-loading-bar').cloneNode(true)
		// 		clone.id = this.makeLoaderId(id)
		// 		//use non container appendChild to avoid firing events about the loader
		// 		this.#container.lookup(id).appendChild(clone)
		// 		this.#container.setMetadata(id, 'syncing', true)
		// 	}	
		// } catch (e) {
		// 	console.log(`${this.appId} failed to mark ${id} as syncing`)
		// 	console.error(e)
		// }
	}

	onSynced(id) {
		// delete this.#syncing[id]
		// try {
		// 	this.#container.setMetadata(id, 'syncing', false)
		// 	//use non container appendChild to avoid firing events about the loader
		// 	let loader = document.getElementById(this.makeLoaderId(id))
		// 	if (loader) {
		// 		loader.parentNode.removeChild(loader)
		// 	}
		// } catch (e) {
		// 	console.log(`${this.appId} failed to mark ${id} as synced`)
		// 	console.error(e)
		// }
	}
}