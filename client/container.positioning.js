import { Container, ACTIONS } from "./Container.js"
import { ContainerOperationNotApplicable } from './ContainerExcepitons.js'
import { inferUnit } from "./UnitConverter.js"

const POSITIONABLE = new Set(['absolute','relative','fixed'])

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

function findAbsPos(obj, stopNode) {
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
        var pos = findAbsPos(obj.offsetParent, stopNode);
        curleft += pos[0];
        curtop += pos[1];
    } else if(obj.ownerDocument) {
        var thewindow = obj.ownerDocument.defaultView;
        if(!thewindow && obj.ownerDocument.parentWindow)
            thewindow = obj.ownerDocument.parentWindow;
        if(thewindow) {
            if(thewindow.frameElement) {
                var abspos = findAbsPos(thewindow.frameElement, stopNode);
                curleft += abspos[0];
                curtop += abspos[1];
            }
        }
    }

    return [curleft,curtop];
}
    
//[TODO]: get rid of this function
function findAbsolutePosition(obj, container) {
    //return findAbsPos(obj, (container.camera)?container.camera.getSurface():container.parent)
    return findAbsPos(obj)
}

Container.prototype.localToGlobalPosition = function(id, x, y) {
    let node = this.lookup(id)
    let pos = findAbsolutePosition(node, this)
    return {x: pos[0] + x, y: pos[1] + y}
}

Container.prototype.getTopCornerMargin = function(element) {
    let style = window.getComputedStyle(element);
    let marginTop = style.marginTop;
    let marginLeft = style.marginLeft;
    let topUnit = inferUnit(marginTop);
    let leftUnit = inferUnit(marginLeft);

    if (topUnit == '%') {
        marginTop = this.getHeight(element) * marginTop / 100 
    }
    if (leftUnit == '%') {
        marginLeft = this.getWidth(element) * marginLeft / 100
    }

    return {top: parseInt(marginTop.replace(topUnit,""),10), left: parseInt(marginLeft.replace(leftUnit,""))}
}

/**
 * @summary Sets a container's position
 * @description Position reference is always absolute pixels, the setPosition makes the translation to relative, percent or other types of positioning
There should be an option to force absolute positioning force:true passed in the position argument
ToDo: fix bug where absolute % doesn't work - caused by the height % being calculated as a lot lower than it should be
    - seems like the page width and height that % calculations use are based on maybe viewport percentages rather than the actual document.body
    - the bug behaves differently depending on the final size of document.body (parent)
ToDo: support more position types
 Absolute position is absolute in the sense that each element's origin point is the top left of its parent element. (margin and border and padding can push that lower) 
 * @param {string} id - The id (or DOM Reference) of the DOM Object 
 * @param {object} position - object describing the new intended position
 * @param {string} callerId - the name of the caller of this method
 */
Container.prototype.setPosition = function(id, position, callerId, force = false) {
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
    let parentPos = this.getPosition(elem.parentNode || this.parent)
    position.top -= parentPos.top
    position.left -= parentPos.left
    
    //remove margin offset
    let margins = this.getTopCornerMargin(elem, position)
    position.top -= margins.top
    position.left -= margins.left

    //use origin based placement
    position.left -= (position.originX || 0) * this.getWidth(elem)
    position.top -= (position.originY || 0) * this.getHeight(elem)

    let leftUnit = elem.dataset.leftUnit || 'px'
    let topUnit = elem.dataset.topUnit  || 'px'
    position = this.convertPixelPos(elem, position, {top:topUnit, left:leftUnit})

    jQuery(elem).css({top: `${position.top}${topUnit}`, left: `${position.left}${leftUnit}`});
    this.emit(ACTIONS.setPosition, {
        id: elem.id, 
        position: position,
        callerId: callerId
    });
}

/**
 * @summary Returns the absolute pixel position of the DOM element referenced by the argument.
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
Container.prototype.move = function(id, dx, dy, callerId) {
    let pos = this.getPosition(id)
    pos.top += dy;
    pos.left += dx;
    this.setPosition(id, pos, callerId)
}

Container.prototype.setPositionUnits = function(id, units, callerId) {
    this.setUnit(id, "topUnit", units.top)
    this.setUnit(id, "leftUnit", units.left)
    let pos = this.getPosition(id)
    this.setPosition(id, pos, callerId)
}

Container.prototype.canPosition = function(id) {
    let node = this.lookup(id)
    return POSITIONABLE.has(node.style.position)
}