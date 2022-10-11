import {Container, ACTIONS} from "./Container.js"
/**
 * Container Abstraction.
 * 
 * Extension allowing you to have multiple levels of abstraction for a container's content.
 * This means you can add content to a container and then abstract it away / summarize it, so not all the 
 * detail will be visible.
 * 
 * With this functionality you can:
 * * Create / Delete abstraction levels
 * * Get/Set content's abstraction level (default = 0, which is root and equates to no abstraction)
 * * Get/Set the container's current abstration level
 *   - this determines what will be visible within the container
 * 
 * 
 * Implementation details
 *  Container stores what abstraction content abstraction level it is displaying via data-contentAbstractionLevel. Defailt = 0 (no Abstraction)
 *  Container stores what abstraction level it belongs to via data-abstractionLevel. Default = 0 (no abstraction)
 * 
 * Add ability to fit content when compressing. Store previou style in memory maybe.
 * Test removal functions
 */

//[TODO]: figure out what properties to save regarding the style of each level. Some properties will be global (i.e. position) some local (i.e. width, height, background colour)
//        - we'll start by just persisting width and height and nothing else.
let C_ABS_LVL = 'contentAstractionLevel'
let C_TOT_ABS_LVLS = 'contentTotalAbstractionLevels'
let LAYER_STYLE_PREFIX = 'abstractionLevelStyle'
let RELEVANT_STYLE_SUBSET = new Set(['width','height'])
let ABS_LVL = 'abstractionLevel'
let VISUALISATION_ELEMENT_SUFFIX = "-abstraction-level-viz"

/**
 * @summary Increases container's abstraction level
 * @description [TODO]
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object 
 * @param {string} callerId - the name of the caller of this method
 */
Container.prototype.collapse = function(id, callerId) {
    let node = this.lookup(id)
    let currentLvl = this.getCurrentContentAbstractionLevel(node);
    let maxAbsLevels = this.getAbstractionLevels(node)

    if (currentLvl < maxAbsLevels) {
        this.setCurrentContentAbstractionLevel(node, currentLvl + 1, callerId)
        this.notifyUpdate(node, callerId)
        return true;
    } 
    return false;
}

/**
 * @summary Lowers container's abstraction level
 * @description [TODO]
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object 
 * @param {string} callerId - the name of the caller of this method
 */
Container.prototype.expand = function(id, callerId) {
    let node = this.lookup(id);
    
    let currentLvl = this.getCurrentContentAbstractionLevel(node);
    
    if (currentLvl > 0) {
        this.setCurrentContentAbstractionLevel(node, currentLvl - 1, callerId)
        this.notifyUpdate(node, callerId)
    }
}

/**
 * @summary Saves the container's current style as the current layer's style
 * */
Container.prototype.persistLevelStyle = function(node, callerId, emit)  {
    let style = this.toSerializableStyle(node, true, RELEVANT_STYLE_SUBSET)
    let level = this.getCurrentContentAbstractionLevel(node)

    this.saveStyleForLevel(node, style, level, callerId, emit)
}

/**
 * @summary Persists a provided style configuration for a provided abstraction level
 * @param {ID or Node} id - The node for which this style is persisted
 * @param {Map} style - The style configuration to serialise and persist 
 * @param {integer} level - the abstraction level for which to persist the provided style
 * @param {CallerId} callerId - the id of the caller of this method
 * 
 * TODO: ensure style object only contains the RELEVANT_STYLE_SUBSET properties
 * */
Container.prototype.saveStyleForLevel = function(id, style, level, callerId, emit = true)  {
    let node = this.lookup(id);
    let filteredStyle = {}
    for (const key of RELEVANT_STYLE_SUBSET) {
        filteredStyle[key] = style[key]
    }

    node.dataset[`${LAYER_STYLE_PREFIX}${level}`] = JSON.stringify(filteredStyle)
    if (emit) {
        this.notifyUpdate(node, callerId)
    }
}

