import {container} from '../../nodeshow.js'

class ContainerRepeller {
    appId = 'container.format.repell'
	#container = null;
    target = null;
    #enabled = false
    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);
    }

    /*
    Relevant events
    container.create
    container.move
    container.setWidth
    container.setHeight
    container.changeParent
    container.delete
    */
    enable() {
        if (!this.#enabled) {
            document.addEventListener('container.edit.pos.selected', e => this.target = e.detail.id);
		    document.addEventListener('container.edit.pos.unselected', (e) => this.target = null);
            document.addEventListener("keydown", (e) => this.handleKeydown(e))
            this.#enabled = true
        }
    }  
    
    disable() {
        if (this.#enabled) {
            document.removeEventListener('container.edit.pos.selected', e => this.target = e.detail.id);
		    document.removeEventListener('container.edit.pos.unselected', (e) => this.target = null);
            document.addEventListener("keydown", (e) => this.handleKeydown(e))

            this.#enabled = false
        }
    }
    
    isEnabled() {
		return this.#enabled
	}


    //universe expansion type
    expand() {
        //ToDo
        //compute center of set of siblings
        //then move them all away from the centre enough for no overlaps to exist anymore
    }

    //collision type
    move(id, dx, dy) {
        //find siblings that overlap
        //move siblings with changed direction
        //keep doing until no more moves
    }

    onMove() {

    }

    onWidth() {

    }

    onHeight() {

    }

    onRotate() {

    }

    handleKeydown(e) {
        //console.log(`Collapser key down: ${e.key}`)
        if( e.key == '|') {
            this.expand();
        }
    }
}

let crepeller = new ContainerRepeller(container);
crepeller.enable()