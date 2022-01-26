import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

export class ContainerEditLinks {
    appId = 'container.edit.links'
    displayName = 'Link'
    actuatorId = 'container.link'    
    type = 'background'

	#container = null;
    #actuator = null;
    
    left = null;
    right = null;

    #enabled = false
    #mouse = null;
    #handlers = {}
    #links = {}
    
    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);

        this.#mouse = new Mouse(this.appId)
        this.#mouse.setAction(MouseEvents.DRAG_START, (e) => this.onSelect(e), ACCESS_REQUIREMENT.SET_EXCLUSIVE)
    }

    enable() {
        if (!this.#enabled) {
            this.#enabled = true
            this.#mouse.enable();

            for (const [key, value] of Object.entries(this.#handlers)) {
                this.#container.addEventListener(key, value)
            }
        }
    }

    disable () {
        if (this.#enabled) {
            this.#enabled = false
            this.#mouse.disable();
            
            for (const [key, value] of Object.entries(this.#handlers)) {
                this.#container.removeEventListener(key, value)
            }
        }
    }

    isEnabled() {
		return this.#enabled
	}
    
    #localToPercent(details) {
        let pos = this.#container.getPosition(details.target)
        return {
            percentX: (details.absX - pos.left) / this.#container.getWidth(details.target),
            percentY: (details.absY - pos.top) / this.#container.getHeight(details.target)
        }
    }

    link (left, right) {
        let descriptor = {
            "fromPos": this.#localToPercent(left),
            "toPos": this.#localToPercent(right),
            "drawer":"straightLine"
        }
        
        if (!this.#actuator) {
            this.#actuator = this.#container.getComponent(this.actuatorId)    
        }
        
        this.#actuator.createLink(left.target, right.target, descriptor);
    }
    
    remove(link) {
        //ToDo
    }

    handleMouseMove(e) {
        // if (this.left && this.#currentLink) {
        //     this.draw(this.#currentLink, e.pageX, e.pageY)
        // }   
    }

    getLinksRelatedTo(targetId) {
        let links = []
        let children = [targetId]
        let i = 0;
        while ( i < children.length ) {
            let currentId = children[i]
            let currentLinks = this.#links[currentId]
            if (currentLinks) {
                links = links.concat(currentLinks)
            }

            let node = this.#container.lookup(currentId)
            for (const child of node.children) {
                if (this.#links[child.id]) {
                    children.push(child.id)
                }
            }
            i++;
        }

        return links;
    }

    onContainerChange(e) {
        // let links = this.getLinksRelatedTo(e.detail.id)
        // for(const link of links) {
        //     this.draw(link)
        // }
    }

    linkStart(target) {
        this.left = target
        this.right = null;
    }

    linkUpdate() {

    }

    linkFinish(target) {
        this.link(this.left, target)
        this.left = null
    }

    onSelect(event) {
        let e = event.detail.originalEvent
        let target = {
            target: event.detail.id,
            localX: e.layerX,
            localY: e.layerY,
            absX: event.detail.position.x,
            absY: event.detail.position.y
        }

        if (!this.left) {
            this.linkStart(target)
        } else {
            this.linkFinish(target)
        }
    }

    //todo why is absX not the same as calculated below... (could have used the abs positions from the event rather than calc them)
    placeDot(details) {
        // if (!this.left) {
        //     let pos = this.#container.getPosition(this.left.target)
        //     pos.top += details.localY;
        //     pos.left += details.localX;
        //     pos.originX = 0.5
        //     pos.originY = 0.5
            
        //     this.#container.show(this.#leftDot, this.appId)
        //     this.#container.hide(this.#rightDot, this.appId)
        //     this.#container.setPosition(this.#leftDot, pos, this.appId)
        //     this.#container.bringToFront(this.#leftDot, this.appId)
        // } else {
        //     let pos = this.#container.getPosition(this.right.target)
        //     pos.top += details.localY;
        //     pos.left += details.localX;
        //     pos.originX = 0.5
        //     pos.originY = 0.5

        //     this.#container.show(this.#rightDot, this.appId)
        //     this.#container.setPosition(this.#rightDot, pos, this.appId)
        //     this.#container.bringToFront(this.#rightDot, this.appId)
        // }
    }
}