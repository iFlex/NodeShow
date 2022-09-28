import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

export class ContainerReferenceEditor {
    appId = 'container.edit.reference'
	
    #container = null;
    #enabled = false
    
    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this, new Set([
            {"operation":"setURLreference","method":this.setReference},
            {"operation":"getURLreference","method":this.getReference},
            {"operation":"unsetURLreference","method":this.unsetReference},
            {"operation":"editURLreference","method":this.edit},
        ]));
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

    edit(targets, callerId = this.appId) {
        let oldReffs = this.getReference(targets) 
        let oldReff = ""
        if (oldReffs.length > 0) {
            oldReff = oldReffs[0] || ""
        }

        let newRef = prompt("URL:", oldReff);
        if (newRef && newRef.length > 0) {
            this.setReference(newRef, targets, callerId)
        } else {
            this.unsetReference(targets, callerId)
        }
    }

    setReference(reff, targets, callerId = this.appId) {
        for (const target of targets) {
            this.#container.setReference(target, reff, callerId);
        }
    }

    unsetReference(targets, callerId = this.appId) {
        for (const target of targets) {
            this.#container.unsetReference(target, callerId);
        }
    }

    getReference(targets) {
        let result = []
        for (const target of targets) {
            result.push(this.#container.getReference(target))
        }
        return result
    }
}