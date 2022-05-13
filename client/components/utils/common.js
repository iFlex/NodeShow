import { ACTIONS } from "../../Container.js"

export function clearSelection(container) {
	let selectorApp = container.getComponent('container.select')
	if (selectorApp) {
		selectorApp.clearSelection();
	}
}

export function makeSelection(container, items) {
	let selectorApp = container.getComponent('container.select')
	if (selectorApp) {
		selectorApp.makeSelection(items)
	}
}

export function getSelection(container) {
	let selectorApp = container.getComponent('container.select')
	if (!selectorApp) {
		return []
	}

	return selectorApp.getSelection() || []
}

//TODO get rid of this
export function findActionableAnchestor(container, target, appId) {
	if (!target) {
		return null;
	}
	
	try {
		container.isOperationAllowed('container.edit', target, appId)
		container.isOperationAllowed('container.edit.pos', target, appId)
	} catch(e) {
		console.log(e)
		return null;
	}

	//ToDo: figure out how to get rid of this shitty coupling... (local permissions would be a nice solution)
	//this should be solved with a local permission. deny cascading to everyone while editing text
	if (container.getMetadata(target, 'text-editing')) {
		return null;
	}
	
	try {
		container.isOperationAllowed(ACTIONS.setPosition, target, appId)
		return target
	} catch (e) {
		if (target === container.parent) {
			return null;
		}
		return findActionableAnchestor(container, target.parentNode, appId)
	}
}

//TODO: use just for drag event
export function findDraggableAncestor(container, target, appId) {
	if (!target) {
		return null;
	}

	//ToDo: figure out how to get rid of this shitty coupling... (local permissions would be a nice solution)
	if (container.getMetadata(target, 'text-editing')) {
		return null;
	}
	
	if (!container.canPosition(target)) {
		return findDraggableAncestor(container, target.parentNode, appId)
	}
	try {
		container.isOperationAllowed(ACTIONS.setPosition, target, appId)
		return target
	} catch (e) {
		if (target === container.parent) {
			return null;
		}
		return findDraggableAncestor(container, target.parentNode, appId)
	}
}

export function findClickableAncestor(container, target, appId) {
	//TODO
}

export function lookupStyleRules(className) {
	className = `.${className}`
	var styleDirectives = [];
	for (var i = 0 ; i < document.styleSheets.length; ++i) {
		let classes = document.styleSheets[i].cssRules
		for (var x = 0; x < classes.length; x++) {    
			if (classes[x].selectorText == className) {
				styleDirectives.push(classes[x].style)
			}         
		}
	}

	var result = {}
	for (const directive of styleDirectives) {
		for(let  i = 0 ; i < directive.length; ++i) {
			let name = directive.item(i)
			let value = directive.getPropertyValue(name)
			result[name] = value
		}
	}
	return result;
}

export function findCommonStyleSubset(container, selection = []) {
	if (selection.length == 0 || selection.size == 0) {
		return {};
	}
	let result = null
	for (const item of selection) {
		let style = container.toSerializableStyle(item)
		if (!result) {
			result = style
		} else {
			for (const [key, value] of Object.entries(style)) {
			
				if (!result[key] || result[key] !== value) {
					delete result[key]
				}
	
				if (Object.keys(result).length == 0) {
					break;
				}
			}
		}
	}

	return result
}

export function getTranslatedCursorPosition(x, y, container) {
	let rootPos = container.localToGlobalPosition(container.parent, x, y)
	let position = {x:rootPos.left, y:rootPos.top} 
	
	if (container.camera) {
		return container.camera.viewPortToSurface(position.x, position.y)
	}
	return position
}

//TEMPORARY & EXPERIMENTAL
export function positionVerticalMenu(container, interfNode, appId) {
	try {
		let w = container.getWidth(container.lookup('ns-orchestrator-menu-container'))
		container.setPosition(interfNode, {
			top:0,
			left: w
		}, appId)
	} catch(e) {
		//nevermind
	}
}