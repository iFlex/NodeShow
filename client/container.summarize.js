import {Container, ACTIONS} from "./Container.js"

//ToDo: find a better way to store state rather than as string in data- objects
Container.prototype.isCollapsed = function(id) {
    let node = Container.lookup(id)
    
    if (node.getAttribute('data-prev-style')) {
        return true;
    }
    return false;
}

Container.prototype.summarizeToggle = function(id, callerId) {
    if (this.isCollapsed(id)) {
        this.expand(id, callerId)
    } else {
        this.collapse(id, callerId)
    }
}

Container.prototype.collapse = function(id, callerId) {
    let node = Container.lookup(id)
    this.isOperationAllowed(ACTIONS.collapse, node, callerId);
    if (node.getAttribute('data-prev-style')) {
        //already collapsed
        return;
    }

    let settings = JSON.parse(node.getAttribute('data-collapse-settings')) || {height:'32px', width:'32px'}
    let prevState = this.toSerializableStyle(id, true)
    
    try {
        if (settings.height) {
            let unit = this.detectUnit(settings.height)
            let h = parseInt(settings.height.replace(unit,''))
            this.setHeight(id, h, callerId)
        }
        if (settings.width) {
            let unit = this.detectUnit(settings.width)
            let w = parseInt(settings.width.replace(unit,''))
            this.setWidth(id, w, callerId)
        }
    } catch (e) {
        //may partially fail due to permissions
        console.error(e)
    }
    
    node.setAttribute('data-prev-style', JSON.stringify(prevState))
    node.style.overflow = 'hidden';
    this.emit(ACTIONS.collapse, {
        id:node.id,
        callerId:callerId
    });
}

Container.prototype.setCollapseMode = function(id, settings, callerId) {
    Container.lookup(id).setAttribute('data-collapse-settings', JSON.stringify(settings))
    //ensures collapse settings are persisted on the server
    this.notifyUpdate(id, callerId)    
}

Container.prototype.expand = function(id, callerId) {
    let node = Container.lookup(id);
    this.isOperationAllowed(ACTIONS.expand, node, callerId);
    
    let prevStat = JSON.parse(node.getAttribute('data-prev-style'))
    if (prevStat) {
        this.styleChild(node, prevStat)
        node.removeAttribute('data-prev-style')
        this.emit(ACTIONS.expand, {
            id:node.id,
            callerId:callerId
        });
    }
}