/**
 * @summary Fetch an abstraction layer specific style configuration
 * @param {Node} node - The node for which to fetch the level style
 * @param {integer} level - the level
 * */
Container.prototype.fetchStyleForLevel = function(node, level) {
    let rawStyle = node.dataset[`${LAYER_STYLE_PREFIX}${level}`]
    if (rawStyle) {
        return JSON.parse(rawStyle)
    }
}

/**
 * @summary Applies the style corresponding to the current abstraction layer to the a container
 * */
Container.prototype.loadStyleForCurrentLevel = function(id, callerId, emit = true) {
    let node = this.lookup(id);
    let level = this.getCurrentContentAbstractionLevel(node)
    let style = this.fetchStyleForLevel(node, level)
    if (style) {
        this.styleChild(node, style, callerId, emit)
    }
}

/**
 * @summary Gets container's abstraction level count
 * @description [TODO]
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object 
 * @return {number} number of abstraction levels 
 */
Container.prototype.getAbstractionLevels = function(c) {
    let node = this.lookup(c);
    return parseInt(node.dataset[C_TOT_ABS_LVLS] || 0)
}

/**
 * @summary Creates a new abstraction level for a given container
 * @description [TODO]
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object 
 */
Container.prototype.createAbstractionLevel = function(c, callerId) {
    let node = this.lookup(c);
    let maxAbsLevels = this.getAbstractionLevels(node);
    
    let prevCount = this.getAllInAbstractionLevel(node, maxAbsLevels).length
    if (prevCount == 0) {
        throw `Previous abstraction level is empty, cannot make a new one based on an empty previous`
    }

    node.dataset[C_TOT_ABS_LVLS] = maxAbsLevels + 1
    updateAbstractionVisualisation(this, node, callerId)
    this.notifyUpdate(node, callerId)
    return maxAbsLevels
}

/**
 * @summary Removes a given abstraction level from a given container
 * @description Note: this is not the most efficient way to do it at the moment.
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object 
 * @param {number} level - The index of the abstraction level to remove
 */
Container.prototype.removeAbstractionLevel = function(c, lvl, callerId) {
    let node = this.lookup(c);
    let maxAbsLevels = this.getAbstractionLevels(node);

    if (lvl < 0 || lvl > maxAbsLevels) {
        throw `Abstraction level ${lvl} out of bounds [${0}:${maxAbsLevels}]`
    }

    removeLevel(this, node, lvl)
    for (var i = lvl + 1; i <= maxAbsLevels; ++i ){
        let toTranslate = this.getAllInAbstractionLevel(node, i)
        for (const child of toTranslate) {
            this.setAbstractionLevel(child, i - 1)
        }
    }
    this.notifyUpdate(node, callerId)
}

/**
 * @summary Removes all abstraction level from a given container
 * @description Effectively the container will on longer have any abstraction.
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object 
 */
Container.prototype.removeAllAbstraction = function(c, callerId) {
    let node = this.lookup(c);

    node.dataset[C_TOT_ABS_LVLS] = 0;
    node.dataset[C_ABS_LVL] = 0
    removeAll(this, node)
    this.notifyUpdate(node, callerId)
}

/**
 * @summary Sets the current abstraction level for this container's content.
 * @description In other words any child of this container that has the abstraction level equal to the 2nd argument (lvl) will be displayed
 * and all others hidden
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object
 * @params {number} level - The index of the abstraction level to switch to
 * @params {string} callerId - the name of the caller of this method
 */
Container.prototype.setCurrentContentAbstractionLevel = function(c, lvl, callerId) {
    let node = this.lookup(c);
    this.isOperationAllowed(ACTIONS.setContentAbstractionLevel, node, callerId);
    
    lvl = parseInt(lvl)
    let maxAbsLevels = this.getAbstractionLevels(node);
    if (lvl < 0 || lvl > maxAbsLevels) {
        throw `Abstraction level ${lvl} out of bounds [${0}:${maxAbsLevels}]`
    }

    if (node.dataset[C_ABS_LVL] != lvl) {
        this.persistLevelStyle(node, callerId, false)    
    }

    node.dataset[C_ABS_LVL] = lvl
    updateDisplayedAbstractionLevel(this, node, lvl, callerId)
    this.notifyUpdate(node, callerId)
}

