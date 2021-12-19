import {Container, ACTIONS} from "./Container.js"

let orphans = {}
let initQueue = {}

function emitContainerCreated(context, parent, child, callerId) {
    //this container has finally been initialized
    console.log(`Created contrainer ${child.id} in ${parent.id} by: ${callerId}`)
    context.CONTAINER_COUNT ++;
    context.emit(ACTIONS.create, {
        presentationId: context.presentationId, 
        parentId: parent.id, 
        id: child.id, 
        callerId: callerId
    });
    context.notifyUpdate(parent, callerId)
}

function addChildNodes(context, elem, callerId) {
    if (!initQueue[elem.id]) {
        console.log(`Failed to initialize ChildNodes for ${elem.id} - no state stored in init queue`)
        return;
    }

    let childNodes = initQueue[elem.id].childNodes
    let index = initQueue[elem.id].index
    console.log(`start step adding children to ${elem.id} index:${index}`)
    for (; index < childNodes.length; ++index) {
        let node = childNodes[index]
        if (node.id) {
            try {
                Container.lookup(node.id)
            } catch (e){
                break;   
            }
        } else {
            let nodeDOM = document.createTextNode(node.value)
            elem.appendChild(nodeDOM)
        }
    }

    //update index
    initQueue[elem.id].index = index;
    console.log(`end step adding children to ${elem.id} index:${index}`)
    //initialisation complete
    if (childNodes.length <= index) {
        console.log(`CONTAINER CREATED ${elem.id}`)
        //update order of siblings 
        context.reorderChildren(elem, initQueue[elem.id].descriptor, callerId)
        emitContainerCreated(context, elem.parent || context.parent, elem, callerId)
        delete initQueue[elem.id]
    }
}

function makeAndInsertChild(rawDescriptor, parent, insertBefore) {
    if (rawDescriptor.id) {
        let collision = null;
        try {
            collision = Container.lookup(rawDescriptor.id)
        } catch (e) {
            
        }
        if (collision) {
            throw `ID Collision. ${rawDescriptor.id} already exists in this document`
        }
    }
    

    let child = document.createElement(rawDescriptor['nodeName'])
    child.id = rawDescriptor.id || Container.generateUUID();
    //create the child
    if (insertBefore) {
        parent.insertBefore(child, insertBefore);
        //ToDo: insert before could mess up with correct initialisation of parents...hmm
    } else {
        parent.appendChild(child);
    }
    return child
}

function resolveParentForCreation(context, parentId, rawDescriptor) {
    if (parentId) {
        try {
            return Container.lookup(parentId);
        } catch (e) {
            //save it in case the parrent shows up :D 
            if (!orphans[parentId]) {
                orphans[parentId] = []
            }
            orphans[parentId].push(rawDescriptor)
            throw `${parentId} does not exist yet. Orphan`
        }
    } 
    return context.parent;
}

//Prone to UID collisions. It won't complain if you want to create an element that already exists
//has the ability to wait for parent to show up
Container.prototype.createFromSerializable = function(parentId, rawDescriptor, insertBefore, callerId) {
    if (rawDescriptor.nodeName.toLowerCase() == 'body'){
        console.log("No need to re-create the body object");
        this.updateChild(rawDescriptor.id, rawDescriptor, callerId, false)
        return;
    }

    let parent = resolveParentForCreation(this, parentId, rawDescriptor)
    this.isOperationAllowed(ACTIONS.create, parent, callerId);
    let child = makeAndInsertChild(rawDescriptor, parent, insertBefore)
    //set all properties and configurations & child order
    this.updateChild(child, rawDescriptor, callerId, false)
    
    if(rawDescriptor.childNodes && rawDescriptor.childNodes.length > 0) {
        initQueue[child.id] = {
            childNodes: rawDescriptor.childNodes,
            descriptor: rawDescriptor,
            index: 0,
            queuedAt: Date.now()
        }
        addChildNodes(this, child, callerId)
    } else {
        emitContainerCreated(this, parent, child, callerId)
    }
    
    //this container is a parent of orphans, they are no longer orphans
    if (orphans[child.id]) {
        while (orphans[child.id].length > 0) {
            let orphan = orphans[child.id].pop()
            this.createFromSerializable(child.id, orphan, null, callerId)
        }
    }
    //continue paret setup
    addChildNodes(this, parent, callerId)
    
    return child;
}

