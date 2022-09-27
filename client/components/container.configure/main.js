import { ACTIONS } from '../../Container.js'
import { positionVerticalMenu } from '../utils/common.js'
import { Clipboard, EVENTS as ClipboardEvents } from '../utils/clipboard.js'
import { Keyboard } from '../utils/Keyboards.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

//importance: this allows determining how content is arranged, setting overflow rules, how to position elements
export class ContainerConfig {
	appId = 'container.configure'
	container = null;
	selection = null;
	
	type = 'transactional'
	modal = true
    displayName = "Config"

	#enabled = false
	#interface = null;
	#clipboard = null
	#keyboard = null
	#handlers = {}	  

	layouts = {

		"none":{
			"childStyle":{
			}, 
			"parentStyle":{
			}
		},
		"horizontal-list":{
			"childStyle":{
				position: "static",
				height: "inherit"
			}, 
			"parentStyle":{
				"min-width": "64px",
				"width": "auto",
				"display": "flex"
			}
		},
		"vertical-list":{
			"childStyle":{
				margin: "0px",
				padding: "15px",
				"min-height": "64px",
				height: "auto"
			}, 
			"parentStyle":{
				margin: "5px",
				position: "static",
				width: "98%"
			}
		},
		"grid": {
			"childStyle":{
				position: "static",
				float: "left"
			}, 
			"parentStyle":{
				height: "auto",
				"min-height": "100px"
			}
		}
	}

