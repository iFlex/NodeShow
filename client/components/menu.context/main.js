import { container } from '../../nodeshow.js'

//ToDo: make the callback work
class ContextMenu {
	appId = "menu.context"
	#container = null;
	#enabled = false
	#handlers = {}
	#interface = null

	#defaultActions = [
		{name: "X", action: "menu.context.stop"},
		{name: "Delete", action: "delete", shortcut:'Delete', icon:'ns-delete-icon'},
		{name: "DeleteSparingChildren", action: ""},
		{name: "Text", action: "container.edit.text.start"},
		{name: "ParentDown", action: "container.lineage.parentDown"},
		{name: "ParentUp", action: "container.lineage.parentUp"},
		{name: "Collapse", action: ""},
		{name: "Arrange", action: ""},
		{name: "Copy", action: "", icon:"ns-copy-icon"},
		{name: "Paste", action: "", icon:"ns-paste-icon"},
		{name: "BringToFront", action: "bringToFront"},
		{name: "SendToBack", action: "sendToBottom"}
	]
  
	#actions = []
	#buttonTemplate = null
	#target = null

	constructor (container) {
		this.#container = container;
		container.registerComponent(this);

		this.#handlers['contextmenu'] = (e) => this.start(e)

		this.#interface = this.#container.createFromSerializable(document.body, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"0px",
				"position":"absolute"
			},
			"permissions":{"container.broadcast":{"*":false}}
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
				document.addEventListener(event, handler)
			}
		}
	}

	disable () {
		if (this.#enabled) {
			this.#enabled = false
			this.#container.hide(this.#interface, this.appId)
			for ( const [event, handler] of Object.entries(this.#handlers)) {
				document.removeEventListener(event, handler)
			}
		}
	}

	isEnabled () {
		return this.#enabled
	}

	start (e) {
		e.preventDefault()

		this.#target = e.target
		this.#container.setPosition(this.#interface, {
			top: e.pageY,
			left: e.pageX
		}, 
		this.appId)
		this.#container.show(this.#interface, this.appId)
		this.#container.bringToFront(this.#interface, this.appId)
		this.#container.componentStartedWork(this.appId, {})
	}

	stop () {
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
		console.log(node)
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

		button.addEventListener('click', (e) => this.callAction(e, details.action))	
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

	callAction(e, call) {
		let toCall = this.#container.lookupMethod(call)
	    if (toCall) {
            let params = [this.#target, this.appId]//(actionDescriptor.params || []).concat([e])
            toCall.method.apply(toCall.context, params)
	    } else {
	        throw `Could not find method ${call} to attach action`
	    }

	    this.stop();
	}
}

let cmenu = new ContextMenu(container)
cmenu.enable()