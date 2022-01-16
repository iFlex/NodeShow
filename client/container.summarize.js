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

//[TODO]: integrate with other functions to reflect abstraction level. e.g. adding content / set parent / etc to respect abstraction
//[TODO]: think about styling and padding
//[TODO]: Make it work well for non positioned elements. e.g. text
//[TODO]: hook parameters are inconsistent, establish what to do about it
let C_ABS_LVL = 'contentAstractionLevel'
let C_TOT_ABS_LVLS = 'contentTotalAbstractionLevels'
let ABS_LVL = 'abstractionLevel'

/**
 * @summary Increases container's abstraction level
 * @description [TODO]
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object 
 * @param {string} callerId - the name of the caller of this method
 */
Container.prototype.collapse = function(id, callerId) {
    let node = Container.lookup(id)
    let currentLvl = this.getCurrentContentAbstractionLevel(node);
    let maxAbsLevels = this.getAbstractionLevels(node)

    if (currentLvl < maxAbsLevels) {
        this.setCurrentContentAbstractionLevel(node, currentLvl + 1)
        this.notifyUpdate(node)
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
    let node = Container.lookup(id);
    
    let currentLvl = this.getCurrentContentAbstractionLevel(node);
    
    if (currentLvl > 0) {
        this.setCurrentContentAbstractionLevel(node, currentLvl - 1)
        this.notifyUpdate(node)
    }
}

//Create/Delete abstraction levels
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
Container.prototype.createAbstractionLevel = function(c) {
    let node = this.lookup(c);
    let maxAbsLevels = this.getAbstractionLevels(node);
    
    let prevCount = this.getAllInAbstractionLevel(node, maxAbsLevels).length
    if (prevCount == 0) {
        throw `Previous abstraction level is empty, cannot make a new one based on an empty previous`
    }

    node.dataset[C_TOT_ABS_LVLS] = maxAbsLevels + 1
    this.notifyUpdate(node)
    return maxAbsLevels
}

/**
 * @summary Removes a given abstraction level from a given container
 * @description Note: this is not the most efficient way to do it at the moment.
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object 
 * @param {number} level - The index of the abstraction level to remove
 */
Container.prototype.removeAbstractionLevel = function(c, lvl) {
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
    this.notifyUpdate(node)
}

/**
 * @summary Removes all abstraction level from a given container
 * @description Effectively the container will on longer have any abstraction.
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object 
 */
Container.prototype.removeAllAbstraction = function(c) {
    let node = this.lookup(c);

    node.dataset[C_TOT_ABS_LVLS] = 0;
    node.dataset[C_ABS_LVL] = 0
    removeAll(this, node)
    this.notifyUpdate(node)
}

//Content abstraction level
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

    node.dataset[C_ABS_LVL] = lvl

    updateDisplayedAbstractionLevel(this, node, lvl)
    this.notifyUpdate(node)
}

/**
 * @summary Gets the current abstraction level for this container's content.
 * @description [TODO]
 * @param {(string|DOMReference)} id - The id (or DOM Reference) of the DOM Object
 * @returns {number} The current abstraction level of the given container
 */
Container.prototype.getCurrentContentAbstractionLevel = function(c) {
    let node = this.lookup(c);
    return parseInt(node.dataset[C_ABS_LVL] || 0)
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

//Container abstraction level
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
        throw `Abstraction level ${lvl} out of bounds [${0}:${maxAbsLevels}]`
    }
    
    if (lvl > 0) {
        let targetLvlCount = this.getAllInAbstractionLevel(node.parentNode, lvl).length
        let prevLvlCount = this.getAllInAbstractionLevel(node.parentNode, lvl - 1).length
        
        if (targetLvlCount + 1 > prevLvlCount) {
            throw `Cannot make abstraction level contain more nodes than its previous abstraction level`
        }
    }

    node.dataset[ABS_LVL] = lvl
    if (lvl == this.getCurrentContentAbstractionLevel(node.parentNode)) {
        this.show(node)
    } else {
        this.hide(node)
    }
    this.notifyUpdate(node)
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

Container.registerPreSetterHook('setParent', function(node) {
    if (this.getAbstractionLevel(node) > 0) {
        throw `Not allowed to change ownership of abstraction level content`
    }
});

//[TODO]: figure out what causes the event look feedback
//[TODO]: set abstraction level according to parent when changing parents
Container.registerPostSetterHook('new', setUnignorableDataFields);
Container.registerPostSetterHook('create', applyAbstractionView);
//Container.registerPostSetterHook('update', applyAbstractionViewOnUpdate);

function applyAbstractionView(pid, node) {
    //content abstraction
    let maxLvl = this.getAbstractionLevels(node)
    if (maxLvl > 0) {
        let lvl = this.getCurrentContentAbstractionLevel(node)
        updateDisplayedAbstractionLevel(this, node, lvl)
    }

    //set current abstraction level based on the parent if abstraction level absent
    let currentLevel = this.getAbstractionLevel(node)
    let parentContentAbstractionLevel = this.getCurrentContentAbstractionLevel(pid)
    if (currentLevel == 0 && parentContentAbstractionLevel > 0) {
        this.setAbstractionLevel(node, parentContentAbstractionLevel)
    }
}

function applyAbstractionViewOnUpdate(node) {
    applyAbstractionView.apply(this, [null, node])
}

function setUnignorableDataFields() {
    if (typeof this.serializerCannotIgnore === 'function') {
        this.serializerCannotIgnore('data',C_ABS_LVL)
        this.serializerCannotIgnore('data',C_TOT_ABS_LVLS)
        this.serializerCannotIgnore('data',ABS_LVL)
    }
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
}

function updateDisplayedAbstractionLevel(ctx, node, lvl) {
    for (const child of node.children) {
        if (lvl == ctx.getAbstractionLevel(child)) {
            ctx.show(child)
        } else {
            ctx.hide(child)
        }
    }

    //[TODO]: experimental
    ctx.fitVisibleContent(node, false)
}