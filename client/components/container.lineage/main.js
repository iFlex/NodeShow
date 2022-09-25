import { Keyboard } from '../utils/Keyboards.js'
import { ContainerOverlap } from '../utils/overlap.js'
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

//quite problematic currently as it causes disappearings
export class ContainerLineage {
    appId = 'container.lineage'
    displayName = 'Lineage'
    type = 'service'
    
    container = null
    target = null
    actOnDragEnd = true;
    
    REVERSE_PARENT_OVERLAP_TRESHOLD = 0.5
    OVERLAP_TRESHOLD = 5

    #enabled = null
    #handlers = {}
    #keyboard = null;
    #mouse = null;
    #overlap = null;
    
    constructor (container) {
        this.container = container;
        this.container.registerComponent(this);
        this.#keyboard = new Keyboard(this.appId, container, ACCESS_REQUIREMENT.DEFAULT)
        this.#overlap = new ContainerOverlap(container);

        this.#mouse = new Mouse(this.appId, container);
        this.#mouse.setAction(MouseEvents.DRAG_END, (e) => this.onDragEnd(e))

        // /[TODO] update target
        // this.#keyboard.setKeyDownAction(new Set(['Shift','<']), this, (key) => this.parentUp(this.target), true, true)
        // this.#keyboard.setKeyDownAction(new Set(['Shift','>']), this, (key) => this.parentDown(this.target), true, true)
    }

    enable () {
        if (!this.#enabled) {
            this.#enabled = true;
            this.#mouse.enable();
            for (const [key, value] of Object.entries(this.#handlers)) {
                this.container.addEventListener(key, value)
            }
            this.#keyboard.enable();
        }
    }

    disable () {
        if (this.#enabled) {
            this.#enabled = false;
            this.#mouse.disable();
            for (const [key, value] of Object.entries(this.#handlers)) {
                this.container.removeEventListener(key, value)
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

    findLargestOverlap (target) {
        //check siblings and decide which one has the largest overlap
        let largestOverlapPercent = 0;
        let largestOverlapRec = null;
        
        let overlaps = this.#overlap.getOverlappingSiblings(target)
        for ( const overlapRec of overlaps ) {
            if (largestOverlapPercent < overlapRec.overlapPercent) {
                largestOverlapPercent = overlapRec.overlapPercent
                largestOverlapRec = overlapRec;
            }
        }

        if (largestOverlapRec) {
            return largestOverlapRec.id;
        }
        return null;
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

    parentUp(id) {
        this.setTarget(id)
        if (this.target === this.container.parent) {
            return;
        }
            
        this.changeParent(this.getGrandpa(this.target))
    }

    parentDown(id) {
        this.setTarget(id)
        if (this.target === this.container.parent) {
            return;
        }
        let largestOverlapPeerId = this.findLargestOverlap(this.target);
        console.log(`${this.appId} - parentDown ${this.target.id} @ ${this.target.parentNode.id} -> ${largestOverlapPeerId}`) 
        if (largestOverlapPeerId) {
            this.changeParent(largestOverlapPeerId)
        }
    }

    calculateReverseParentOverlap() {
        let overlap = 0;
        if (this.target.parentNode === this.container.parent) {//to body is acting weird af...
            //all object overlap with the root
            overlap = this.#overlap.getOverlapArea(this.container.getBoundingBox(this.target))
        } else {
            overlap = this.#overlap.getOverlapArea(this.#overlap.getOverlapBBox(this.target, this.target.parentNode));
        }
        let targetArea = this.#overlap.getOverlapArea(this.container.getBoundingBox(this.target))
        return targetArea - overlap;
    }

    onDragEnd(e) {
        if(this.actOnDragEnd) {
            this.setTarget(e.detail.id)
            let reverseParentOverlap = this.calculateReverseParentOverlap()
            let overlapRatio = reverseParentOverlap / (this.container.getWidth(this.target) * this.container.getHeight(this.target))
            if ( overlapRatio >= this.REVERSE_PARENT_OVERLAP_TRESHOLD) {
                this.parentUp(this.target);
            } else {
                this.parentDown(this.target)
            }
            this.unsetTarget()
        }
    }
}