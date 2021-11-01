class ContainerMover {
	container = null;
	appId = "container.edit.pos"

	movable = "div, img, svg"
	mouseEvents = ['mouseup','mousedown','mousemove']
	touchEvents = ['touchstart','touchend', 'touchcancel', 'touchmove']

	target = null;
	selection = null;

	lastX = 0;
	lastY = 0;

	constructor (ngps) {
		this.container = ngps;
		ngps.registerComponent(this.appId, this);
	}

	enable() {
		for (const event of this.mouseEvents) {
			$(this.movable).on(event, e => this.handleMouseEvent(e))
		}
		for (const event of this.touchEvents) {
			$(this.movable).on(event, e => this.handleTouchEvent(e));
		}
		
		$(this.movable).addClass("editable");
		$('*').on('dragstart', function(event) { event.preventDefault(); });
	}

	disable() {
		for (const event of this.mouseEvents) {
			$(this.movable).off(event, e => this.handleMouseEvent(e))
		}
		
		for (const event of this.touchEvents) {
			$(this.movable).off(event, e => this.handleTouchEvent(e));
		}
		
		$(this.movable).removeClass("editable");
	}

	handleMouseEvent(event) {
		let eventType = event.type;

		if (eventType == 'mousedown' || eventType == 'touchstart') {
			this.target = event.target;
			this.selection = event.target;

			this.container.appEmit(this.appId,'selected',{id:this.target.id});
		}
		else if (eventType == 'mouseup' || eventType == 'touchend' || eventType == 'touchcancel') {
			this.target = null;
		}
		else if (this.target) {
			let dx = event.originalEvent.screenX - this.lastX;
			let dy = event.originalEvent.screenY - this.lastY;
			
			this.container.move(this.target.id, dx, dy)
			
			if(dx != 0 || dy != 0) {
				this.selection = null;
				this.container.appEmit(this.appId,'unselected',{id:this.target.id});
			}
		}
		
		this.lastX = event.originalEvent.screenX;
		this.lastY = event.originalEvent.screenY;
	}

	handleTouchEvent(event) {
		handleMouseEvent(event)
	}

	getClickedContainer() {
		return this.selection;
	}
}

let cmover = new ContainerMover(container);
cmover.enable()