import { Container, ACTIONS } from "./Container.js"
import { ContainerOperationNotApplicable } from "./ContainerExcepitons.js"
import { inferUnit, convert, convertToStandard, SUPPORTED_MEASURING_UNITS } from "./UnitConverter.js"

const NOT_SIZEABLE = new Set(['auto'])

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

//<size>
//contextualise width and height based on type of element and wrapping
//[DOC] width is always expressed in pixels. If a unitOverride is provided, a conversion from pixels to the provided unit will be carried out before setting the result.
Container.prototype.setWidth = function(id, width, callerId, emit) {
    let elem = this.lookup(id)
    let unit = elem.dataset.widthUnit || 'px'
    if (NOT_SIZEABLE.has(unit)) {
        throw new ContainerOperationNotApplicable(id, 'setWidth')
    }

    if (this.camera) {
        let translated = this.camera.zoomTranslate(width, 0)
        width = translated.x
    }

    if (unit !== 'px') {
        width = convertPixelWidth(this, elem, width, unit)    
    }

    this.setExplicitWidth(elem, width, unit, callerId, emit)        
}

Container.prototype.setExplicitWidth = function(elem, width, unit, callerId, emit) {
    this.isOperationAllowed(ACTIONS.setWidth, elem, callerId);
    let prevWidth = this.getWidth(elem);
    
    if (unit == 'auto') {
        width = ''
    }
    this.setUnit(elem, 'widthUnit', unit)
    jQuery(elem).css({width: `${width}${unit}`});
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

    if (this.camera) {
        let translated = this.camera.zoomTranslate(0, height)
        height = translated.y
    }

    if (unit !== 'px') {
        height = convertPixelHeight(this, elem, height, unit)    
    }

    this.setExplicitHeight(elem, height, unit, callerId, emit)
}

Container.prototype.setExplicitHeight = function(elem, height, unit, callerId, emit) {
    this.isOperationAllowed(ACTIONS.setHeight, elem, callerId);
    
    let prevHeight = this.getHeight(elem);
    if (unit == 'auto') {
        height = ''
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
    let result = this.getPosition(node)
    let positionTypes = new Set([])
    let widthTypes = new Set([])
    let heightTypes = new Set([])

    result.bottom = 0
    result.right = 0

    for (const child of node.children) {
        let bbox = this.getBoundingBox(child)
        if (result.right < bbox.right) {
            result.right = bbox.right
        }
        if (result.bottom < bbox.bottom) {
            result.bottom = bbox.bottom
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

function decideFittingAction(units) {
    //TODO: implement
}

//[TODO][WARNING]Highly experimental!
Container.prototype.fitVisibleContent = function(id, expandOnly = false, callerId, emit) {
    let node = this.lookup(id)
    let computedStyle = window.getComputedStyle(node, null)
    let paddingRight = 0;//convertToStandard(computedStyle.getPropertyValue("padding-right"))
    let paddingBottom = 0;//convertToStandard(computedStyle.getPropertyValue("padding-bottom"))
    
    let w = node.scrollWidth + paddingRight
    let h = node.scrollHeight + paddingBottom

    let oldW = this.getWidth(node)
    let oldH = this.getHeight(node)

    let contentBbox = this.getContentBoundingBox(node)
    if (expandOnly) {
        if (oldW < node.scrollWidth) {
            this.setWidth(node, w, callerId)    
        }
    } else {
        this.setWidth(node, contentBbox.right + paddingRight, callerId)
    }

    if (expandOnly) {
        if (oldH < node.scrollHeight) {
            this.setHeight(node, h, callerId)
        }
    } else {
        this.setHeight(node, contentBbox.bottom + paddingBottom, callerId)
    }
}