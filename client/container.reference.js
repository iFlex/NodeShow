import {Container} from "./Container.js"

//ToDo: integrate events
Container.prototype.hasReference = function(node) {
    try {
        node = this.lookup(node)   
        return (node.dataset.reference) ? true : false
    } catch (e) {
        return false;
    }
}

Container.prototype.getReference = function(node) {
    try {
        node = this.lookup(node)
        return node.dataset.reference   
    } catch (e) {
        return null;
    }
}

Container.prototype.setReference = function(node, reff, callerId, emit = true) {
    try {
        node = this.lookup(node)  
        node.dataset.reference = reff
        if (emit === true) {
            this.notifyUpdate(node, callerId)
        }
        return reff
    } catch (e) {
        return null;
    }
}

Container.prototype.unsetReference = function(node, callerId, emit = true) {
    try {
        node = this.lookup(node)  
        let oldReff = node.dataset.reference 
        delete node.dataset.reference
        if (emit === true) {
            this.notifyUpdate(node, callerId)
        }
        return oldReff
    } catch (e) {
        return null
    }
}