Container.prototype.toSerializableStyle = function(id, snapshot) {
    let elem = Container.lookup(id);
    let computedStyle = elem.style;
    if (snapshot) {
        computedStyle = window.getComputedStyle(elem)
    }

    let result = {}
    for (const item of computedStyle) {
        result[item] = computedStyle.getPropertyValue(item)
    }

    return result;
}

Container.prototype.toSerializable = function(id) {
    let relevantProps = ['id','nodeName','className', 'src']

    let elem = Container.lookup(id);
    
    let serialize = {}
    for (const tag of relevantProps) {
        serialize[tag] = elem[tag];
    }

    //only save inner html if leaf node
    if (!elem.children || elem.children.length == 0) {
        serialize['innerHTML'] = elem.innerHTML
    } else {
        serialize['childNodes'] = []
        for (const child of elem.childNodes) {
            if(!child.id) {
                serialize['childNodes'].push({
                    nodeName:child.nodeName, 
                    nodeType:child.nodeType, 
                    value:   child.nodeValue,
                    text:    child.textContent})
            } else {
                serialize['childNodes'].push({id:child.id})
            }
        }
    }

    serialize['cssText'] = elem.style.cssText;
    serialize['computedStyle'] = this.toSerializableStyle(id);
    
    //save data- tags
    serialize['data'] = $(elem).data();
    
    //save metadata
    serialize["permissions"] = this.permissions[elem.id]

    return serialize;
}

Container.prototype.reorderChildren = function(elem, rawDescriptor, callerId) {
    //check children order
    console.log(`Updating child order ${elem.id} - ${(rawDescriptor.childNodes)?rawDescriptor.childNodes.length:0}`) 
    if (rawDescriptor.childNodes) {
        for (let i = 0; i < rawDescriptor.childNodes.length && i < elem.childNodes.length; ++i ) {
            console.log(`${i} descriptor_id:${rawDescriptor.childNodes[i].id} actual_id: ${elem.childNodes[i].id}`)
            if (rawDescriptor.childNodes[i].id != elem.childNodes[i].id) {
                console.log(`setPos ${rawDescriptor.childNodes[i].id} to ${i}`)
                console.log(elem)
                try {
                    this.setSiblingPosition(rawDescriptor.childNodes[i].id, i, callerId)    
                    console.log("SWAPPED:")
                } catch (e) {
                    console.error("Failed to reorder siblings. Did you reference an unrelated container?", e)
                }
            } 
        }    
    }
}

/*
    Everything about the child that can be mutated after creation
    style
    permissions
    actions
*/
Container.prototype.updateChild = function(childId, rawDescriptor, callerId, emit){
    let child = Container.lookup(childId)
    //bulindly applying all properties received
    for (const [tag, value] of Object.entries(rawDescriptor)) {
        if (this.skipSetOnDOM[tag] || !value){
            continue;
        }
        
        try {
            child[tag] = value;
        } catch (e) {
            console.error(`Could not set tag:${tag} on ${child.id}`);
            console.error(e);
        }
    }

    //set data attributes
    for( const [tag, value] of Object.entries(rawDescriptor.data || {})) {
        child.dataset[tag] = JSON.stringify(value)
    }

    //apply permissions
    if (rawDescriptor.permissions) {
        this.permissions[child.id] = Container.clone(rawDescriptor.permissions)
    }
    
    this.reorderChildren(child, rawDescriptor, callerId)
    
    //init actions
    try {
        this.initActions(child)
    } catch (e) {
        console.log("Could not init container actions. Did you not include the module?")
        console.error(e)
    }
    //update style
    if (rawDescriptor['cssText']){
        child.style.cssText = rawDescriptor['cssText']    
    }
    if (rawDescriptor['computedStyle']) {
        this.styleChild(child, rawDescriptor['computedStyle'], callerId, emit)    
    } else if(emit != false) {
        this.emit(ACTIONS.update, {id:child.id, callerId:callerId})
    }
}