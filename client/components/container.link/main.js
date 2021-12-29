import { container } from '../../nodeshow.js'
import { ACTIONS } from '../../Container.js'
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { ACCESS_REQUIREMENT } from '../utils/inputAccessManager.js'

class ContainerLink {
    appId = 'container.link'
    displayName = 'Link'
    
	#container = null;
    
    left = null;
    right = null;
    #leftDot = null;
    #rightDot = null;
    #currentLink = null;
    #enabled = false
    #mouse = null;
    #handlers = {}
    #links = {}
    
    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);

        this.#mouse = new Mouse(this.appId)
        this.#mouse.setAction(MouseEvents.DRAG_START, (e) => this.onSelect(e), ACCESS_REQUIREMENT.SET_EXCLUSIVE)

        this.#handlers[ACTIONS.setPosition] = (e) => this.onContainerChange(e)
        this.#handlers["mousemove"] = (e) => this.handleMouseMove(e)
        //this.#handlers["keydown"] = (e) => this.cancelLink(e)
        //this.#handlers["container.focus"] = (e) => this.onSelect(e)
		//this.#handlers["container.blur"] = (e) => this.cancelLink(e)
    }

    enable() {
        if (!this.#enabled) {
            this.#enabled = true
            this.#mouse.enable();

            for (const [key, value] of Object.entries(this.#handlers)) {
                document.addEventListener(key, value)
            }
    
            // let dot = {
            //     nodeName:"div",
            //     className: "container-linker-dot",
            //     permissions: {
            //         "container.setPosition":{
            //             "*":false
            //         }
            //     },
            //     computedStyle: {
            //         position:"absolute",
            //         top:"0px",
            //         left:"0px"
            //     }
            // }
    
            // this.#leftDot = this.#container.createFromSerializable(null, dot, null, this.appId)
            // this.#rightDot = this.#container.createFromSerializable(null, dot, null, this.appId)
        }
    }

    disable () {
        if (this.#enabled) {
            this.#enabled = false
            this.#mouse.disable();
            
            for (const [key, value] of Object.entries(this.#handlers)) {
                document.removeEventListener(key, value)
            }
    
            //this.#container.delete(this.#leftDot, this.appId)
            //this.#container.delete(this.#rightDot, this.appId)
        }
    }

    isEnabled() {
		return this.#enabled
	}
    
    #localToPercent(details) {
        return {
            percentX: details.localX / this.#container.getWidth(details.target),
            percentY: details.localY / this.#container.getWidth(details.target)
        }
    }

    link (left, right) {
        let descriptor = {
            "fromPos": this.#localToPercent(left),
            "toPos": this.#localToPercent(right),
            "drawer":"straightLine"
        }

        this.#container.createLink(left.target, right.target, descriptor);
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
    }to

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
            absX: e.pageX,
            absY: e.pageY
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

const clinker = new ContainerLink(container);
clinker.enable();