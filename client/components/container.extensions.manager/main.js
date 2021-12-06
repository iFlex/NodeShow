import { container } from '../../nodeshow.js'
import { ACTIONS } from '../../Container.js'

//ToDo: make it toggle extensions on and off as well as register and deregister
class ContainerExtensionsManager {
    appId = 'container.extensions.manager'
	#container = null;
    #interface = null;
    #componentModelDom = null
    #handlers = {}
    #componentTogglers = {}

    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);
        
        this.#handlers[ACTIONS.componentAdded] = (e) => this.onComponentRegistered(e)
        this.#handlers[ACTIONS.componentRemoved] = (e) => this.onComponentUnregistered(e)
    
        this.#interface = this.#container.createFromSerializable(null, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"0px",
				"position":"absolute",
                "width":"48px",
                "height":"100%"
			}
		},
		null,
		this.appId)
		//load interface style and html
		this.#container.loadStyle("style.css", this.appId)
		this.#container.loadHtml(this.#interface, "interface.html", this.appId).then(
            e => {
                this.#componentModelDom = this.#container.lookup('ns-extension-toggler')
                this.#interface.removeChild(this.#componentModelDom)
                this.loadExistingComponents()
            }
        )
    }

    enable() {
        for (const [key, value] of Object.entries(this.#handlers)) {
			document.addEventListener(key, value)
		}
        this.#container.show(this.#interface)
    }

    disable() {
        for (const [key, value] of Object.entries(this.#handlers)) {
			document.removeEventListener(key, value)
		}
        this.#container.hide(this.#interface)
    }

    loadExistingComponents() {
        for( const id of this.#container.listComponents()) {
            this.loadComponentIcon(id)
        }
    }

    loadComponentIcon(id) {
        if (id in this.#componentTogglers) {
            return;
        }
        let cloned = this.#componentModelDom.cloneNode(true)
        cloned.innerHTML = id
        
        this.#container.addDomChild(this.#interface, cloned, this.appId)
        this.#container.show(cloned)
        this.#componentTogglers[id] = cloned
    }

    unloadComponentIcon(id) {
        if (!(id in this.#componentTogglers)) {
            return;
        }

        let domNode = this.#componentTogglers[id]
        domNode.parentNode.removeChild(domNode)
        delete this.#componentTogglers[id]
    }

    enableComponent(e) {
        
    }

    disableComponent(e) {

    }

    toggle(e) {

    }

    onComponentRegistered(e) {
        this.loadComponentIcon(e.detail.name)
    }

    onComponentUnregistered(e) {
        this.unloadComponentIcon(e.detail.name)
    }
}

let cext = new ContainerExtensionsManager(container, true);
cext.enable()