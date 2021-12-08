import {container} from '../../nodeshow.js'

//BUG: fails to ignore interface
class ContainerRepeller {
    appId = 'container.format.repell'
	#container = null;
    target = null;
    #enabled = false
    #handlers = {}

    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);
        
        this.#handlers['container.edit.pos.drag.update'] = (e) => this.onDragUpdate(e.detail)
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

            this.#enabled = false
        }
    }
    
    isEnabled() {
		return this.#enabled
	}
    //EXTRACT
    doBoundingBoxOverlap(leftBBox, rightBBox) {
        return !(
            leftBBox.right <= rightBBox.left 
            || leftBBox.left >= rightBBox.right
            || leftBBox.top >= rightBBox.bottom 
            || leftBBox.bottom <= rightBBox.top)
    }

    calculateOverlapBBox(leftBBox, rightBBox) {
        if (this.doBoundingBoxOverlap(leftBBox, rightBBox)) {
            return {
                left:(leftBBox.left < rightBBox.left) ? rightBBox.left : leftBBox.left, 
                right:(leftBBox.right < rightBBox.right) ? leftBBox.right : rightBBox.right,
                top:(leftBBox.top < rightBBox.top) ? rightBBox.top : leftBBox.top,
                bottom:(leftBBox.bottom < rightBBox.bottom) ? leftBBox.bottom : rightBBox.bottom 
            }
        }
        return undefined;
    }
    //EXTRACT
    getOverlapBBox(left, right) {
        let leftBBox = this.#container.getBoundingBox(left)
        let rightBBox = this.#container.getBoundingBox(right)

        return this.calculateOverlapBBox(leftBBox, rightBBox);
    }

    sign(val) {
        if (val < 0){
            return -1;
        }
        if (val > 0) {
            return 1;
        }
        return 0;
    }

    pushSiblingsAway (node, dx, dy, visited) {
        let children = node.parentNode.children;
        for(const child of children) {
            if (child.id == node.id) {
                continue;
            }

            let overlap = this.getOverlapBBox(node, child)
            if (overlap) {
                console.log(overlap)
                let moveX = Math.abs(overlap.right - overlap.left)
                let moveY = Math.abs(overlap.bottom - overlap.top)
                if (moveX > moveY) {
                    moveX = 0;
                } else if (moveX < moveY) {
                    moveY = 0;
                }
                let pos = this.#container.getPosition(child)
                pos.left += this.sign(dx)*moveX;
                pos.top += this.sign(dy)*moveY;
                this.#container.setPosition(child, pos, this.appId)
                //ToDo: don't do this recursively
                if (!visited.has(child.id)) {
                    this.pushSiblingsAway(child, dx, dy, visited.add(node.id))
                } 
            }
        }
    }

    onDragUpdate (ev) {
        let node = this.#container.lookup(ev.id)
        this.pushSiblingsAway(node, ev.dx, ev.dy, new Set([]))
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