/**
 * @summary Gets the current abstraction level for this container's content.
 * @description [TODO]
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object
 * @returns {number} The current abstraction level of the given container
 */
Container.prototype.getCurrentContentAbstractionLevel = function(c) {
    try {
        let node = this.lookup(c);
        return parseInt(node.dataset[C_ABS_LVL] || 0)
    } catch (e) {
        return 0;
    }
}

/**
 * @summary Retrieves a list of containers from a container's abstraction level.
 * @description [TODO]
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object
 * @param {number} level - abstraction level
 * @returns {array} array of container references comprising the abstraction level
 */
Container.prototype.getAllInAbstractionLevel = function(c, lvl) {
    let node = this.lookup(c);
    let result = []
    for (const child of node.children) {
        if (this.getAbstractionLevel(child) == lvl) {
            result.push(child)
        }
    }

    return result
}

/**
 * @summary Sets the abstraction level a container belongs to.
 * @description This can cause it to be hidden or displayed depending if it matches with the current content abstraction level or its parent.
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object
 * @param {number} level - abstraction level
 * @param {string} callerId - id of the caller of this method
 * @returns {array} array of container references comprising the abstraction level
 */
Container.prototype.setAbstractionLevel = function(c, lvl, callerId) {
    let node = this.lookup(c);
    this.isOperationAllowed(ACTIONS.setAbstractionLevel, node, callerId);

    if (node == this.parent) {
        throw `Cannot abstract away the root node`
    }

    lvl = parseInt(lvl)
    let maxAbsLevels = this.getAbstractionLevels(node.parentNode);
    if (lvl < 0 || lvl > maxAbsLevels) {
        let cap = Mat.min(Math.max(0, lvl), maxAbsLevels)
        console.error(`Abstraction level ${lvl} out of bounds [${0}:${maxAbsLevels}]. Capped at: ${cap}`)
        lvl = cap
    }
    
    if (lvl > 0) {
        let targetLvlCount = this.getAllInAbstractionLevel(node.parentNode, lvl).length
        let prevLvlCount = this.getAllInAbstractionLevel(node.parentNode, lvl - 1).length
        
        if (targetLvlCount + 1 > prevLvlCount) {
            console.error(`Cannot make abstraction level contain more nodes than its previous abstraction level. Defaulting to lowest level (0).`)
            lvl = 0;
        }
    }

    node.dataset[ABS_LVL] = lvl
    if (lvl == this.getCurrentContentAbstractionLevel(node.parentNode)) {
        this.show(node)
    } else {
        this.hide(node)
    }
    this.notifyUpdate(node, callerId)
}

/**
 * @summary Gets the abstraction level a container belongs to.
 * @description [TODO] 
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object
 * @returns {number} container's abstraction level
 */
Container.prototype.getAbstractionLevel = function(c) {
    let node = this.lookup(c);
    return parseInt(node.dataset[ABS_LVL] || 0)
}

//[TODO]: check if events are still leaking
Container.registerPostSetterHook('new', setUnignorableDataFields);
Container.registerPostSetterHook('create', applyAbstractionView);
Container.registerPostSetterHook('setParent', setChildAbsLevelToParentContentAbsLevel);
Container.registerPostSetterHook('update', applyAbstractionViewOnUpdate);

