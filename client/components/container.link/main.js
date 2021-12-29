import { container } from '../../nodeshow.js'
import { Container, ACTIONS } from '../../Container.js'
import { draw as straightLine } from './straightLine.js'

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
            //drawer = this.#linkDrawers['straightLine']
        }
        return drawer.apply(this, [this.#container, descriptor])
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
        descriptor.linkId = linkId
        descriptor.linkUnits = []

        //draw link
        let nodelist = this.draw(descriptor)
        
        //persist
        for (let linkUnit of nodelist) {
            linkUnit.dataset.linkId = linkId
            descriptor.linkUnits.push(linkUnit.id)
        }
        nodelist[0].dataset.link = JSON.stringify(descriptor)
        
        this.#links[linkId] = descriptor
        if (!this.#targetLinks[fromNode.id]) {
            this.#targetLinks[fromNode.id] = new Set([])
        }
        if (!this.#targetLinks[toNode.id]) {
            this.#targetLinks[toNode.id] = new Set([])
        }

        this.#targetLinks[fromNode.id].add(linkId)
        this.#targetLinks[toNode.id].add(linkId)

        return linkId
    }

    deleteLink(linkId, callerId) {
        const descriptor = this.#links[linkId]
        for (const linkUnitId of descriptor.linkUnits) {
            try {
                this.#container.delete(this.#container.lookup(linkUnitId), callerId)
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

    onContainerChange(e) {
        let links = this.getLinksRelatedTo(e.detail.id)
        for(const link of links) {
            this.draw(this.#links[link])
        }
    }
}

const clinker = new ContainerLink(container);
clinker.enable();