import { container } from '../../nodeshow.js'
import { getSelection } from '../utils/common.js'

//ToDo: implement. 
//importance: this allows determining how content is arranged, setting overflow rules, how to position elements
class ContainerConfig {
	appId = 'container.configure'
	container = null;
	selection = null;
	transactional = true
    displayName = "Config"

	#enabled = false
	#interface = null;
	#handlers = {}

	constructor (container) {
		this.container = container;
		container.registerComponent(this);
		
		this.#handlers['container.select.selected'] = (e) => this.onFocus(e.detail.id)
		this.#handlers['container.blur'] = (e) => this.onUnfocus(e)

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

			for ( const [event, handler] of Object.entries(this.#handlers)) {
				document.addEventListener(event, handler)
			}

			this.container.show(this.#interface, this.appId)
			this.container.bringToFront(this.#interface, this.appId)
			this.onFocus()
		}
	}

	disable() {
		if (this.#enabled) {
			this.#enabled = false

			for ( const [event, handler] of Object.entries(this.#handlers)) {
				document.removeEventListener(event, handler)
			}

			this.container.hide(this.#interface, this.appId)
		}
	}

	isEnabled() {
		return this.#enabled
	}

	onFocus(id) {
		this.selection = getSelection();
	}

	onUnfocus(e) {
		this.selection = [];
	}

	applyChanges() {
		this.selection = getSelection() || [];

	}
}

new ContainerConfig(container)