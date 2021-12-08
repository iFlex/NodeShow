import {container} from '../../nodeshow.js'

var tapedTwice = false;

class ContainerCreator {
	appId = 'container.create'
	container = null;
	target = null;
	palette = ["#605B56", "#837A75", "#ACC18A", "#DAFEB7", "#F2FBE0"]
	#paletteIndex = 0
	#control = false;
	#interface = null;
	#handlers = {}
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

		this.#handlers['keydown'] = (e) => this.keyDown(e)
		this.#handlers['keyup'] = (e) => this.keyUp(e)
		this.#handlers['dblclick'] = (e) => this.onClick(e)
		this.#handlers['container.edit.pos.selected'] = (e) => this.focusOn(e.detail.id)
		this.#handlers['container.edit.pos.unselected'] = (e) => this.unfocus()
		this.#handlers['touchstart'] = (e) => this.tapHandler(e)

		this.#interface = this.container.createFromSerializable(null, {
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
		this.container.hide(this.#interface, this.appId)
		this.container.loadHtml(this.#interface, "interface.html", this.appId)
	}

	enable() {
		if (!this.#enabled) {
			for (const [key, value] of Object.entries(this.#handlers)) {
				document.addEventListener(key, value)
			}
			this.#enabled = true
		}
	}

	disable() {
		if (this.#enabled) {
			for (const [key, value] of Object.entries(this.#handlers)) {
				document.removeEventListener(key, value)
			}
			this.container.hide(this.#interface, this.appId)
			this.#enabled = false
		}
	}

	isEnabled() {
		return this.#enabled
	}

	delete (spareChildren) {
		if(this.target) {
			if (this.container.getMetadata(this.target, 'text-editing')) {
				return;
			}
			
			console.log(`${this.appId}: deleting container: ${this.target.id}. Sparing children? ${spareChildren}`)
			if (spareChildren) {
				this.container.deleteSparingChildren(this.target, this.appId);
			} else {
				this.container.delete(this.target, this.appId);
			}
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
			'background-color': this.pickColor(this.target.style['background-color'])	
		}

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
		this.container.show(this.#interface, this.appId)
	}

	unfocus() {
		this.target = null
		this.container.hide(this.#interface, this.appId)
	}

	pickColor(notThis) {
	 	let clr = this.palette[this.#paletteIndex]
		this.#paletteIndex++;
		this.#paletteIndex %= this.palette.length
		
		if (notThis && notThis == clr) {
			//take next color from palette
			clr = this.palette[this.#paletteIndex]
		}
		return clr;
	}

	onClick(e) {
		this.create(e.pageX, e.pageY)
	}

	keyDown(e) {
		if(e.key == 'Control') {
			this.#control = true;
		}
	}

	keyUp(e) {
		if(e.key == 'Control') {
			this.#control = false;
		}
		if (e.key == 'Delete') {
			this.delete(false);
		}
		if (e.key == 'End') {
			this.delete(true);
		}
		if (e.key == 'Insert' && this.#control) {
			this.create();
		}
	}

	tapHandler(event) {
		if(!tapedTwice) {
			tapedTwice = true;
			setTimeout( function() { tapedTwice = false; }, 300 );
			return false;
		}
		let touch = event.touches[0]
		this.create(touch.pageX, touch.pageY)
	}
}

let ccreator = new ContainerCreator(container);
ccreator.enable()