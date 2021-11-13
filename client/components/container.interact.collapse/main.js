class ContainerCollapser {
    #appId = 'container.interact.collapse'
	#container = null;
    target = null;

    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this.#appId, this);
    }

    enable() {
        document.addEventListener('container.edit.pos.selected', e => this.target = e.detail.id);
		document.addEventListener('container.edit.pos.unselected', (e) => this.target = null);
        document.addEventListener("keydown", (e) => this.handleKeydown(e))
    }  
    
    disable() {
        document.removeEventListener('container.edit.pos.selected', e => this.target = e.detail.id);
		document.removeEventListener('container.edit.pos.unselected', (e) => this.target = null);
        document.addEventListener("keydown", (e) => this.handleKeydown(e))
    }

    collapse() {
        if (this.target) {
            console.log(`Collapsing ${this.target}`)
            this.#container.setCollapseMode(this.target, {width:"32px",height:"32px"})
            this.#container.collapse(this.target, "app:"+this.#appId)
        }
    }

    expand() {
        if (this.target) {
            console.log(`Expanding ${this.target}`)
            this.#container.expand(this.target, "app:"+this.#appId)
        }
    }

    handleKeydown(e) {
        console.log(`Collapser key down: ${e.key}`)
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