import {container} from '../../nodeshow.js'

//BUG: when mouse goes out of target, moveing or sizing stops... it needs to keep happening until mouse up (release)
class ContainerMover {
	container = null;
	appId = "container.edit.pos"

	movable = "div, img, svg"
	mouseEvents = ['mouseup','mousedown','mousemove']
	touchEvents = ['touchstart','touchend', 'touchcancel', 'touchmove']
	
	#presenveRatio = false
	#mode = 'move' //or size
	
	target = null;
	selection = null;

	lastX = 0;
	lastY = 0;

	constructor (ngps) {
		this.container = ngps;
		this.#mode = 'move'

		ngps.registerComponent(this);
	}

	enable() {
		this.attachListeners(this.movable)
		$('*').on('dragstart', function(event) { event.preventDefault(); });

		document.addEventListener('container.create', e => {
			console.log(`editor has now toy ${e.detail.id}`)
			this.attachListeners("#" + e.detail.id)
		});
		//checking shift and ctrl
		document.addEventListener("keydown", (e) => this.handleKeydown(e))
		document.addEventListener("keyup",(e) => this.handleKeyUp(e))
		document.addEventListener("mouseout", (e) => this.handleLoseFocus(e))
	}

	attachListeners(target) {
		for (const event of this.mouseEvents) {
			$(target).on(event, e => this.handleMouseEvent(e))
		}
		for (const event of this.touchEvents) {
			$(target).on(event, e => this.handleTouchEvent(e));
		}
		$(target).addClass("editable");
	}

	detachListeners(target) {
		for (const event of this.mouseEvents) {
			$(target).off(event, e => this.handleMouseEvent(e))
		}
		
		for (const event of this.touchEvents) {
			$(target).off(event, e => this.handleTouchEvent(e));
		}
		$(target).removeClass("editable");
	}

	//ToDo: the container.created event listener could attach listeners to dom children types that may then not be detached in this call, plz fix
	disable() {
		this.detachListeners(this.movable)
		document.removeEventListener('container.create', e => this.attachListeners(e));
		//checking shift and ctrl
		document.removeEventListener("keydown", (e) => this.handleKeydown(e))
		document.removeEventListener("keyup",(e) => this.handleKeyUp(e))
		document.removeEventListener("mouseout", (e) => this.handleLoseFocus(e))
	}

	considerScale(id, dx, dy) {

	}

	//ToDo: consider dragging form all corners
	keepRatio (id, w, h, dx, dy) {
		let sign = 1
		let dist = Math.sqrt((dx*dx) + (dy*dy))
		let ratio = w/h; 
		
		if (Math.abs(dx) > Math.abs(dy)) {
			if (dx < 0) {
				sign = -1
			}
		} else {
			if (dy < 0) {
				sign = -1
			}
		}
		//ToDo: figure out sign	
		if (dx < 0 && dy < 0) {
			sign = -1
		}
		
		return {dx:(sign * ratio * dist), dy:(sign * dist)}
	}

	//ToDo: consider scale
	modifyContainer(dx, dy) {
		if (this.#mode == 'size') {
			let w = this.container.getWidth(this.target.id)
			let h = this.container.getHeight(this.target.id)
			if (this.#presenveRatio) {
				let change = this.keepRatio(this.target.id, w, h, dx, dy)
				dx = change.dx;
				dy = change.dy;
			}
			this.container.setWidth(this.target.id, w + dx);
			this.container.setHeight(this.target.id, h + dy);
		} else {
			console.log(`Moving by dx:${dx} dy:${dy}`)
			console.log(this.container.getPosition(this.target.id))
			this.container.move(this.target.id, dx, dy)
		} 
	}

	handleMouseEvent(event) {
		let eventType = event.type;
		try {
			this.container.isOperationAllowed('container.edit', event.target, this.appId)
		} catch(e) {
			return;
		}
		
		if (eventType == 'mousedown' || eventType == 'touchstart') {

			this.target = event.target;
			this.selection = event.target;

			this.container.appEmit(this.appId,'selected',{id:this.target.id, originalEvent: event.originalEvent});
		}
		else if (eventType == 'mouseup' || eventType == 'touchend' || eventType == 'touchcancel') {
			this.target = null;//ToDo: smaller ratio preserving change amount
		}
		else if (this.target) {
			let dx = event.originalEvent.screenX - this.lastX;
			let dy = event.originalEvent.screenY - this.lastY;
			
			this.modifyContainer(dx, dy)
			
			if(dx != 0 || dy != 0) {
				this.selection = null;
				this.container.appEmit(this.appId,'unselected',{id:this.target.id, originalEvent: event.originalEvent});
			}
		}
		
		this.lastX = event.originalEvent.screenX;
		this.lastY = event.originalEvent.screenY;
	}

	handleTouchEvent(event) {
		if (event.type in ['touchend', 'touchcancel']) {
			this.handleMouseEvent(event)
		} else {
			let touch = event.touches[0]
			let evt = {
				type: event.type,
				pageX: touch.pageX,
				pageY: touch.pageY,
				originalEvent: {
					screenX: touch.screenX,
					screenY: touch.screenY
				},
				target: event.target
			}

			this.handleMouseEvent(evt)
		}
	}

	getClickedContainer() {
		return this.selection;
	}

	handleKeydown(e) {
		let key = e.key
		if (key == 'Control') {
			this.#mode = 'size';
		}
		if (key == 'Shift') {
			this.#presenveRatio = true;
		}
	}

	handleKeyUp(e) {
		let key = e.key
		if (key == 'Control') {
			this.#mode = 'move';
		}
		if (key == 'Shift') {
			this.#presenveRatio = false;
		}
	}

	handleLoseFocus(e) {		
		e = e ? e : window.event;
        var from = e.relatedTarget || e.toElement;
        if (!from || from.nodeName == "HTML") {
            this.target = null;
        }
	}
}

let cmover = new ContainerMover(container);
cmover.enable()