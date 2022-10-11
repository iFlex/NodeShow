import { ContainerOverlap } from '../utils/overlap.js'
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { queueWork } from '../../YeldingExecutor.js'
//import { ACTIONS } from '../../Container.js'

export class ContainerRepeller {
    appId = 'container.repell'
    type = 'service'
    displayName = 'Repell'
    
	#container = null;
    target = null;
    #overlap = null;
    #mouse = null;
    #enabled = false
    #handlers = {}
    #visited = new Set([])

    constructor (container) {
        this.#container = container
        this.#container.registerComponent(this);
        this.#overlap = new ContainerOverlap(container);
        
        this.#mouse = new Mouse(this.appId);
        this.#mouse.setAction(MouseEvents.DRAG_UPDATE, (e) => this.onDragUpdate(e.detail))
        
        //this.#handlers[ACTIONS.setPosition] = (e) => this.onUpdate(e.detail)
        //this.#handlers[ACTIONS.setWidth] = (e) => this.onUpdate(e.detail)
        //this.#handlers[ACTIONS.setHeight] = (e) => this.onUpdate(e.detail)
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
                this.#container.addEventListener(key, value)
            }
            this.#mouse.enable();
            this.#enabled = true
        }
    }  
    
    disable() {
        if (this.#enabled) {
            for (const [key, value] of Object.entries(this.#handlers)) {
                this.#container.removeEventListener(key, value)
            }
            this.#mouse.disable();
            this.#enabled = false
        }
    }
    
    isEnabled() {
		return this.#enabled
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
        if (visited.has(node.id)) {
            return;
        } else {
            visited.add(node.id)
        }

        let children = node.parentNode.children;
        for(const child of children) {
            if (child.id == node.id) {
                continue;
            }
            let overlap = this.#overlap.getOverlapBBox(node, child)
            if (overlap) {
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
                //ToDo: don't do this recursively
                if (!visited.has(child.id)) {
                    //this.#container.setPosition(child, pos, this.appId)
                    queueWork(this.#container.setPosition, this.#container, [child, pos, this.appId])
                    this.pushSiblingsAway(child, dx, dy, visited)
                } 
            }
        }
        queueWork(this.#container.fitVisibleContent, this.#container, [node.parentNode])
    }

    onDragUpdate (ev) {
        let node = this.#container.lookup(ev.id)
        this.pushSiblingsAway(node, ev.dx, ev.dy, new Set([]))
        //[TODO]: find a better way to clear visited
        //this.#visited = new Set([])
    }

    //universe expansion type
    expand() {
        //ToDo
        //compute center of set of siblings
        //then move them all away from the centre enough for no overlaps to exist anymore
    }

    onUpdate(ev) {
        let node = this.#container.lookup(ev.id)
        this.pushSiblingsAway(node, ev.dx, ev.dy, new Set([])) 
    }
}
