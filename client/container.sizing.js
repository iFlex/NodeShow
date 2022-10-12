import { Container, ACTIONS } from "./Container.js"
import { ContainerOperationNotApplicable } from "./ContainerExcepitons.js"
import { inferUnit, convert, convertToStandard, SUPPORTED_MEASURING_UNITS } from "./UnitConverter.js"

const NOT_SIZEABLE = new Set(['auto','inherit'])
const ASPECT_RATIO_LOCKED_KEY = "AspectRatioLocked"
/**
 * Warning: the sizing code isn't completely stable. It is currently failing the test of e.setWidth(e.getWidth()) 
 * where the dimension of the obejct should not change
*/

function readAsPixels(stringValue) {
    if (stringValue.endsWith('px')) {
        return parseFloat(stringValue.substring(0, stringValue.length - 2))
    }

    console.error(`Failed to read string value ${stringValue} as pixels`)
    return 0;
}

function getPercentage(total, fraction) {
    return fraction/total*100
}

function convertPixelHeight(container, node, height, unit) {
    if (unit == '%') {
        if (!node.parentNode) {
            throw `Cannot convert to % height for a container with no parentNode`
        }
        return getPercentage(container.getHeight(node.parentNode), height)
    } else {
        return convert(height, 'px', unit)
    }
}

function convertPixelWidth(container, node, width, unit) {
    if (unit == '%') {
        if (!node.parentNode) {
            throw `Cannot convert to % width for a container with no parentNode`
        }
        return getPercentage(container.getWidth(node.parentNode), width)
    } else {
        return convert(width, 'px', unit)
    }
}

Container.prototype.convertPixelPos = function(node, pos, units) {
    let result = {
        top:0,
        left:0
    }

    if (units.top == '%' || units.left == '%') {
        if (!node.parentNode) {
            throw `Cannot convert to % position for a container with no parentNode`
        }
    }

    if (units.top == '%') {
        result.top = getPercentage(this.getHeight(node.parentNode), pos.top)    
    } else {
        result.top = convert(pos.top, 'px', units.top)
    }
    
    if (units.left == '%') {
        result.left = getPercentage(this.getWidth(node.parentNode), pos.left)
    } else {
        result.left = convert(pos.left, 'px', units.left)
    } 
    return result
}

Container.prototype.getAspectRatio = function(id) {
    let node = this.lookup(id)
    return this.getWidth(node) / this.getHeight(node)
}

Container.prototype.isAspectRationLocked = function(id) {
    try {
        let node = this.lookup(id)
        return node.dataset[ASPECT_RATIO_LOCKED_KEY] != null
    } catch(e) {
        return false;
    }
}

Container.prototype.lockAspectRatio = function(id, callerId) {
    let node = this.lookup(id)
    node.dataset[ASPECT_RATIO_LOCKED_KEY] = "true"
    this.notifyUpdate(id, callerId)
}

Container.prototype.unlockAspectRatio = function(id, callerId) {
    let node = this.lookup(id)
    delete node.dataset[ASPECT_RATIO_LOCKED_KEY]
    this.notifyUpdate(id, callerId)
}

Container.prototype.getUnit = function(id, property) {
    let elem = this.lookup(id)
    return elem.dataset[property]
}

Container.prototype.setWidthUnit = function(id, unit, callerId) {
    this.setUnit(id, "widthUnit", unit)
    let measurement = this.getWidth(id)
    this.setWidth(id, measurement, callerId)
}

Container.prototype.setHeightUnit = function(id, unit, callerId) {
    this.setUnit(id, "heightUnit", unit)
    let measurement = this.getHeight(id)
    this.setHeight(id, measurement, callerId)
}

Container.prototype.adjustWidthToBoxMode = function (node, value){
    let computedStyle = this.getComputedStyle(node)
    if (computedStyle["box-sizing"] != "border-box") {
        return value
    }

    let paddingRight = convertToStandard(computedStyle["padding-right"])
    let paddingLeft = convertToStandard(computedStyle["padding-left"])
    let bleft = convertToStandard(computedStyle['border-left-width'])
    let bright = convertToStandard(computedStyle['border-right-width'])
    
    return value + paddingLeft + paddingRight + bleft + bright
}

Container.prototype.adjustHeightToBoxMode = function(node, value) {
    let computedStyle = this.getComputedStyle(node)
    if (computedStyle["box-sizing"] != "border-box") {
        return value
    }

    let paddingBottom = convertToStandard(computedStyle["padding-bottom"])
    let paddingTop = convertToStandard(computedStyle["padding-top"])
    let btop = convertToStandard(computedStyle['border-top-width'])
    let bbottom = convertToStandard(computedStyle['border-bottom-width'])

    return value + paddingTop + paddingBottom + btop + bbottom
}

