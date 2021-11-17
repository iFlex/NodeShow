import {container} from '../../nodeshow.js'

//support only straignt lines for now
class ContainerLink {
    #appId = 'container.link'
	#container = null;
    
    left = null;
    right = null;
    
    #links = {}
    
    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this.#appId, this);
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
        }, null, "app:"+this.#appId)
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

    draw(link) {
        let linkId = link.node.id
        console.log("Linking...")
        console.log(link)
        let leftPos = this.computeAbsoluteLinkPosition(
            this.#container.getPosition(link.left.target),
            link.left
        )
        let rightPos = this.computeAbsoluteLinkPosition(
            this.#container.getPosition(link.right.target),
            link.right
        )
        console.log(leftPos)
        console.log(rightPos)

        let angle = this.calculateLinkAngle(leftPos, rightPos)
        
        this.#container.setPosition(linkId, leftPos,"app:"+this.#appId)
        this.#container.setAngle(linkId, angle+"rad", "0%", "0%", "app:"+this.#appId)
        this.#container.setWidth(linkId, this.calculateDistance(leftPos, rightPos), "app:"+this.#appId)
        this.#container.setHeight(linkId, 5, "app:"+this.#appId)
    }

    remove(link) {
        //ToDo
    }

    enable() {
        document.addEventListener('click',(e) => this.onClick(e))
        document.addEventListener('container.setPosition',(e) => this.onContainerChange(e))
    }

    disable () {
        document.removeEventListener('click',(e) => this.onClick(e))
        document.addEventListener('container.setPosition',(e) => this.onContainerChange(e))
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

    onClick(e) {
        let target = {
            target:e.target,
            localX: e.layerX,
            localY: e.layerY,
            absX: e.pageX,
            absY: e.pageY
        }
        console.log("LINK TARGET")
        console.log(e)
        if (this.left) {
            this.right = target
            
            this.link(this.left, this.right)
            this.left = null
            this.right = null
        } else {
            this.left = target
        }
    }
}

const clinker = new ContainerLink(container);
clinker.enable();