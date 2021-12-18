import { container } from '../../nodeshow.js'
import { getSelection } from '../utils/common.js'

class ContainerJsonEdit {
	appId = 'container.edit.json'
	container = null;
	selection = null;

	#containerId = 'ns-container-id'
	#actionsInput = 'ns-container-actions';
	#permsInput = 'ns-container-permissions';

	#enabled = false
	
	#interface = null;
	#handlers = {}

	constructor (container) {
		this.container = container;
		container.registerComponent(this);
		
		this.#handlers['container.select.selected'] = (e) => this.onFocus(e)
		this.#handlers['container.blur'] = (e) => this.onUnfocus(e)

		this.#interface = this.container.createFromSerializable(document.body, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"128px",
				"position":"absolute"
			},
			"permissions":{"container.broadcast":{"*":false}}
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

	onFocus() {
		this.selection = getSelection();
		
		if (this.selection.length > 0) {
			console.log(`${this.appId} - onFocus() loading up actions and premissions for`)
			console.log(this.selection)

			let target = id//this.selection[0]
			let perms = this.container.getPermission(target) || {};
			let actns = this.container.getActions(target) || {};

			document.getElementById(this.#containerId).innerHTML = target.id;
			document.getElementById(this.#actionsInput).value = JSON.stringify(actns);
			document.getElementById(this.#permsInput).value = JSON.stringify(perms);
		}
	}

	onUnfocus(e) {
		this.selection = [];

		document.getElementById(this.#containerId).innerHTML = '';
		document.getElementById(this.#actionsInput).value = '';
		document.getElementById(this.#permsInput).value = '';
	}

	applyChanges() {
		this.selection = getSelection() || [];

		let actions = {}
		let perms   = {}

		try {
			actions = JSON.parse(document.getElementById(this.#actionsInput).value);
		} catch (e) {
			alert(e);
			return;
		}

		try {
			perms = JSON.parse(document.getElementById(this.#permsInput).value)
		} catch (e) {
			alert(e);
			return;
		}

		for (const item of this.selection) {
			for (const [key, value] of Object.entries(actions)) {
				this.container.setAction(item, values, this.appId);
			}

			for (const [key, value] of Object.entries(perms)) {
				this.container.setPermission(item, key, value, null,this.appId)
			}
		}
	}
}

new ContainerJsonEdit(container)