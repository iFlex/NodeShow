//support only straignt lines for now
class ContainerLink {
    #appId = 'container.link'
	#container = null;
    target = null;

    #links = {}
    
    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this.#appId, this);
    }


    link(left, right, settings) {
        //create the link
        let link = {}
        link['node'] = this.#container.createFromSerializable(nul, {
            height:0,
            width:10,
            computedStyle:{
                "background-color":black
            }
        }, null, "app:"+this.#appId)
        link['left'] = left
        link['right'] = right
        
        //keep a record of the link
        let links = this.#links[left] || []
        links.push(link)
        this.#links[left] = links
        this.#links[right] = links

        //draw the link and return it
        this.draw(link)
        return link
    }
    
    draw(link) {
        let linkId = link.node.id
        //ToDo: compute position, width and angle
        this.setAngle(linkId, angle, "app:"+this.#appId)
        this.setWidth(linkId, width, "app:"+this.#appId)
        this.setPosition(linkId, pos,"app:"+this.#appId)
    }

    remove(link) {
        //ToDo
    }

    enable() {
        //ToDo
    }

    disable () {
        //ToDo
    }
}

const clinker = ContainerLink(Container);
clinker.enable();