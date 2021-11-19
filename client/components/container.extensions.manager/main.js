import {container} from '../../nodeshow.js'

//ToDo: make it toggle extensions on and off as well as register and deregister
class ContainerExtensionsManager {
    appId = 'container.extensions.manager'
	#container = null;
    #interface = null;
    #componentModelDom = null

    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);
        
        this.#interface = this.#container.createFromSerializable(null, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"0px",
				"position":"absolute",
                "width":"48px",
                "height":"100%",
                "background-color":"blue"
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
            }
        )
    }


    enable() {
        document.addEventListener('container.component.added', e => this.onComponentRegistered(e));
        document.addEventListener('container.component.added', e => this.onComponentUnregistered(e));
    }

    disable() {
        document.removeEventListener('container.component.added', e => this.onComponentRegistered(e));
        document.removeEventListener('container.component.added', e => this.onComponentUnregistered(e));
    }

    enableComponent(e) {
        let c = this.#container.addDomChild(this.#interface, this.#componentModelDom, this.appId)
    }

    disableComponent(e) {

    }

    toggle(e) {

    }

    onComponentRegistered(e) {

    }

    onComponentUnregistered(e) {

    }
}

let cext = new ContainerExtensionsManager(container, true);
cext.enable()