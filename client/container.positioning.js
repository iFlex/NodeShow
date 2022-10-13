import { Container, ACTIONS } from "./Container.js"
import { ContainerOperationNotApplicable } from './ContainerExcepitons.js'

const POSITIONABLE = new Set(['absolute','relative','fixed', 'sticky'])
/**
 * ToDo: - check if it passes the get then set test where the position shouldn't change.
 *       - look into getBoundingClientRect()'s viewport perspective. i.e. will it work with transforms? 
 *         do we need special changes for the camera?
 * 
 * BUG: When using setPosition the border of the target element can offset the positioning
 * BUG: Scrolled root messes with position, for some friggin reason (despite getBoundingClientRect() claiming to take that into account...)
*/

//Old and problematic. Should be retired
/** This is a description of the foo function. */
//Stolen from stack overflow because I was hoping to get this directly from the browser somehow.
//ToDo: find a way to simplify this
var getStyle = function(e, styleName) {
  var styleValue = "";
  if (document.defaultView && document.defaultView.getComputedStyle) {
    styleValue = document.defaultView.getComputedStyle(e, "").getPropertyValue(styleName);
  } else if (e.currentStyle) {
    styleName = styleName.replace(/\-(\w)/g, function(strMatch, p1) {
      return p1.toUpperCase();
    });
    styleValue = e.currentStyle[styleName];
  }
  return parseInt(styleValue, 10);
}

function findAbsPosSlow(obj, stopNode) {
    var curleft = 0;
    var curtop = 0;
    if(obj.offsetLeft) curleft += parseInt(obj.offsetLeft) + getStyle(obj, 'border-left-width');
    if(obj.offsetTop) curtop += parseInt(obj.offsetTop) + getStyle(obj, 'border-top-width');
    if(obj.scrollTop && obj.scrollTop > 0) curtop -= parseInt(obj.scrollTop);
    if(obj.scrollLeft && obj.scrollLeft > 0) curleft -= parseInt(obj.scrollLeft);
    if(stopNode && obj == stopNode) {
        return [curleft, curtop]
    }

    if(obj.offsetParent) {
        var pos = findAbsPosSlow(obj.offsetParent, stopNode);
        curleft += pos[0];
        curtop += pos[1];
    } else if(obj.ownerDocument) {
        //console.log("ownerDocument")
        var thewindow = obj.ownerDocument.defaultView;
        if(!thewindow && obj.ownerDocument.parentWindow) {
            //console.log("parentWindow")
            thewindow = obj.ownerDocument.parentWindow;
        }
        if(thewindow) {
            //console.log("noParentWindow")
            if(thewindow.frameElement) {
                //console.log("frame elem")
                var abspos = findAbsPosSlow(thewindow.frameElement, stopNode);
                curleft += abspos[0];
                curtop += abspos[1];
            }
        }
    }

    return [curleft,curtop];
}


function readAsPixels(stringValue) {
    if (stringValue.endsWith('px')) {
        return parseFloat(stringValue.substring(0, stringValue.length - 2))
    }

    console.error(`Failed to read string value ${stringValue} as pixels`)
    return 0;
}

//operates in pixels only
/**
 * This positioning system uses a root container as a reference frame. This container is configurable via parameter and by default it is the document root.
   The deeper the document, the slower these methods will be. In the future a workaround that uses the browser's internal computations for positioning should be used
   rather than compute them in Javascript's Runtime Env.
 */
function findAbsPos(obj, pos = [0,0]) {
    if(!obj || !obj.getBoundingClientRect) {
        return pos //[null, null]
    }

    let bbox = obj.getBoundingClientRect()
    pos[0] += bbox.left
    pos[1] += bbox.top
    return pos
}
   
function findAbsolutePosition(obj, container) {
    let pos = findAbsPos(obj)
    return pos
}


//TODO: imperfect, this assumes equal border/parring/margin
Container.prototype.getRelativePositionOffset = function(node) {
    let style = window.getComputedStyle(node, null)
    let pleft = readAsPixels(style.getPropertyValue('padding-left'))
    let ptop = readAsPixels(style.getPropertyValue('padding-top'))
    let bleft = readAsPixels(style.getPropertyValue('border-left-width'))
    let btop = readAsPixels(style.getPropertyValue('border-top-width'))
    
    return {dx: pleft + bleft, dy: ptop + btop}
}

