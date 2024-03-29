/**
 * Container Framework Module
 * @module Container 
 */
import { queueWork } from './YeldingExecutor.js'
import { ContainerException, ContainerOperationDenied, ContainerOperationNotApplicable, NoSuitableComponentPresent } from './ContainerExcepitons.js'

//[TODO]: push out subsystems that can be moved out (e.g. metadata)
//[NOTE] Node data attributes are strings
//[TODO]: postSetterHooks and preSetterHooks should not fire any events. Save this decision somewhere

export const ACTIONS = {
    new: 'instance.new',
    create: 'container.create',
    delete: 'container.delete',
    deleteSparingChildren: 'container.delete.sparingChildren',
    setParent: 'container.set.parent',
    update: 'container.update',
    bridge: 'container.bridge',
    error: 'container.error',
    syncronizing: 'container.syncronizing',
    syncronized: 'container.syncronized',
    bringToFront: 'container.bringToFront',
    sendToBack: 'container.sendToBottom',
    setContentAbstractionLevel: 'container.set.contentAbstractionLevel',
    setAbstractionLevel: 'container.set.abstractionLevel',

    setPosition: 'container.setPosition',
    setWidth: 'container.set.width',
    setHeight: 'container.set.height',
    setAngle: 'container.set.angle',
    setSiblingPosition: 'container.set.sibling.position',
    setPermission: 'container.set.permission',
    removePermission: 'container.remove.permission',

    hide: 'container.hide',
    show: 'container.show',
    componentAdded: 'container.component.added',
    componentRemoved: 'container.component.removed',
    loadHTML: 'container.loadHTML',

    remoteUpdate: 'container.bridge.update',
    connected: 'container.bridge.connected',
    disconnected: 'container.bridge.disconnected'
}
//DOC: setting data-ignore on container should cause the system to not index anything under it

//events that can automatically triger other events.
//WARNING: the related events will only receive id and callerId as details as well as the original_event data.
let ACTIONS_CHAIN = {}
    ACTIONS_CHAIN[ACTIONS.setPosition] = [ACTIONS.update]
    ACTIONS_CHAIN[ACTIONS.setWidth] = [ACTIONS.update]
    ACTIONS_CHAIN[ACTIONS.setHeight] = [ACTIONS.update]
    ACTIONS_CHAIN[ACTIONS.setAngle] = [ACTIONS.update]
    ACTIONS_CHAIN[ACTIONS.setSiblingPosition] = [ACTIONS.update]
    ACTIONS_CHAIN[ACTIONS.setPermission] = [ACTIONS.update]
    ACTIONS_CHAIN[ACTIONS.removePermission] = [ACTIONS.update]

//[TODO]: use WeakSet to account for deallocations -> allow GC to collect the container ref
export const INSTANCES = new Set()//new WeakSet([])

const CHILD_RULES_PREFIX = "childrules"

/** @class */
export class Container {
	//[TODO]: integrate hook callers wherever relevant
    //ToDo: make all fields private
    parent = null;
	presentationId = null;
	socket = null;
    debug = false;
    
    #currentMaxZindex = 0;
    #currentMinZindex = 0;
    
    //[VirtualDOM] Incomplete feature meant to optimize speed of rendering and grouping up large amounts of changes (in order to minimise the amount of redraw events caused by using the Container API)
    virtualDOM = {}
    
    /*
    Permissions describing what operations can be performed on containers
    Format {"containerId":{"operation":{"callerId":true/false}}}
    e.g. {
        "7702-container":{
            "container.delete":{
                "container.creator":false - denies delete permissions to app container.create
                "777398fas99292": false - denies delete permissions to user 777398fas99292
            },
            "container.setPosition":{
                "*":false - denied move permissions to everyone
            }
        }
    }
    */
    #permissions = {}
    localmetadata = {}
	
    components = {}
    #exportedOperations = new Map()
    skipSetOnDOM = {"nodeName":true, "children":true, "childNodes":true}

    constructor(parentDom, debug) {
        console.log("CREATED CONTAINER OBJECT")
        console.log(`------------------------`)
        console.log(parentDom)
        console.log(`------------------------`)

		this.parent = parentDom;
		this.presentationId = Container.getQueryVariable("pid")
        this.debug = debug
        
        INSTANCES.add(this)
        this.emit(ACTIONS.new, {root:parentDom, debug:debug})
    }

    //<utils>
    static clone(obj) {
        if (!obj) {
            return null;
        }
        return JSON.parse(JSON.stringify(obj))
    }

    //TODO: rename this and move
	static getQueryVariable(variable) {
		var query = window.location.search.substring(1);
		var vars = query.split('&');
		for (var i = 0; i < vars.length; i++) {
		    var pair = vars[i].split('=');
		    if (decodeURIComponent(pair[0]) == variable) {
		        return decodeURIComponent(pair[1]);
		    }
		}
		console.log('Query variable %s not found', variable);
	}

