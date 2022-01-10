/**
 * Clipboard Module
 * @module Clipboard
 */

import { container } from "../../nodeshow.js"
import { InputAccessManagerInstance as InputAccessManager } from "./InputAccessManager.mjs"
import { InputManager } from "../utils/InputManager.js"

let appId = null; //Temporary, think this up

export const EVENTS = {
	'copy':'container.copy',
	'paste':'container.paste',
	'cut':'container.cut'
}

function copy(e) {
	container.emit('container.copy', {originalEvent:e});
}

function paste(e) {
	container.emit('container.paste', {originalEvent:e});
}

function cut(e) {
	container.emit('container.cut', {originalEvent:e});	
}

document.addEventListener('copy', copy)
document.addEventListener('paste', paste)
document.addEventListener('cut', cut)
 
let Manager = new InputManager(InputAccessManager, EVENTS);

/** @class
 *  @summary Component implementing consistent and managed access to mouse input. 
 *  @description TODO
 * */
export class Clipboard {
	#appId = null
	#handlers = {}
	#mmanager = Manager
	
	constructor(appId, container) {
		console.log(`NEW Clipboard handler instance created for ${appId}`)
		this.#appId = appId
	}

	getId() {
		return this.#appId
	}

	getEvents() {
		let result = {}
		for ( const [key, value] of Object.entries(this.#handlers) ) {
			result[key] = value
		}
		return result
	}

	enable() {
		this.#mmanager.register(this)
	}

	disable() {
		this.#mmanager.unregister(this)
	}

	setAction(event, callback, accessReq) {
		this.#handlers[event] = {
			callback:callback,
			access: accessReq
		}
	}
}

export { Manager as ClipboardManager }