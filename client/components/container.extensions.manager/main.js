import { ACTIONS } from '../../Container.js'

//ToDo: make it toggle extensions on and off as well as register and deregister
export class ContainerExtensionsManager {
    appId = 'container.extensions.manager'
	type = 'transactional'
    modal = true
    displayName = "Apps"

    #container = null;
    #interface = null;
    #componentModelDom = null
    #enabled = false
    #handlers = {}
    #componentTogglers = {}

    #enabledStyle = 'ns-extensions-manager-toggle-enabled'
    #disabledStyle = 'ns-extensions-manager-toggle-disabled'
    #modelTogglerId = 'ns-extension-toggler'

    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);
        
        this.#handlers[ACTIONS.componentAdded] = (e) => this.onComponentRegistered(e)
        this.#handlers[ACTIONS.componentRemoved] = (e) => this.onComponentUnregistered(e)
    
        this.#interface = this.#container.createFromSerializable(document.body, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"250px",
				"position":"fixed",
                "width":"auto",
                "height":"100%"
			},
            "data":{
                "ignore":true,
                "containerPermissions":{
                    "container.bridge":{"*":false}
                }
            }
		},
		null,
		this.appId)
		//load interface style and html
		this.#container.loadStyle("style.css", this.appId)
		this.#container.loadHtml(this.#interface, "interface.html", this.appId).then(
            e => {
                this.#componentModelDom = this.#container.lookup(this.#modelTogglerId)
                this.#interface.removeChild(this.#componentModelDom)
                this.loadExistingComponents()
            }
        )
        this.#container.hide(this.#interface, this.appId)
    }

    enable() {
        if (!this.#enabled) {
            for (const [key, value] of Object.entries(this.#handlers)) {
                document.addEventListener(key, value)
            }
            this.#container.show(this.#interface)
            this.#enabled = true
        }
    }

    disable() {
        if (this.#enabled) {
            for (const [key, value] of Object.entries(this.#handlers)) {
                document.removeEventListener(key, value)
            }
            this.#container.hide(this.#interface)
            this.#enabled = false
        }
    }

    isEnabled() {
		return this.#enabled
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
        
        this.#container.addDomChild(this.#interface, cloned, this.appId, false)
        this.#container.show(cloned)
        this.#componentTogglers[id] = cloned

        let component = this.#container.getComponent(id)
        if (component.isEnabled()){
            $(cloned).addClass(this.#enabledStyle);
        } else {
            $(cloned).addClass(this.#disabledStyle);
        }
    }

    unloadComponentIcon(id) {
        if (!(id in this.#componentTogglers)) {
            return;
        }

        let domNode = this.#componentTogglers[id]
        domNode.parentNode.removeChild(domNode)
        delete this.#componentTogglers[id]
    }

    enableComponent(component, toggler) {
        component.enable()

        $(toggler).addClass(this.#enabledStyle)
        $(toggler).removeClass(this.#disabledStyle)
        console.log(`${this.appId}:ENABLED -> ${component.appId}`)
    }

    disableComponent(component, toggler) {
        component.disable()

        $(toggler).removeClass(this.#enabledStyle)
        $(toggler).addClass(this.#disabledStyle)
        console.log(`${this.appId}:DISABLED -> ${component.appId}`)
    }

    getComponentIdFromToggler(toggler) {
        return toggler.innerHTML
    }

    toggle(e) {
        e.preventDefault()

        let id = this.getComponentIdFromToggler(e.target) 
        let component = this.#container.getComponent(id)

        if (component.isEnabled() != true) {
            this.enableComponent(component, e.target)
        } else {
            this.disableComponent(component, e.target)
        }
    }

    onComponentRegistered(e) {
        this.loadComponentIcon(e.detail.name)
    }

    onComponentUnregistered(e) {
        this.unloadComponentIcon(e.detail.name)
    }
}