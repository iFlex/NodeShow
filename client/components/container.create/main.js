import {container} from '../../nodeshow.js'

class ContainerCreator {
	appId = 'container.create'
	container = null;
	target = null;
	currentContainerStyle = 'ns-vertical-list'
	palette = ["#ff0fff", "#000000", "#ff0000", "#ff8000", "#ffff00", "#008000", "#0000ff", "#4b0082", "#9400d3"]
	#paletteIndex = 0
	#control = false;

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
		container.registerComponent(this.appId, this);
	}

	enable() {
		document.addEventListener('keydown',(e) => this.keyDown(e))
		document.addEventListener('keyup',(e) => this.keyUp(e))
		document.addEventListener('dblclick',(e) => this.onClick(e))
		
	    document.addEventListener('container.edit.pos.selected', e => this.target = this.container.lookup(e.detail.id));
		document.addEventListener('container.edit.pos.unselected', (e) => this.target = null);
	}

	disable() {
		document.removeEventListener('keydown',(e) => this.keyDown(e))
		document.removeEventListener('keyup',(e) => this.keyUp(e))
		document.removeEventListener('dblclick',(e) => this.onClick(e))

		document.removeEventListener('container.edit.pos.selected', e => this.target = this.container.lookup(e.detail.id));
		document.removeEventListener('container.edit.pos.unselected', (e) => this.target = null);
	}

	delete () {
		console.log("Deleting current target");
		console.log(this.target);

		if(this.target) {
			this.container.delete(this.target.id);
		}
		this.target = null;
	}

	create (x, y) {
		console.log("Creating child");
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

		let parentSuggestion = this.target.getAttribute("data-child-style")
		if (parentSuggestion) {
			parentSuggestion = JSON.parse(parentSuggestion)
			//apply parent suggestion to child style if there is any
			for (const [key, value] of Object.entries(parentSuggestion)) {
				childStyle[key] = value
			}
		}
		
		console.log("No children");
		let div = {
			"nodeName":"div",
			"className": this.currentContainerStyle,
			"computedStyle": childStyle
		}
		let node = this.container.createFromSerializable(this.target.id, div)
		this.setChildStyleSuggestion(node)
		if (x != undefined && y!= undefined) {
			this.container.setPosition(node.id, {top:y, left:x})
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

	pickColor() {
		return this.palette[this.#paletteIndex++]
	}

	onClick(e) {
		this.create(e.pageX, e.pageY)
	}

	keyDown(e) {
		if(e.key == 'Control') {
			this.#control = true;
		}
		if (e.key == 'Delete') {
			this.delete();
		}
	}

	keyUp(e) {
		if(e.key == 'Control') {
			this.#control = false;
		}
		if (e.key == 'Insert' && this.#control) {
			this.create();
		}
	}
}

let ccreator = new ContainerCreator(container);
ccreator.enable()