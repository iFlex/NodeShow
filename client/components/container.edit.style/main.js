class ContainerStyler {
	appId = 'container.edit.style'
	container = null;
	#enabled = false
	constructor (container) {
		this.container = container;
		container.registerComponent(this);
	}
}

let cstyler = new ContainerStyler(container);
cstyler.enable()