	constructor (container) {
		this.container = container;
		container.registerComponent(this, new Set([{operation:"changeContentLayout", method:this.changeContentLayoutAs}]));
		
		this.#handlers['container.select.selected'] = (e) => this.onFocus(e.detail.id)
		this.#handlers['container.blur'] = (e) => this.onUnfocus(e)

		this.#interface = this.container.createFromSerializable(document.body, {
			"nodeName":"div",
			"className":"ns-vertical-slice-interface",
			"computedStyle":{
				"top":"0px",
				"left":"0px",
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

		// //preload
		// for (let entry of Object.entries(this.layouts)) {
		// 	entry.parentStyle = lookupStyleRules(entry.parentClassName)
		// 	entry.childStyle = lookupStyleRules(entry.childClassName)
		// }

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
			positionVerticalMenu(this.container, this.#interface, this.appId)
		}
	}

	disable() {
		if (this.#enabled) {
			this.#enabled = false

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
		this.selection = this.container.tryExecuteWithComponent("getSelection");
	}

	onUnfocus(e) {
		this.selection = [];
	}

	applyChanges() {
		this.selection = this.container.tryExecuteWithComponent("getSelection");
	}

	lockPosition() {
		this.selection = this.container.tryExecuteWithComponent("getSelection");
		for (const target of this.selection) {
			this.container.setPermission(target, ACTIONS.setPosition, "*", false, this.appId)
		}
	}

	unlockPosition() {
		this.selection = this.container.tryExecuteWithComponent("getSelection");
		for (const target of this.selection) {
			this.container.removePermission(target, ACTIONS.setPosition, null, this.appId)
		}
	}

	lockWidth() {
		this.selection = this.container.tryExecuteWithComponent("getSelection");
		for (const target of this.selection) {
			this.container.setPermission(target, ACTIONS.setWidth, "*", false, this.appId)
		}
	}

	unlockWidth() {
		this.selection = this.container.tryExecuteWithComponent("getSelection");
		for (const target of this.selection) {
			this.container.removePermission(target, ACTIONS.setWidth, null, this.appId)
		}
	}

	lockHeight() {
		this.selection = this.container.tryExecuteWithComponent("getSelection");
		for (const target of this.selection) {
			this.container.setPermission(target, ACTIONS.setHeight, "*", false, this.appId)
		}
	}

	unlockHeight() {
		this.selection = this.container.tryExecuteWithComponent("getSelection");
		for (const target of this.selection) {
			this.container.removePermission(target, ACTIONS.setHeight, null, this.appId)
		}
	}

	changePosType() {
		let type = document.getElementById('ns-pos-type').value
		this.selection = this.container.tryExecuteWithComponent("getSelection")
		for (const target of this.selection) {	
			let node = this.container.lookup(target)
			if (type == 'absolute') {
				let prevPos = this.container.getPosition(node)
				this.container.styleChild(node, {"position": type}, this.appId)
				this.container.setPosition(node, prevPos, this.appId)	
			} else {
				this.container.styleChild(node, {"position": type}, this.appId)
			}
		}
	}

	removeParentLayout(node) {
		for (let config of Object.entries(this.layouts)) {
			let style = config.parentStyle
			this.container.removeStyle(node, style, this.appId)
			config.parentStyle = style
		}
	}
	
	removeChildLayout(node) {
		for (let config of Object.entries(this.layouts)) {
			let style = config.childStyle
			this.container.removeStyle(node, style, this.appId)
			config.childStyle = style
		}
	}

	setChildrenLayouts(parent, layout) {
		for (const child of parent.children) {
			this.removeChildLayout(child)
			this.container.styleChild(child, layout, this.appId)
		}
	}

	setParentLayout(parent, parentStyle) {
		this.removeParentLayout(parent)
		this.container.styleChild(parent, parentStyle, this.appId)
	}

	//[TODO]: make this more efficient: currently when setting a new layout, 
	//all layouts are iterated and removed from the parent and 1st level children and then the desired ones are applied
	changeContentLayout() {
		let type = document.getElementById('ns-content-layout').value
		this.selection = this.container.tryExecuteWithComponent("getSelection")
		this.changeContentLayoutAs(type, this.selection)
	}

	changeContentLayoutAs(type, targets) {
		let layoutConfig = this.layouts[type]
		layoutConfig.parentStyle = layoutConfig.parentStyle
		layoutConfig.childStyle = layoutConfig.childStyle
		
		for (const target of targets) {	
			let node = this.container.lookup(target)
			this.container.setChildStyleRules(node,layoutConfig.childStyle)
			
			//ToDo: deprecate below functions
			node.setAttribute("data-child-style", JSON.stringify(layoutConfig.childStyle))
			this.setParentLayout(node, layoutConfig.parentStyle)
			this.setChildrenLayouts(node, layoutConfig.childStyle)
		}
	}

	changeHeightUnit() {
		let newUnit = document.getElementById('ns-height-unit').value

		this.selection = this.container.tryExecuteWithComponent("getSelection")
		for (const target of this.selection) {	
			this.container.setHeightUnit(target, newUnit, this.appId)
		}
	}

	changeWidthUnit() {
		let newUnit = document.getElementById('ns-width-unit').value

		this.selection = this.container.tryExecuteWithComponent("getSelection")
		for (const target of this.selection) {	
			this.container.setWidthUnit(target, newUnit, this.appId)
		}
	}

	changePosYUnit() {
		let newUnit = document.getElementById('ns-pos-y-unit').value

		this.selection = this.container.tryExecuteWithComponent("getSelection")
		for (const target of this.selection) {	
			this.container.setPositionUnits(target, {top:newUnit}, this.appId)
		}
	}

	changePosXUnit() {
		let newUnit = document.getElementById('ns-pos-x-unit').value

		this.selection = this.container.tryExecuteWithComponent("getSelection")
		for (const target of this.selection) {	
			this.container.setPositionUnits(target, {left:newUnit}, this.appId)
		}
	}

	changeSiblingIndex() {
		let newIndex = document.getElementById('ns-sibling-index').value
		if (newIndex && newIndex.length > 0) {
			newIndex = parseInt(newIndex)
			
			this.selection = this.container.tryExecuteWithComponent("getSelection")
			for (const target of this.selection) {	
				this.container.setSiblingPosition(target, newIndex, this.appId)
			}
		}
	}

	setExplicitWidth () {
		let value = document.getElementById('ns-width').value
		let unit = document.getElementById('ns-width-unit').value
		if (value && value.length > 0) {
			value = parseInt(value)
			
			this.selection = this.container.tryExecuteWithComponent("getSelection")
			for (const target of this.selection) {	
				this.container.setExplicitWidth(target, value, unit, this.appId)
			}
		}
	}

	setExplicitHeight () {
		let value = document.getElementById('ns-height').value
		let unit = document.getElementById('ns-height-unit').value
		if (value && value.length > 0) {
			value = parseInt(value)

			this.selection = this.container.tryExecuteWithComponent("getSelection")
			for (const target of this.selection) {	
				this.container.setExplicitHeight(target, value, unit, this.appId)
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