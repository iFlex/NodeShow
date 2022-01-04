import { ACTIONS } from "../../Container.js"

//[TODO]: remove dependency on nodeshow.js
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