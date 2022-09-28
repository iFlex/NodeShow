import { Keyboard } from '../utils/Keyboards.js'
import { getSelection, clearSelection, lookupStyleRules } from '../utils/common.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'
import { EVENTS as MouseEvents, Mouse, getCursorPosition } from '../utils/mouse.js'

export class ContainerCreator {
	appId = 'container.create'
	type = 'background'
	container = null;
	target = null;
	palette = ["#605B56", "#837A75", "#ACC18A", "#DAFEB7", "#F2FBE0"]
	
	#keyboard = null;
	#mouse = null;
	#enabled = false
	#colorPicker = null;

	constructor (container, colorPicker = {"overlayWith":() => {return "rgb(0,0,0)";}}) {
		this.container = container;
		this.#colorPicker = colorPicker
		container.registerComponent(this);

		this.#keyboard = new Keyboard(this.appId, container, ACCESS_REQUIREMENT.DEFAULT)
		this.#keyboard.setKeyDownAction(new Set(['Alt','n']), this, (e) => this.onKeyboardCreate(), true, true, "Creates a new container")
		this.#keyboard.setKeyDownAction(new Set(['Delete']), this, (e) => this.delete(false), false, true, "Deletes the selected container(s)")
		this.#keyboard.setKeyDownAction(new Set(['End']), this, (e) => this.delete(true), true, true, "Deletes the selected containers but not its/their children")
		
		this.#mouse = new Mouse(this.appId, container)
		this.#mouse.setAction(MouseEvents.DOUBLE_CLICK, (e) => this.onDoubleClick(e))
		this.#mouse.setAction(MouseEvents.CLICK, (e) => this.focusOn(e.detail.id))
	}

	enable() {
		if (!this.#enabled) {
			this.#enabled = true
			this.#keyboard.enable()
			this.#mouse.enable()
		}
	}

	disable() {
		if (this.#enabled) {
			this.#enabled = false
			this.#keyboard.disable()
			this.#mouse.disable()
		}
	}

	isEnabled() {
		return this.#enabled
	}

	deleteNode(sid, spareChildren) {
		if (this.container.getMetadata(sid, 'text-editing')) {
			return;
		}
		console.log(`${this.appId} deleting: ${sid}`)
		try {
			if (spareChildren) {
				this.container.deleteSparingChildren(sid, this.appId);
			} else {
				this.container.delete(sid, this.appId);
			}
		} catch(e) {
			console.error(e)
		}
	}

	delete (spareChildren) {
		let selection = getSelection(this.container);
		clearSelection(this.container);
		for (const sid of selection) {
			this.deleteNode(sid, spareChildren)
		}
		this.target = null;
	}

	create (x, y) {
		if (!this.target) {
			this.target = this.container.parent
		}
		if (x == undefined || y == undefined) {
			let pos = getCursorPosition()
			x = pos.left
			y = pos.top
		}
		
		let childStyle = {
			'position':'absolute',
			'overflow':'hidden',
			'width':'150px',
			'height':'150px',
			'margin': '0px',
			'padding': '0px',
			'background-color': this.#colorPicker.overlayWith([this.target])	
		}
		let div = {
			"nodeName":"div",
			"computedStyle": childStyle
		}

		let parentSuggestion = this.target.getAttribute("data-child-style")
		if (parentSuggestion) {
			parentSuggestion = JSON.parse(parentSuggestion)
			//apply parent suggestion to child style if there is any
			for (const [key, value] of Object.entries(parentSuggestion)) {
				childStyle[key] = value
			}
		}
		
		let node = this.container.createFromSerializable(this.target.id, div, null, this.appId)
		if (x != undefined && y!= undefined) {
			console.log(`Creating new container @abspos{${x}x${y}}`)
			console.log(node)

			try {
				this.container.setPosition(node.id, {top:y, left:x}, this.appId)
			} catch (e) {
			}			
			
			let pointer = node.parentNode
			while (pointer && pointer != this.parent) {
				this.container.fitVisibleContent(pointer, true)	
				pointer = pointer.parentNode
			}
		}
	}
	
	changeType(e) {
		let cls = e.target.className;
		if (this.target) {
			let rules = lookupStyleRules(cls)
			$(this.target).addClass(cls)
			this.container.styleChild(this.target, rules, this.appId)
			//this.setChildStyleSuggestion(this.target)
		}
	}

	focusOn(id) {
		let node = this.container.lookup(id)
		this.target = node
	}

	unfocus() {
		this.target = null
	}

	onKeyboardCreate () {
		let selection = getSelection(this.container)
		let target = this.container.parent
		if (selection) {
			target = selection[0]
		}

		this.create()
	}

	onDoubleClick (e) {
		let pos = {x:e.detail.originalEvent.clientX, y:e.detail.originalEvent.clientY} //e.detail.position
		this.target = this.container.lookup(e.detail.id)
		this.create(pos.x, pos.y)
	}
	
	applyStyleWithStylerSettings(style) {
		let styler = this.container.getComponent('container.edit.style')
		let stylerKeys = styler.getStyleKeys()
		for (const key of stylerKeys) {
			let value = this.container.getMetadata(null, key)
			if (value) {
				if (typeof value === 'string') {
					style[key] = value
				} else {
					for (const [k,v] of Object.entries(value)) {
						style[k] = v
					}
				}
			}
		}
	}	
}
