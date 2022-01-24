import {Container, ACTIONS} from "./Container.js"


Container.prototype.getCamera = function(camId) {
	return this.getMetadata(camId, 'camera')
}

Container.prototype.registerCamera = function(node, camera, callerId) {
	if (node === this.parent || node === document.documentElement) {
		this.camera = camera
	}

	let camdetails = camera.toString()
	this.setMetadata(node.id, 'camera', camdetails)
	node.dataset.camera = JSON.stringify(camdetails)
}

Container.prototype.makeCamera = function(viewPortId, contentSurfaceId, options, callerId) {
	let viewPortNode = this.lookup(viewPortId)
	if (!contentSurfaceId) {
		contentSurfaceId = viewPortNode
	}
	let contentSurfaceNode = this.lookup(contentSurfaceId)

	let camera = new Camera(this, viewPortNode, contentSurfaceNode, options);
	this.registerCamera(viewPortNode, camera, callerId)
	return camera
}

Container.registerPostSetterHook('create', function(parentId, node) {
	if (node.dataset.camera) {
		this.makeCamera(node, null, JSON.parse(node.dataset.camera))
	}
})

//[TODO]: clearly define options and parameters and standardise
/*
options: {
	speed: duration in seconds
	targetOriginX:, 
	targetOriginY:,
	camOriginX:,
	camOriginY:,
	function: transition method name
}
*/
export class Camera {
	#container = null
	#viewPort = null
	#contentSurface = null
	#options = null

	//[TODO]: reconsider
	#zoomLevel = 1.0

	constructor(container, viewPort, contentSurface, options) {
		this.#container = container
		this.#viewPort = viewPort
		this.#contentSurface = contentSurface
		this.#options = options
	}

	toString() {
		return JSON.stringify(this.#options)
	}

	focusOn(id, options = {}) {
		let pos = this.#container.getPosition(id)
		pos.left += this.#container.getWidth(id) * (options.targetOriginX || 0.5)
		pos.top += this.#container.getHeight(id) * (options.targetOriginY || 0.5)

		let viewPortTop = this.#viewPort.scrollTop
		let viewPortLeft = this.#viewPort.scrollLeft

		this.setPosition(pos.left, pos.top, options)
	}

	pan() {

	}

	move(dx, dy, options = {speed:0}) {
		$(this.#viewPort).animate({
			scrollTop: this.#viewPort.scrollTop + dy,
			scrollLeft: this.#viewPort.scrollLeft + dx
		}, options.speed)
	}

	setPosition(x, y, options = {speed:0}) {
		let viewPortW = this.#container.getWidth(this.#viewPort)
		let viewPortH = this.#container.getHeight(this.#viewPort)
		
		$(this.#viewPort).animate({
			scrollTop: y - (viewPortH * (options.camOriginY || 0.5)),
			scrollLeft: x - (viewPortW * (options.camOriginX || 0.5))
		}, options.speed)
	}

	zoomTo (level, options = {speed:0}) {
		this.#zoomLevel = level
		this.#contentSurface.style.transform = `scale(${level})`
		this.#contentSurface.style.transformOrigin = `${options.ox || "50%"} ${options.oy || "50%"}`
		this.#contentSurface.style.transitionDuration = `${options.speed}s`
		this.#contentSurface.style.transitionFunction= options.function || 'linear'
	}

	zoom (delta, options = {speed:0}) {
		this.#zoomLevel += delta
		this.zoomTo(this.#zoomLevel, options)
	}

	getZoomLevel () {
		return this.#zoomLevel
	}

	getPosition() {
		return {
			top:this.#viewPort.scrollTop,
			left:this.#viewPort.scrollLeft
		}
	}
}
