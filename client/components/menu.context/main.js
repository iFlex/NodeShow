import { EVENTS as TouchEvents, Touch } from '../utils/touch.js'
import { clearSelection, getSelection, makeSelection } from '../utils/common.js'

//ToDo: state based button text and action
//ToDo: implement key bindings
export class ContextMenu {
	appId = "menu.context"
	#container = null;
	#enabled = false
	#handlers = {}
	#interface = null

	#touch = null

	#defaultActions = [
		{name: "New[X]", action: "menu.context.stop", shortcut: 'Double Click'},
		{name: "Deselect", action: "menu.context.deselect", shortcut: 'Ctrl+d'},
		{name: "Delete", action: "delete", shortcut:'Delete', icon:'ns-delete-icon'},
		{name: "Delete Sparing", action: "deleteSparingChildren", shortcut:'End', icon:'ns-delete-icon'},
		{name: "Text", action: "menu.context.editText", options:{forwardEvent:true}},
		{name: "ParentDown", action: "container.lineage.parentDown", shortcut:'Shift+<'},
		{name: "ParentUp", action: "container.lineage.parentUp", shortcut:'Shift+>'},
		{name: "Collapse", action: "container.edit.abstraction.collapse", shortcut: 'Ctrl+Down'},
		{name: "Expand", action: "container.edit.abstraction.expand", shortcut: 'Ctrl+Up'},
		{name: "Arrange[X]", action: ""},
		{name: "Copy[X]", action: "", icon:"ns-copy-icon", shortcut:'Ctrl+C'},
		{name: "Paste[X]", action: "", icon:"ns-paste-icon", shortcut:'Ctrl+V'},
		{name: "Send To Front", action: "bringToFront", shortcut:'Ctrl+}'},
		{name: "Send To Back", action: "sendToBottom", shortcut:'Ctrl+{'}
	]
  
	#actions = []
	#buttonTemplate = null
	#target = null

	constructor (container) {
		this.#container = container;
		container.registerComponent(this);
		
		this.#touch = new Touch(this.appId)
		this.#touch.setAction(TouchEvents.CLICK, (e) => {
			this.start(e)
		})

		this.#handlers['contextmenu'] = (e) => this.start(e)

		this.#interface = this.#container.createFromSerializable(document.body, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"0px",
				"position":"absolute"
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

		this.#container.hide(this.#interface, this.appId)
		//load interface style and html
		this.#container.loadStyle("style.css", this.appId)
		this.#container.loadHtml(this.#interface, "interface.html", this.appId).then(e => {
			this.#buttonTemplate = document.getElementById('ns-context-menu-item')
			this.#actions = this.#defaultActions
			this.buildMenu();
		})
	}

	enable () {
		if (!this.#enabled) {
			this.#enabled = true
			for ( const [event, handler] of Object.entries(this.#handlers)) {
				this.#container.addEventListener(event, handler)
			}
			this.#touch.enable();
		}
	}

	disable () {
		if (this.#enabled) {
			this.#enabled = false
			this.#container.hide(this.#interface, this.appId)
			for ( const [event, handler] of Object.entries(this.#handlers)) {
				this.#container.removeEventListener(event, handler)
			}
			this.#touch.disable();
			
		}
	}

	isEnabled () {
		return this.#enabled
	}

	start (e) {
		console.log(`${this.appId} - start`)
		console.log(e)
		this.#container.componentStartedWork(this.appId, {})
		e.preventDefault()
		this.#target = e.target
		this.#container.setPosition(this.#interface, {
			top: e.pageY,
			left: e.pageX
		}, 
		this.appId)
		this.#container.show(this.#interface, this.appId)
		this.#container.bringToFront(this.#interface, this.appId)
	}

	stop () {
		this.unsetMenuActions();
		this.#container.hide(this.#interface, this.appId)
		this.#container.componentStoppedWork(this.appId)
	}

	setMenuActions(actions) {
		this.#actions = actions
		this.buildMenu();
	}

	unsetMenuActions() {
		this.#actions = this.#defaultActions
		this.buildMenu();
	}

	makeItem(node, details) {
		let button = node.children[0]
		
		button.innerHTML = '';

		if (details.icon) {
			try {
				let icon = document.getElementById(details.icon)
				icon.style.display = "block"
				button.appendChild(icon.cloneNode(true))	
			} catch (e) {
				console.log(`${this.appId} failed to lookup icon ${details.icon}`)
				console.error(e)
			}
			
		}
		button.innerHTML += `<span>${details.name}</span>`
		if (details.shortcut) {
			button.innerHTML += `<span>${details.shortcut}</span>`
		}

		button.addEventListener('click', (e) => this.callAction(e, details))	
	}

	buildMenu() {
		let root = document.getElementById('ns-context-menu')
		root.innerHTML = ''

		for ( const item of this.#actions ) {
			let node = this.#buttonTemplate.cloneNode(true)
			this.makeItem(node, item)
			root.appendChild(node)
		}
	}

	tellUserOnError(e) {
		let userd = this.#container.getComponent('user.dialogue')
		userd.toast(e)
	}

	userOrMakeSelection(e) {
		let selection = getSelection(this.#container)
		if (selection.length == 0) {
			makeSelection(this.#container, e.target)
			return getSelection(this.#container)
		} 

		return selection
	}

	callAction(e, details) {
		let toCall = this.#container.lookupMethod(details.action)
	    if (toCall) {
	    	let selection = getSelection(this.#container)

            let params = []
            //[TODO]: make a better system for determining what params the call will be made with
            if (details.options && details.options.forwardEvent) {
            	params.push(e)
            }
            params.push(selection[0]) //params.push(this.#target)
            params.push(this.appId)
            
            if (details.params) {
            	params = details.params
            }

            try {
            	toCall.method.apply(toCall.context, params)
            } catch (e) {
            	this.tellUserOnError(e)
            }
	    } else {
	        throw `Could not find method ${call} to attach action`
	    }

	    this.stop();
	}

	createContainerWrapper(e) {
		
	}

	editText(e) {
		let textEditor = this.#container.getComponent('container.edit.text')
		textEditor.start(this.#target, {top:e.pageY, left: e.pageX})
	}

	deselect(e) {
		clearSelection(this.#container)
	}
}