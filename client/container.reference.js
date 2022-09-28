import {Container} from "./Container.js"

//ToDo: integrate events
Container.prototype.hasReference = function(node, callerId) {
    try {
        node = this.lookup(node)   
        return (node.dataset.reference) ? true : false
    } catch (e) {
        return false;
    }
}

Container.prototype.getReference = function(node, callerId) {
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
    } catch (e) {

    }
}

Container.prototype.unsetReference = function(node, callerId) {
    try {
        node = this.lookup(node)  
        delete node.dataset.reference
    } catch (e) {

    }
}
