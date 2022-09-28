import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

export class ContainerReferenceActuator {
    appId = 'container.interact.reference'
	
    #container = null;
    #enabled = false
    
    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);
    }

    enable() {
        if(!this.#enabled) {
            this.#enabled = true
        }
    }  
    
    disable() {
        if (this.#enabled) {
            this.#enabled = false
        }
    }

    isEnabled() {
		return this.#enabled
	}
}