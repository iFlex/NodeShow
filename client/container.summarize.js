import {Container} from "./Container.js"

//ToDo: find a better way to store state rather than as string in data- objects
//collpase settings should be sent to the server somehow
Container.prototype.isCollapsed = function(id) {
    let node = Container.lookup(id)
    
    if (node.getAttribute('data-prev-style')) {
        return true;
    }
    return false;
}

Container.prototype.collapse = function(id, callerId) {
    let node = Container.lookup(id)
    this.isOperationAllowed('container.collapse', node, callerId);
    if (node.getAttribute('data-prev-style')) {
        //already collapsed
        return;
    }

    let settings = JSON.parse(node.getAttribute('data-collapse-settings'))
    let prevState = this.toSerializableStyle(id)
    
    try {
        if (settings.height) {
            this.setHeight(id, settings.height, callerId)
        }
        if (settings.width) {
            this.setWidth(id, settings.width, callerId)
        }
    } catch (e) {
        //may partially fail due to permissions
        console.error(e)
    }
    
    node.setAttribute('data-prev-style', JSON.stringify(prevState))
    node.style.overflow = 'hidden';
    this.emit('container.collapse', {
        id:id,
        callerId:callerId
    });
}

Container.prototype.setCollapseMode = function(id, settings) {
    Container.lookup(id).setAttribute('data-collapse-settings', JSON.stringify(settings))    
}

Container.prototype.expand = function(id, callerId) {
    let node = Container.lookup(id);
    this.isOperationAllowed('container.expand', node, callerId);
    
    let prevStat = JSON.parse(node.getAttribute('data-prev-style'))
    if (prevStat) {
        this.styleChild(node, prevStat)
        node.removeAttribute('data-prev-style')
        this.emit('container.expand', {
            id:id,
            callerId:callerId
        });
    }
}