//<size>
//contextualise width and height based on type of element and wrapping
//[DOC] width is always expressed in pixels. If a unitOverride is provided, a conversion from pixels to the provided unit will be carried out before setting the result.
/*
... Frigging hell... can this be any more situational... https://developer.mozilla.org/en-US/docs/Web/CSS/width
*/
Container.prototype.setWidth = function(id, width, callerId, emit) {
    let elem = this.lookup(id)
    let unit = elem.dataset.widthUnit || 'px'
    if (NOT_SIZEABLE.has(unit)) {
        throw new ContainerOperationNotApplicable(id, 'setWidth')
    }

    width = this.adjustWidthToBoxMode(elem, width)
    if (unit !== 'px') {
        width = convertPixelWidth(this, elem, width, unit)    
    }

    this.setExplicitWidth(elem, width, unit, callerId, emit)
}

Container.prototype.setExplicitWidth = function(elem, width, unit, callerId, emit, adjustRatio = true) {
    this.isOperationAllowed(ACTIONS.setWidth, elem, callerId);
    let prevWidth = this.getWidth(elem);
    
    if (unit == 'auto' || unit == 'inherit') {
        width = ''
    } else if (elem.dataset[ASPECT_RATIO_LOCKED_KEY] && adjustRatio) {
        let ratio = this.getAspectRatio(elem)
        this.setExplicitHeight(elem, width/ratio, unit, callerId, emit, false);
    }
    this.setUnit(elem, 'widthUnit', unit)
    //jQuery(elem).css({width: `${width}${unit}`});
    elem.style.width = `${width}${unit}`

    if (emit != false) {
        this.emit(ACTIONS.setWidth, {
            id: elem.id, 
            width: width, 
            prevWidth: prevWidth,
            callerId: callerId
        });
    }
}

Container.prototype.setUnit = function(id, property, unit) {
    if (!unit) {
        return;
    }

    let elem = this.lookup(id)
    if (!SUPPORTED_MEASURING_UNITS.has(unit)) {
        throw `Unsupported measuring unit ${unit}`
    }
    elem.dataset[property] = unit
}

Container.prototype.setHeight = function(id, height, callerId, emit) {
    let elem = this.lookup(id);
    let unit = elem.dataset.heightUnit || 'px'
    if (NOT_SIZEABLE.has(unit)) {
        throw new ContainerOperationNotApplicable(id, 'setHeight')
    }
    
    height = this.adjustHeightToBoxMode(elem, height)
    if (unit !== 'px') {
        height = convertPixelHeight(this, elem, height, unit)    
    }

    this.setExplicitHeight(elem, height, unit, callerId, emit)
}

Container.prototype.setExplicitHeight = function(elem, height, unit, callerId, emit, adjustRatio = true) {
    this.isOperationAllowed(ACTIONS.setHeight, elem, callerId);
    
    let prevHeight = this.getHeight(elem);
    if (unit == 'auto' || unit == 'inherit') {
        height = ''
    } else if (elem.dataset[ASPECT_RATIO_LOCKED_KEY] && adjustRatio) {
        let ratio = this.getAspectRatio(elem)
        this.setExplicitWidth(elem, height*ratio, unit, callerId, emit, false);
    }

    this.setUnit(elem, 'heightUnit', unit)
    jQuery(elem).css({height: `${height}${unit}`});
    if (emit != false) {
        this.emit(ACTIONS.setHeight, {
            id: elem.id, 
            height: height, 
            prevHeight: prevHeight,
            callerId: callerId
        });
    }
}

/*
https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect
w + pading + border-width
*/
Container.prototype.getWidth = function(id, withMargin = false) {
    let node = this.lookup(id)
    let rect = node.getBoundingClientRect()
    
    if (withMargin) {
        //return jQuery(this.lookup(id)).outerWidth()    
        return rect.width
    }

    let style = window.getComputedStyle(node, null)
    let pleft = readAsPixels(style.getPropertyValue('padding-left'))
    let pright = readAsPixels(style.getPropertyValue('padding-right'))
    let bleft = readAsPixels(style.getPropertyValue('border-left-width'))
    let bright = readAsPixels(style.getPropertyValue('border-right-width'))
    return rect.width - pleft - pright - bleft - bright;
}

