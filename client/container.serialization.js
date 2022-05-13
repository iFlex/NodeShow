import {Container, ACTIONS} from "./Container.js"

let orphans = {}
let initQueue = {}

function shouldNotIgnore(context, tag, key) {
    //core permissions storage tag.
    if (tag == 'data' && key == 'containerPermissions') {
        return true;
    }

    if (!context.serializerKeeps || !context.serializerKeeps[tag]) {
        return false;
    }

    return context.serializerKeeps[tag].has(key)    
}

function getKeysToIgnore(context, tag) {
    if (!context.serializerIgnores || !context.serializerIgnores[tag]) {
        return new Set()
    }

    return context.serializerIgnores[tag]
}

function stripClassName(classList, toStrip) {
    let result = classList
    for (const strip of toStrip) {
        result = result.replaceAll(strip, '')
    }
    return result
}

function emitContainerCreated(context, parent, child, callerId) {
    //this container has finally been initialized
    //console.log(`Created contrainer ${child.id} in ${parent.id} by: ${callerId}`)
    Container.applyPostHooks(context, 'create', [parent.id, child, callerId])

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
        //console.log(`Failed to initialize ChildNodes for ${elem.id} - no state stored in init queue`)
        return;
    }

    let childNodes = initQueue[elem.id].childNodes
    let index = initQueue[elem.id].index
    //console.log(`start step adding children to ${elem.id} index:${index}`)
    for (; index < childNodes.length; ++index) {
        let node = childNodes[index]
        if (node.id) {
            try {
                context.lookup(node.id)
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
    //console.log(`end step adding children to ${elem.id} index:${index}`)
    //initialisation complete
    if (childNodes.length <= index) {
        //console.log(`CONTAINER CREATED ${elem.id}`)
        //update order of siblings 
        context.reorderChildren(elem, initQueue[elem.id].descriptor, callerId)
        emitContainerCreated(context, elem.parent || context.parent, elem, callerId)
        delete initQueue[elem.id]
    }
}

function makeAndInsertChild(context, rawDescriptor, parent, insertBefore) {
    if (rawDescriptor.id) {
        let collision = null;
        try {
            collision = context.lookup(rawDescriptor.id)
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
    context.virtualDOM[child.id] = child
    return child
}

function resolveParentForCreation(context, parentId, rawDescriptor) {
    if (parentId) {
        try {
            return context.lookup(parentId);
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
    
    Container.applyPreHooks(this, 'create', [parentId, null, rawDescriptor, insertBefore, callerId])
    let parent = resolveParentForCreation(this, parentId, rawDescriptor)
    this.isOperationAllowed(ACTIONS.create, parent, callerId);
    let child = makeAndInsertChild(this, rawDescriptor, parent, insertBefore)
    //set all properties and configurations & child order
    this.updateChild(child, rawDescriptor, callerId, false) //PERF: HEAVY
    
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

Container.prototype.toSerializableStyle = function(id, snapshot, subset) {
    let elem = this.lookup(id);
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

Container.prototype.toSerializable = function(id, snapshot, subset) {
    let basicProps = ['id','nodeName', 'src']

    let elem = this.lookup(id);
    
    let serialize = {}
    //NOTE: the basic properties will always be present in a serialization result
    for (const tag of basicProps) {
        serialize[tag] = elem[tag];
    }

    if (!subset || subset['className']) {
        serialize['className'] = stripClassName(elem.className, getKeysToIgnore(this, 'className'))    
    }
    
    //only save inner html if leaf node
    if (!elem.children || elem.children.length == 0) {
        if (!subset || subset['className']) {
            serialize['innerHTML'] = elem.innerHTML
        }
    } else {
        //NOTE: child nodes will always be presend in a serialized descriptor
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

    //[TODO]: figure out if cssText is needed
    if (!subset || subset['cssText']) {
        serialize['cssText'] = elem.style.cssText    
    }
    if (!subset || subset['computedStyle']) {
        serialize['computedStyle'] = this.toSerializableStyle(id, snapshot);
    }
    //save data- tags
    if (!subset || subset['data']) {
        serialize['data'] = {}
        let dataIgnore = getKeysToIgnore(this, 'data')
        for (let [key, value] of Object.entries(elem.dataset)) {
            if (!dataIgnore.has(key)) {
                if (!subset || subset['data'] == true || subset['data'][key]) {
                    serialize.data[key] = value
                }
            }
        }
    }

    return serialize;
}

Container.prototype.reorderChildren = function(elem, rawDescriptor, callerId) {
    //check children order
    //console.log(`Updating child order ${elem.id} - ${(rawDescriptor.childNodes)?rawDescriptor.childNodes.length:0}`) 
    if (rawDescriptor.childNodes) {
        for (let i = 0; i < rawDescriptor.childNodes.length && i < elem.childNodes.length; ++i ) {
            if (rawDescriptor.childNodes[i].id != elem.childNodes[i].id) {
                try {
                    this.setSiblingPosition(rawDescriptor.childNodes[i].id, i, callerId)    
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
    actions
*/
Container.prototype.updateChild = function(childId, rawDescriptor, callerId, emit){
    let child = this.lookup(childId)
    Container.applyPreHooks(this, 'update', [child, rawDescriptor, callerId, emit])
    
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

    //set data attributes. Value is always a string.
    for( const [tag, value] of Object.entries(rawDescriptor.data || {})) {
        if (typeof value === 'object') {
            child.dataset[tag] = JSON.stringify(value)
        } else {
            child.dataset[tag] = value
        }
    }
    
    this.reorderChildren(child, rawDescriptor, callerId)
    
    //update style
    if (rawDescriptor['cssText']){
        child.style.cssText = rawDescriptor['cssText']    
    }
    
    this.updateZindexLimits(child)
    Container.applyPostHooks(this, 'update', [child, rawDescriptor, callerId, emit])
    
    if (rawDescriptor['computedStyle']) {
        this.styleChild(child, rawDescriptor['computedStyle'], callerId, emit)    
    } else if(emit != false) {
        this.emit(ACTIONS.update, {id:child.id, changes: descriptor, callerId:callerId})
    }
}

Container.prototype.serializerCannotIgnore = function(tag, key) {
    if (!this.serializerKeeps) {
        this.serializerKeeps = {}
    }
    if (!this.serializerKeeps[tag]) {
        this.serializerKeeps[tag] = new Set()
    }

    this.serializerKeeps[tag].add(key)
}

/**
 * @summay Add a tag and key to ignore when serializing
 * @description This can be used when serializing a container to leave out certain properties that are mean only for the local context.
 */ 
//[TODO]: currently supports className and data as tags, see if more are needed +test 
Container.prototype.serializerIgnore = function(tag, key) {
    if (shouldNotIgnore(this, tag, key)) {
        throw `Cannot ignore ${tag}:${key} when serializing`
    }

    if (!this.serializerIgnores) {
        this.serializerIgnores = {}
    }
    if (!this.serializerIgnores[tag]) {
        this.serializerIgnores[tag] = new Set()
    }

    this.serializerIgnores[tag].add(key)
}

Container.prototype.diagnozeSerde = function(argument) {
    return {
        "orphans":orphans,
        "initQ":initQueue
    }
}