import { ACTIONS } from '../../Container.js'
import { EVENTS as MouseEvents, MiceManager, getCursorPosition } from '../utils/mouse.js'
import { Keyboard } from '../utils/Keyboards.js'
import { InputAccessManagerInstance, ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'
import { clearSelection, getSelection, makeSelection } from '../utils/common.js'

let lastY = 0
let lastX = 0

//[TODO]: Add another app cathegory (other than transactional) which can be toggled via this app but that won't need to show an iterface
export class ContainerEditOrchestrator {
	appId = "container.edit.orchestrator"
	#container = null;
	#enabled = false
		
	#keyboard = null;
	#mouseManager = null;
	#interface = null;
	#conflictingGroups = [];
	#modals = new Set([])
	#previousRoutes = {}
	#handlers = {}
	
	#menuRoot = null
	#menuItemTemplate = null
	#componentToInputInstance = {}
	defaults = {}


	constructor (container) {
		this.#container = container;
		container.registerComponent(this);	
		
		this.#keyboard = new Keyboard(this.appId, container, ACCESS_REQUIREMENT.DEFAULT)
		this.setupKeyboardShortcuts()
		
		this.#mouseManager = MiceManager;
		this.#mouseManager.setChangeCallback((e) => this.onMouseMgmtChange(e))

		this.#interface = this.#container.createFromSerializable(document.body, {
			"nodeName":"div",
			"id":"root-interface",
			"computedStyle":{
				"top":"0px",
				"left":"0px",
				"position":"fixed",
                "width":"auto",
                "height":"100%"
			},
			"data":{
		    	"ignore":true,
		    	"containerPermissions": {
			   		"container.bridge":{"*":false}
			   	}
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
        // this.#handlers[ACTIONS.create] = (e) => {
        // 	this.#container.bringToFront(this.#interface, this.appId)
        // }
        // this.#handlers[ACTIONS.bringToFront] = (e) => {
        // 	if (e.detail.id != this.#interface.id){
        // 		this.#container.bringToFront(this.#interface, this.appId)
        // 	}
        // }

        document.onmousemove = function(event) {
			lastX = event.pageX;
			lastY = event.pageY;
		}

		this.defaults[MouseEvents.DRAG_START] = 'container.edit.pos'
	}

	enable () {
		if (!this.#enabled) {
			this.#enabled = true
			this.#keyboard.enable();
			this.onMouseMgmtChange();
			
			for (const [key, value] of Object.entries(this.#handlers)) {
                this.#container.addEventListener(key, value)
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
                this.#container.removeEventListener(key, value)
            }

			this.#container.hide(this.#interface, this.appId)
		}
	}

	isEnabled () {
		return this.#enabled
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
				let comId = this.#stripUUID(item)
				let comp = this.#container.getComponent(comId)
				ctxOptions.push(
				{
					name: comp.displayName || comId, 
					action: "container.edit.orchestrator.switchRoute", 
					shortcut:  `${this.getShortcuts(comId)} / Ctrl + ${i}`, 
					icon: this.getIconId(comId),
					params:[event, item, triggerNode]
				})
				i++;
			}

			let contextMenuController = this.#container.getComponent('menu.context')
			contextMenuController.setMenuActions(ctxOptions)
			contextMenuController.start({
				target: this.#container.parent,
				pageX: lastX + this.#container.getWidth(this.#interface),
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

		this.#modals = new Set([])
		let components = this.#container.listComponents()
		for ( const component of components ) {
			let comp = this.#container.getComponent(component)
			if (comp.type == 'transactional' || comp.type == 'service') {
				let node = this.#menuItemTemplate.cloneNode(true)
				node.id = component
				node.setAttribute('data-type', comp.type)
				node.addEventListener('click', (e) => {
					this.toggleTransactionalApp(comp, node)
				})
				this.#menuRoot.children[0].appendChild(node)

				if (comp.modal) {
					this.#modals.add(comp.appId)
				}
			}
		}

		this.updateMenu();
	}
	
	#stripUUID (componentId) {
		let items = componentId.split(' ')
		return items[0]
	}

	updateMenu () {
		let menu = this.#menuRoot.children[0]
		for (const toggler of menu.children) {
			let type = toggler.getAttribute('data-type')

			if (type == 'transactional' || type == 'service') {
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
					grantedTo = this.#stripUUID(grantedTo)
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

	#remapInputIntancesToComponents(listeners) {
		for (const [key, entry] of Object.entries(listeners)) {
			for (const listener of entry) {
				let component = this.#stripUUID(listener)
				this.#componentToInputInstance[component] = listener
			}
		}
	}

	onMouseMgmtChange() {
		this.#conflictingGroups = this.#mouseManager.getConflictingGroups()
		this.#remapInputIntancesToComponents(this.#conflictingGroups)
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

	switchOffOtherModals (compId) {
		for (const appId of this.#modals) {
			if (appId !== compId) {
				let comp = this.#container.getComponent(appId)
				if (comp) {
					comp.disable()
				}
			}
		}
	}

	toggleTransactionalApp(component, node) {
		let state = component.isEnabled()
		if (state) {
			component.disable();		
		} else {
			component.enable();
			if (component.modal) {
				this.switchOffOtherModals(component.appId)
			}
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
			return 'Alt'
		}
		return ""
	}

	tryAddText (key) {
		let keyboardState = this.#keyboard.getCurrentKeyState();
		if (keyboardState.get("pressedNonPrintables").size > 0) {
			//we want to trigger the text editor only if a printable character was pressed. No other funtional keys should be pressed.
			return;
		}

		let sel = getSelection(this.#container)
		if (sel.length == 1 ) {
			try {
				let textEditor = this.#container.getComponent('container.edit.text');
				if (!textEditor.getEditTarget()) {
					let target = sel[0]
					let position = undefined
					if (target == this.#container.parent) {
						position = getCursorPosition()
						position.top = position.y
						position.left = position.x
					}

					textEditor.start(target, position)
					textEditor.addPrintable(key)
				}
			} catch (e) {
				console.error(`${this.appId} failed to start text editor on keyboard event`)
				console.error(e)
			}
		}
	}

	collapse() {
		let targets = getSelection(this.#container)
		for (const target of targets) {
			this.#container.collapse(target, this.appId)
		}
	}

	expand() {
		let targets = getSelection(this.#container)
		for (const target of targets) {
			this.#container.expand(target, this.appId)
		}
	}

	fitContent() {
		let targets = getSelection(this.#container)
		for (const target of targets) {
			this.#container.fitVisibleContent(target, true, this.appId, true)
		}
	}

	bringToFront() {
		let targets = getSelection(this.#container)
		for (const target of targets) {
			this.#container.bringToFront(target, this.appId)
		}
	}

	sendToBack() {
		let targets = getSelection(this.#container)
		for (const target of targets) {
			this.#container.sendToBottom(target, this.appId)
		}
	}

	shiftChild(direction) {
		let targets = getSelection(this.#container)
		for (const target of targets) {
			this.#container.changeSiblingPosition(target, direction, this.appId)
		}
	}

	contentLayout(type) {
		this.#container.tryExecuteWithComponent("changeContentLayout", type, getSelection(this.#container), this.appId)
	}

	positionType(type) {
		let targets = getSelection(this.#container)
		for (const target of targets) {
			if (type == 'absolute') {
				this.#container.styleChild(target, {"position": "absolute"}, this.appId)
				this.#container.setPosition(target, getCursorPosition(), this.appId)	
			} else {
				this.#container.styleChild(target, {"position": "static"}, this.appId)
			}
		}
	}

	selectParent() {
		let targets = getSelection(this.#container)
		if (targets) {
			let target = this.#container.lookup(targets[0])
			if (target === this.#container.parent) { 
				return;
			}

			let parent = target.parentNode
			makeSelection(this.#container, [parent])
		}
	}

	setupKeyboardShortcuts() {
		this.#keyboard.setKeyDownAction(new Set(['Control']), this, (e) => {
			InputAccessManagerInstance.grant(MouseEvents.DRAG_START, 
				this.#componentToInputInstance['container.edit.size'])
			this.updateMenu()
		}, false, true)

		this.#keyboard.setKeyUpAction(new Set(['Control']), this, (e) => {
			InputAccessManagerInstance.grant(MouseEvents.DRAG_START, 
				this.#componentToInputInstance[this.defaults[MouseEvents.DRAG_START]])
			this.updateMenu()
		}, false)

		this.#keyboard.setKeyDownAction(new Set(['Shift']), this, (e) => {
			InputAccessManagerInstance.grant(MouseEvents.DRAG_START, 
				this.#componentToInputInstance['container.grouping'])
			this.updateMenu()
		}, true, true)

		this.#keyboard.setKeyUpAction(new Set(['Shift']), this, (e) => {
			InputAccessManagerInstance.grant(MouseEvents.DRAG_START, 
				this.#componentToInputInstance[this.defaults[MouseEvents.DRAG_START]])
			this.updateMenu()
		}, true)

		this.#keyboard.setKeyDownAction(new Set(['Alt']), this, (e) => {
			InputAccessManagerInstance.grant(MouseEvents.DRAG_START, 
				this.#componentToInputInstance['container.select'])
			this.updateMenu()
		}, true, true)

		this.#keyboard.setKeyUpAction(new Set(['Alt']), this, (e) => {
			InputAccessManagerInstance.grant(MouseEvents.DRAG_START, 
				this.#componentToInputInstance[this.defaults[MouseEvents.DRAG_START]])
			this.updateMenu()
		}, true)
		
		this.#keyboard.setPrintableKeyDownAction(this, (e) => this.tryAddText(e), false)
		this.#keyboard.setKeyDownAction(new Set(['Control','ArrowUp']), this, () => this.collapse(), true, true)
		this.#keyboard.setKeyDownAction(new Set(['Control','ArrowDown']), this, () => this.expand(), true, true)

		this.#keyboard.setKeyDownAction(new Set(['Control',' ']), this, () => this.fitContent(), true, true)
		this.#keyboard.setKeyDownAction(new Set(['Shift','ArrowUp']), this, () => this.bringToFront(), true, true)
		this.#keyboard.setKeyDownAction(new Set(['Shift','ArrowDown']), this, () => this.sendToBack(), true, true)
		this.#keyboard.setKeyDownAction(new Set(['Shift','ArrowLeft']), this, () => this.shiftChild(-1), true, true)
		this.#keyboard.setKeyDownAction(new Set(['Shift','ArrowRight']), this, () => this.shiftChild(+1), true, true)

		//temporary workaround as the browser is very eager to execute its own shortcuts...
		const keyboard = new Keyboard(this.appId, this.#container, ACCESS_REQUIREMENT.DEFAULT)
		keyboard.setKeyDownAction(new Set(['Alt']), this, () => {}, true, false)
		keyboard.setKeyDownAction(new Set(['Shift']), this, () => {}, true, false)
		
		this.#keyboard.setKeyDownAction(new Set(['Alt','ArrowUp']), this, () => this.selectParent(), true, true)
		this.#keyboard.setKeyDownAction(new Set(['Alt','p','0']), this, () => this.positionType('static'), true, true)
		this.#keyboard.setKeyDownAction(new Set(['Alt','p','1']), this, () => this.positionType('absolute'), true, true)

		this.#keyboard.setKeyDownAction(new Set(['Alt','l','0']), this, () => this.contentLayout('none'), true, true)
		this.#keyboard.setKeyDownAction(new Set(['Alt','l','1']), this, () => this.contentLayout('grid'), true, true)
		this.#keyboard.setKeyDownAction(new Set(['Alt','l','2']), this, () => this.contentLayout('vertical-list'), true, true)
		this.#keyboard.setKeyDownAction(new Set(['Alt','l','3']), this, () => this.contentLayout('horizontal-list'), true, true)

		
		this.#keyboard.setKeyDownAction(new Set(['Control','1']), this, (e) => this.routeByIndex(1), true)
		this.#keyboard.setKeyDownAction(new Set(['Control','2']), this, (e) => this.routeByIndex(2), true)
		this.#keyboard.setKeyDownAction(new Set(['Control','3']), this, (e) => this.routeByIndex(3), true)
		this.#keyboard.setKeyDownAction(new Set(['Control','4']), this, (e) => this.routeByIndex(4), true)
		this.#keyboard.setKeyDownAction(new Set(['Control','5']), this, (e) => this.routeByIndex(5), true)
		this.#keyboard.setKeyDownAction(new Set(['Control','6']), this, (e) => this.routeByIndex(6), true)
		this.#keyboard.setKeyDownAction(new Set(['Control','7']), this, (e) => this.routeByIndex(7), true)
		this.#keyboard.setKeyDownAction(new Set(['Control','8']), this, (e) => this.routeByIndex(8), true)
		this.#keyboard.setKeyDownAction(new Set(['Control','9']), this, (e) => this.routeByIndex(9), true)
		this.#keyboard.setKeyDownAction(new Set(['Control','0']), this, (e) => this.routeByIndex(0), true)
	}
}