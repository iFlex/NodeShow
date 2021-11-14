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
                "background-color": "black"
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
        let links = this.#links[left] || []
        links.push(link)
        this.#links[left.target.id] = links
        this.#links[right.target.id] = links

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
        let leftPos = this.computeAbsoluteLinkPosition(
            this.#container.getPosition(link.left.target),
            link.left
        )
        let rightPos = this.computeAbsoluteLinkPosition(
            this.#container.getPosition(link.right.target),
            link.right
        )
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

    onContainerChange(e) {
        let targetId = e.detail.id
        let links = this.#links[targetId]
        if (links) {
            for(const link of links) {
                this.draw(link)
            }
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