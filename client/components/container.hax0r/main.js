import { container } from '../../nodeshow.js'

class ContainerHax0r {
	appId = 'container.hax0r'
	container = null;
	transactional = true
    displayName = "Hax0r"

	#enabled = false;
	#interface = null;
	
	constructor (container) {
		this.container = container;
		container.registerComponent(this);
		
		this.#interface = this.container.createFromSerializable(document.body, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"128px",
				"position":"fixed"
			},
			"data":{
		    	"ignore":true
		    },
			"permissions":{
				"container.broadcast":{"*":false},
				"container.bridge":{"*":false}
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
		}
	}

	disable() {
		if (this.#enabled) {
			this.#enabled = false

			this.container.hide(this.#interface, this.appId)
		}
	}

	isEnabled() {
		return this.#enabled
	}

	evaluate(e) {
		console.log(eval(document.getElementById('ns-hax0r').value))
	}
}

new ContainerHax0r(container)