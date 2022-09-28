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

Container.prototype.setReference = function(node, reff, callerId) {
    try {
        node = this.lookup(node)  
        node.dataset.reference = reff
        this.notifyUpdate(node, callerId)
    } catch (e) {

    }
}

Container.prototype.unsetReference = function(node, callerId) {
    try {
        node = this.lookup(node)  
        delete node.dataset.reference
        this.notifyUpdate(node, callerId)
    } catch (e) {

    }
}
