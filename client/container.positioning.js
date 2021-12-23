import {Container, ACTIONS} from "./Container.js"

//Stolen from stack overflow because I was hoping to get this directly from the browser somehow.
//ToDo: find a way to simplify this
function findAbsPos(obj) {
    var curleft = 0;
    var curtop = 0;
    if(obj.offsetLeft) curleft += parseInt(obj.offsetLeft);
    if(obj.offsetTop) curtop += parseInt(obj.offsetTop);
    if(obj.scrollTop && obj.scrollTop > 0) curtop -= parseInt(obj.scrollTop);
    if(obj.offsetParent) {
        var pos = findAbsPos(obj.offsetParent);
        curleft += pos[0];
        curtop += pos[1];
    } else if(obj.ownerDocument) {
        var thewindow = obj.ownerDocument.defaultView;
        if(!thewindow && obj.ownerDocument.parentWindow)
            thewindow = obj.ownerDocument.parentWindow;
        if(thewindow) {
            if(thewindow.frameElement) {
                var pos = findAbsPos(thewindow.frameElement);
                curleft += pos[0];
                curtop += pos[1];
            }
        }
    }

    return [curleft,curtop];
}

Container.prototype.getTopCornerMargin = function(element) {
    let style = window.getComputedStyle(element);
    let marginTop = style.marginTop;
    let marginLeft = style.marginLeft;
    let topUnit = this.detectUnit(marginTop);
    let leftUnit = this.detectUnit(marginLeft);

    if (topUnit == '%') {
        marginTop = this.getHeight(element) * marginTop / 100 
    }
    if (leftUnit == '%') {
        marginLeft = this.getWidth(element) * marginLeft / 100
    }

    return {top: parseInt(marginTop.replace(topUnit,""),10), left: parseInt(marginLeft.replace(leftUnit,""))}
}

/* 
Position reference is always absolute pixels, the setPosition makes the translation to relative, percent or other types of positioning
There should be an option to force absolute positioning force:true passed in the position argument
ToDo: fix bug where absolute % doesn't work - caused by the height % being calculated as a lot lower than it should be
    - seems like the page width and height that % calculations use are based on maybe viewport percentages rather than the actual document.body
    - the bug behaves differently depending on the final size of document.body (parent)
ToDo: support more position types
 Absolute position is absolute in the sense that each element's origin point is the top left of its parent element. (margin and border and padding can push that lower)
*/
Container.prototype.setPosition = function(id, position, callerId) {
    let elem = Container.lookup(id);
    this.isOperationAllowed(ACTIONS.setPosition, elem, callerId);

    let posType = elem.style.position 
    
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

    let xUnit = position.leftUnit || this.detectUnit(elem.style.left) || this.detectUnit(elem.style.right) || 'px'
    let yUnit = position.topUnit || this.detectUnit(elem.style.top) || this.detectUnit(elem.style.bottom) || 'px'
    
    if (xUnit == '%') {
        position.left = parseFloat(position.left) / this.getWidth(elem.parentNode || this.parent)*100
    }
    if (yUnit == '%') {
        position.top = parseFloat(position.top) / this.getHeight(elem.parentNode || this.parent)*100
    }

    jQuery(elem).css({top: `${position.top}${yUnit}`, left: `${position.left}${xUnit}`});
    this.emit(ACTIONS.setPosition, {
        id: elem.id, 
        position: position,
        callerId: callerId
    });
}

/* Returned position is always absolute and without account for transforms */
Container.prototype.getPosition = function(id) {
    let node = Container.lookup(id)
    let p = findAbsPos(node)

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

/* dx and dy are always in pixels */
Container.prototype.move = function(id, dx, dy, callerId) {
    let pos = this.getPosition(id)
    pos.top += dy;
    pos.left += dx;
    this.setPosition(id, pos, callerId)
}