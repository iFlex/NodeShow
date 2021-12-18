import { ACTIONS } from "../../Container.js"
import { container } from "../../nodeshow.js"

export function getSelection() {
	let selectorApp = container.getComponent('container.select')
	let selection = selectorApp.getSelection() || []

	return selection
}

export function findActionableAnchestor(target, appId) {
	if (!target) {
		return null;
	}
	
	try {
		//ToDo: this shouldn't live here?...
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
		return findActionableAnchestor(target.parentNode)
	}
}