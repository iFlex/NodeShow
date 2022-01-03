import { Keyboard } from '../utils/keyboard.js'
import { getSelection, clearSelection } from '../utils/common.js'

import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'

//ToDo: read style configuration from container.edit.style
export class ContainerCreator {
	appId = 'container.create'
	type = 'background'
	container = null;
	target = null;
	palette = ["#605B56", "#837A75", "#ACC18A", "#DAFEB7", "#F2FBE0"]
	
	#keyboard = null;
	#mouse = null;
	#interface = null;
	#enabled = false
	#nodeStyleTypeToChildStyle = {
		"ns-horizontal-list":"ns-horizontal-list-unit ",
		"ns-horizontal-list-unit":"",
		"ns-vertical-list":"ns-vertical-list-unit ",
		"ns-vertical-list-unit":"",
		"ns-grid":"ns-grid-unit",
		"ns-grid-unit":""
	}

	constructor (container) {
		this.container = container;
		container.registerComponent(this);

		this.#keyboard = new Keyboard(this.appId)
		this.#keyboard.setAction(new Set(['Delete']), this, (e) => this.delete(false), false)
		this.#keyboard.setAction(new Set(['End']), this, (e) => this.delete(true), true)
		
		this.#mouse = new Mouse(this.appId)
		this.#mouse.setAction(MouseEvents.DOUBLE_CLICK, (e) => this.onDoubleClick(e))
		this.#mouse.setAction(MouseEvents.CLICK, (e) => this.focusOn(e.detail.id))
	
		this.#interface = this.container.createFromSerializable(document.body, {
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
		this.container.hide(this.#interface, this.appId)
		this.container.loadHtml(this.#interface, "interface.html", this.appId)
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
		
		let childStyle = {
			'position':'absolute',
			'width':'150px',
			'height':'150px',
			'margin': '5px',
			'padding': '5px',
			'background-color': this.pickColor()	
		}
		this.overrideStyleWithStylerSettings(childStyle)

		let parentSuggestion = this.target.getAttribute("data-child-style")
		if (parentSuggestion) {
			parentSuggestion = JSON.parse(parentSuggestion)
			//apply parent suggestion to child style if there is any
			for (const [key, value] of Object.entries(parentSuggestion)) {
				childStyle[key] = value
			}
		}
		
		let div = {
			"nodeName":"div",
			"computedStyle": childStyle
		}
		let node = this.container.createFromSerializable(this.target.id, div, null, this.appId)
		this.setChildStyleSuggestion(node)
		if (x != undefined && y!= undefined) {
			console.log(`Creating new container @abspos{${x}x${y}}`)
			console.log(node)
			this.container.setPosition(node.id, {top:y, left:x}, this.appId)
			console.log("Final position")
			console.log(this.container.getPosition(node.id))
		}
	}

	setChildStyleSuggestion(node) {
		let classes = node.className.split(" ")
		let suggestions = {}
		
		for (const cls of classes) {
			let ccls = this.#nodeStyleTypeToChildStyle[cls]
			if (ccls) {
				suggestions = this.lookupStyleRules(ccls.trim())
			}
		}
		console.log("suggestions")
		console.log(suggestions)
		node.setAttribute("data-child-style", JSON.stringify(suggestions))
	}

	lookupStyleRules(className) {
		className = `.${className}`
		var styleDirectives = [];
		for (var i = 0 ; i < document.styleSheets.length; ++i) {
			console.log(document.styleSheets[i])
			let classes = document.styleSheets[i].cssRules
			for (var x = 0; x < classes.length; x++) {    
				if (classes[x].selectorText == className) {
					styleDirectives.push(classes[x].style)
				}         
			}
		}

		var result = {}
		for (const directive of styleDirectives) {
			for(let  i = 0 ; i < directive.length; ++i) {
				let name = directive.item(i)
				let value = directive.getPropertyValue(name)
				result[name] = value
			}
		}
		return result;
	}
	
	changeType(e) {
		let cls = e.target.className;
		if (this.target) {
			let rules = this.lookupStyleRules(cls)
			$(this.target).addClass(cls)
			this.container.styleChild(this.target, rules, this.appId)
			this.setChildStyleSuggestion(this.target)
		}
	}

	focusOn(id) {
		let node = this.container.lookup(id)
		this.target = node
	}

	unfocus() {
		this.target = null
	}

	pickColor() {
		let index = this.container.nodeCountToRoot(this.target) % this.palette.length;
		console.log(`Picking color ${index} = ${this.palette[index]} :: ${this.target.id}(${this.container.nodeCountToRoot(this.target)})`)
	 	return this.palette[index]
	}

	onDoubleClick (e) {
		let evt = e.detail.originalEvent
		this.target = this.container.lookup(e.detail.id)
		this.create(evt.pageX, evt.pageY)
	}
	
	overrideStyleWithStylerSettings(style) {
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
