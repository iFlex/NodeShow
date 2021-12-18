import { container } from '../../nodeshow.js'

class Template {
	appId = "container.select"
	#container = null;
	#enabled = false
	
	constructor (container) {
		this.#container = container;
		container.registerComponent(this);	
	}

	enable () {
		if (!this.#enabled) {
			this.#enabled = true
		}
	}

	disable () {
		if (this.#enabled) {
			this.#enabled = false
		}
	}

	isEnabled () {
		return this.#enabled
	}

	//entrypoint to container function
	start(targets) {
		//use this if app needs mutual exclusivity from other apps that have start & stop.
		//reactive apps won't be affected
		//background apps won't be affected
		this.#container.componentStartedWork(this.appId, {})
	}

	stop() {
		this.#container.componentStoppedWork(this.appId)
	}
}

let t = new Template(container)
t.enable()