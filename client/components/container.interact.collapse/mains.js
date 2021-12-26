import { container } from '../../nodeshow.js'
import { Keyboard } from '../utils/keyboard.js'

class ContainerCollapser {
    appId = 'container.interact.collapse'
	target = null;

    #container = null;
    #hoverTarget = null;
    #handlers = {}
    #enabled = false
    #keyboard = null;

    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);

        this.#keyboard = new Keyboard(this.appId)
        this.#keyboard.setAction(new Set(["ArrowDown"]), this, (e) => this.collapse(), false);
        this.#keyboard.setAction(new Set(["ArrowUp"]), this, (e) => this.expand(), false);
        
        this.#handlers['container.select.selected'] = (e) => this.onSelection(e.detail.selection)
        this.#handlers["mouseover"] = (e) => { this.#hoverTarget = e.target }
    }

    enable() {
        if(!this.#enabled) {
            for (const [key, value] of Object.entries(this.#handlers)) {
                document.addEventListener(key, value)
            }
            this.#enabled = true
            this.#keyboard.enable();
        }
    }  
    
    disable() {
        if (this.#enabled) {
            for (const [key, value] of Object.entries(this.#handlers)) {
                document.removeEventListener(key, value)
            }
            this.#enabled = false
            this.#keyboard.disable();
        }
    }

    isEnabled() {
		return this.#enabled
	}

    onSelection (selection) {
        this.target = selection[0]
    }

    findClosestDiv(start) {
        if(!start) {
            return null
        }

        let node = start
        while(node) {
            if (node.nodeName.toLowerCase() == 'div') {
                return node
            }
            node = node.parentNode
        }
        return node
    }

    collapse() {
        let target = this.findClosestDiv(this.target || this.#hoverTarget)
        if (target) {
            this.#container.collapse(target, this.appId)
        }
    }

    expand() {
        let target = this.findClosestDiv(this.target || this.#hoverTarget)
        if (target) {
            this.#container.expand(target, this.appId)
        }
    }
}

let ccollapser = new ContainerCollapser(container);