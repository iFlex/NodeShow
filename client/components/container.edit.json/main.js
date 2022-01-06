import { getSelection } from '../utils/common.js'
import { Clipboard, EVENTS as ClipboardEvents } from '../utils/clipboard.js'
import { Keyboard } from '../utils/keyboard.js'
import { ACCESS_REQUIREMENT } from '../utils/inputAccessManager.js'

//[BUG]: unsetting actions and permissions dones't work
export class ContainerJsonEdit {
	appId = 'container.edit.json'
	container = null;
	selection = null;
	type = 'transactional'
	modal = true
    displayName = "JEdit"

	#containerId = 'ns-container-id'
	#actionsInput = 'ns-container-actions';
	#permsInput = 'ns-container-permissions';

	#enabled = false
	
	#interface = null;
	#keyboard = null;
	#clipboard = null;
	#handlers = {}

	constructor (container) {
		this.container = container;
		container.registerComponent(this);
		
		this.#handlers['container.select.selected'] = (e) => this.onFocus(e.detail.id)
		this.#handlers['container.blur'] = (e) => this.onUnfocus(e)

		this.#interface = this.container.createFromSerializable(document.body, {
			"nodeName":"div",
			"className":"ns-vertical-slice-interface",
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

		this.#clipboard = new Clipboard(this.appId);
		for (let evid of Object.values(ClipboardEvents)) {
			this.#clipboard.setAction(evid,
				(event) => {},//noop
				ACCESS_REQUIREMENT.EXCLUSIVE)  
		}
		this.#keyboard = new Keyboard(this.appId, container, ACCESS_REQUIREMENT.EXCLUSIVE)
	}

	enable() {
		if (!this.#enabled) {
			this.#enabled = true

			for ( const [event, handler] of Object.entries(this.#handlers)) {
				this.container.addEventListener(event, handler)
			}

			this.container.show(this.#interface, this.appId)
			this.container.bringToFront(this.#interface, this.appId)
			this.onFocus()
		}
	}

	disable() {
		if (this.#enabled) {
			this.#enabled = false
			this.onTextFieldBlur();

			for ( const [event, handler] of Object.entries(this.#handlers)) {
				this.container.removeEventListener(event, handler)
			}

			this.container.hide(this.#interface, this.appId)
		}
	}

	isEnabled() {
		return this.#enabled
	}

	onFocus(id) {
		this.selection = getSelection(this.container);
		
		if (this.selection.length > 0) {
			console.log(`${this.appId} - onFocus() loading up actions and premissions for`)
			console.log(this.selection)

			let target = this.selection[0]
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
		this.selection = getSelection(this.container);

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
			let rmactions = this.container.getActions(item)
			for (const actionToRm of rmactions) {
				this.container.removeAction(item, actionToRm, this.appId)
			}

			for (const action of actions) {
				try {
					console.log(`${this.appId} saving action on container`)
					console.log(action)
					this.container.addAction(item, action, this.appId);
				} catch ( e ) {
					console.log(`${this.appId} failed to save action on container`)
					console.error(e)
					//ToDo: notify user
				}
			}

			let permsToRm = this.container.getPermission(item)
			for (const [rmperm, acl] of Object.entries(permsToRm)) {
				for (const caller of Object.keys(acl)) {
					this.container.removePermission(item, rmperm, caller, this.appId)
				}
			}
			
			for (const [permission, acl] of Object.entries(perms)) {

				for (const [caller, allowed] of Object.entries(acl)) {
					this.container.setPermission(item, permission, caller, allowed, this.appId)
				}
			}
		}
	}

	onTextFieldFocus() {
    this.#clipboard.enable()
    this.#keyboard.enable()
  }

  onTextFieldBlur() {
    this.#clipboard.disable()
    this.#keyboard.disable()
  }
}