	static generateUUID() { // Public Domain/MIT
	    var d = new Date().getTime();//Timestamp
	    var d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now()*1000)) || 0;//Time in microseconds since page-load or 0 if unsupported
	    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
	        var r = Math.random() * 16;//random number between 0 and 16
	        if(d > 0){//Use timestamp until depleted
	            r = (d + r)%16 | 0;
	            d = Math.floor(d/16);
	        } else {//Use microseconds since page-load if supported
	            r = (d2 + r)%16 | 0;
	            d2 = Math.floor(d2/16);
	        }
	        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
	    });
	}

    static isFunction(obj) {
        return typeof obj === 'function'
    }

    /**
    * @summary Lookup DOM for given reference container in document.body
    * @param {(string|DOMReference)} id - container reference
    * @param {(Boolean)} throwIfNotFound - throw exception if the container isn't found
    * @returns {DOMObject} the DOM object with the given id
    */
	lookupReal(id, throwIfNotFound = true) {
		if (id instanceof Element || id instanceof Node) {
            return id;
        }

        let el = document.getElementById(id);
        if (!el && throwIfNotFound === true) {
            throw new ContainerException(id,"lookup", null,"not found");
        }

        return el
    }

    /**
    * @summary Lookup DOM or VirtualDOM for given reference container in document.body
    * @param {(string|DOMReference)} id - container reference
    * @param {(Boolean)} throwIfNotFound - throw exception if the container isn't found
    * @returns {DOMObject} the DOM object with the given id
    */
    lookup (id, throwIfNotFound = true) {
        let realNode = this.lookupReal(id, false)
        if (realNode) {
            return realNode
        }
        let virtualNode = this.virtualDOM[id]
        if (!virtualNode && throwIfNotFound === true) {
            throw new ContainerException(id,"lookup", null,"not found");
        }
        return (virtualNode || {}).node
    }

    /**
    * @summary Checks wether this instance of Container owns the referenced node.
    * @description A node is owned by a Container instance if the root node of the instance is an ancestor of the given node.
    * @param {(string|DOMReference)} id - container reference
    * @returns {boolean} wether the node is owned or not
    */
    owns (id) {
        let node = this.lookup(id, false)

        while (node) {
            if (node === this.parent) {
                return true;
            }
            node = this.getParent(node)
        }

        return false;
    }

    /**
    * @summary Returns the parent of the provided DOM Node
    * @param {(DOMReference)} node - container reference
    * @returns {DOMObject} the parent of the provided node. If the provided node is the root of the container instance, it will return the root
    */
    getParent(node) {
        if (node === this.parent) {
            return null;
        }

        if (node.parentNode) {
            return node.parentNode
        }

        let virtualNode = this.virtualDOM[node.id]
        if (virtualNode) {
            return virtualNode.parentNode
        }
        return null;
    }
 
    /**
    * @summary Traverses the DOM tree starting from the provided ROOT and initializes the framework on each found node.
    * @description For each found node it will generate a unique ID if one isn't present and will call any postCreateHooks.
    *   e.g. initialize permissions, initialize actions, etc.
    * @param {DOMObject} root - DOM objet to start the indexing from
    * @param {Boolean} emit - wether or not to emit events when discovering DOM Nodes
    */
    index(root, emit) {
		let queue = [root || this.parent]
		var index = 0
		var labeledCount = 0;

		do {
			let item = queue[index]
            
            if (!item.id && item.nodeName != "SCRIPT" && item.nodeName != "BODY") {
				item.id = Container.generateUUID()	
                labeledCount += 1;
			}
            
            if (item.children) {
				for (const child of item.children) {
					if (this.isLocalOnly(item)) {
                        this.markDOMNodeasLocalOnly(child)
                    }
                    queue.push(child)
				}
			}

			index ++;
            if(emit != false) {
                this.emit(ACTIONS.create, {
                    presentationId: this.presentationId, 
                    parentId: (item.parentNode || this.root).id, 
                    id: item.id
                    //TODO: add caller id somehow
                });
            }
		} while(index < queue.length)

		console.log(`Indexed ${index} document entities. Labeled ${labeledCount}`)
	}

    /**
    * @summary Initializes the Container framework. Requires a not to set as root.
    * @param {DOMObject} element - DOM reference of the root node
    */
	init(element) {
		//ToDo: check element type and enforce dom object
		console.log(`Initialising NodeShow engine with ID: ${this.presentationId}`)
		this.index();
        this.emit("Container.init", {
            presentationId: this.presentationId,
            //TODO: add caller_id somehow    
        });
	}

    getSerialisedDescendents(root, snapshot, nullifyParentId = false) {
		let queue = [root || this.parent]
        let rootId = queue[0].id
		let result = []
        var index = 0
		
		do {
            let item = queue[index++]
            let parentId = item.parentNode.id
			
            result.push({
                parentId: (nullifyParentId && parentId == rootId) ? null : parentId,
                descriptor: this.toSerializable(item, snapshot)
            })

            if (item.children) {
				for (const child of item.children) {
					queue.push(child)
				}
			}
		} while(index < queue.length)

		return result
	}
    //</utils>

    /**
    * @summary Chechks wether an operation can be carried out on a container by a caller
    * @throws throws a string exception if operation is not allowed
    * @param {string} operation - the name of the operation
    * @param {DOMObject} resource  - the DOM reference of the container
    * @param {string} resource  - the name of the caller
    * @returns {boolean} returns true if operation is allowed, otherwise throws exception
    */
    isOperationAllowed(operation, resource, callerId) {
        let rules = ((this.#permissions[resource.id] || {})[operation] || {})
    
        let explicit = rules[callerId]
        if(explicit == false) {
            throw new ContainerOperationDenied(resource.id, operation, callerId);
        }
        if(explicit == true) {
            return true;
        }

        let general = rules["*"]
        if (general == false) {
            throw new ContainerOperationDenied(resource.id, operation, callerId);
        } 

        return true;
    }

    /**
    * @summary Sets a given permission on a given container. 
    * @param {(string|DOMReference)} id - container reference
    * @param {string} permName - the name of the permission being set 
    * @param {string} opCaller - the name of the caller subject to this permission
    * @param {boolean} allow - wether to allow the the given operation for the given caller
    * @param {string} callerId  - the name of the caller of the setPermission method
    * @param {boolean=false} isLocal - indicates if the permission should be persisted or only applied locally
    * 
    * Events per call: 1
    */
    setPermission(id, permName, opCaller, allow, callerId, isLocal = false, emit = true) {
        let elem = this.lookup(id);
        let operation = `set.${permName}`
        this.isOperationAllowed(operation, elem, callerId)

        if (!(elem.id in this.#permissions)) {
            this.#permissions[elem.id] = {}
        }
        if (!(permName in this.#permissions[elem.id])) {
            this.#permissions[elem.id][permName] = {}
        }
        
        //load the permission into local memory
        this.#permissions[elem.id][permName][opCaller] = allow
        
        //persist permission if needed
        if (!isLocal) {
            elem.dataset.containerPermissions = JSON.stringify(this.#permissions[elem.id])
        }

        if (emit === true) {
            this.emit(ACTIONS.setPermission, {
                id:id,
                permission: permName,
                subject: opCaller,
                callerId: callerId,
                isLocal: isLocal
            })
        }
    }

    /**
    * @summary Removes permissions from a given container.
    * @description It can remove all permissions, or all permissions of a certaing name, or the permission given to a specific caller. 
    * @param {(string|DOMReference)} id - container reference
    * @param {string=} permName - the name of the permission being set. If not provided, all permissions are removed. 
    * @param {string=} opCaller - the name of the caller subject to this permission. If not provided, all permissions for the given permName are removed.
    * @param {string} callerId  - the name of the caller of the setPermission method
    * 
    * Events per call: 1
    */
    //TODO: better integrate isLocal in the entier permissions system
    removePermission(id, permName, opCaller, callerId, emit = true) {
        let elem = this.lookup(id);
        let operation = `remove.${permName || '*'}`
        this.isOperationAllowed(operation, elem, callerId)
        
        if (this.#permissions[elem.id]){
            if (permName){ //this.#permissions[elem.id][permName]){
                if (opCaller) {
                    if (opCaller in this.#permissions[elem.id][permName]) {
                        delete this.#permissions[elem.id][permName][opCaller]
                    }
                } else {
                    delete this.#permissions[elem.id][permName]
                }
                elem.dataset.containerPermissions = JSON.stringify(this.#permissions[elem.id])
            } else {
                delete this.#permissions[elem.id]
                delete elem.dataset.containerPermissions
            }
        }
        
        //TODO: differentiate among local and global permissions
        if (emit === true) {
            this.emit(ACTIONS.removePermission, {
                id:id,
                permission: permName,
                subject: opCaller,
                callerId: callerId,
                //isLocal: ?
            })
        }
    }

    //ToDo: permission matching e.g. container.set.*
    /**
    * @summary Retrieves the permissions for a given container.
    * @description It can retrieve all permissions, or all permissions of a certaing name, or the permission given to a specific caller. 
    * @param {(string|DOMReference)} id - container reference
    * @param {string=} permName - the name of the permission being set. If not provided, all permissions are removed. 
    * @param {string=} opCaller - the name of the caller subject to this permission. If not provided, all permissions for the given permName are removed.
    */
    getPermission(id, permName, opCaller) {
        let elem = this.lookup(id);
        let permission = Container.clone(this.#permissions[elem.id] || {})
        
        if (!permName) {
            return permission
        }
        
        if (!opCaller) {
            return permission[permName]
        }

        return (permission[permName] || {})[opCaller]
    }

    /**
    * @summary Loads permissions into memory from DOM storage. 
    * @description Permissions are stored in data-container-permissions on the dataset of a DOM object. In order to be enforced they need to be loaded into memory. This method reads from the dataset of the DOM object and loads into memory. 
    * @param {DOMReference} node - container to load for
    */
    loadPermissionsFromDataset(node) {
        if (!node || !node.dataset || !node.dataset.containerPermissions) {
            return {};
        }

        let perms = JSON.parse(node.dataset.containerPermissions)
        //console.log("Loading permissions from DOM")
        this.#permissions[node.id] = perms
        return perms
    }
    //<extensions subsystem>

    isLocalOnly(node) {
        node = this.lookup(node, false) || {dataset:{}};
        return node.dataset.ignore
    }

    markDOMNodeasLocalOnly(dom) {
        dom.dataset.ignore = true
    }

    markChildAsLocalOnlyIfNeeded(parent, child) {
        if (this.isLocalOnly(parent)) {
            this.markDOMNodeasLocalOnly(child)
        }
    }

    isVisible(node) {
        node = this.lookup(node);
        return node.style.display != "none";
    }

    getVisibleChildren(node) {
        node = this.lookup(node);
        
        let result = new Set([])
        for(const child of node.childNodes) {
            if (this.isVisible(child)) {
                result.add(child)
            }
        }

        return result
    }

    getAllChildren(node) {
        node = this.lookup(node);
        return new Set(node.children)
    }

    getAllChildNodes(node) {
        node = this.lookup(node);
        return new Set(node.childNodes)
    }

    /**
    * @summary Registers an extension component into the Container Framework instance.
    * @param {reference} pointer - Component instance reference 
    * @param {Set} exportedFunctionality - A set of operations the component implements that can be used by any other component / code. e.g. decoding and importing a certain image format into a container.
        exportedFunctionality = [{operation:"decode:text/html", method:methodToCall}] - call format method(input, List[targets (ids or DOMNodes)] - returns result if any
    *
    * Events per call: 1
    */
   //ToDo: make exportedFunctionality a map maybe?
    registerComponent(pointer, exportedFunctionality = new Set([])) {
        let name = pointer.appId
        if (name in this.components) {
            throw `${name} component is already registered`
        }

        this.components[name] = {
            pointer:pointer
        }

        //ToDo: adapt to work with components getting unregistered as well
        for (const ophandler of exportedFunctionality) {
            if (!this.#exportedOperations.has(ophandler.operation)) {
                this.#exportedOperations.set(ophandler.operation, {scope:pointer, method:ophandler.method})
            }
        }

        console.log(`Registered ${name}`);
        this.emit(ACTIONS.componentAdded, {
            name: name,
            //TODO: add callerId somehow
        }) 
    }

    /**
     * 
     * Events per call: 1
     */
    #unregisterComponent(component) {
        component.disable()
        delete this.components[component.appId]
        console.log(`Unregistered component ${component.appId}`)
        this.emit(ACTIONS.componentRemoved, {
            name: component.appId,
            //TODO: add callerId somehow
        }) 
    }

    /**
    * @summary Removes a registered component from the Container Framework instance.
    * @param {reference} pointer - Component instance reference
    * 
    * Events per call: 1 
    */
    unregisterComponent(component) {
        if (component.appId in this.components) {
            this.#unregisterComponent(component)
            return
        }
    }

    /**
    * @summary Retrieves a reference for a given component.
    * @param {string} appName - name of component to retrieve 
    * @returns {reference} reference to the retrieved component
    */
    getComponent(appName) {
        for (const [name, componentData] of Object.entries(this.components)) {
            if (appName == name) {
                return componentData.pointer
            }
        }

        return null;
    }
    
    //ToDo: integrate emit into this
    tryExecuteWithComponent(operation, input, targets, callerId) {
        let handler = this.#exportedOperations.get(operation)
        if (!handler) {
            throw new NoSuitableComponentPresent(operation);
        }
        return handler.method.apply(handler.scope, [input, targets, callerId, operation])
    }

    canExecuteWithComponent(operation) {
        return this.#exportedOperations.has(operation)
    }

    /**
    * @summary Retrieves a list of component names loaded into the Container Framework instance.
    * @returns {string[]} reference to the retrieved component
    */
    listComponents() {
        return Object.keys(this.components)
    }

    //ToDo: evaluate the usefulness of this subsystem
    componentStartedWork(appId, settings) {
        if (!(appId in this.components)) {
            return;
        }

        //make it mutually exclusive for now. Any existing work sessions will be stopped when a new one starts.
        for (const [id, compData] of Object.entries(this.components)) {
            if ('workSession' in compData) {
                try {
                    compData.pointer.stop();    
                } catch (e) {
                    console.log(`[CORE]: failed to stop existing work session on ${id}`)
                }
                this.componentStoppedWork(id)
            }
        }

        this.components[appId]['workSession'] = settings
    }

    componentStoppedWork(appId) {
        if (!(appId in this.components)) {
            return;
        }

        delete this.components[appId]['workSession']
    }
    //</extensions subsystem>
    
    nodeCountToRoot(id) {
        let pointer = this.lookup(id)
        if (pointer == this.parent) {
            return 0;
        }
        
        let count = 0;
        while (pointer && pointer != this.parent) {
            count ++;
            pointer = this.getParent(pointer);
        }

        return count;
    }

    //ToDo: add a system to impose style on children being added to parents with restrictions (including when changing parent) 
    /**
     * 
     * Events per call: 0 - expects caller to fire events
     */
    conformToParentRules(elementId) {
        let child = this.lookup(elementId);
        let parent = this.getParent(child)
        let rules = this.getChildStyleRules(parent)
        
        //Flow based positioning rules:
        if (parent.style.position == "static") {
            //static parents force their children to be static as well - otherwise positioning becomes incorrect.
            rules.position = "static"
        }

        if (rules && Object.entries(rules).length > 0) {
            this.styleChild(child, rules, null, false);
        }
    }

    getChildStyleRules(parentId) {
        let node = this.lookup(parentId)
        try {
            return JSON.parse(node.dataset[CHILD_RULES_PREFIX] || "{}")
        } catch (e) {
            console.error(`[CONTAINER][CORE] Failed to parse child style rulse for ${parentId}`);
        }
        return {}
    }

    setChildStyleRules(parentId, rules, callerId, emit = true) {
        console.log(`Set child rules to ${JSON.stringify(rules)}`)
        let node = this.lookup(parentId)
        node.dataset[CHILD_RULES_PREFIX] = JSON.stringify(rules);
        
        if (emit === true) {
            this.notifyUpdate(node, callerId)
        }
    }

    unsetChildStyleRules(node, rules) {
        //ToDo: implement
    }

    //<nesting>
    /**
     * ToDo: document
     * @param {*} childId 
     * @param {*} parentId 
     * @param {*} callerId 
     * @param {*} options 
     * @param {*} emit 
     * @returns 
     * 
     * Events per call: 4 + pre & post hooks
     */
	setParent(childId, parentId, callerId, options, emit = true) {
        let parent = this.lookup(parentId);
        let child = this.lookup(childId);
        if (this.getParent(child).id === parent.id) {
            return; //noop
        }
        this.isOperationAllowed(ACTIONS.setParent, child, callerId);
        this.isOperationAllowed(ACTIONS.create, parent, callerId);
        
        //console.log(`Change parent for ${child.id} to ${parent.id}`)
        let prevParentId = this.getParent(child).id;
        if (options && options.insertBefore && parent.firstChild) {
            jQuery(child).detach().insertBefore(this.lookup(options.insertBefore));
        } else {
            jQuery(child).detach().appendTo(parent);    
        }
        this.conformToParentRules(child)

        if (emit === true) {
            this.emit(ACTIONS.setParent, {
                id: child.id,
                prevParent: prevParentId,
                parentId: parent.id,
                callerId: callerId
            })
            //update server on updated elements
            this.notifyUpdate(child, callerId)
            this.notifyUpdate(prevParentId, callerId)
            this.notifyUpdate(parent, callerId)
        }
    }
    //</nesting>
    
    /**
     * ToDo: document and implement?
     * @param {*} id 
     * @param {*} angle 
     * @param {*} originX 
     * @param {*} originY 
     * @param {*} callerId 
     * @param {*} emit
     * 
     * Events per call: 2 
     */
    setAngle(id, angle, originX, originY, callerId, emit = true) {
        this.isOperationAllowed(ACTIONS.setAngle, id, callerId);
        let node = this.lookup(id)
        this.styleChild(node, {
            "transform-origin": `${originX} ${originY}`,
            "transform":`rotate(${angle})`
        }, callerId, false)

        if (emit === true) {
            this.emit(ACTIONS.setAngle, {
                id:node.id, 
                //prevAngle:prevAngle,
                // prevOrigin:{
                // },
                angle: angle,
                origin:{
                    originX: originX,
                    originY: originY
                },
                callerId:callerId
            })
            this.notifyUpdate(node, callerId)
        }
    }

    getAngle(id) {
        //ToDo
    }
    //</rotation>

    //ToDo: determine if notifyUpdate should be fired or not
    hide(id, callerId, emit = true) {
        let elem = this.lookup(id);
        this.isOperationAllowed(ACTIONS.hide, elem, callerId);
        
        $(elem).hide();

        if (emit === true) {
            this.emit(ACTIONS.hide, {
                id:elem.id,
                callerId:callerId
            });
            this.notifyUpdate(id, callerId)
        }
    }

    //ToDo: determine if notifyUpdate should be fired or not
    show(id, callerId, emit = true) {
        let elem = this.lookup(id);
        this.isOperationAllowed(ACTIONS.show, elem, callerId);
        
        $(elem).show();
        if (emit === true) {
            this.emit(ACTIONS.show, {
                id:elem.id,
                callerId:callerId
            });
            this.notifyUpdate(id, callerId)
        }
    }

    getComputedStyle(node, properties) {
        node = this.lookup(node)
        let computedStyle = window.getComputedStyle(node)
        
        let result = {}
        for (const prop of (properties || computedStyle)) {
            result[prop] = computedStyle[prop]
        }
        return result
    }

    //[TODO]: permissions
    styleChild(child, style, callerId, emit = true) {
        let computedStyle = window.getComputedStyle(child)
        for (const [tag, value] of Object.entries(style)) {
            if (Container.isFunction(value)) {
                let computedValue = value.call(this, computedStyle.getPropertyValue(tag))
                child.style.setProperty(tag, computedValue)
            } else {
                child.style.setProperty(tag, value) //important
            }
        }

        if(emit === true) {
            this.emit(ACTIONS.update, {
                id:child.id, 
                changes:{"computedStle":style}, 
                callerId:callerId})
        }
    }

    //[TODO]: permissions
    removeStyle(child, style, callerId, emit = true) {
        if (typeof style !== 'object') {
            return;
        }

        for (const [tag, value] of Object.entries(style)) {
            let currentValue = child.style.getPosition(tag)
            if (value == null || value == currentValue) {
                child.style.removeProperty(tag)
            }
        }

        if(emit === true) {
            this.emit(ACTIONS.update, {
                id:child.id, 
                changes:{"computedStle":style}, 
                callerId:callerId})
        }        
    }

    getChildAt(parentId, index) {
        let parent = this.lookup(parentId)
        if (index < 0 || index >= parent.childNodes.length) {
            return undefined;
        }

        return parent.childNodes[index]
    }

    getSiblingPosition(siblingId) {
        let sibling = this.lookup(siblingId)
        let parent = this.getParent(sibling)
        if (parent) {
            for ( let i = 0 ; i < parent.childNodes.length; ++i ) {
                if (parent.childNodes[i].id == sibling.id) {
                    return i;
                }
            }
        }
        return undefined;
    }
    /**
     * 
     * @param {*} siblingId 
     * @param {*} index 
     * @param {*} callerId 
     * @param {*} emit 
     * @returns 
     * 
     * Events per call: 2
     */
    setSiblingPosition(siblingId, index, callerId, emit = true) {
        let sibling = this.lookup(siblingId)
        this.isOperationAllowed(ACTIONS.setSiblingPosition, sibling, callerId);
        let curPos = this.getSiblingPosition(sibling)
        let parent = this.getParent(sibling)
        
        let switchSibling = this.getChildAt(parent, index + ((curPos < index) ? 1 : 0))
        
        if(this.debug) {
            console.log(`Moving ${siblingId} before:`)
            console.log(switchSibling)
        }
        //special case, no move needed
        if (switchSibling == sibling) {
            return;
        }

        parent.removeChild(sibling)
        if (switchSibling) {
            parent.insertBefore(sibling, switchSibling)
        } else {
            parent.appendChild(sibling)
        }

        if (emit === true) {
            this.emit(ACTIONS.setSiblingPosition, {
                id: sibling.id,
                position: index,
                callerId: callerId
            })
            //Child order is stored in the parent
            this.notifyUpdate(this.getParent(sibling), callerId)
        }
    }
    
    /**
     * 
     * @param {*} siblingId 
     * @param {*} amount 
     * @param {*} callerId 
     * @param {*} emit
     * 
     * Events per call: 1 
     */
    changeSiblingPosition(siblingId, amount, callerId, emit = true) {
        let sibling = this.lookup(siblingId)
        let pos = this.getSiblingPosition(sibling)
        this.setSiblingPosition(sibling, pos + amount, callerId, emit)
    }

    /**
     * 
     * @param {*} parentId 
     * @param {*} domNode 
     * @param {*} callerId 
     * @param {*} emit 
     * 
     * Events per call: 1 + hooks
     */
    addDomChild(parentId, domNode, callerId, emit = true) {
        let parent = this.lookup(parentId);
        this.isOperationAllowed(ACTIONS.create, parent, callerId);

        if (domNode) {
            domNode.id = Container.generateUUID(); //pref considerable
            parent.appendChild(domNode);
            this.markChildAsLocalOnlyIfNeeded(parent, domNode)

            this.updateZindexLimits(domNode)
            this.conformToParentRules(domNode)
            this.virtualDOM[domNode.id] = domNode

            if (emit === true) {
                this.emit(ACTIONS.create, {
                    presentationId: this.presentationId, 
                    parentId: parent.id,
                    callerId: callerId,
                    id: domNode.id
                });
            }
        }
    }
    
    /**
     * 
     * @param {*} id 
     * @param {*} callerId 
     * @param {*} emit 
     * 
     * Events per call: 1 + hooks
     */
    delete (id, callerId, emit = true) {
        let child = this.lookup(id)
        this.isOperationAllowed(ACTIONS.delete, child, callerId);

        if (child != this.parent) {
            //remove any local metadata
            this.removeMetadata(child)
            //TODO: remove local permissions if any

            this.getParent(child).removeChild(child);
            if (emit === true) {
                this.emit(ACTIONS.delete, {
                    id: child.id,
                    callerId: callerId
                });
            }
        } else {
            console.log(`A delete attempt was made on the root of the doc. Pls don't...`);
        }
    }

    /**
     * 
     * @param {*} id 
     * @param {*} callerId 
     * @param {*} emit
     * 
     * Events per call: 1 + ? * child_count 
     */
    deleteSparingChildren(id, callerId, emit = true) {
        let elem = this.lookup(id)
        this.isOperationAllowed(ACTIONS.delete, elem, callerId);
        this.isOperationAllowed(ACTIONS.deleteSparingChildren, elem, callerId);

        let parent = this.getParent(elem) || this.parent
        let children = []
        for (const child of elem.children) {
            children.push(child)
        }
        
        for (const child of children) {
            let pos = this.getPosition(child)
            try {
                this.setParent(child, parent, callerId, emit)
                this.setPosition(child, pos, callerId, emit)
            } catch (e) {
                console.log(`core: failed to save child`)
                console.error(e)
            }
        }

        this.delete(elem, callerId, emit)
    }

    updateZindexLimits(node) {
        if (node.style.zIndex) {
            let zIndex = parseInt(node.style.zIndex)
            if (this.#currentMaxZindex < zIndex) {
                this.#currentMaxZindex = zIndex
            }
            if(this.#currentMinZindex > zIndex) {
                this.#currentMinZindex = zIndex
            }
            //console.log(`[CORE] zIndex[${this.#currentMinZindex},${this.#currentMaxZindex}]`)
        } else if (this.#currentMaxZindex  != 0 || this.#currentMinZindex != 0) {
            this.#currentMaxZindex++;
            node.style.zIndex = `${this.#currentMaxZindex}`;
        }
    }

    bringToFront(id, callerId, emit = true) {
        let node = this.lookup(id)
        this.#currentMaxZindex++;
        node.style.zIndex = `${this.#currentMaxZindex}`

        if (emit === true) {
            this.emit(ACTIONS.bringToFront, {
                id: id,
                callerId: callerId
            }) 
            this.notifyUpdate(node, callerId)
        }
    }

    //ToDo: FIX - this makes the container invisitble...
    sendToBottom(id, callerId, emit = true) {
        let node = this.lookup(id)
        this.#currentMinZindex--;
        node.style.zIndex = `${this.#currentMinZindex}` 

        if (emit === true) {
            this.emit(ACTIONS.sendToBack, {
                id: id,
                callerId: callerId
            }) 
            this.notifyUpdate(node, callerId)
        } 
    }

    setZIndex(id, index, callerId, emit = true) {
        let node = this.lookup(id)
        node.style.zIndex = `${index}` 
        if (emit === true) {
            this.notifyUpdate(node, callerId)
        }
    }

    setMetadata (id, key, value) {
        let node = {}
        try {
            node = this.lookup(id)
        } catch (e) {
            return null;
        }

        if (!(node.id in this.localmetadata)) {
            this.localmetadata[node.id] = {}
        }
        this.localmetadata[node.id][key] = value
    }
    
    removeMetadata (id, key) {
        let node = {}
        try {
            node = this.lookup(id)
        } catch (e) {
            return null;
        }

        if (this.localmetadata[node.id]) {
            if (key) {
                delete this.localmetadata[node.id][key]
            } else {
                delete this.localmetadata[node.id]
            }
        }
    }
    
    getMetadata (id, key) {
        let node = {}
        try {
            node = this.lookup(id)
        } catch (e) {
            return null;
        }

        if (this.localmetadata[node.id]) {
            if (key) {
                return this.localmetadata[node.id][key]
            } else {
                return Container.clone(this.localmetadata[node.id])
            }
        }
        return null;
    }

    couldBeTriedOnParent(exception, currentNode) {
        if (this.getMetadata(currentNode, "disallow-try-on-parent") == true) {
            return false;
        }
        return exception instanceof ContainerOperationNotApplicable || exception instanceof ContainerOperationDenied
    }

    denyTryingOnParent(node) {
        try {
            this.setMetadata(node, "disallow-try-on-parent", true)
            return true;
        } catch (e) {
            return false;
        }
    }

    allowTryingOnParent(node) {
        try {
            this.removeMetadata(node, "disallow-try-on-parent")
            return true;
        } catch (e) {
            return false;
        }
    }

    //<events>
    notifyUpdate(id, callerId, subset) {
        // if (!callerId) {
        //     throw `Failed to notifyUpdate, no caller id provided...`
        // }

        let node = (id) ? this.lookup(id) : this.parent
        this.emit(ACTIONS.update, {id:node.id, callerId:callerId, subset:subset})
    }

    static #chainedWork = {}
    static composeOn(event, method) {
        let list = Container.#chainedWork[event] || []
        list.push(method)
        Container.#chainedWork[event] = list
    }

	//ToDo: consider creating an abstraction over the event system. The current solution is a synchronous event system which could start buckling with many listeners and events.
	//Deffered set to true helps with bulk operations.
    //While creating items on screen works super well with defferred = true,
    // updating can be very slow. E.g. moving a 5K content node container on screen works just fine with defferred=false and lags behind with deffered=true
    // - defferred - is an important performance consideration
    emit(type, details, deffered=false) {
        // if (!details.callerId) {
        //     console.error(details)
        //     throw `Missing mandatory caller_id in event ${type}`
        // }
        
        //EXPERIMENTAL
        let chain = Container.#chainedWork[type] || []
        for (let method of chain) {
            try {
                method.apply(this, [details])
            } catch (e) {
                console.error(e)
            }
        }

        details['type'] = type;
		const event = new CustomEvent(type, {
		  bubbles: true,
		  detail: details
		});

        if (deffered) {
            queueWork(this.parent.dispatchEvent, this.parent, [event])
        } else {
            this.parent.dispatchEvent(event);    
        }
        
        //fire related events
        if (ACTIONS_CHAIN[type]) {
            for (const relatedEvent of ACTIONS_CHAIN[type]) {
                this.emit(relatedEvent, 
                    { id:details.id, callerId:details.callerId, original_event:details}, 
                    deffered)
            }
        }
	}

    //ToDo: is this the best way to emit from app?
    appEmit(appId, type, details) {
        this.emit(appId+'.'+type, details); 
    }

    listeners = {}
    addEventListener(event, listener) {
        this.parent.addEventListener(event, listener)
        if (!this.listeners[event]){
            this.listeners[event] = {
                count: 0,
                listeners: []
            }
        }
        this.listeners[event].count++;
        this.listeners[event].listeners.push(listener)
    }

    removeEventListener(event, listener) {
        this.parent.removeEventListener(event, listener)
        this.listeners[event].count--
    }

    listenerStats() {
        return this.listeners
    }
    //</events>
    
    //experimental
    //ToDo: sibling order and other items needing to be saved before removal from DOM tree
    #transactions = {}
    virtualize(node) {
        let parent = this.getParent(node)
        let virtualNode = {
            node: node,
            parentNode: parent
        }
        this.virtualDOM[node.id] = virtualNode

        let children = this.getAllChildren(node)
        for (const child of children) {
            this.virtualize(child)
        }
    }
    //experimental - DO NOT USE
    startTransaction(id, callerId) {
        let node = this.lookup(id)
        let parent = this.getParent(node)
        this.virtualize(node);

        this.#transactions[node.id] = parent
        parent.removeChild(node)
    }

    //experimental
    endTransaction(id) {
        let node = this.lookup(id)
        this.#transactions[node.id].appendChild(node)
        delete this.virtualDOM[node.id]
    }
}

//load persisted permissions when node is created
function loadPermissionsFromDataset(event) {
    this.loadPermissionsFromDataset(this.lookup(event.id, false))
}


Container.composeOn(ACTIONS.create, loadPermissionsFromDataset)
//ToDo: narrow this down
Container.composeOn(ACTIONS.update, loadPermissionsFromDataset)
Container.composeOn(ACTIONS.remoteUpdate, loadPermissionsFromDataset)