//[TODO]: think of what to do when child already has an abstraction level but is out of bounds of the parent?
function setChildAbsLevelToParentContentAbsLevel(child, parent, callerId, ignore, ignore2) {
    //set current abstraction level based on the parent if abstraction level absent
    let parentContentAbstractionLevel = this.getCurrentContentAbstractionLevel(parent)
    if (parentContentAbstractionLevel > 0 && this.isContainerReady(parent)) {
        //if parent is complete, then it override's child's abstraction level
        this.setAbstractionLevel(child, parentContentAbstractionLevel, callerId)
    }

    return 1
}

function applyAbstractionView(pid, node, callerId) {
    //content abstraction
    let maxLvl = this.getAbstractionLevels(node)
    if (maxLvl > 0) {
        let lvl = this.getCurrentContentAbstractionLevel(node)
        updateDisplayedAbstractionLevel(this, node, lvl, callerId)
    }

    return setChildAbsLevelToParentContentAbsLevel.apply(this, [node, pid, callerId, null, null])
}

function applyAbstractionViewOnUpdate(node, rawDescriptor, callerId, emit) {
    return applyAbstractionView.apply(this, [node.parentNode.id, node, callerId])
}

function setUnignorableDataFields() {
    if (typeof this.serializerCannotIgnore === 'function') {
        this.serializerCannotIgnore('data',C_ABS_LVL)
        this.serializerCannotIgnore('data',C_TOT_ABS_LVLS)
        this.serializerCannotIgnore('data',ABS_LVL)
    }
    return 1
}

function removeAll(ctx, node) {
    for (const child of node.children) {
        let alvl = ctx.getAbstractionLevel(child)
        if (alvl != 0) {
            ctx.delete(child)
        }
    }
}

function removeLevel(ctx, node, lvl) {
    for (const child of node.children) {
        let alvl = ctx.getAbstractionLevel(child)
        if (alvl == lvl) {
            ctx.delete(child)
        }
    }
    updateAbstractionVisualisation(ctx, node, callerId)
}

function updateDisplayedAbstractionLevel(ctx, node, lvl, callerId) {
    let ignoreAbstractionVisualiserId = node.id + VISUALISATION_ELEMENT_SUFFIX;
    ctx.loadStyleForCurrentLevel(node, callerId, false)
    for (const child of node.children) {
        if (lvl == ctx.getAbstractionLevel(child) || child.id == ignoreAbstractionVisualiserId) {
            ctx.show(child, callerId)
        } else {
            ctx.hide(child, callerId)
        }
    }
    updateAbstractionVisualisation(ctx, node, callerId)
}

function createAbstractionVisualisation(container, target, callerId) {
    let bayDescriptor = {
        nodeName:"DIV",
		id: target.id + VISUALISATION_ELEMENT_SUFFIX,
        className:"container-abstraction-visualizer",
        computedStyle:{
            "position":"static",
            "width":"auto",
            "height":"auto"
        }
    }
    let barDescriptor = {
        nodeName:"DIV",
		className:"container-abstraction-visualizer-status",
        computedStyle:{
            "position":"static",
        }
    }
    
    let child = container.createFromSerializable(target, bayDescriptor, null, callerId)
    container.createFromSerializable(child, barDescriptor, null, callerId);
    container.setSiblingPosition(child, 0, callerId)
    container.show(child, callerId) //override abstraction hiding it away
    return child;
}

function lookupAbstractionvisualisation(container, target, callerId) {
    try {
        return container.lookup(target.id + VISUALISATION_ELEMENT_SUFFIX);
    } catch (e) {
        return createAbstractionVisualisation(container, target, callerId);
    }
}

//ToDo: figure out what to do if you paste an abstracted container...
function updateAbstractionVisualisation(container, target, callerId) {
    let totalLevels = container.getAbstractionLevels(target)
    let currentLevel = container.getCurrentContentAbstractionLevel(target)
    let visualisation = lookupAbstractionvisualisation(container, target, callerId)

    let percent = 1 - (currentLevel/totalLevels)
    container.setSiblingPosition(visualisation, 0, callerId)
    container.setExplicitWidth(visualisation.firstChild, percent * 100, "%", callerId, false)
}