import {Container} from "./Container.js"

/*
    The idea here is that you can bind actions to a container
    data-action: {"trigger":"event_name","call":"method.name","params":["p1","p2",...]}
*/

let trigger_listeners = {}

Container.prototype.initActions = function(node) {
    let actions = this.getActions(node)
    for(const k in actions) {
        this.attachAction(node, actions[k])
    }   
}

//ToDo: switch to using set instead of list for actions.
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

Container.prototype.removeAction = function(id, action, callerId) {
    this.isOperationAllowed('container.actions.remove', id, callerId);
    let node = Container.lookup(id)
    this.detachAction(node, action)

    let toRem = JSON.stringify(action)
    let actions = this.getActions(node)
    for (let i in actions) {
        let existingAction = JSON.stringify(actions[i])
        if (existingAction == toRem) {
            actions.splice(i,1)
            break;
        }
    }

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
        try {
            actions = JSON.parse(actions)
            for (const k in actions) {
                result.push(actions[k])
            }
        } catch (e) {
            //pass
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
    let key = JSON.stringify(actionDescriptor)
    node.removeEventListener(actionDescriptor.trigger, trigger_listeners[key])
    delete trigger_listeners[key]
}

Container.prototype.attachAction = function(node, actionDescriptor) { 
    let toCall = this.lookupMethod(actionDescriptor.call)
    if (toCall) {
        let key = JSON.stringify(actionDescriptor)
        trigger_listeners[key] = e => {
            let params = (actionDescriptor.params || []).concat([e])
            toCall.method.apply(toCall.context, params)
        }

        node.addEventListener(actionDescriptor.trigger, trigger_listeners[key])
    } else {
        throw `Could not find method ${actionDescriptor.call} to attach action`
    }
}

Container.registerPostSetterHook('create', function(parentId, node){
    this.initActions(node)
});