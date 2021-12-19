import {Container} from "./Container.js"

/*
    The idea here is that you can bind actions to a container
    data-action: {"trigger":"event_name","call":"method.name","params":["p1","p2",...]}
    
    ToDo: Polish    
*/

Container.prototype.initActions = function(node) {
    let actions = this.getActions(node)
    for(const k in actions) {
        this.attachAction(node, actions[k])
    }   
}

Container.prototype.addAction = function(id, action, callerId) {
    this.isOperationAllowed('container.actions.add', id, callerId);
    let node = Container.lookup(id)
    this.attachAction(node, action)
    
    let actions = this.getActions(node)
    actions.push(action)
    this.saveActions(node, actions)
    
    this.emit('container.actions.add', {
        id: node.id,
        action: action,
        callerId: callerId
    })
}

//TODO: fix this. currently not working
Container.prototype.removeAction = function(id, action, callerId) {
    this.isOperationAllowed('container.actions.remove', id, callerId);
    let node = Container.lookup(id)
    this.detachAction(id, action)

    let actions = this.getActions(node)
    delete actions[action]
    this.saveActions(node, actions)

    this.emit('container.actions.remove', {
        id: node.id,
        action: action,
        callerId: callerId
    })
}

Container.prototype.getActions = function(node) {
    let result = []
    let actions = node.getAttribute("data-container-actions")
    if (actions) {
        actions = JSON.parse(actions)
        for (const k in actions) {
            result.push(actions[k])
        }
    }

    return result
}

Container.prototype.saveActions = function(node, actions) {
    node.setAttribute("data-container-actions", JSON.stringify(actions))
}

Container.prototype.lookupMethod = function(method) {
    let chain = method.split('.')
    if (!chain) {
        throw `CORE: invalid method name ${method}`
    }

    let context = this
    if (this[chain[0]] && typeof this[chain[0]] === 'function') {
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
                    throw `CORE: ${chain[i]} method not found in component ${name}`
                }
            }
        }

        if (typeof method === 'function') {
            return {method:method, context:context}
        }
    }
    
    throw `CORE: Could not find method ${method}`
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