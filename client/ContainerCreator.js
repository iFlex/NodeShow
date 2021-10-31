class ContainerCreator {
	appId = 'container.create.delete'
	container = null;
	target = null;

	constructor (container) {
		this.container = container;
		container.registerComponent(this.appId, this);
	}

	enable() {
		document.addEventListener('keydown',(e) => this.handleKeyPress(e))
		
	    document.addEventListener('container.edit.pos.selected', e => this.target = this.container.lookup(e.detail.id));
		document.addEventListener('container.edit.pos.unselected', (e) => this.target = null);
	}

	disable() {
		document.removeEventListener('keydown',(e) => this.handleKeyPress(e))
		document.removeEventListener('container.edit.pos.selected', e => this.target = this.container.lookup(e.detail.id));
		document.removeEventListener('container.edit.pos.unselected', (e) => this.target = null);
	}

	delete () {
		console.log("Deleting current target");
		console.log(this.target);

		if(this.target) {
			this.container.delete(this.target.id);
		}
		this.target = null;
	}

	create () {
		console.log("Creating child");

		if (!this.target) {
			this.target = this.container.parent
		}
		//clone last child
		let lastChild = this.container.parent.lastChild;
		if (lastChild) {
			let newNode = lastChild.cloneNode();
			this.container.addDomChild(this.target.id, newNode)
			return;
		} else {
			console.log("No children");
		}
	}

	handleKeyPress(e) {
		if (e.key == 'Delete') {
			this.delete();
		}
		if (e.key == '+') {
			this.create();
		}
	}
}