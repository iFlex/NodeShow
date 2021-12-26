import {Container, ACTIONS} from "./Container.js"
/**
 * Container Abstraction.
 * 
 * Extension allowing you to have multiple layers of abstraction for a container's content.
 * This means you can add content to a container and then abstract it away / summarize it, so not all the 
 * detail will be visible.
 * 
 * With this functionality you can:
 * * Create / Delete abstraction layers
 * * Get/Set content's abstraction layer (default = 0, which is root and equates to no abstraction)
 * * Get/Set the container's current abstration layer
 *   - this determines what will be visible within the container
 * 
 * 
 * Implementation details
 *  Container stores what abstraction content abstraction layer it is displaying via data-contentAbstractionLayer. Defailt = 0 (no Abstraction)
 *  Container stores what abstraction layer it belongs to via data-abstractionLayer. Default = 0 (no abstraction)
 * 
 * Add ability to fit content when compressing. Store previou style in memory maybe.
 * Test removal functions
 * */

//[TODO]: disallow empty abstraction layers other than the topmost one
//[TODO]: integrate with other functions to reflect abstraction level. e.g. adding content / set parent / etc to respect abstraction

let C_ABS_LVL = 'contentAstractionLevel'
let C_TOT_ABS_LVLS = 'contentTotalAbstractionLevels'
let ABS_LVL = 'abstractionLevel'

Container.prototype.collapse = function(id, callerId) {
    let node = Container.lookup(id)
    let currentLvl = this.getCurrentContentAbstractionLevel(node);
    let maxAbsLevels = this.getAbstractionLevels(node)

    if (currentLvl < maxAbsLevels) {
        this.setCurrentContentAbstractionLevel(node, currentLvl + 1)
        return true;
    } 
    return false;
}

Container.prototype.expand = function(id, callerId) {
    let node = Container.lookup(id);
    
    let currentLvl = this.getCurrentContentAbstractionLevel(node);
    let maxAbsLevels = this.getAbstractionLevels(node)

    if (currentLvl > 0) {
        this.setCurrentContentAbstractionLevel(node, currentLvl - 1)
    }
}

//Create/Delete abstraction levels
Container.prototype.getAbstractionLevels = function(c) {
    let node = this.lookup(c);
    return parseInt(node.dataset[C_TOT_ABS_LVLS] || 0)
}

Container.prototype.createAbstractionLevel = function(c) {
    let node = this.lookup(c);
    let maxAbsLevels = this.getAbstractionLevels(node);
    
    let prevCount = this.getAllInAbstractionLevel(node, maxAbsLevels).length
    if (prevCount == 0) {
        throw `Previous abstraction layer is empty, cannot make a new one based on an empty previous`
    }

    node.dataset[C_TOT_ABS_LVLS] = maxAbsLevels + 1
    return maxAbsLevels
}

/**
 * Removes one abstraction level from given container
 * Note: this is not the most efficient way to do it at the moment.
 */
Container.prototype.removeAbstractionLevel = function(c, lvl) {
    let node = this.lookup(c);
    let maxAbsLevels = this.getAbstractionLevels(node);

    if (lvl < 0 || lvl > maxAbsLevels) {
        throw `Abstraction level ${lvl} out of bounds [${0}:${maxAbsLevels}]`
    }

    removeLevel(this, node, lvl)
    for ( i = lvl + 1; i <= maxAbsLevels; ++i ){
        let toTranslate = this.getAllInAbstractionLevel(node, i)
        for (const child of toTranslate) {
            this.setAbstractionLevel(child, i - 1)
        }
    }
}

/**
 * This will remove all children with abstraction levels other than 0. 
 * Effectively the container will have no content abstraction left
*/
Container.prototype.removeAllAbstraction = function(c) {
    let node = this.lookup(c);

    node.dataset[C_TOT_ABS_LVLS] = 0;
    node.dataset[C_ABS_LVL] = 0
    removeAll(this, node)
}

//Content abstraction level
/**
 * Sets the current abstraction level for this container's content.
 * In other words any child of this container that has the abstraction level equal to the 2nd argument (lvl) will be displayed
 * and all others hidden
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

Container.prototype.getCurrentContentAbstractionLevel = function(c) {
    let node = this.lookup(c);
    return parseInt(node.dataset[C_ABS_LVL] || 0)
}

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
* Sets the abstraction level of the given container. 
* This can cause it to be hidden or displayed depending if it matches with the current content abstraction level or its parent. 
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

Container.prototype.getAbstractionLevel = function(c) {
    let node = this.lookup(c);
    return parseInt(node.dataset[ABS_LVL] || 0)
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
    let bounding = {
        top: null,
        left: null,
        botton: 0,
        right: 0
    }

    for (const child of node.children) {
        if (lvl == ctx.getAbstractionLevel(child)) {
            ctx.show(child)
        } else {
            ctx.hide(child)
        }
    }
    
    //[TODO]: make node fit content + styling application
}