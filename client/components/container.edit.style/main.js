class ContainerStyler {
	appId = 'container.edit.style'
	container = null;
	
	constructor (container) {
		this.container = container;
		container.registerComponent(this);
	}
}

let cstyler = new ContainerStyler(container);
cstyler.enable()