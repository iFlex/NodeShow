import {container} from '../../nodeshow.js'

/*
Add cursor
*/
class ContainerCollapser {
    appId = 'container.interact.collapse'
	#container = null;
    target = null;
    #hoverTarget = null;

    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);
    }

    enable() {
        document.addEventListener('container.edit.pos.selected', e => this.target = e.detail.id);
		document.addEventListener('container.edit.pos.unselected', (e) => this.target = null);
        document.addEventListener("keydown", (e) => this.handleKeydown(e))
        document.addEventListener('mouseover',(e) => this.#hoverTarget = e.target)
    }  
    
    disable() {
        document.removeEventListener('container.edit.pos.selected', e => this.target = e.detail.id);
		document.removeEventListener('container.edit.pos.unselected', (e) => this.target = null);
        document.removeEventListener('mouseover',(e) => this.#hoverTarget = e.target)
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