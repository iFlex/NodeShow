import { container } from '../../nodeshow.js'
import { Keyboard } from '../utils/keyboard.js'

//BUG: when dragging sometimes the dragged element disappears (wrong move to parent)
//BUG: fails to ignore interface
class ContainerLineage {
    appId = 'container.lineage'
    container = null
    target = null
    actOnDragEnd = true;
    
    REVERSE_PARENT_OVERLAP_TRESHOLD = 4
    OVERLAP_TRESHOLD = 4

    #enabled = null
    #handlers = {}
    #keyboard = null;
    
    constructor (container) {
        this.container = container;
        this.container.registerComponent(this);
        this.#keyboard = new Keyboard();

        this.#handlers['container.edit.pos.selected'] = (e) => this.setTarget(e.detail.id)
		this.#handlers['container.edit.pos.unselected'] = (e) => this.unsetTarget()
        this.#handlers['container.edit.pos.drag.end'] = (e) => this.onDragEnd(e)

        this.#keyboard.setAction(new Set(['Shift','<']), this, (key) => this.parentUp(), true)
        this.#keyboard.setAction(new Set(['Shift','>']), this, (key) => this.parentDown(), true)
    }

    enable () {
        if (!this.#enabled) {
            this.#enabled = true;
            for (const [key, value] of Object.entries(this.#handlers)) {
                document.addEventListener(key, value)
            }
            this.#keyboard.enable();
        }
    }

    disable () {
        if (this.#enabled) {false
            this.enabled = false;
            for (const [key, value] of Object.entries(this.#handlers)) {
                document.removeEventListener(key, value)
            }
            this.#keyboard.disable();
        }
    }

    isEnabled () {
        return this.#enabled
    }

    setTarget (id) {
        this.target = this.container.lookup(id)
    }

    unsetTarget () {
        this.target = null
    }

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

    calcBBoxArea(bbox) {
        return Math.abs(bbox.left - bbox.right) * Math.abs(bbox.top - bbox.bottom)
    }

    calculateOverlap(left, right) {
        let leftBBox = this.container.getBoundingBox(left)
        let rightBBox = this.container.getBoundingBox(right)

        let overlapBBox = this.calculateOverlapBBox(leftBBox, rightBBox);
        if (overlapBBox) {
            return this.calcBBoxArea(overlapBBox)
        }
        return 0;
    }

    findLargestOverlap () {
        //check siblings and decide which one has the largest overlap
        let children = this.target.parentNode.children
        let largestOverlap = 0;
        let largestOverlapPeer = null;

        for ( const child of children ) {
            if (child.id != this.target.id) {
                let overlap = this.calculateOverlap(this.target, child);
                if (overlap && overlap >= this.OVERLAP_TRESHOLD && overlap > largestOverlap) {
                    largestOverlap = overlap;
                    largestOverlapPeer = child
                }
            }
        }

        return largestOverlapPeer
    }

    changeParent(newParent) {
        let pos = this.container.getPosition(this.target)
        this.container.setParent(this.target, newParent, this.appId)
        this.container.setPosition(this.target, pos, this.appId)
    }

    getGrandpa(node) {
        if (!node || node === this.container.parent) {
            return this.container.parent
        }

        let parent = node.parentNode
        if ( !parent || parent === this.container.parent ) {
            return this.container.parent;
        }

        if (!parent.parentNode) {
            return this.container.parent;
        }
        return parent.parentNode
    }

    parentUp() {
        if (!this.target) {
            return;
        }

        this.changeParent(this.getGrandpa(this.target))
    }

    parentDown() {
        if (!this.target) {
            return;
        }

        let largestOverlapPeer = this.findLargestOverlap();
        if (largestOverlapPeer) {
            this.changeParent(largestOverlapPeer)
        }
    }

    calculateReverseParentOverlap() {
        let overlap = 0;
        if (this.target.parentNode === this.container.parent) {//to body is acting weird af...
            //all object overlap with the root
            overlap = this.calcBBoxArea(this.container.getBoundingBox(this.target))
        } else {
            overlap = this.calculateOverlap(this.target, this.target.parentNode);
        }
        let targetArea = this.calcBBoxArea(this.container.getBoundingBox(this.target))
        return targetArea - overlap;
    }

    onDragEnd(e) {
        if(this.actOnDragEnd) {
            this.setTarget(e.detail.id)
            let reverseParentOverlap = this.calculateReverseParentOverlap()
            if ( reverseParentOverlap >= this.REVERSE_PARENT_OVERLAP_TRESHOLD) {
                this.parentUp();
            } else {
                this.parentDown()
            }
            this.unsetTarget()
        }
    }
}

let clinage = new ContainerLineage(container);
//clinage.enable();