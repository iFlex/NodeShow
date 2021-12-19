import { container } from '../../nodeshow.js'
import { ACTIONS } from '../../Container.js'
import { EVENTS as MouseEvents, MiceManager } from '../utils/mouse.js'
import { Keyboard } from '../utils/keyboard.js'
import { ACCESS_REQUIREMENT, InputAccessManagerInstance } from '../utils/inputAccessManager.js'
import { getSelection } from '../utils/common.js'

//[BUG]: icons show on the body for some reason?
//[BUG]: interface gets persisted
let lastY = 0
let lastX = 0
class ContainerEditOrchestrator {
	appId = "container.edit.orchestrator"
	#container = null;
	#enabled = false
		
	#keyboard = null;
	#mouseManager = null;
	#interface = null;
	#conflictingGroups = [];
	#previousRoutes = {}
	#handlers = {}
	
	#iconIds = {}
	#menuRoot = null
	#menuItemTemplate = null
	#enabledTransactionalsCount = 0

	constructor (container) {
		this.#container = container;
		container.registerComponent(this);	
		
		this.#keyboard = new Keyboard(this.appId);
		this.#keyboard.onPritable(this, (e) => this.tryAddText(e), false)
		this.#keyboard.setAction(new Set(['Control','1']), this, (e) => this.routeByIndex(1), false)
		this.#keyboard.setAction(new Set(['Control','2']), this, (e) => this.routeByIndex(2), false)
		this.#keyboard.setAction(new Set(['Control','3']), this, (e) => this.routeByIndex(3), false)
		this.#keyboard.setAction(new Set(['Control','4']), this, (e) => this.routeByIndex(4), false)
		this.#keyboard.setAction(new Set(['Control','5']), this, (e) => this.routeByIndex(5), false)
		this.#keyboard.setAction(new Set(['Control','6']), this, (e) => this.routeByIndex(6), false)
		this.#keyboard.setAction(new Set(['Control','7']), this, (e) => this.routeByIndex(7), false)
		this.#keyboard.setAction(new Set(['Control','8']), this, (e) => this.routeByIndex(8), false)
		this.#keyboard.setAction(new Set(['Control','9']), this, (e) => this.routeByIndex(9), false)
		this.#keyboard.setAction(new Set(['Control','0']), this, (e) => this.routeByIndex(0), false)

		this.setupQuickEditShortcuts()

		this.#mouseManager = MiceManager;
		this.#mouseManager.setChangeCallback((e) => this.onMouseMgmtChange(e))

		this.#interface = this.#container.createFromSerializable(document.body, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"0px",
				"position":"fixed",
                "width":"48px",
                "height":"100%"
			},
			"data":{
		    	"ignore":true
		    },
		   	"permissions": {
		   		"container.bridge":{"*":false}
		   	}
		},
		null,
		this.appId)
		//load interface style and html
		this.#container.loadStyle("style.css", this.appId)
		this.#container.loadHtml(this.#interface, "interface.html", this.appId).then(
            e => {
             	this.#menuRoot = document.getElementById('ns-orchestrator-menu-container')
             	this.#menuItemTemplate = document.getElementById('ns-orchestrator-menu-item').cloneNode(true)
            	this.rebuildMenu()
            }
        )

		this.#handlers[ACTIONS.componentAdded] = (e) => this.onComponentRegistered(e)
        this.#handlers[ACTIONS.componentRemoved] = (e) => this.onComponentUnregistered(e)

        document.onmousemove = function(event) {
			lastX = event.pageX;
			lastY = event.pageY;
		}
	}

	enable () {
		if (!this.#enabled) {
			this.#enabled = true
			this.#keyboard.enable();
			this.onMouseMgmtChange();
			
			for (const [key, value] of Object.entries(this.#handlers)) {
                document.addEventListener(key, value)
            }

			this.#container.show(this.#interface, this.appId)
			this.#container.bringToFront(this.#interface, this.appId)
		}
	}

	disable () {
		if (this.#enabled) {
			this.#enabled = false
			this.#keyboard.disable();
			
			for (const [key, value] of Object.entries(this.#handlers)) {
                document.removeEventListener(key, value)
            }

			this.#container.hide(this.#interface, this.appId)
		}
	}

	isEnabled () {
		return this.#enabled
	}

	setupQuickEditShortcuts() {
		this.#keyboard.setAction(new Set(['Control']), this, (e) => {
			this.#previousRoutes[MouseEvents.DRAG_START] = InputAccessManagerInstance.getGrant(MouseEvents.DRAG_START)
			InputAccessManagerInstance.grant(MouseEvents.DRAG_START, 'container.edit.size')
			this.updateMenu()
		}, false)

		this.#keyboard.setKeyUpAction(new Set(['Control']), this, (e) => {
			InputAccessManagerInstance.grant(MouseEvents.DRAG_START, this.#previousRoutes[MouseEvents.DRAG_START])
			this.updateMenu()
		}, false)

		this.#keyboard.setAction(new Set(['Shift']), this, (e) => {
			this.#previousRoutes[MouseEvents.DRAG_START] = InputAccessManagerInstance.getGrant(MouseEvents.DRAG_START)
			InputAccessManagerInstance.grant(MouseEvents.DRAG_START, 'container.grouping')
			this.updateMenu()
		}, false)

		this.#keyboard.setKeyUpAction(new Set(['Shift']), this, (e) => {
			InputAccessManagerInstance.grant(MouseEvents.DRAG_START, this.#previousRoutes[MouseEvents.DRAG_START])
			this.updateMenu()
		}, false)


		this.#keyboard.setAction(new Set(['Tab']), this, (e) => {
			this.#previousRoutes[MouseEvents.DRAG_START] = InputAccessManagerInstance.getGrant(MouseEvents.DRAG_START)
			InputAccessManagerInstance.grant(MouseEvents.DRAG_START, 'container.select')
			this.updateMenu()
		}, false)

		this.#keyboard.setKeyUpAction(new Set(['Tab']), this, (e) => {
			InputAccessManagerInstance.grant(MouseEvents.DRAG_START, this.#previousRoutes[MouseEvents.DRAG_START])
			this.updateMenu()
		}, false)
	}

	switchRoute(event, routeTo, triggerNode) {
		console.log(`${this.appId} - ${event} -> ${routeTo}`)
		InputAccessManagerInstance.grant(event, routeTo)
		this.updateMenu();
	}

	buildAndShowContextMenu(event, triggerNode) {
		let ctxOptions = []

		let group = this.#conflictingGroups[event]
		if (group) {
			let i = 0;
			for (const item of group) {
				let comp = this.#container.getComponent(item)
				ctxOptions.push(
				{
					name: comp.displayName || item, 
					action: "container.edit.orchestrator.switchRoute", 
					shortcut:  `${this.getShortcuts(item)} / Ctrl + ${i}`, 
					icon: this.getIconId(item),
					params:[event, item, triggerNode]
				})
				i++;
			}

			let contextMenuController = this.#container.getComponent('menu.context')
			contextMenuController.setMenuActions(ctxOptions)
			contextMenuController.start({
				target: this.#container.parent,
				pageX: this.#container.getWidth(this.#interface),
				pageY: lastY,
				preventDefault: function(){}
			})
		}
	}

	rebuildMenu () {
		if (!this.#conflictingGroups || !this.#menuRoot) {
			return;
		}

		this.#menuRoot.children[0].innerHTML = '';
		for (const [event,group] of Object.entries(this.#conflictingGroups)) {
			let node = this.#menuItemTemplate.cloneNode(true)
			node.id = event
			node.setAttribute('data-type','router')
			node.addEventListener('click', (e) => {
				this.buildAndShowContextMenu(event, node)
			})
			this.#menuRoot.children[0].appendChild(node)
		}

		let components = this.#container.listComponents()
		for ( const component of components ) {
			let comp = this.#container.getComponent(component)
			if (comp.transactional) {
				let node = this.#menuItemTemplate.cloneNode(true)
				node.id = component
				node.setAttribute('data-type','transactional')
				node.addEventListener('click', (e) => {
					this.toggleTransactionalApp(comp, node)
				})
				this.#menuRoot.children[0].appendChild(node)
			}
		}

		this.updateMenu();
	}
 	
	updateMenu () {
		let menu = this.#menuRoot.children[0]
		for (const toggler of menu.children) {
			let type = toggler.getAttribute('data-type')

			if (type == 'transactional') {
				let id = toggler.id
				let node = toggler.children[0]
				let component = this.#container.getComponent(id)

				let displayName = component.displayName || id;
				
				let icon = undefined 
				try {
					icon = document.getElementById(this.getIconId(id)).cloneNode(true)
				} catch (e) {

				}

				node.innerHTML = ''
				if (icon) {
					node.appendChild(icon)
					icon.style.display = 'block'
				}
				node.innerHTML += `<span>${displayName}</span>`
				
				if (component.isEnabled()) {
					$(node).addClass('ns-toggler-enabled')
					$(node).removeClass('ns-toggler-disabled')
				} else {
					$(node).removeClass('ns-toggler-enabled')
					$(node).addClass('ns-toggler-disabled')
				}
			} else {
				let event = toggler.id
				let node = toggler.children[0]
				
				let grantedTo = InputAccessManagerInstance.getGrant(event)
				if (!grantedTo) {
					grantedTo = this.getDefaultListener(event);
					InputAccessManagerInstance.grant(event, grantedTo)
				}

				if (grantedTo) {
					let component = this.#container.getComponent(grantedTo)
			
					let displayName = component.displayName || grantedTo;
					let icon = undefined 
					try {
						icon = document.getElementById(this.getIconId(grantedTo)).cloneNode(true)
					} catch (e) {

					}
					node.innerHTML = ''
					if (icon) {
						node.appendChild(icon)
						icon.style.display = 'block'
					}
					node.innerHTML += `<span>${displayName}</span>`
				}
			}
		}
	}


	onMouseMgmtChange() {
		this.#conflictingGroups = this.#mouseManager.getConflictingGroups()
		this.rebuildMenu();
		
		console.log(`${this.appId} - conflictingGroups`)
		console.log(this.#conflictingGroups)
	}

	routeByIndex(i) {
		console.log(`${this.appId} - route by index ${i}`)
		console.log(this.#conflictingGroups)
		for ( const [event, listeners] of Object.entries(this.#conflictingGroups) ) {
			let grantedTo = listeners[i%listeners.length]
			console.log(`${this.appId} granted ${event} to ${grantedTo}`)
			InputAccessManagerInstance.grant(event, grantedTo)
			this.#previousRoutes[event] = grantedTo
		}
		this.updateMenu();		
	}

	onComponentRegistered(e) {
		this.rebuildMenu();
	}

	onComponentUnregistered(e) {
		this.rebuildMenu();
	}

	toggleTransactionalApp(container, node) {
		let state = container.isEnabled()
		if (state) {
			container.disable();
			this.#enabledTransactionalsCount--;		
		} else {
			container.enable();
			this.#enabledTransactionalsCount++;
		}

		this.updateMenu();
	}

	getIconId(id) {
		return id + "-icon";
	}

	getDefaultListener(event) {
		if (!this.#conflictingGroups 
			|| !this.#conflictingGroups[event] 
			|| this.#conflictingGroups[event].length == 0) {
			return null;
		}

		return this.#conflictingGroups[event][0]
	}

	getShortcuts(id) {
		if (id == 'container.edit.size') {
			return 'Ctrl'
		}
		if (id == 'container.grouping') {
			return 'Shift'
		}
		if (id == 'container.select') {
			return 'Tab'
		}
		return ""
	}

	tryAddText (key) {
		let sel = getSelection()
		if (sel.length == 1 ) {
			try {
				let textEditor = this.#container.getComponent('container.edit.text');
				textEditor.start(sel[0])
				//ToDo: figure out a way to also send this char to the text editor
			} catch (e) {
				console.error(`${this.appId} failed to start text editor on keyboard event`)
				console.error(e)
			}
		}
	}
}

let ceo = new ContainerEditOrchestrator(container)
ceo.enable()