//[TODO]: fix
Container.prototype.localToGlobalPosition = function(id, x, y) {
    let node = this.lookup(id)
    let result = findAbsPos(node, [x,y])
    return {left: result[0], top: result[1]}
}

/**
 * @summary Sets a container's position
 * @description Position reference is always absolute pixels (absolute with the origin being the main vewport: i.e. the screen), 
 * the setPosition makes the translation to relative, percent or other types of positioning
   There should be an option to force absolute positioning force:true passed in the position argument
   ToDo: fix bug where absolute % doesn't work - caused by the height % being calculated as a lot lower than it should be
    - seems like the page width and height that % calculations use are based on maybe viewport percentages rather than the actual document.body
    - the bug behaves differently depending on the final size of document.body (parent)
   ToDo: support more position types
   Browser absolute position is absolute in the sense that each element's origin point is the top left of its parent element. (margin and border and padding can push that lower) 
   
 * @param {string} id - The id (or DOM Reference) of the DOM Object 
 * @param {object} position - object describing the new intended position
 * @param {string} callerId - the name of the caller of this method
 */

   //ToDo: check if anyone calls setPosition with force.
Container.prototype.setPosition = function(id, position, callerId, force = false, emit = true) {
    let elem = this.lookup(id);
    this.isOperationAllowed(ACTIONS.setPosition, elem, callerId);
    let positionType = elem.style.position || 'static';
    if (!POSITIONABLE.has(positionType)) {
        if (force) {
            elem.style.position = 'absolute';
        } else {
            throw new ContainerOperationNotApplicable(elem.id, "setPosition")
        }
    }
    //do position translation (even if the positioning is absolute, it still uses the parent x,y as the origin point)
    let parent = this.getParent(elem)
    let parentPos = this.getPosition(parent || this.parent)
    
    //New compensation style
    let offsets = this.getRelativePositionOffset(parent)
    parentPos.top += offsets.dy
    parentPos.left += offsets.dx

    //Convert to relative position with origin=parent
    position.top -= parentPos.top
    position.left -= parentPos.left

    this.setPositionRelative(elem, position, callerId, emit)
}

Container.prototype.setPositionRelative = function(elem, position, callerId, emit = true) {
    //In case the position is percentual:
    position.left -= (position.originX || 0) * this.getWidth(elem)
    position.top -= (position.originY || 0) * this.getHeight(elem)

    //Unit conversion
    let leftUnit = elem.dataset.leftUnit || 'px'
    let topUnit = elem.dataset.topUnit  || 'px'
    position = this.convertPixelPos(elem, position, {top:topUnit, left:leftUnit})

    jQuery(elem).css({top: `${position.top}${topUnit}`, left: `${position.left}${leftUnit}`});

    if (emit === true) {
        this.emit(ACTIONS.setPosition, {
            id: elem.id, 
            position: position,
            callerId: callerId
        });
    }
}

/**
 * @summary Returns the absolute pixel position of the DOM element referenced by the argument. The reference for the absolute position is the main viewport i.e. the screen
 * @description [TODO]
 * @param {string} id - The id (or DOM Reference) of the DOM Object
 * @returns the position of the referenced container. 
 */
Container.prototype.getPosition = function(id) {
    let node = this.lookup(id)
    let p = findAbsolutePosition(node, this)

    return {
        top:p[1],
        left:p[0],
        position:node.style.position, 
        boundingBox:jQuery(node).position(), 
        contextual:{
            top:node.style.top,
            left:node.style.left,
        }
    }
}

/**
 * @summary Moves the DOM element referenced by the first argument.
 * @param {string} id - The id (or DOM Reference) of the DOM Object
 * @param {number} dx - The amount of pixels to move on the x axis (horizontally)
 * @param {number} dy - The amount of pixels to move on the y axis (verticlaly)
 * @param {string} callerId - The identifier of the caller of this method 
 */
Container.prototype.move = function(id, dx, dy, callerId, emit = true) {
    let pos = this.getPosition(id)
    pos.top += dy;
    pos.left += dx;
    this.setPosition(id, pos, callerId, false, emit)
}

Container.prototype.setPositionUnits = function(id, units, callerId, emit = true) {
    this.setUnit(id, "topUnit", units.top, callerId, emit)
    this.setUnit(id, "leftUnit", units.left, callerId, emit)
    let pos = this.getPosition(id)
    this.setPosition(id, pos, callerId, emit)
}

Container.prototype.canPosition = function(id) {
    let node = this.lookup(id)
    return POSITIONABLE.has(node.style.position)
}