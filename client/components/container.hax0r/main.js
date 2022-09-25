import { Keyboard } from '../utils/Keyboards.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

export class ContainerHax0r {
	appId = 'container.hax0r'
	container = null;
	type = 'service'
	modal = true
    displayName = "Hax0r"

	#enabled = false;
	#interface = null;
	#keyboard = null;

	constructor (container) {
		this.container = container;
		container.registerComponent(this);
		this.#keyboard = new Keyboard(this.appId, container, ACCESS_REQUIREMENT.EXCLUSIVE)

		this.#interface = this.container.createFromSerializable(document.body, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"128px",
				"position":"fixed"
			},
			"data":{
		    	"ignore":true,
		    	"containerPermissions":{
					"container.broadcast":{"*":false},
					"container.bridge":{"*":false}
				}
		    }
		},
		null,
		this.appId)
		this.container.hide(this.#interface, this.appId)
		this.container.loadHtml(this.#interface, "interface.html", this.appId)
	}

	enable() {
		if (!this.#enabled) {
			this.#enabled = true

			this.container.show(this.#interface, this.appId)
			this.container.bringToFront(this.#interface, this.appId)
			this.#keyboard.enable()
		}
	}

	disable() {
		if (this.#enabled) {
			this.#enabled = false

			this.container.hide(this.#interface, this.appId)
			this.#keyboard.disable()
		}
	}

	isEnabled() {
		return this.#enabled
	}

	evaluate(e) {
		console.log(eval(document.getElementById('ns-hax0r').value))
	}
}