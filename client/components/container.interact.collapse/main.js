import {container} from '../../nodeshow.js'

/*
Add cursor
*/
class ContainerCollapser {
    appId = 'container.interact.collapse'
	#container = null;
    target = null;
    #hoverTarget = null;
    #handlers = {}

    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);

        this.#handlers["container.edit.pos.selected"] = (e) => { this.target = e.detail.id };
        this.#handlers["container.edit.pos.unselected"] = (e) => { this.target = null };
		this.#handlers["keydown"] = (e) => this.handleKeydown(e)
        this.#handlers["mouseover"] = (e) => { this.#hoverTarget = e.target }
    }

    enable() {
        for (const [key, value] of Object.entries(this.#handlers)) {
			document.addEventListener(key, value)
		}
    }  
    
    disable() {
        for (const [key, value] of Object.entries(this.#handlers)) {
			document.removeEventListener(key, value)
		}
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
            this.#container.setCollapseMode(target, {width:"32px",height:"32px"})
            this.#container.collapse(target, this.appId)
        }
    }

    expand() {
        let target = this.findClosestDiv(this.target || this.#hoverTarget)
        if (target) {
            console.log(`Expanding ${target}`)
            this.#container.expand(target, this.appId)
        }
    }

    handleKeydown(e) {
        //console.log(`Collapser key down: ${e.key}`)
        if( e.key == 'ArrowDown') {
            this.collapse();
        }
        if( e.key == 'ArrowUp' ) {
            this.expand();
        }
    }
}

let ccollapser = new ContainerCollapser(container);
ccollapser.enable()