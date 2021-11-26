import {Container, ACTIONS} from "./Container.js"

let orphans = {}
let initQueue = {}

//ToDo: Figure out if need both orphans and initQueue
function getParentOrOrphanChild(parentId, rawDescriptor) {
    try{
        return Container.lookup(parentId);
    } catch (e) {
        //save it in case the parrent shows up :D 
        if (!orphans[parentId]) {
            orphans[parentId] = []
        }
        orphans[parentId].push(rawDescriptor)
    }
    return null;
}

function addChildNodes(context, elem, callerId, emit) {
    if (!initQueue[elem.id]) {
        console.log(`Failed to initialize ChildNodes for ${elem.id} - no state stored in init queue`)
        return;
    }

    let childNodes = initQueue[elem.id].childNodes
    let index = initQueue[elem.id].index
    for (; index < childNodes.length; ++index) {
        let node = childNodes[index]
        if (node.id) {
            index++;
            break;
        } else {
            let nodeDOM = document.createTextNode(node.value)
            elem.appendChild(nodeDOM)
        }
    }

    //update index
    initQueue[elem.id].index = index;
    //update order of siblings 
    context.updateChild(elem, initQueue[elem.id].descriptor, callerId, emit)
    //initialisation complete
    if (childNodes.length <= index) {
        delete initQueue[elem.id]
    }
}

function findOrMakeChild(rawDescriptor){
    try {
        return Container.lookup(rawDescriptor.id)
    } catch (e){
        console.log(`Could not locate child by id ${rawDescriptor.id}, will generate it`)
    }
    return document.createElement(rawDescriptor['nodeName'])
}

//Prone to UID collisions. It won't complain if you want to create an element that already exists
//has the ability to wait for parent to show up
Container.prototype.createFromSerializable = function(parentId, rawDescriptor, insertBefore, callerId) {
    if(this.debug) {
        console.log("Create from serializable")
        console.log(rawDescriptor)
    }
    
    if (rawDescriptor.nodeName.toLowerCase() == 'body'){
        console.log("No need to re-create the body object");
        return;
    }

    let parent = this.parent;
    if (parentId) {
        parent = getParentOrOrphanChild(parentId, rawDescriptor)
        if (!parent) { //orphaned
            if (this.debug) console.log(`${parentId} has new orphan`)
            return;
        }
    }
    this.isOperationAllowed(ACTIONS.create, parent, callerId);
    
    let child = findOrMakeChild(rawDescriptor)
    if (insertBefore) {
        parent.insertBefore(child, insertBefore);
        //ToDo: insert before could mess up with correct initialisation of parents...hmm
    } else {
        parent.appendChild(child);
    }
    
    //initialise unidentifiable leafs inside child
    if (rawDescriptor.childNodes) {
        initQueue[child.id] = {
            childNodes: rawDescriptor.childNodes,
            descriptor: rawDescriptor,
            index: 0
        }
        addChildNodes(this, child, callerId)
    }

    //update styles and child order
    this.updateChild(child, rawDescriptor, callerId, false)
    
    //this container is a parent of orphans, they are no longer orphans
    if (orphans[child.id]) {
        for (const orphan of orphans[child.id]) {
            console.log("unorphaning")
            this.createFromSerializable(child.id, orphan, null, callerId)
        }
    }

    //continue parent initialisation if it is waiting for this node
    if (initQueue[parent.id]) {
        addChildNodes(this, parent, callerId)
    }

    if (rawDescriptor.permissions) {
        this.permissions[child.id] = Container.clone(rawDescriptor.permissions)
    }
    
    try {
        this.initActions(child)
    } catch (e) {
        console.log("Could not init container actions. Did you not include the module?")
        console.error(e)
    }

    this.CONTAINER_COUNT ++;
    this.emit(ACTIONS.create, {
        presentationId: this.presentationId, 
        parentId: parent.id, 
        id: child.id, 
        callerId: callerId,
        descriptor: rawDescriptor
    });
    //fire a parent update as well 
    this.notifyUpdate(parent, callerId)
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
    if (rawDescriptor.childNodes) {
        console.log(`Updating child order ${elem.id}`)
        for (let i = 0; i < rawDescriptor.childNodes.length && i < elem.childNodes.length; ++i ) {
            console.log(`${i} descriptor_id:${rawDescriptor.childNodes[i].id} actual_id: ${elem.childNodes[i].id}`)
            if (rawDescriptor.childNodes[i].id != elem.childNodes[i].id) {
                console.log(`setPos ${rawDescriptor.childNodes[i].id} to ${i}`)
                try {
                    this.setSiblingPosition(rawDescriptor.childNodes[i].id, i, callerId)    
                    console.log("SWAPPED:")
                    console.log(elem)
                } catch (e) {
                    console.error("Failed to reorder siblings. Did you reference an unrelated container?", e)
                }
            } 
        }    
    }
}

Container.prototype.updateChild = function(child, rawDescriptor, callerId, emit){
    if (emit == undefined) {
        emit = true;
    }
    var total = 0;
    var set = 0;
    
    //set an id for this untagged child...
    if (!child.id && !rawDescriptor.id) {
        child.id = Container.generateUUID();
    }
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

    //applying style
    if (rawDescriptor['cssText']){
        child.style.cssText = rawDescriptor['cssText']    
    }

    this.reorderChildren(child, rawDescriptor, callerId)
    
    if (rawDescriptor['computedStyle']) {
        this.styleChild(child, rawDescriptor['computedStyle'], callerId, emit)    
    } else if(emit != false) {
        this.emit(ACTIONS.update, {id:child.id, callerId:callerId})
    }  
}