Container.prototype.getHeight = function(id, withMargin = false) {
    let node = this.lookup(id)
    let rect = node.getBoundingClientRect()
    
    if (withMargin) {
        //return jQuery(this.lookup(id)).outerHeight()
        return rect.height
    }
    
    let style = window.getComputedStyle(node, null)
    let pleft = readAsPixels(style.getPropertyValue('padding-top'))
    let pright = readAsPixels(style.getPropertyValue('padding-bottom'))
    let bleft = readAsPixels(style.getPropertyValue('border-top-width'))
    let bright = readAsPixels(style.getPropertyValue('border-bottom-width'))
    return rect.height - pleft - pright - bleft - bright;
}

Container.prototype.getContentHeight = function(id) {
    return this.lookup(id).scrollHeight
}

Container.prototype.getContentWidth = function(id) {
    return this.lookup(id).scrollWidth
}
//</size>

//get bounding box in absolute coordinates
//wonder if the browser is willing to give this up... rather than having to compute it in JS
Container.prototype.getContentBoundingBox = function(id) {
    let node = this.lookup(id)
    let containerPos = this.getPosition(node)
    let positionTypes = new Set([])
    let widthTypes = new Set([])
    let heightTypes = new Set([])
    let result = {
        containerPosition: containerPos,
        top: containerPos.top,
        left: containerPos.left,
        bottom: 0,
        right: 0,
    }

    let visibleChildren = this.getVisibleChildren(node)
    for (const child of visibleChildren) {
        let bbox = this.getBoundingBox(child)
        if (result.right < bbox.right) {
            result.right = bbox.right
        }
        if (result.bottom < bbox.bottom) {
            result.bottom = bbox.bottom
        }
        if (result.left > bbox.left) {
            result.left = bbox.left
        }
        if (result.top > bbox.top) {
            result.top = bbox.top
        }

        positionTypes.add(child.style.position || "static")
        widthTypes.add(inferUnit(child.style.width) || "auto")
        heightTypes.add(inferUnit(child.style.height) || "auto")
    }

    result.positionTypes = positionTypes
    result.heightTypes = heightTypes
    result.widthTypes = widthTypes
    return result;
}

Container.prototype.getBoundingBox = function(id) {
    let bbox = this.getPosition(id)
    bbox.right = bbox.left + this.getWidth(id, true)
    bbox.bottom = bbox.top + this.getHeight(id, true)
    return bbox;
}

//[TODO][WARNING]Highly experimental!
/*
The scrollWidth value is equal to the minimum width the element would require in order to fit all the content in the viewport 
without using a horizontal scrollbar. 
he width is measured in the same way as clientWidth: 
it includes the element's padding, but not its border, margin or vertical scrollbar (if present)
w + p
*/
Container.prototype.fitVisibleContent = function(id, contract = false, callerId, emit) {
    let node = this.lookup(id)
    let computedStyle = window.getComputedStyle(node, null)

    let mRight = convertToStandard(computedStyle.getPropertyValue("margin-right"))
    //let mLeft = convertToStandard(computedStyle.getPropertyValue("margin-left"))
    let mBottom = convertToStandard(computedStyle.getPropertyValue("margin-bottom"))
    //let mTop = convertToStandard(computedStyle.getPropertyValue("margin-top"))

    let paddingRight = convertToStandard(computedStyle.getPropertyValue("padding-right"))
    let paddingLeft = convertToStandard(computedStyle.getPropertyValue("padding-left"))
    let paddingBottom = convertToStandard(computedStyle.getPropertyValue("padding-bottom"))
    let paddingTop = convertToStandard(computedStyle.getPropertyValue("padding-top"))
    let bleft = convertToStandard(computedStyle.getPropertyValue('border-left-width'))
    let bright = convertToStandard(computedStyle.getPropertyValue('border-right-width'))
    let btop = convertToStandard(computedStyle.getPropertyValue('border-top-width'))
    let bbottom = convertToStandard(computedStyle.getPropertyValue('border-bottom-width'))

    let w = node.scrollWidth + bleft + bright - paddingLeft - paddingRight - mRight
    let h = node.scrollHeight + btop + bbottom - paddingTop - paddingBottom - mBottom
    let oldW = this.getWidth(node)
    let oldH = this.getHeight(node)
    let contentBbox = null

    if (w > oldW) {
        this.setWidth(node, w, callerId, emit)
    } else if(contract) {
        contentBbox = contentBbox || this.getContentBoundingBox(node)
        this.setWidth(node, contentBbox.right - contentBbox.left, callerId, emit)
    }
    
    if (h > oldH) {
        this.setHeight(node, h, callerId, emit)
    } else if (contract) {
        contentBbox = contentBbox || this.getContentBoundingBox(node)
        this.setHeight(node, contentBbox.bottom - contentBbox.top, callerId, emit)
    }
}