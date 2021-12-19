import { container } from '../../nodeshow.js'
import { ACTIONS } from '../../Container.js'
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { ACCESS_REQUIREMENT } from '../utils/inputAccessManager.js'

//support only straignt lines for now
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

    makeLinkObject() {
        return this.#container.createFromSerializable(null, {
            "nodeName":"div",
            permissions: {
                "container.setParent":{
                    "*":false
                },
                "container.create":{ //prevent other apps from adding children to this 
                    "*":false
                }
            },
            computedStyle:{
                "height":5,
                "width":10,
                "background-color": "black",
                "position":"absolute"
            }
        }, null, this.appId)
    }

    isLink (data) {
        return 'node' in data && 'left' in data && 'right' in data && Object.keys(data).length == 3
    }

    link (left, right, settings) {
        //create the link
        let link = {}
        link['node'] = this.makeLinkObject()
        link['left'] = left
        link['right'] = right
        
        //keep a record of the link
        let leftLinks = this.#links[left.target] || []
        let rigthLinks = this.#links[right.target] || []
        leftLinks.push(link)
        rigthLinks.push(link)

        this.#links[left.target] = leftLinks
        this.#links[right.target] = rigthLinks

        //draw the link and return it
        this.draw(link)
        return link
    }
    

    calculateDistance(leftPos, rightPos) {
        let deltaX = leftPos.left - rightPos.left
        let deltaY = leftPos.top - rightPos.top

        return Math.sqrt(deltaX*deltaX + deltaY*deltaY)
    }

    calculateLinkAngle(leftPos, rightPos) {
        let deltaX = rightPos.left - leftPos.left
        let deltaY = rightPos.top - leftPos.top
        return Math.atan2( deltaY , deltaX );
    }

    computeAbsoluteLinkPosition(targetPos, linkDetail) {
        targetPos.top += linkDetail.localY;
        targetPos.left += linkDetail.localX;
        return targetPos
    }

    draw(link, endX, endY) {
        if (!this.isLink(link)) {
            console.log(link)
            throw `${this.appId} - attempted draw call on non link object`
        }
        let linkId = link.node.id
        
        let leftPos = this.computeAbsoluteLinkPosition(
            this.#container.getPosition(link.left.target),
            link.left
        )
        let rightPos = {}
        if (link.right) {
            rightPos = this.computeAbsoluteLinkPosition(
                this.#container.getPosition(link.right.target),
                link.right
            );
        } else {
            rightPos.top = endY;
            rightPos.left = endX;
        }
           
        let angle = this.calculateLinkAngle(leftPos, rightPos)
        
        this.#container.setPosition(linkId, leftPos, this.appId)
        this.#container.setAngle(linkId, angle+"rad", "0%", "0%", this.appId)
        this.#container.setWidth(linkId, this.calculateDistance(leftPos, rightPos), this.appId)
        this.#container.setHeight(linkId, 5, this.appId)
    }

    remove(link) {
        //ToDo
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
    
            this.#container.delete(this.#leftDot, this.appId)
            this.#container.delete(this.#rightDot, this.appId)
        }
    }

    isEnabled() {
		return this.#enabled
	}

    handleMouseMove(e) {
        if (this.left && this.#currentLink) {
            this.draw(this.#currentLink, e.pageX, e.pageY)
        }   
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
        let links = this.getLinksRelatedTo(e.detail.id)
        for(const link of links) {
            this.draw(link)
        }
    }

    linkStart(target) {
        this.left = target
        this.right = null;
        //this.placeDot(target)
        //create preview link
        // console.log("Drawing new preview link")
        // let link = {}
        // link['node'] = this.makeLinkObject()
        // link['left'] = this.left
                
        // this.#currentLink = link
    }

    linkUpdate() {

    }

    linkFinish(target) {
        this.link(this.left, target)
        this.left = null

        //this.placeDot(target)
        // //Link preview
        // this.#container.delete(this.#currentLink.node, this.appId)
        // this.#currentLink = null
    }

    linkCancel() {
        if (this.#currentLink) {
            this.#container.delete(this.#currentLink.node, this.appId)
        }
        this.#currentLink = null
        this.left = null
        this.right = null

        this.#container.hide(this.#leftDot, this.appId)
        this.#container.hide(this.#rightDot, this.appId)
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
        console.log(event)
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