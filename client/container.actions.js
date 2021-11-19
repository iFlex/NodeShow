import {Container} from "./Container.js"

/*
    The idea here is that you can bind actions to a container
    data-action: {"trigger":"event_name","call":"method.name","params":["p1","p2",...]}
    
    ToDo: Polish    
*/

Container.prototype.initActions = function(node) {
    let actions = this.loadActions(node)
    if (actions) {
        for(const [key, action] of Object.entries(actions)) {
            this.attachAction(node, action)
        }
    }   
}

Container.prototype.addAction = function(id, action, callerId) {
    this.isOperationAllowed('container.actions.add', id, callerId);
    let node = Container.lookup(id)
    this.attachAction(node, action)
    
    let actions = this.loadActions(node)
    actions[action] = action
    this.saveActions(actions)
    
    this.emit('container.actions.add', {
        id: node.id,
        action: action,
        callerId: callerId
    })
}


Container.prototype.removeAction = function(id, action, callerId) {
    this.isOperationAllowed('container.actions.remove', id, callerId);
    let node = Container.lookup(id)
    this.detachAction(id, action)

    let actions = this.loadActions(node)
    delete actions[action]
    this.saveActions(actions)

    this.emit('container.actions.remove', {
        id: node.id,
        action: action,
        callerId: callerId
    })
}

Container.prototype.loadActions = function(node) {
    let actions = node.getAttribute("data-container-actions")
    return JSON.parse(actions)
}

Container.prototype.saveActions = function(node, actions) {
    node.setAttribute("data-container-actions",JSON.stringify(actions))
}

Container.prototype.lookupMethod = function(method) {
    let chain = method.split('.')
    let context = this

    if (this[chain[0]] && typeof this[chian[0]] === 'function') {
        //there's a method available in Container
        return {method:this[chain[0]], context:context}
    } else {
        let name = chain[0]
        let method = null
        let i = 1;
        for (; i < chain.length; ++i ) {
            name += `.${chain[i]}`
            method = this.getComponent(name)   
            if (method) {
                i++;
                break;
            }
        }
        if (method) {
            context = method;
            for (; i < chain.length; ++i ) {
                if (chain[i] in method) {
                    method = method[chain[i]]
                } else {
                    throw `${chain[i]} method not found in component ${name}`
                }
            }
        }

        if (typeof method === 'function') {
            return {method:method, context:context}
        }
    }
    
    throw `Could not find method ${method}`
}

Container.prototype.detachAction = function(node, actionDescriptor) {

}

Container.prototype.attachAction = function(node, actionDescriptor) { 
    let toCall = this.lookupMethod(actionDescriptor.call)
    if (toCall) {
        node.addEventListener(actionDescriptor.trigger, e => {
            let params = (actionDescriptor.params || []).concat([e])
            toCall.method.apply(toCall.context, params)
        })
    } else {
        throw `Could not find method ${actionDescriptor.call} to attach action`
    }
}