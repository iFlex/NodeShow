import {container} from '../../nodeshow.js'

//support only straignt lines for now
class ContainerLink {
    appId = 'container.link'
	#container = null;
    
    left = null;
    right = null;
    #leftDot = null;
    #rightDot = null;
    #currentLink = null;

    #links = {}
    
    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);
    }

    makeLinkObject() {
        return this.#container.createFromSerializable(null, {
            "nodeName":"div",
            computedStyle:{
                "height":5,
                "width":10,
                "background-color": "black",
                "position":"absolute"
            }
        }, null, "app:"+this.appId)
    }

    link(left, right, settings) {
        //create the link
        let link = {}
        link['node'] = this.makeLinkObject()
        link['left'] = left
        link['right'] = right
        
        //keep a record of the link
        let leftLinks = this.#links[left.target.id] || []
        let rigthLinks = this.#links[right.target.id] || []
        leftLinks.push(link)
        rigthLinks.push(link)
        this.#links[left.target.id] = leftLinks
        this.#links[right.target.id] = rigthLinks

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
        this.#container.setPosition(linkId, leftPos,"app:"+this.appId)
        this.#container.setAngle(linkId, angle+"rad", "0%", "0%", "app:"+this.appId)
        this.#container.setWidth(linkId, this.calculateDistance(leftPos, rightPos), "app:"+this.appId)
        this.#container.setHeight(linkId, 5, "app:"+this.appId)
    }

    remove(link) {
        //ToDo
    }

    enable() {
        document.addEventListener('container.setPosition',(e) => this.onContainerChange(e))
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e))
        document.addEventListener("keydown", (e) => this.cancelLink(e))

        document.addEventListener('container.edit.pos.selected', e => this.onSelect(e));
		document.addEventListener('container.edit.pos.unselected', (e) => this.cancelLink(e));

        let dot = {
            nodeName:"div",
            className: "container-linker-dot",
            permissions: {
                "container.setPosition":{
                    "*":false
                }
            },
            computedStyle: {
                position:"absolute",
                top:"0px",
                left:"0px"
            }
        }

        this.#leftDot = this.#container.createFromSerializable(null, dot, null, this.appId)
        this.#rightDot = this.#container.createFromSerializable(null, dot, null, this.appId)
    }

    disable () {
        document.removeEventListener('container.setPosition',(e) => this.onContainerChange(e))
        document.removeEventListener('mousemove', (e) => this.handleMouseMove(e))
        document.removeEventListener("keydown", (e) => this.cancelLink(e))

        document.removeEventListener('container.edit.pos.selected', e => this.onSelect(e));
		document.removeEventListener('container.edit.pos.unselected', (e) => this.cancelLink(e));

        this.container.delete(this.#leftDot, this.appId)
        this.container.delete(this.#rightDot, this.appId)
    }

    handleMouseMove(e) {
        if (this.left && !this.right) {
            if (!this.#currentLink) {
                console.log("Drawing new preview link")
                let link = {}
                link['node'] = this.makeLinkObject()
                link['left'] = this.left
                
                this.#currentLink = link
            }
            //update existing link
            this.draw(this.#currentLink, e.pageX, e.pageY)
        }   
    }

    //ToDo: propagate to children
    onContainerChange(e) {
        let targetId = e.detail.id
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
        
        for(const link of links) {
            this.draw(link)
        }
    }

    onSelect(event) {
        
        let e = event.detail.originalEvent
        let target = {
            target: e.target,
            localX: e.layerX,
            localY: e.layerY,
            absX: e.pageX,
            absY: e.pageY
        }
        
        if (this.left) {
            this.right = target
            
            this.link(this.left, this.right)
            this.placeDot(target)
            
            this.left = null
            this.right = null
            //Link preview
            this.#container.delete(this.#currentLink.node)
            this.#currentLink = null
        } else {
            this.left = target
            this.placeDot(target)
        }
        
    }

    //todo why is absX not the same as calculated below... (could have used the abs positions from the event rather than calc them)
    placeDot(details) {
        if (this.left && !this.right) {
            let pos = this.#container.getPosition(this.left.target)
            pos.top += details.localY;
            pos.left += details.localX;
            pos.originX = 0.5
            pos.originY = 0.5
            
            this.#container.show(this.#leftDot)
            this.#container.hide(this.#rightDot)
            this.#container.setPosition(this.#leftDot, pos)
            this.#container.bringToFront(this.#leftDot)
        } else if (this.left && this.right){
            let pos = this.#container.getPosition(this.right.target)
            pos.top += details.localY;
            pos.left += details.localX;
            pos.originX = 0.5
            pos.originY = 0.5

            this.#container.show(this.#rightDot)
            this.#container.setPosition(this.#rightDot, pos)
            this.#container.bringToFront(this.#rightDot)
        }
    }

    cancelLink() {
        if (this.#currentLink) {
            this.#container.delete(this.#currentLink.node)
        }
        this.#currentLink = null
        this.left = null
        this.right = null

        this.#container.hide(this.#leftDot)
        this.#container.hide(this.#rightDot)
    }
}

const clinker = new ContainerLink(container);
clinker.enable();