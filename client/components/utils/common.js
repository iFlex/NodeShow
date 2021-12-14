import { container } from "../../nodeshow.js"
import { Mouse } from '../utils/mouse.js'

let mouse = new Mouse('core')

export function getSelection() {
	let selectorApp = container.getComponent('container.select')
	let selection = selectorApp.getSelection() || []
	
	let focusTarget = mouse.getFocusTarget();
	if (focusTarget) {
		selection.push(focusTarget)
	}

	return selection
}