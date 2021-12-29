import { container } from '../../nodeshow.js'
import { Container, ACTIONS } from '../../Container.js'
import { draw as straightLine } from './straightLine.js'

//[TODO]: load links on container create
//[TODO]: delete hooks
//[TODO]: click hooks
class ContainerLink {
    appId = 'container.link'
	#container = null;
    
    #enabled = false
    #handlers = {}
    #links = {}
    #targetLinks = {}
    #linkDrawers = {}

    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);

        this.#handlers[ACTIONS.update] = (e) => this.onContainerChange(e)
        this.#handlers[ACTIONS.create] = (e) => this.onContainerCreate(e)
        //[TODO]: need to use a hook instead of an event
        //this.#handlers[ACTIONS.delete] = (e) => this.onContainerDelete(e)

        //init drawers
        this.#linkDrawers['straightLine'] = straightLine
    }

    enable() {
        if (!this.#enabled) {
            this.#enabled = true
            
            for (const [key, value] of Object.entries(this.#handlers)) {
                document.addEventListener(key, value)
            }
        }
    }

    disable () {
        if (this.#enabled) {
            this.#enabled = false
            
            for (const [key, value] of Object.entries(this.#handlers)) {
                document.removeEventListener(key, value)
            }
        }
    }

    isEnabled() {
		return this.#enabled
	}
    
    addLinkDrawer(id, method) {
        //[TODO]: check method is function
        this.#linkDrawers[id] = method
    }

    draw(descriptor) {
        if (!descriptor) {
            return;
        }

        let drawer = this.#linkDrawers[descriptor.drawer]
        if (!drawer) {
            drawer = this.#linkDrawers['straightLine']
        }
        return drawer.apply(this, [this.#container, descriptor])
    }

    registerNewLink(linkId, from, to, descriptor) {
        if (linkId in this.#links) {
            throw `${this.appId} - LINK ID COLLISION ${linkId}`
        }

        this.#links[linkId] = descriptor
        if (!this.#targetLinks[from]) {
            this.#targetLinks[from] = new Set([])
        }
        if (!this.#targetLinks[to]) {
            this.#targetLinks[to] = new Set([])
        }

        this.#targetLinks[from].add(linkId)
        this.#targetLinks[to].add(linkId)
    }

    createLink(from, to, descriptor, callerId) {
        let fromNode = this.#container.lookup(from)
        let toNode = this.#container.lookup(to)
        this.#container.isOperationAllowed('container.link', fromNode, callerId)
        this.#container.isOperationAllowed('container.link', toNode, callerId)
        
        const linkId = Container.generateUUID()

        descriptor = Container.clone(descriptor)
        descriptor.from = fromNode.id
        descriptor.to = toNode.id
        descriptor.id = linkId
        descriptor.linkUnits = []

        //draw link
        let nodelist = this.draw(descriptor)
        
        //persist
        for (let linkUnit of nodelist) {
            linkUnit.dataset.linkId = linkId
            descriptor.linkUnits.push(linkUnit.id)
        }
        nodelist[0].dataset.link = JSON.stringify(descriptor)
        this.registerNewLink(linkId, fromNode.id, toNode.id, descriptor)

        this.#container.notifyUpdate(nodelist[0], this.appId)
        return linkId
    }

    //[TODO]: delete doesn't get rid of links
    deleteLink(linkId, callerId) {
        const descriptor = this.#links[linkId]
        for (const linkUnitId of descriptor.linkUnits) {
            try {
                this.#container.delete(linkUnitId, callerId)
            } catch (e) {
                console.error(`[CORE_LINKING]: failed to delete link ${linkId} component ${linkUnitId}`)
                console.error(e)            
            }
        }
        
        delete this.#links[linkId]
        this.#targetLinks[descriptor.from].delete(linkId)
        this.#targetLinks[descriptor.to].delete(linkId)
    }

    getLinksRelatedTo(targetId) {
        let links = new Set([])
        let children = [targetId]
        let i = 0;
        while ( i < children.length ) {
            let currentId = children[i]
            let currentLinks = this.#targetLinks[currentId]
            if (currentLinks) {
                for (let lnk of currentLinks) {
                    links.add(lnk)
                }
            }

            let node = this.#container.lookup(currentId)
            for (const child of node.children) {
                if (this.#targetLinks[child.id]) {
                    children.push(child.id)
                }
            }
            i++;
        }

        return links;
    }

    onContainerCreate(e) {
        let target = this.#container.lookup(e.detail.id)
        if (target.dataset.link) {
            let linkDescriptor = JSON.parse(target.dataset.link)
            
            this.registerNewLink(linkDescriptor.id, 
                linkDescriptor.from, 
                linkDescriptor.to, 
                linkDescriptor)
        }
    }

    //[TODO]: defer execution for going through children
    onContainerChange(e) {
        let links = this.getLinksRelatedTo(e.detail.id)
        for(const link of links) {
            this.draw(this.#links[link])
        }
    }

    //[TODO]: defer execution for going through children
    onContainerDelete(e) {
        let links = this.getLinksRelatedTo(e.detail.id)
        for (const link of links) {
            this.deleteLink(link, this.appId)
        }
    }
}

const clinker = new ContainerLink(container);
clinker.enable();